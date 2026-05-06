"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getQuestionsForStage } from "../data/mockQuestions";
import type { GameQuestion, QuestionLevel } from "../types/gameQuestion";
import { fetchMathflatProblems, fetchMultipleConcepts } from "../lib/fetchMathflatProblems";
import type { CmsFetchResult, ConceptConfig } from "../lib/fetchMathflatProblems";
import { checkAnswerResult, getStarCount, normalizeAnswer } from "../lib/gameEngine";
import { playSound } from "../lib/sounds";
import type { SoundEffect } from "../lib/sounds";

// ─── constants ────────────────────────────────────────────────────────────────
const TOTAL_TIME     = 60;
const MONSTER_MAX_HP = 5;

// ─── CMS multi-concept configuration ─────────────────────────────────────────
/**
 * 테스트에 사용할 CMS conceptId 목록.
 * 추가하려면 배열에 항목을 넣고 CMS_BLOCKED_IDS_STATIC 에서 제거하세요.
 */
const CMS_CONCEPTS: ConceptConfig[] = [
  { id: 15553, title: "받아올림이 없는 (세 자리 수)+(세 자리 수)", unit: "덧셈" },
  { id: 15554, title: "실생활 문제 해결하기",                      unit: "덧셈 활용" },
  // { id: 15552, title: "여러 가지 방법으로 덧셈하기", unit: "덧셈" }, // SQL 오류로 비활성
];

/** 지속적으로 CMS 오류가 발생하는 conceptId — 로드하지 않고 건너뜁니다. */
const CMS_BLOCKED_IDS_STATIC = new Set([15552]);

/**
 * CMS 문제 난이도(1–5)별 게임 규칙.
 * - timeBonus: 세션 시작 시 TOTAL_TIME에 더해지는 보너스 초
 * - rewardMult: 정답 시 코인·점수에 곱해지는 배율
 * - questionCount: 이 난이도 문제를 풀면 스테이지 클리어되는 정답 수
 */
const CMS_DIFFICULTY_RULES: Record<number, { timeBonus: number; rewardMult: number; questionCount: number }> = {
  1: { timeBonus: -30, rewardMult: 1.0, questionCount: 5 },
  2: { timeBonus: -20, rewardMult: 1.2, questionCount: 5 },
  3: { timeBonus: -5,  rewardMult: 1.5, questionCount: 4 },
  4: { timeBonus:  10, rewardMult: 2.0, questionCount: 3 },
  5: { timeBonus:  30, rewardMult: 3.0, questionCount: 2 },
};

// ─── game mode ────────────────────────────────────────────────────────────────
type GameMode = "battle" | "grow" | "puzzle";

/** Learning mode selected on the start screen. */
type LearningMode = "growth" | "challenge" | "review";

const GAME_MODE_META: Record<GameMode, { emoji: string; label: string; desc: string; grad: string }> = {
  battle: { emoji: "⚔️",  label: "전투",  desc: "몬스터를 물리쳐라!",    grad: "from-red-400 to-orange-400"   },
  grow:   { emoji: "🌱",  label: "성장",  desc: "문제 풀어 나무 키우기!", grad: "from-emerald-400 to-green-500" },
  puzzle: { emoji: "🧩",  label: "퍼즐",  desc: "조각을 맞춰 완성하자!",  grad: "from-violet-400 to-purple-500" },
};

/**
 * 지역 진입 시 모드별로 추가되는 제한 시간(초).
 * - grow : 시간 압박을 낮춰 훈련에 집중하게 한다.
 * - battle: 기본 (추가 없음)
 * - puzzle: 복습이므로 충분한 시간을 준다.
 */
const MODE_EXTRA_TIME: Record<GameMode, number> = { grow: 20, battle: 0, puzzle: 30 };

/**
 * 월드맵에서 현재 진입 중인 지역의 상태 텍스트.
 * 모드에 따라 "도전 중" 이 아닌 지역에 맞는 문구를 사용한다.
 */
const ZONE_STATUS_TEXT: Record<GameMode, string> = {
  grow:   "🌱 훈련 중",
  battle: "⚔️ 도전 중",
  puzzle: "🧩 복습 중",
};

// ─── World Selection / Region Map 데이터 ─────────────────────────────────────

/** 지역 선택 화면에서 보여줄 월드 카드 설정 */
type WorldCardConfig = {
  title:    string;
  subtitle: string;
  emoji:    string;
  bgCard:   string;   // 카드 배경 (다크)
  bgMap:    string;   // 지역 맵 배경 (밝음)
  border:   string;
  glow:     string;
  desc:     string;
  badge:    string;
};
const WORLD_CARDS: Record<GameMode, WorldCardConfig> = {
  grow: {
    title:    "숲의 성장 지역",
    subtitle: "성장형 세계",
    emoji:    "🌲",
    bgCard:   "linear-gradient(160deg,#052e16 0%,#064e3b 55%,#065f46 100%)",
    bgMap:    "linear-gradient(180deg,#bae6fd 0%,#bbf7d0 55%,#86efac 100%)",
    border:   "rgba(16,185,129,0.55)",
    glow:     "rgba(16,185,129,0.35)",
    desc:     "경험치를 쌓고 레벨을 올리는 훈련의 세계",
    badge:    "🌱 성장형",
  },
  battle: {
    title:    "불꽃의 협곡",
    subtitle: "전투형 세계",
    emoji:    "🌋",
    bgCard:   "linear-gradient(160deg,#1c0700 0%,#7c1d0a 55%,#b45309 100%)",
    bgMap:    "linear-gradient(180deg,#fed7aa 0%,#fde68a 50%,#fca5a5 100%)",
    border:   "rgba(220,38,38,0.55)",
    glow:     "rgba(220,38,38,0.35)",
    desc:     "몬스터와 싸워 승리하는 전투의 세계",
    badge:    "⚔️ 전투형",
  },
  puzzle: {
    title:    "지혜의 탑",
    subtitle: "퍼즐형 세계",
    emoji:    "🗼",
    bgCard:   "linear-gradient(160deg,#1e1b4b 0%,#312e81 55%,#2e1065 100%)",
    bgMap:    "linear-gradient(180deg,#c7d2fe 0%,#bfdbfe 50%,#ddd6fe 100%)",
    border:   "rgba(99,102,241,0.55)",
    glow:     "rgba(99,102,241,0.35)",
    desc:     "조각을 맞춰 기억을 복구하는 지혜의 세계",
    badge:    "🧩 퍼즐형",
  },
};

/** 각 지역 맵 안에서 표시할 노드 설정 */
type RegionNodeConfig = {
  id:          string;
  label:       string;
  subLabel:    string;
  emoji:       string;
  difficulty:  "easy" | "normal" | "hard";
  description: string;
};
const REGION_NODES: Record<GameMode, RegionNodeConfig[]> = {
  grow: [
    { id: "grow-easy",   label: "새싹 훈련",    subLabel: "TRAINING", emoji: "🌱", difficulty: "easy",   description: "천천히 시작해요!" },
    { id: "grow-normal", label: "성장의 나무",   subLabel: "GROWTH",   emoji: "🌳", difficulty: "normal", description: "꾸준히 성장해요!" },
    { id: "grow-hard",   label: "집중 수련",     subLabel: "LEVELUP",  emoji: "✨", difficulty: "hard",   description: "최고 수준 도전!" },
  ],
  battle: [
    { id: "battle-easy",   label: "슬라임",     subLabel: "ENEMY",  emoji: "👾", difficulty: "easy",   description: "약한 적부터 시작!" },
    { id: "battle-normal", label: "화산 전투",   subLabel: "COMBO",  emoji: "🔥", difficulty: "normal", description: "진짜 전투 시작!" },
    { id: "battle-hard",   label: "드래곤 보스", subLabel: "BOSS",   emoji: "🐉", difficulty: "hard",   description: "최강 보스 도전!" },
  ],
  puzzle: [
    { id: "puzzle-easy",   label: "기억 조각",  subLabel: "RESTORE", emoji: "🧩", difficulty: "easy",   description: "쉬운 조각 맞추기" },
    { id: "puzzle-normal", label: "오답 복원",   subLabel: "MEMORY",  emoji: "📖", difficulty: "normal", description: "기억을 되살려요!" },
    { id: "puzzle-hard",   label: "탑 복구",    subLabel: "PIECE",   emoji: "🏛", difficulty: "hard",   description: "완벽한 복구 도전!" },
  ],
};

// ─── review dungeon: weakness names ──────────────────────────────────────────
/** Maps a question's conceptName to a human-readable "weakness" label shown in review mode. */
const CONCEPT_WEAKNESS: Record<string, string> = {
  "두 자리 덧셈":  "덧셈 실수",
  "받아올림 덧셈": "받아올림 오류",
  "두 자리 뺄셈":  "뺄셈 실수",
};

function getWeaknessName(conceptName: string): string {
  return CONCEPT_WEAKNESS[conceptName] ?? `${conceptName} 오류`;
}

// ─── mode-aware game text ──────────────────────────────────────────────────────
const GAME_TEXT = {
  battle: {
    entryEmoji:      "⚔️",
    entryBanner:     "전투 시작!",
    waitingMsg:      (name: string) => `${name}이(가) 기다리고 있어요!`,
    attackBtn:       "⚔️ 공격!",
    wrongFeedback:   "🛡️ 반격!",
    critFeedback:    "⚡ 대박 공격!",
    comboFeedback:   (n: number) => `🔥 ${n}콤보 공격!`,
    clearTitle:      "스테이지 클리어!",
    clearSubtitle:   (name: string) => `${name} 처치 성공! 🎉`,
    nextTeaser:      (name: string) => `${name} 등장!`,
    nextBtn:         "다음 도전하기",
    resultHero:      (s: number) => s >= 300 ? "🌟 전설의 수학 영웅!" : s >= 150 ? "👏 훌륭한 퀘스트 클리어!" : "💪 다시 도전해봐요!",
  },
  grow: {
    entryEmoji:      "🌱",
    entryBanner:     "정원 가꾸기 시작!",
    waitingMsg:      (name: string) => `${name} 정원이 기다려요!`,
    attackBtn:       "🌱 물 주기!",
    wrongFeedback:   "🍂 시들었어요!",
    critFeedback:    "🌺 활짝 피었어요!",
    comboFeedback:   (n: number) => `🌸 ${n}번 연속 성장!`,
    clearTitle:      "정원 완성!",
    clearSubtitle:   (name: string) => `${name} 가득 피었어요! 🌸`,
    nextTeaser:      (name: string) => `새 씨앗: ${name}`,
    nextBtn:         "다음 정원 가꾸기",
    resultHero:      (s: number) => s >= 300 ? "🌟 마스터 정원사!" : s >= 150 ? "🌸 멋진 정원이에요!" : "🌱 계속 성장해봐요!",
  },
  puzzle: {
    entryEmoji:      "🧩",
    entryBanner:     "퍼즐 도전 시작!",
    waitingMsg:      (name: string) => `${name} 퍼즐이 기다려요!`,
    attackBtn:       "🧩 맞히기!",
    wrongFeedback:   "❌ 틀렸어요!",
    critFeedback:    "✨ 완벽 적중!",
    comboFeedback:   (n: number) => `🎯 ${n}개 연속 정답!`,
    clearTitle:      "퍼즐 완성!",
    clearSubtitle:   (name: string) => `${name} 퍼즐 클리어! 🧩`,
    nextTeaser:      (name: string) => `다음 퍼즐: ${name}`,
    nextBtn:         "다음 퍼즐 도전",
    resultHero:      (s: number) => s >= 300 ? "🧩 퍼즐 마스터!" : s >= 150 ? "🎯 훌륭한 풀이!" : "💪 다시 도전해봐요!",
  },
} as const;

// ─── grow mode: EXP / level-up skill system ───────────────────────────────────
const EXP_PER_LEVEL = 100; // EXP needed to level up

type GrowSkill = {
  id:    string;
  emoji: string;
  name:  string;
  desc:  string;
  kind:  "time" | "score" | "coin" | "exp" | "shield";
};

const GROW_SKILLS: GrowSkill[] = [
  { id: "tempo",   emoji: "⚡", name: "속도 향상",  desc: "제한시간 +8초",          kind: "time"   },
  { id: "power",   emoji: "💪", name: "집중력 강화", desc: "이번 스테이지 점수 1.5배", kind: "score"  },
  { id: "fortune", emoji: "💰", name: "행운",        desc: "코인 +25개",              kind: "coin"   },
  { id: "growth",  emoji: "📈", name: "성장 가속",   desc: "경험치 획득 1.5배",       kind: "exp"    },
  { id: "shield",  emoji: "🛡️", name: "보호막",      desc: "오답 1회 무효화",         kind: "shield" },
];

function pickLevelUpSkills(count = 3): GrowSkill[] {
  return [...GROW_SKILLS].sort(() => Math.random() - 0.5).slice(0, count);
}

// ─── CMS multi-concept question selection ─────────────────────────────────────
function shuffleArr<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

/**
 * 전체 CMS 문제 풀(pool)에서 게임 모드에 맞는 문제를 선택합니다.
 * - grow:   난이도 1~3 중심, 4는 약 20% 포함
 * - battle: 난이도 2~5 위주
 * - puzzle: 틀린 문제 우선, 없으면 pool 전체 사용
 *
 * @param pool         전체 CMS 문제 풀
 * @param mode         현재 게임 모드
 * @param wrongIds     틀린 문제 ID 집합 (puzzle 모드용)
 * @param maxCount     반환할 최대 문제 수
 */
function selectQuestionsForMode(
  pool:     GameQuestion[],
  mode:     GameMode,
  wrongIds: Set<number> = new Set(),
  maxCount  = 15,
): GameQuestion[] {
  if (pool.length === 0) return [];

  if (mode === "grow") {
    const easy   = pool.filter((q) => (q.difficulty ?? 1) <= 3);
    const hard4  = pool.filter((q) => (q.difficulty ?? 1) === 4 && Math.random() < 0.2);
    const result = shuffleArr([...easy, ...hard4]).slice(0, maxCount);
    // Guard: if mode filter removes everything, use the full CMS pool rather than returning empty
    return result.length > 0 ? result : shuffleArr(pool).slice(0, maxCount);
  }

  if (mode === "battle") {
    const challenging = pool.filter((q) => (q.difficulty ?? 1) >= 2);
    const base        = challenging.length >= 3 ? challenging : pool;
    return shuffleArr(base).slice(0, maxCount);
  }

  if (mode === "puzzle") {
    const wrong = pool.filter((q) => wrongIds.has(q.id));
    if (wrong.length >= 3) return shuffleArr(wrong).slice(0, maxCount);
    return shuffleArr(pool).slice(0, maxCount);
  }

  return shuffleArr(pool).slice(0, maxCount);
}

/**
 * 문제 풀의 중간 난이도를 계산합니다. 빈 풀이면 1을 반환합니다.
 */
function medianDifficulty(pool: GameQuestion[]): number {
  if (pool.length === 0) return 1;
  const sorted = [...pool].map((q) => q.difficulty ?? 1).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// ─── difficulty ───────────────────────────────────────────────────────────────
type Difficulty = "easy" | "normal" | "hard";

const DIFFICULTY_CONFIG = {
  easy: {
    label:     "쉬움",
    emoji:     "🌱",
    timeBonus: +10,
    coinMult:  1,
    badgeColor: "from-emerald-400 to-green-500",
    bgFrom:    "#dcfce7",
    bgTo:      "#bbf7d0",
    pros:  "제한시간 +10초",
    cons:  "코인 1배",
  },
  normal: {
    label:     "보통",
    emoji:     "⚡",
    timeBonus: 0,
    coinMult:  1.5,
    badgeColor: "from-sky-400 to-blue-500",
    bgFrom:    "#dbeafe",
    bgTo:      "#bfdbfe",
    pros:  "기본 제한시간",
    cons:  "코인 1.5배",
  },
  hard: {
    label:     "도전",
    emoji:     "🔥",
    timeBonus: -10,
    coinMult:  2,
    badgeColor: "from-orange-400 to-red-500",
    bgFrom:    "#fed7aa",
    bgTo:      "#fde68a",
    pros:  "제한시간 -10초",
    cons:  "코인 2배",
  },
} as const satisfies Record<Difficulty, {
  label: string; emoji: string; timeBonus: number; coinMult: number;
  badgeColor: string; bgFrom: string; bgTo: string; pros: string; cons: string;
}>;

const CHAR_LEFT = ["10%", "20%", "30%", "38%", "46%", "54%"];

// ─── World / Type data ────────────────────────────────────────────────────────
// Two-level hierarchy: CHAPTERS (소단원) → types (유형).
// type.id === conceptId — the CMS concept ID is the single source of truth.
const CHAPTERS = [
  {
    id:    5679,
    name:  "받아올림이 없는 세 자리 수의 덧셈",
    emoji: "➕",
    types: [
      {
        id:           15553,
        // 지역 테마 이름 (맵 표시용)
        zoneName:     "숲의 성장 지역",
        // 수학 개념 제목 (게임 내 문제 헤더)
        title:        "받아올림이 없는 (세 자리 수)+(세 자리 수)",
        // 이 지역에 진입하면 자동으로 설정될 게임 모드
        mode:         "grow" as GameMode,
        emoji:        "🌱",
        monster:      "🐛",
        monsterName:  "슬라임",
        monsterImage: "/assets/monster/slime.png",
        monsterIcon:  "/assets/monster/slime.png",
        skyFrom: "#bae6fd",
        skyTo:   "#d1fae5",
        groundColor: "#16a34a",
        accentColor: "#22c55e",
        mapBg: "from-sky-200 to-emerald-200",
      },
      {
        id:           15554,
        zoneName:     "불꽃의 협곡",
        title:        "실생활 문제 해결하기",
        mode:         "battle" as GameMode,
        emoji:        "🔥",
        monster:      "🐉",
        monsterName:  "드래곤",
        monsterImage: "/assets/monster/dino.png",
        monsterIcon:  "/assets/monster/dino.png",
        skyFrom: "#fed7aa",
        skyTo:   "#fde68a",
        groundColor: "#c2410c",
        accentColor: "#f97316",
        mapBg: "from-orange-200 to-yellow-200",
      },
      {
        // ⚠ conceptId 15552는 CMS SQL 오류로 문제 로드 실패.
        // CMS_BLOCKED_IDS(아래)에 등록되어 있어 mock 문제로 자동 fallback됩니다.
        // CMS에서 정상 로드되는 다른 conceptId로 교체하려면:
        //   1. 이 id 값을 교체하고
        //   2. CMS_BLOCKED_IDS에서 해당 id를 제거하세요.
        id:           15552,
        zoneName:     "지혜의 탑",
        title:        "여러 가지 방법으로 덧셈하기",
        mode:         "puzzle" as GameMode,
        emoji:        "⚡",
        monster:      "🦕",
        monsterName:  "공룡",
        monsterImage: "/assets/monster/dino.png",
        monsterIcon:  "/assets/monster/dino.png",
        skyFrom: "#c7d2fe",
        skyTo:   "#bfdbfe",
        groundColor: "#1d4ed8",
        accentColor: "#3b82f6",
        mapBg: "from-indigo-200 to-blue-200",
      },
    ],
  },
] satisfies {
  id: number;
  name: string;
  emoji: string;
  types: {
    id: number;
    zoneName: string;
    title: string;
    mode: GameMode;
    emoji: string;
    monster: string;
    monsterName: string;
    monsterImage: string;
    monsterIcon: string;
    skyFrom: string;
    skyTo: string;
    groundColor: string;
    accentColor: string;
    mapBg: string;
  }[];
}[];

/** Backward-compat alias used by the WorldMap render loop. */
const WORLDS = CHAPTERS;

/** Flat ordered list of all types — used for iteration and progression checks. */
const FLAT_TYPES = WORLDS.flatMap((w) => w.types);

/**
 * Look up a type by its globally-unique id.
 * Falls back to the first type only as a last resort.
 */
function getTypeInfo(typeId: number) {
  return FLAT_TYPES.find((t) => t.id === typeId) ?? FLAT_TYPES[0];
}

/** Return the world that contains the given typeId, or the first world. */
function getWorldForType(typeId: number) {
  return WORLDS.find((w) => w.types.some((t) => t.id === typeId)) ?? WORLDS[0];
}

/**
 * Returns the 0-based position of `typeId` in the FLAT_TYPES array.
 * Used for progression checks so we don't rely on numeric ID ordering
 * (conceptIds are not sequential: 15552, 15553, 15554 …).
 */
function getTypeIndex(typeId: number): number {
  const idx = FLAT_TYPES.findIndex((t) => t.id === typeId);
  return idx === -1 ? 0 : idx;
}

/** Returns the type that comes immediately after `typeId` in progression order, or null. */
function getNextType(typeId: number) {
  const idx = getTypeIndex(typeId);
  return FLAT_TYPES[idx + 1] ?? null;
}

/** Returns the first type in FLAT_TYPES (the starting unlock). */
const FIRST_TYPE_ID = FLAT_TYPES[0].id;

// ─── adaptive difficulty helpers ──────────────────────────────────────────────

const LEVEL_RANK: Record<QuestionLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const LEVEL_FROM_RANK: QuestionLevel[] = ["LOW", "MEDIUM", "HIGH"];

/**
 * Pick a random question from the pool at the preferred level.
 * Falls back to adjacent levels if the preferred level has no available questions.
 * Avoids re-showing the same question when possible.
 */
function pickQuestion(
  pool: GameQuestion[],
  preferredLevel: QuestionLevel,
  excludeId?: number,
): GameQuestion {
  const rank = LEVEL_RANK[preferredLevel];
  // Walk outward: preferred → lower → higher
  for (const delta of [0, -1, 1, -2, 2]) {
    const r = rank + delta;
    if (r < 0 || r > 2) continue;
    const level = LEVEL_FROM_RANK[r];
    const candidates = pool.filter(
      (q) => q.level === level && q.id !== excludeId,
    );
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
  }
  // Last resort: anything except the excluded id
  const any = pool.filter((q) => q.id !== excludeId);
  return any.length > 0
    ? any[Math.floor(Math.random() * any.length)]
    : pool[0];
}

/**
 * Pick a "retry" question after a wrong answer:
 * same conceptName, same or lower level, different question if possible.
 */
function pickRetryQuestion(
  pool: GameQuestion[],
  conceptName: string,
  currentLevel: QuestionLevel,
  excludeId: number,
): GameQuestion {
  const maxRank = LEVEL_RANK[currentLevel]; // same or lower level
  const sameConcept = pool.filter(
    (q) => q.conceptName === conceptName && LEVEL_RANK[q.level] <= maxRank && q.id !== excludeId,
  );
  if (sameConcept.length > 0) {
    return sameConcept[Math.floor(Math.random() * sameConcept.length)];
  }
  return pickQuestion(pool, currentLevel, excludeId);
}

/**
 * Returns the next adaptive level after a correct answer.
 * Higher combo = higher probability to level up.
 */
function nextAdaptiveLevel(current: QuestionLevel, combo: number): QuestionLevel {
  const rank = LEVEL_RANK[current];
  if (rank >= 2) return "HIGH"; // already max
  const upChance = combo >= 5 ? 0.7 : combo >= 3 ? 0.45 : combo >= 1 ? 0.25 : 0.1;
  return Math.random() < upChance
    ? LEVEL_FROM_RANK[rank + 1]
    : current;
}

/**
 * Returns the next adaptive level after a wrong answer (always decreases).
 */
function downAdaptiveLevel(current: QuestionLevel): QuestionLevel {
  const rank = LEVEL_RANK[current];
  return LEVEL_FROM_RANK[Math.max(rank - 1, 0)];
}

/** Star string for the current adaptive level (shown in battle UI). */
const LEVEL_LABEL: Record<QuestionLevel, { stars: string; color: string; label: string }> = {
  LOW:    { stars: "★☆☆", color: "text-emerald-400", label: "기초" },
  MEDIUM: { stars: "★★☆", color: "text-amber-400",   label: "보통" },
  HIGH:   { stars: "★★★", color: "text-rose-400",    label: "어려움" },
};
const DEFAULT_CHARACTER = "🧍";
/** Image path used for the default (hero) character. */
const HERO_IMG = "/assets/character/main.png";

// ── Character guide system ──────────────────────────────────────────────────
/** Visual state of the guide character. Each state can use a different asset. */
type CharState = "idle" | "focus" | "success" | "oops";

/**
 * Per-state image paths. If the asset is missing the component falls back to
 * HERO_IMG automatically via the onError handler.
 */
const CHAR_IMGS: Record<CharState, string> = {
  idle:    "/assets/character/main.png",
  focus:   "/assets/character/focus.png",
  success: "/assets/character/success.png",
  oops:    "/assets/character/oops.png",
};

/**
 * Character guide widget — a small character image with a speech bubble.
 *
 * @param message    Text shown in the speech bubble.
 * @param charState  Controls which image is used and the animation applied.
 * @param size       Width/height of the character image in px.
 * @param bubbleSide Which side of the character the speech bubble sits on.
 * @param className  Extra classes applied to the outermost wrapper.
 */
function CharacterGuide({
  message,
  charState = "idle",
  size = 72,
  bubbleSide = "right",
  className = "",
}: {
  message:     string;
  charState?:  CharState;
  size?:       number;
  bubbleSide?: "left" | "right";
  className?:  string;
}) {
  const [imgSrc, setImgSrc] = useState(CHAR_IMGS[charState]);

  useEffect(() => {
    setImgSrc(CHAR_IMGS[charState]);
  }, [charState]);

  const handleImgError = () => setImgSrc(HERO_IMG);

  const charEl = (
    <div className="flex-shrink-0">
      <img
        src={imgSrc}
        alt="캐릭터"
        onError={handleImgError}
        className={
          charState === "success" || charState === "oops"
            ? "animate-bounce"
            : charState === "idle"
            ? "animate-idle-float"
            : ""
        }
        style={{
          width:     size,
          height:    size,
          objectFit: "contain",
          display:   "block",
          filter:
            charState === "success" ? "drop-shadow(0 0 10px rgba(16,185,129,0.6))" :
            charState === "oops"    ? "drop-shadow(0 0 10px rgba(239,68,68,0.5))"  :
            charState === "focus"   ? "drop-shadow(0 0 8px rgba(37,99,235,0.5))"   :
                                     "drop-shadow(0 6px 14px rgba(0,0,0,0.15))",
          animationDuration: charState === "idle" ? "2.8s" : "0.75s",
          transition: "filter 0.3s",
        }}
      />
    </div>
  );

  const bubbleEl = (
    <div className="bubble-card relative" style={{ maxWidth: "300px" }}>
      <div
        className="rounded-2xl px-5 py-3.5 bg-white"
        style={{
          boxShadow: "0 8px 28px rgba(79,70,229,0.18), 0 2px 8px rgba(0,0,0,0.1)",
          border:    "2px solid rgba(79,70,229,0.12)",
        }}
      >
        <p className="ty-bubble text-slate-700" style={{ fontSize: "20px" }}>
          {message}
        </p>
      </div>
      {/* Tail pointing toward the character */}
      {bubbleSide === "right" ? (
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            left:         "-10px",
            width:        0, height: 0,
            borderTop:    "9px solid transparent",
            borderBottom: "9px solid transparent",
            borderRight:  "10px solid #fff",
            filter:       "drop-shadow(-2px 0 2px rgba(79,70,229,0.1))",
          }}
        />
      ) : (
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            right:        "-10px",
            width:        0, height: 0,
            borderTop:    "9px solid transparent",
            borderBottom: "9px solid transparent",
            borderLeft:   "10px solid #fff",
            filter:       "drop-shadow(2px 0 2px rgba(79,70,229,0.1))",
          }}
        />
      )}
    </div>
  );

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {bubbleSide === "right" ? <>{charEl}{bubbleEl}</> : <>{bubbleEl}{charEl}</>}
    </div>
  );
}

/**
 * Renders a character avatar: main.png for the default character,
 * emoji span for purchased skins (no separate image asset yet).
 */
function CharAvatar({
  src,
  size = 56,
  style: extraStyle,
  className = "",
}: {
  src: string;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt="character"
      width={size}
      height={size}
      style={{
        objectFit: "contain",
        display: "block",
        ...extraStyle,
      }}
      className={className}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

const SHOP_ITEMS = [
  { id: "rabbit", emoji: "🐰", name: "토끼 모험가",   price: 30, desc: "빠르고 귀여워요!" },
  { id: "cat",    emoji: "🐱", name: "고양이 마법사", price: 50, desc: "마법을 쓸 수 있어요!" },
  { id: "fox",    emoji: "🦊", name: "여우 기사",     price: 80, desc: "가장 강한 기사예요!" },
] as const;

type ShopItemId = (typeof SHOP_ITEMS)[number]["id"];

// ─── battle items ─────────────────────────────────────────────────────────────
const BATTLE_ITEMS = [
  {
    id:    "potion" as const,
    emoji: "⏰",
    name:  "시간 물약",
    price: 20,
    desc:  "전투 중 시간 +10초",
    reviewable: false,
  },
  {
    id:    "shield" as const,
    emoji: "🛡️",
    name:  "보호막",
    price: 25,
    desc:  "오답 1회를 막아줌",
    reviewable: true,
  },
  {
    id:    "bomb" as const,
    emoji: "💣",
    name:  "폭탄",
    price: 30,
    desc:  "몬스터 HP 2칸 감소",
    reviewable: true,
  },
] as const;

type ItemId    = (typeof BATTLE_ITEMS)[number]["id"];
type Inventory = Record<ItemId, number>;

const EMPTY_INVENTORY: Inventory = { potion: 0, shield: 0, bomb: 0 };

// ─── student list ─────────────────────────────────────────────────────────────
const STUDENT_LIST_KEY = "mathGameStudentList";

type Student = { id: string; name: string };

const DEFAULT_STUDENTS: Student[] = [
  { id: "s0", name: "김민준" },
  { id: "s1", name: "이서연" },
  { id: "s2", name: "박지우" },
];

function loadStudentList(): { students: Student[]; selectedId: string } {
  if (typeof window === "undefined") return { students: DEFAULT_STUDENTS, selectedId: DEFAULT_STUDENTS[0].id };
  try {
    const raw = localStorage.getItem(STUDENT_LIST_KEY);
    if (!raw) return { students: DEFAULT_STUDENTS, selectedId: DEFAULT_STUDENTS[0].id };
    const p = JSON.parse(raw) as { students?: unknown; selectedId?: unknown };
    const students: Student[] =
      Array.isArray(p.students) && p.students.length > 0
        ? (p.students as Student[]).filter((s) => s && typeof s.id === "string" && typeof s.name === "string")
        : DEFAULT_STUDENTS;
    const selectedId =
      typeof p.selectedId === "string" && students.some((s) => s.id === p.selectedId)
        ? p.selectedId
        : students[0].id;
    return { students, selectedId };
  } catch {
    return { students: DEFAULT_STUDENTS, selectedId: DEFAULT_STUDENTS[0].id };
  }
}

function saveStudentList(data: { students: Student[]; selectedId: string }): void {
  try { localStorage.setItem(STUDENT_LIST_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

// ─── persistence ──────────────────────────────────────────────────────────────
// Module-level mutable: tracks the currently-active student for all save helpers.
// Must be updated (via switchStudent or on mount) BEFORE any state setters that
// trigger auto-saves, so every write goes to the correct student's key.
let _currentStudentId = DEFAULT_STUDENTS[0].id;

const saveKey  = (sid: string) => `mathGameSave_${sid}`;
const dailyKey = (sid: string) => `mathGameDaily_${sid}`;
const statsKey = (sid: string) => `mathGameStats_${sid}`;
const rankKey  = (sid: string) => `mathGameRanking_${sid}`;

type SaveData = {
  coins:               number;
  unlockedTypeId:      number;
  clearedTypeIds:      number[];
  purchasedCharacters: ShopItemId[];
  selectedCharacter:   string;
  wrongQuestions:      WrongQuestion[];
  inventory:           Inventory;
  claimedQuests:       QuestId[];  // lifetime achievements — lives in save, not daily
};

const SAVE_DEFAULTS: SaveData = {
  coins:               0,
  unlockedTypeId:      FIRST_TYPE_ID,
  clearedTypeIds:      [],
  purchasedCharacters: [],
  selectedCharacter:   DEFAULT_CHARACTER,
  wrongQuestions:      [],
  inventory:           { ...EMPTY_INVENTORY },
  claimedQuests:       [],
};

function loadSave(sid = _currentStudentId): SaveData {
  if (typeof window === "undefined") return SAVE_DEFAULTS;
  try {
    const raw = localStorage.getItem(saveKey(sid));
    if (!raw) return SAVE_DEFAULTS;
    const p = JSON.parse(raw) as Partial<SaveData> & { unlockedStage?: number; clearedStages?: number[] };
    const validIds = SHOP_ITEMS.map((i) => i.id);
    return {
      coins:          typeof p.coins === "number"  ? p.coins          : SAVE_DEFAULTS.coins,
      // Support legacy key names (unlockedStage / clearedStages) from before the WORLDS refactor.
      // Also migrate old sequential IDs (1,2,3) to conceptIds via FLAT_TYPES position.
      unlockedTypeId: (() => {
        const raw = typeof p.unlockedTypeId === "number" ? p.unlockedTypeId
                  : typeof p.unlockedStage  === "number" ? p.unlockedStage
                  : null;
        if (raw === null) return SAVE_DEFAULTS.unlockedTypeId;
        // If raw ID is a valid conceptId already, use it.
        if (FLAT_TYPES.some((t) => t.id === raw)) return raw;
        // Otherwise it's an old sequential index (1-based) — map to conceptId by position.
        const byIndex = FLAT_TYPES[raw - 1];
        return byIndex ? byIndex.id : SAVE_DEFAULTS.unlockedTypeId;
      })(),
      clearedTypeIds: (() => {
        const arr = Array.isArray(p.clearedTypeIds) ? (p.clearedTypeIds as number[])
                  : Array.isArray(p.clearedStages)  ? (p.clearedStages  as number[])
                  : [];
        // Migrate old sequential IDs to conceptIds.
        return arr.map((id) => {
          if (FLAT_TYPES.some((t) => t.id === id)) return id;
          const byIndex = FLAT_TYPES[id - 1];
          return byIndex ? byIndex.id : id;
        }).filter((id) => FLAT_TYPES.some((t) => t.id === id));
      })(),
      purchasedCharacters: Array.isArray(p.purchasedCharacters)
        ? (p.purchasedCharacters as string[]).filter((id): id is ShopItemId => validIds.includes(id as ShopItemId))
        : SAVE_DEFAULTS.purchasedCharacters,
      selectedCharacter:   typeof p.selectedCharacter === "string" ? p.selectedCharacter : SAVE_DEFAULTS.selectedCharacter,
      wrongQuestions:      Array.isArray(p.wrongQuestions)
        ? (p.wrongQuestions as WrongQuestion[]).filter(
            (q) => q && typeof q.id === "number" && typeof q.answer === "string"
          ).map((q) => ({
            ...q,
            // Back-compat: older saves won't have `source`; default to "mock".
            source: (q.source === "cms" || q.source === "mock") ? q.source : "mock" as const,
          }))
        : SAVE_DEFAULTS.wrongQuestions,
      inventory: (() => {
        const raw = (p as Record<string, unknown>).inventory;
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          const r = raw as Record<string, unknown>;
          return {
            potion: typeof r.potion === "number" ? r.potion : 0,
            shield: typeof r.shield === "number" ? r.shield : 0,
            bomb:   typeof r.bomb   === "number" ? r.bomb   : 0,
          };
        }
        return { ...EMPTY_INVENTORY };
      })(),
      claimedQuests: (() => {
        const validQuestIds = QUESTS.map((q) => q.id);
        return Array.isArray(p.claimedQuests)
          ? (p.claimedQuests as string[]).filter((id): id is QuestId => validQuestIds.includes(id as QuestId))
          : SAVE_DEFAULTS.claimedQuests;
      })(),
    };
  } catch {
    return SAVE_DEFAULTS;
  }
}

function writeSave(data: SaveData): void {
  try { localStorage.setItem(saveKey(_currentStudentId), JSON.stringify(data)); } catch { /* ignore */ }
}

// ─── tutorial ─────────────────────────────────────────────────────────────────
const TUTORIAL_KEY = "mathGameTutorialSeen";

const TUTORIAL_STEPS = [
  {
    icon:  "⚔️",
    title: "문제를 풀어 공격하기",
    desc:  "수학 문제의 정답을 입력하면\n몬스터를 공격할 수 있어요!\n5번 맞히면 스테이지 클리어!",
  },
  {
    icon:  "💰",
    title: "코인과 콤보",
    desc:  "연속으로 맞히면 콤보가 올라가고\n더 많은 코인을 얻을 수 있어요!\n콤보를 끊지 말고 도전해봐요.",
  },
  {
    icon:  "🗺️",
    title: "스테이지 클리어",
    desc:  "스테이지를 클리어하면\n다음 맵이 열려요!\n모든 퀘스트를 완료해보세요.",
  },
  {
    icon:  "🏪",
    title: "상점에서 캐릭터 구매",
    desc:  "모은 코인으로 상점에서\n귀여운 캐릭터 스킨을\n구매할 수 있어요!",
  },
] as const;

function loadTutorialSeen(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(TUTORIAL_KEY) === "true";
}

function saveTutorialSeen(): void {
  try { localStorage.setItem(TUTORIAL_KEY, "true"); } catch { /* ignore */ }
}

// ─── sound persistence ────────────────────────────────────────────────────────
const SOUND_KEY = "mathGameSound";

function loadSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(SOUND_KEY);
  return v === null ? true : v === "true";
}

function saveSoundEnabled(v: boolean): void {
  try { localStorage.setItem(SOUND_KEY, String(v)); } catch { /* ignore */ }
}

// ─── ranking persistence ──────────────────────────────────────────────────────
const RANK_KEY = "mathGameRanking";

type RankData = {
  bestScore:    number;
  recentScores: number[]; // newest first, max 5
};

const RANK_DEFAULTS: RankData = { bestScore: 0, recentScores: [] };

function loadRanking(sid = _currentStudentId): RankData {
  if (typeof window === "undefined") return RANK_DEFAULTS;
  try {
    const raw = localStorage.getItem(rankKey(sid));
    if (!raw) return RANK_DEFAULTS;
    const p = JSON.parse(raw) as Partial<RankData>;
    return {
      bestScore:    typeof p.bestScore === "number" ? p.bestScore : 0,
      recentScores: Array.isArray(p.recentScores)
        ? (p.recentScores as unknown[]).filter((v): v is number => typeof v === "number").slice(0, 5)
        : [],
    };
  } catch {
    return RANK_DEFAULTS;
  }
}

function saveRanking(data: RankData): void {
  try { localStorage.setItem(rankKey(_currentStudentId), JSON.stringify(data)); } catch { /* ignore */ }
}

// ─── lifetime learning stats ──────────────────────────────────────────────────

/**
 * Persisted learning stats.
 * `streakDays` and `lastCompletedDate` form the completion-based streak:
 *   they are updated only when the player meets today's daily goal
 *   (5 correct answers OR 1 stage clear), not just by opening the app.
 * This same `streakDays` value is shown in both the WorldMap streak banner
 * and the StatsPanel "연속 학습일" row — there is one source of truth.
 */
type LifetimeStats = {
  totalSolved:        number; // all problems attempted
  totalCorrect:       number; // correct answers
  totalWrong:         number; // wrong answers
  bestCombo:          number; // highest combo ever achieved
  reviewsDone:        number; // review dungeon completions
  streakDays:         number; // consecutive daily-goal completion days
  lastCompletedDate:  string; // YYYY-MM-DD of last daily-goal completion
};

const STATS_DEFAULTS: LifetimeStats = {
  totalSolved:       0,
  totalCorrect:      0,
  totalWrong:        0,
  bestCombo:         0,
  reviewsDone:       0,
  streakDays:        0,
  lastCompletedDate: "",
};

function loadLifetimeStats(sid = _currentStudentId): LifetimeStats {
  if (typeof window === "undefined") return { ...STATS_DEFAULTS };
  try {
    const raw = localStorage.getItem(statsKey(sid));
    if (!raw) return { ...STATS_DEFAULTS };
    const p = JSON.parse(raw) as Record<string, unknown>;
    const num = (v: unknown, d = 0) => (typeof v === "number" && v >= 0 ? v : d);
    // Support both old key ("lastLogin") and new key ("lastCompletedDate")
    const lastCompleted =
      typeof p.lastCompletedDate === "string" ? p.lastCompletedDate :
      typeof p.lastLogin         === "string" ? p.lastLogin         : "";
    return {
      totalSolved:       num(p.totalSolved),
      totalCorrect:      num(p.totalCorrect),
      totalWrong:        num(p.totalWrong),
      bestCombo:         num(p.bestCombo),
      reviewsDone:       num(p.reviewsDone),
      streakDays:        num(p.streakDays),
      lastCompletedDate: lastCompleted,
    };
  } catch {
    return { ...STATS_DEFAULTS };
  }
}

function saveLifetimeStats(s: LifetimeStats): void {
  try { localStorage.setItem(statsKey(_currentStudentId), JSON.stringify(s)); } catch { /* ignore */ }
}

// ─── daily quests ─────────────────────────────────────────────────────────────
const DAILY_KEY = "mathGameDaily";

// ── quests (cumulative lifetime achievements — never reset daily) ─────────────
const QUESTS = [
  { id: "solve50",     title: "문제 50개 맞히기",    target: 50,  reward: 100 },
  { id: "bestCombo20", title: "최고 콤보 20 달성",   target: 20,  reward:  80 },
  { id: "review10",    title: "복습 던전 10회 완료", target: 10,  reward: 120 },
] as const;

// ── today's missions (displayed as a progress card; completing all = +50 coins) ──
const MISSIONS = [
  { id: "solve" as const, icon: "📚", label: "문제 5개 풀기",   target: 5 },
  { id: "combo" as const, icon: "🔥", label: "콤보 3회 달성",   target: 3 },
  { id: "stage" as const, icon: "🗺️", label: "스테이지 클리어", target: 1 },
] satisfies { id: "solve" | "combo" | "stage"; icon: string; label: string; target: number }[];

type MissionId = typeof MISSIONS[number]["id"];

// ── user role ─────────────────────────────────────────────────────────────────
const USER_ROLE_KEY = "mathGameUserRole";
type UserRole = "student" | "teacher";

function loadUserRole(): UserRole {
  if (typeof window === "undefined") return "student";
  const raw = localStorage.getItem(USER_ROLE_KEY);
  return raw === "teacher" ? "teacher" : "student";
}
function saveUserRole(role: UserRole): void {
  try { localStorage.setItem(USER_ROLE_KEY, role); } catch { /* ignore */ }
}

// ── teacher mode config ───────────────────────────────────────────────────────
const TEACHER_CONFIG_KEY = "mathGameTeacherConfig";

type TeacherConfig = {
  solveTarget: number; // mission: 문제 풀기
  comboTarget: number; // mission: 콤보 달성
  stageTarget: number; // mission: 스테이지 클리어
};

const TEACHER_DEFAULTS: TeacherConfig = { solveTarget: 5, comboTarget: 3, stageTarget: 1 };

function loadTeacherConfig(): TeacherConfig {
  if (typeof window === "undefined") return { ...TEACHER_DEFAULTS };
  try {
    const raw = localStorage.getItem(TEACHER_CONFIG_KEY);
    if (!raw) return { ...TEACHER_DEFAULTS };
    const p = JSON.parse(raw) as Partial<TeacherConfig>;
    const posInt = (v: unknown, d: number) =>
      typeof v === "number" && Number.isInteger(v) && v >= 1 ? v : d;
    return {
      solveTarget: posInt(p.solveTarget, TEACHER_DEFAULTS.solveTarget),
      comboTarget: posInt(p.comboTarget, TEACHER_DEFAULTS.comboTarget),
      stageTarget: posInt(p.stageTarget, TEACHER_DEFAULTS.stageTarget),
    };
  } catch {
    return { ...TEACHER_DEFAULTS };
  }
}

function saveTeacherConfig(c: TeacherConfig): void {
  try { localStorage.setItem(TEACHER_CONFIG_KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

type QuestId = (typeof QUESTS)[number]["id"];

type DailyData = {
  lastDate:             string;
  solvedToday:          number;
  comboToday:           number;
  reviewDoneToday:      number;
  attendanceClaimed:    boolean;
  dailyCompleted:       boolean;
  stagesClearedToday:   number;
  missionsBonusClaimed: boolean;
};

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

const DAILY_DEFAULTS: Omit<DailyData, "lastDate"> = {
  solvedToday:          0,
  comboToday:           0,
  reviewDoneToday:      0,
  attendanceClaimed:    false,
  dailyCompleted:       false,
  stagesClearedToday:   0,
  missionsBonusClaimed: false,
};

function loadDaily(sid = _currentStudentId): DailyData {
  const today = todayStr();
  if (typeof window === "undefined") return { ...DAILY_DEFAULTS, lastDate: today };
  try {
    const raw = localStorage.getItem(dailyKey(sid));
    if (!raw) return { ...DAILY_DEFAULTS, lastDate: today };
    const p = JSON.parse(raw) as Partial<DailyData>;
    // Date changed → return fresh defaults
    if (p.lastDate !== today) return { ...DAILY_DEFAULTS, lastDate: today };
    return {
      lastDate:             today,
      solvedToday:          typeof p.solvedToday          === "number"  ? p.solvedToday          : 0,
      comboToday:           typeof p.comboToday           === "number"  ? p.comboToday           : 0,
      reviewDoneToday:      typeof p.reviewDoneToday      === "number"  ? p.reviewDoneToday      : 0,
      attendanceClaimed:    typeof p.attendanceClaimed    === "boolean" ? p.attendanceClaimed    : false,
      dailyCompleted:       typeof p.dailyCompleted       === "boolean" ? p.dailyCompleted       : false,
      stagesClearedToday:   typeof p.stagesClearedToday   === "number"  ? p.stagesClearedToday   : 0,
      missionsBonusClaimed: typeof p.missionsBonusClaimed === "boolean" ? p.missionsBonusClaimed : false,
    };
  } catch {
    return { ...DAILY_DEFAULTS, lastDate: today };
  }
}

function writeDaily(data: DailyData): void {
  try { localStorage.setItem(dailyKey(_currentStudentId), JSON.stringify(data)); } catch { /* ignore */ }
}

// ─── types ────────────────────────────────────────────────────────────────────
/** Snapshot of a question the player answered incorrectly, saved to localStorage. */
type WrongQuestion = Pick<GameQuestion, "id" | "text" | "answer" | "conceptName" | "stageId" | "questionImageUrl"> & {
  solutionImageUrl?: string;
  /** Tracks whether the question came from CMS or mock data, for review dungeon logic. */
  source: "cms" | "mock";
};

type Phase    = "modeSelect" | "ready" | "regionMap" | "shop" | "travel" | "playing" | "stageClear" | "result" | "review" | "reviewClear" | "difficultySelect" | "teacherDashboard";
type CardAnim = "bounce" | "shake" | "";

// ─── component ────────────────────────────────────────────────────────────────
export default function MathGame() {
  // ── progress state (persists across stages on the same run) ────────────────
  const [unlockedTypeId,  setUnlockedTypeId]  = useState(FIRST_TYPE_ID);
  const [clearedTypeIds,  setClearedTypeIds]  = useState<number[]>([]);

  // ── session state ──────────────────────────────────────────────────────────
  const [phase,          setPhase]          = useState<Phase>("modeSelect");
  const [learningMode,   setLearningMode]   = useState<LearningMode>("growth");
  const [currentTypeId,  setCurrentTypeId]  = useState(FIRST_TYPE_ID);
  const [correctCount,   setCorrectCount]   = useState(0);
  const [charAttacking,  setCharAttacking]  = useState(false);
  const [monsterHit,     setMonsterHit]     = useState(false);
  const [monsterCounter, setMonsterCounter] = useState(false);
  const [damageKey,      setDamageKey]      = useState(0);
  const [questionIndex,  setQuestionIndex]  = useState(0);   // key counter only
  const [adaptiveLevel,  setAdaptiveLevel]  = useState<QuestionLevel>("LOW");
  const [currentQuestion, setCurrentQuestion] = useState<GameQuestion | null>(null);
  const [input,          setInput]          = useState("");
  const [score,          setScore]          = useState(0);
  const [combo,          setCombo]          = useState(0);
  const [coins,          setCoins]          = useState(0);
  const [timeLeft,       setTimeLeft]       = useState(TOTAL_TIME);
  const [feedback,       setFeedback]       = useState<string | null>(null);
  const [feedbackKey,    setFeedbackKey]    = useState(0);
  const [cardAnim,       setCardAnim]       = useState<CardAnim>("");
  const [selectedCharacter, setSelectedCharacter] = useState(HERO_IMG);

  // ── shop state ─────────────────────────────────────────────────────────────
  const [purchasedCharacters, setPurchasedCharacters] = useState<ShopItemId[]>([]);
  const [shopMsg,             setShopMsg]             = useState<string | null>(null);

  // ── difficulty state ───────────────────────────────────────────────────────
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>("normal");
  const [pendingTypeId,      setPendingTypeId]      = useState(1);

  // ── wrong-question / review state ──────────────────────────────────────────
  const [wrongQuestions,    setWrongQuestions]    = useState<WrongQuestion[]>([]);
  const [reviewIndex,       setReviewIndex]       = useState(0);
  const [reviewInitialCount, setReviewInitialCount] = useState(0);
  // Derived Set for puzzle mode wrong-first selection (avoids useState for derived data)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const wrongQuestionIds = new Set(wrongQuestions.map((q) => q.id));

  // ── tutorial state ─────────────────────────────────────────────────────────
  const [showTutorial, setShowTutorial] = useState(false);

  // ── skill / critical state ─────────────────────────────────────────────────
  const [skillCharge, setSkillCharge] = useState(0);
  const [skillReady,  setSkillReady]  = useState(false);

  // ── battle item state ──────────────────────────────────────────────────────
  const [inventory,    setInventory]    = useState<Inventory>({ ...EMPTY_INVENTORY });
  const [shieldActive, setShieldActive] = useState(false);

  // ── player lives (hearts) ─────────────────────────────────────────────────
  // easy/normal → 3 hearts · hard → 2 hearts
  // Each wrong answer that bypasses the shield costs 1 heart.
  // Reaching 0 triggers goToResult (defeat).
  const [playerLives,  setPlayerLives]  = useState(3);
  const MAX_PLAYER_LIVES = 3;

  // ── grow mode: EXP / level-up system ────────────────────────────────────────
  const [growExp,        setGrowExp]        = useState(0);
  const [growLevel,      setGrowLevel]      = useState(1);
  const [levelUpOpen,    setLevelUpOpen]    = useState(false);
  const [levelUpChoices, setLevelUpChoices] = useState<GrowSkill[]>([]);
  const [growScoreMult,  setGrowScoreMult]  = useState(1.0);
  const [growExpMult,    setGrowExpMult]    = useState(1.0);

  // ── ranking state ─────────────────────────────────────────────────────────
  const [bestScore,    setBestScore]    = useState(0);
  const [recentScores, setRecentScores] = useState<number[]>([]);
  const [wasNewRecord, setWasNewRecord] = useState(false);

  // ── visual effect states ───────────────────────────────────────────────────
  const [screenFlash,   setScreenFlash]   = useState<"correct" | "wrong" | null>(null);
  const [floatingNums,  setFloatingNums]  = useState<{ id: number; text: string; color: string }[]>([]);
  const [coinFlash,     setCoinFlash]     = useState(false); // brief bump on coin earn
  // gameMode: always starts as "battle" on server to avoid hydration mismatch.
  // The stored preference is loaded from localStorage in the mount useEffect below.
  const [gameMode, setGameMode] = useState<GameMode>("battle");
  const [battleEntry,   setBattleEntry]   = useState(false);
  const prevPhaseRef = useRef<string>("");

  // ── CMS test integration ───────────────────────────────────────────────────
  /** Full question pool from all CMS concepts. Populated once per difficultySelect open. */
  const [cmsPool,       setCmsPool]       = useState<GameQuestion[]>([]);
  /** Filtered set for the current game session (mode-specific). */
  const [cmsQuestions,  setCmsQuestions]  = useState<GameQuestion[]>([]);
  const [cmsLoading,    setCmsLoading]    = useState(false);
  /** Full result from the last CMS fetch (contains filter stats & error detail). */
  const [cmsResult,     setCmsResult]     = useState<CmsFetchResult | null>(null);
  /** IDs of questions the player answered wrong — used by puzzle mode for review-first selection. */
  // Note: derived from wrongQuestions (already tracked for the review dungeon feature)

  // ── lifetime learning stats ────────────────────────────────────────────────
  const [lifetimeStats,  setLifetimeStats]  = useState<LifetimeStats>({ ...STATS_DEFAULTS });
  const [showStatsPanel, setShowStatsPanel] = useState(false);

  // ── sound state ────────────────────────────────────────────────────────────
  const [soundEnabled, setSoundEnabled] = useState(true);
  // Use a ref so callbacks never capture a stale closure value
  const soundEnabledRef = useRef(true);

  // Detect playing phase entry → show "전투 시작!" banner
  useEffect(() => {
    if (prevPhaseRef.current !== "playing" && phase === "playing") {
      setBattleEntry(true);
      const t = window.setTimeout(() => setBattleEntry(false), 1500);
      prevPhaseRef.current = phase;
      return () => clearTimeout(t);
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      soundEnabledRef.current = next;
      saveSoundEnabled(next);
      return next;
    });
  }, []);

  /** Play a sound effect if sound is enabled. */
  const play = useCallback((effect: SoundEffect) => {
    if (soundEnabledRef.current) playSound(effect);
  }, []);

  // ── daily quest / attendance state ─────────────────────────────────────────
  const [solvedToday,       setSolvedToday]       = useState(0);
  const [comboToday,        setComboToday]        = useState(0);
  const [reviewDoneToday,   setReviewDoneToday]   = useState(0);
  const [claimedQuests,     setClaimedQuests]     = useState<QuestId[]>([]);
  const [attendanceClaimed,    setAttendanceClaimed]    = useState(false);
  const [dailyCompleted,       setDailyCompleted]       = useState(false);
  const [stagesClearedToday,   setStagesClearedToday]   = useState(0);
  const [missionsBonusClaimed, setMissionsBonusClaimed] = useState(false);

  // ── user role & teacher mode ───────────────────────────────────────────────
  const [userRole,      setUserRole]      = useState<UserRole>("student");
  const [teacherMode,   setTeacherMode]   = useState(false);
  const [teacherConfig, setTeacherConfig] = useState<TeacherConfig>({ ...TEACHER_DEFAULTS });

  // ── student management ─────────────────────────────────────────────────────
  const [studentList,       setStudentList]       = useState<Student[]>(DEFAULT_STUDENTS);
  const [selectedStudentId, setSelectedStudentId] = useState(DEFAULT_STUDENTS[0].id);

  const inputRef            = useRef<HTMLInputElement>(null);
  const timers              = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hasLoaded           = useRef(false);
  const dailyCompletedRef   = useRef(false);
  const lifetimeStatsRef    = useRef<LifetimeStats>({ ...STATS_DEFAULTS });

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const addTimer = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  }, []);

  // ── daily completion (streak) ─────────────────────────────────────────────
  /**
   * Called when the player meets today's goal (5 correct answers OR 1 stage clear).
   * Guards itself with a ref so it fires at most once per calendar day.
   */
  const markDailyComplete = useCallback(() => {
    if (dailyCompletedRef.current) return;
    dailyCompletedRef.current = true;
    setDailyCompleted(true);

    const today     = todayStr();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split("T")[0];

    const current   = lifetimeStatsRef.current;
    // Completion-based streak: +1 if last completed yesterday, else reset to 1
    const newStreak = current.lastCompletedDate === yStr ? current.streakDays + 1 : 1;
    const next: LifetimeStats = { ...current, streakDays: newStreak, lastCompletedDate: today };
    lifetimeStatsRef.current = next;
    setLifetimeStats(next);
    saveLifetimeStats(next);

    // Base reward + milestone bonuses
    let bonus = 20;
    if (newStreak === 3) bonus += 30;
    if (newStreak === 7) bonus += 50;
    setCoins((c) => c + bonus);
  }, []);

  // ── switch to a different student ─────────────────────────────────────────
  const switchStudent = useCallback((newId: string) => {
    if (newId === _currentStudentId) return;

    // Update module var first so subsequent auto-saves write to the correct key
    _currentStudentId = newId;

    // Load new student's data
    const save  = loadSave(newId);
    const daily = loadDaily(newId);
    const stats = loadLifetimeStats(newId);
    const rank  = loadRanking(newId);

    // Persist selection
    setStudentList((prev) => {
      saveStudentList({ students: prev, selectedId: newId });
      return prev;
    });
    setSelectedStudentId(newId);

    // Update all game state
    setCoins(save.coins);
    setUnlockedTypeId(save.unlockedTypeId);
    setClearedTypeIds(save.clearedTypeIds);
    setPurchasedCharacters(save.purchasedCharacters);
    setSelectedCharacter(save.selectedCharacter);
    setWrongQuestions(save.wrongQuestions);
    setInventory(save.inventory);
    setClaimedQuests(save.claimedQuests);

    setSolvedToday(daily.solvedToday);
    setComboToday(daily.comboToday);
    setReviewDoneToday(daily.reviewDoneToday);
    setAttendanceClaimed(daily.attendanceClaimed);
    setDailyCompleted(daily.dailyCompleted);
    dailyCompletedRef.current = daily.dailyCompleted;
    setStagesClearedToday(daily.stagesClearedToday);
    setMissionsBonusClaimed(daily.missionsBonusClaimed);

    lifetimeStatsRef.current = stats;
    setLifetimeStats(stats);

    setBestScore(rank.bestScore);
    setRecentScores(rank.recentScores);

    // Reset in-progress game
    clearTimers();
    setPhase("ready");
    setScore(0);
    setCombo(0);
    setCorrectCount(0);
    setQuestionIndex(0);
    setInput("");
    setTimeLeft(TOTAL_TIME);
    setFeedback(null);
    setSkillCharge(0);
    setSkillReady(false);
    setShieldActive(false);
    setWasNewRecord(false);
  }, [clearTimers]);

  // Trigger completion automatically when 5 correct answers are reached
  useEffect(() => {
    if (!hasLoaded.current) return;
    if (solvedToday >= 5 && !dailyCompleted) markDailyComplete();
  }, [solvedToday, dailyCompleted, markDailyComplete]);

  // Grant all-missions bonus (+50) when every mission target is met (uses teacher-adjustable targets)
  useEffect(() => {
    if (!hasLoaded.current) return;
    if (missionsBonusClaimed) return;
    const allDone =
      solvedToday        >= teacherConfig.solveTarget &&
      comboToday         >= teacherConfig.comboTarget &&
      stagesClearedToday >= teacherConfig.stageTarget;
    if (allDone) {
      setMissionsBonusClaimed(true);
      setCoins((c) => c + 50);
    }
  }, [solvedToday, comboToday, stagesClearedToday, missionsBonusClaimed, teacherConfig]);

  // ── keep refs in sync with state ─────────────────────────────────────────
  useEffect(() => { dailyCompletedRef.current = dailyCompleted; }, [dailyCompleted]);
  useEffect(() => { lifetimeStatsRef.current  = lifetimeStats;  }, [lifetimeStats]);

  // ── auto-save (declared before load so it skips on the very first render) ───
  useEffect(() => {
    if (!hasLoaded.current) return;
    writeSave({ coins, unlockedTypeId, clearedTypeIds, purchasedCharacters, selectedCharacter, wrongQuestions, inventory, claimedQuests });
  }, [coins, unlockedTypeId, clearedTypeIds, purchasedCharacters, selectedCharacter, wrongQuestions, inventory, claimedQuests]);

  // ── daily auto-save (also declared before load) ───────────────────────────
  useEffect(() => {
    if (!hasLoaded.current) return;
    writeDaily({ lastDate: todayStr(), solvedToday, comboToday, reviewDoneToday, attendanceClaimed, dailyCompleted, stagesClearedToday, missionsBonusClaimed });
  }, [solvedToday, comboToday, reviewDoneToday, attendanceClaimed, dailyCompleted, stagesClearedToday, missionsBonusClaimed]);

  // ── load from localStorage on mount (client only) ────────────────────────────
  useEffect(() => {
    // Load student list first and set module-level ID before any data loads
    const { students, selectedId } = loadStudentList();
    setStudentList(students);
    setSelectedStudentId(selectedId);
    _currentStudentId = selectedId; // keep module var in sync

    const save  = loadSave(selectedId);
    const daily = loadDaily(selectedId);
    setCoins(save.coins);
    setUnlockedTypeId(save.unlockedTypeId);
    setClearedTypeIds(save.clearedTypeIds);
    setPurchasedCharacters(save.purchasedCharacters);
    setSelectedCharacter(save.selectedCharacter);
    setWrongQuestions(save.wrongQuestions);
    setInventory(save.inventory);
    setClaimedQuests(save.claimedQuests);
    setSolvedToday(daily.solvedToday);
    setComboToday(daily.comboToday);
    setReviewDoneToday(daily.reviewDoneToday);
    setAttendanceClaimed(daily.attendanceClaimed);
    setDailyCompleted(daily.dailyCompleted);
    dailyCompletedRef.current = daily.dailyCompleted;
    setStagesClearedToday(daily.stagesClearedToday);
    setMissionsBonusClaimed(daily.missionsBonusClaimed);
    if (!loadTutorialSeen()) setShowTutorial(true);
    const rawStats = loadLifetimeStats(selectedId);
    lifetimeStatsRef.current = rawStats;
    setLifetimeStats(rawStats);
    const rank = loadRanking(selectedId);
    setBestScore(rank.bestScore);
    setRecentScores(rank.recentScores);
    const se = loadSoundEnabled();
    setSoundEnabled(se);
    soundEnabledRef.current = se;
    setTeacherConfig(loadTeacherConfig());
    setUserRole(loadUserRole());
    // Restore game mode preference (client-only — avoids SSR hydration mismatch)
    try {
      const stored = localStorage.getItem("mathGameMode");
      if (stored === "grow" || stored === "puzzle" || stored === "battle") {
        setGameMode(stored as GameMode);
      }
    } catch { /* ignore */ }
    hasLoaded.current = true;
  }, []);

  const typeInfo            = getTypeInfo(currentTypeId);
  const currentMonsterName  = typeInfo.monsterName;
  const currentMonsterImage = typeInfo.monsterImage;
  const currentMonsterIcon  = typeInfo.monsterIcon;
  // When CMS questions are loaded they take priority; mock questions are the fallback.
  const questions = cmsQuestions.length > 0 ? cmsQuestions : getQuestionsForStage(currentTypeId);
  const current   = currentQuestion ?? questions[0];
  const monsterHp = MONSTER_MAX_HP - correctCount;

  // ── travel → playing transition (600 ms) ─────────────────────────────────────
  useEffect(() => {
    if (phase !== "travel") return;
    const id = setTimeout(() => {
      setPhase("playing");
      setTimeout(() => inputRef.current?.focus(), 80);
    }, 600);
    return () => clearTimeout(id);
  }, [phase]);

  /**
   * Transition to the result screen.
   * Also updates bestScore / recentScores and persists them.
   * Call this instead of setPhase("result") directly.
   */
  const goToResult = useCallback(() => {
    if (score > 0) {
      const isNew = score > bestScore;
      setWasNewRecord(isNew);
      const newBest   = isNew ? score : bestScore;
      const newRecent = [score, ...recentScores].slice(0, 5);
      setBestScore(newBest);
      setRecentScores(newRecent);
      saveRanking({ bestScore: newBest, recentScores: newRecent });
    } else {
      setWasNewRecord(false);
    }
    setPhase("result");
  }, [score, bestScore, recentScores]);

  // ── timer ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    if (levelUpOpen) return; // pause timer during level-up skill selection
    if (timeLeft <= 0) { goToResult(); return; }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, phase, goToResult, levelUpOpen]);

  // ── answer check ─────────────────────────────────────────────────────────────
  const checkAnswer = useCallback(() => {
    if (phase !== "playing") return;

    const result = checkAnswerResult({
      userAnswer:       input,
      correctAnswer:    current.answer,
      answerCandidates: current.answerCandidates,
      combo,
      correctCount,
      autoScoringType:  current.autoScoringType,
    });

    // ── needs_review: 채점 불가 → HP 차감 없이 재입력 안내 ──────────────────
    if (result.gradingStatus === "needs_review") {
      setFeedbackKey((k) => k + 1);
      setFeedback("🔍 정답 확인이 필요해요. 다시 한 번 입력해볼까요?");
      setCardAnim("shake");
      setInput("");
      addTimer(() => {
        setFeedback(null);
        setCardAnim("");
      }, 1800);
      setTimeout(() => inputRef.current?.focus(), 60);
      return;
    }

    if (result.isCorrect) {
      const newCombo  = result.nextCombo;
      const coinMult  = DIFFICULTY_CONFIG[selectedDifficulty].coinMult;

      // ── CMS difficulty reward multiplier ───────────────────────────────────
      const qDifficulty  = current.difficulty ?? 1;
      const cmsRewardMult = (CMS_DIFFICULTY_RULES[qDifficulty] ?? CMS_DIFFICULTY_RULES[1]).rewardMult;

      // ── critical hit (20% chance) ──────────────────────────────────────────
      const isCrit  = Math.random() < 0.2;
      const damage  = isCrit ? 2 : 1;
      const newCount = Math.min(correctCount + damage, MONSTER_MAX_HP);
      const shouldClear = newCount >= MONSTER_MAX_HP;

      // ── skill charge (correct = +20, capped at 100) ────────────────────────
      const newCharge  = Math.min(skillCharge + 20, 100);
      const nowReady   = newCharge >= 100;
      setSkillCharge(newCharge);
      setSkillReady(nowReady);

      setCombo(newCombo);
      setScore((s) => s + Math.round(result.addedScore * (isCrit ? 2 : 1) * cmsRewardMult * (gameMode === "grow" ? growScoreMult : 1)));
      setCoins((c) => c + Math.round(5 * coinMult * cmsRewardMult));
      setCoinFlash(true);
      setTimeout(() => setCoinFlash(false), 500);
      setSolvedToday((t) => t + 1);
      if (newCombo === 3) setComboToday((t) => t + 1);
      setLifetimeStats((prev) => {
        const next = {
          ...prev,
          totalSolved:  prev.totalSolved  + 1,
          totalCorrect: prev.totalCorrect + 1,
          bestCombo:    Math.max(prev.bestCombo, newCombo),
        };
        saveLifetimeStats(next);
        return next;
      });

      const gText = GAME_TEXT[gameMode];
      const fbMsg = isCrit
        ? gText.critFeedback
        : newCombo >= 5
        ? gText.comboFeedback(newCombo)
        : newCombo >= 3
        ? gText.comboFeedback(newCombo)
        : newCombo >= 2
        ? "✌️ Good!"
        : "😊 정답!";

      play(isCrit ? "critical" : "correct");

      // ── visual flash + floating coin number ────────────────────────────
      setScreenFlash("correct");
      setTimeout(() => setScreenFlash(null), 380);
      const fid = Date.now();
      const earnedCoins = Math.round(5 * DIFFICULTY_CONFIG[selectedDifficulty].coinMult * cmsRewardMult);
      const diffBonus   = cmsRewardMult > 1 ? ` (Lv.${qDifficulty}×${cmsRewardMult})` : "";
      const floatText = isCrit
        ? `⚡ ×2 +${earnedCoins * 2}💰${diffBonus}`
        : newCombo >= 5
        ? `🌟 ×${newCombo} +${earnedCoins}💰${diffBonus}`
        : newCombo >= 3
        ? `🔥 ×${newCombo} +${earnedCoins}💰${diffBonus}`
        : newCombo >= 2
        ? `✌️ ×${newCombo} +${earnedCoins}💰${diffBonus}`
        : `+${earnedCoins}💰${diffBonus}`;
      const floatColor = isCrit
        ? "#fbbf24"
        : newCombo >= 5
        ? "#f43f5e"
        : newCombo >= 3
        ? "#fb923c"
        : newCombo >= 2
        ? "#34d399"
        : "#86efac";
      setFloatingNums((prev) => [...prev, { id: fid, text: floatText, color: floatColor }]);
      setTimeout(() => setFloatingNums((prev) => prev.filter((f) => f.id !== fid)), 1000);

      setFeedbackKey((k) => k + 1);
      setFeedback(fbMsg);
      setCardAnim("bounce");
      setCharAttacking(true);

      clearTimers();

      addTimer(() => {
        setCorrectCount(newCount);
        setMonsterHit(true);
        setDamageKey((k) => k + 1);
      }, 300);

      addTimer(() => {
        setCharAttacking(false);
        setMonsterHit(false);
        setFeedback(null);
        setCardAnim("");
      }, 720);

      // ── grow mode: EXP gain & level-up trigger ─────────────────────────────
      if (gameMode === "grow" && !shouldClear) {
        const baseExp = isCrit ? 35 : 20;
        const gainedExp = Math.round(baseExp * growExpMult * (newCombo >= 3 ? 1.3 : 1));
        const nextExp = growExp + gainedExp;
        const feid = Date.now() + 1;
        setFloatingNums((prev) => [...prev, { id: feid, text: `+${gainedExp} EXP`, color: "#34d399" }]);
        setTimeout(() => setFloatingNums((prev) => prev.filter((f) => f.id !== feid)), 1000);
        if (nextExp >= EXP_PER_LEVEL) {
          setGrowExp(nextExp - EXP_PER_LEVEL);
          setGrowLevel((l) => l + 1);
          addTimer(() => {
            setLevelUpChoices(pickLevelUpSkills(3));
            setLevelUpOpen(true);
          }, 850);
        } else {
          setGrowExp(nextExp);
        }
      }

      if (shouldClear) {
        setCoins((c) => c + Math.round(20 * coinMult));
        setClearedTypeIds((prev) =>
          prev.includes(currentTypeId) ? prev : [...prev, currentTypeId]
        );
        setUnlockedTypeId((prev) => {
          const next = getNextType(currentTypeId);
          if (!next) return prev;
          return getTypeIndex(next.id) > getTypeIndex(prev) ? next.id : prev;
        });
        setStagesClearedToday((t) => t + 1);
        markDailyComplete(); // stage clear → daily goal met
        addTimer(() => { play("clear"); setPhase("stageClear"); }, 880);
      } else {
        // ── adaptive difficulty: level up on correct ───────────────────────
        const newLevel = nextAdaptiveLevel(adaptiveLevel, newCombo);
        setAdaptiveLevel(newLevel);
        setQuestionIndex((i) => i + 1);
        setCurrentQuestion(pickQuestion(questions, newLevel, current.id));
      }
    } else {
      // Wrong answer (shield or not) — still counts as attempted
      setLifetimeStats((prev) => {
        const next = { ...prev, totalSolved: prev.totalSolved + 1, totalWrong: prev.totalWrong + 1 };
        saveLifetimeStats(next);
        return next;
      });

      if (shieldActive) {
        // ── shield absorbs the hit ─────────────────────────────────────────
        play("item");
        setShieldActive(false);
        setFeedbackKey((k) => k + 1);
        setFeedback("🛡️ 보호막 발동!");
        setCardAnim("");
        clearTimers();
        addTimer(() => setFeedback(null), 800);
      } else {
        // ── normal wrong answer ────────────────────────────────────────────
        play("wrong");
        setScreenFlash("wrong");
        setTimeout(() => setScreenFlash(null), 420);
        setCombo(0);
        setSkillCharge((c) => Math.max(c - 10, 0));
        setSkillReady(false);
        // HP 감소 — 0이 되면 패배
        setPlayerLives((prev) => {
          const next = Math.max(prev - 1, 0);
          if (next === 0) {
            addTimer(() => goToResult(), 1100);
          }
          return next;
        });

        // ── Almost Win: monster had 1 HP left ─────────────────────────────
        const isAlmostWin = correctCount === MONSTER_MAX_HP - 1;

        setFeedbackKey((k) => k + 1);
        setFeedback(isAlmostWin ? "💪 아쉽다! 거의 잡았어요!" : GAME_TEXT[gameMode].wrongFeedback);
        setCardAnim("shake");
        setMonsterCounter(true);

        setWrongQuestions((prev) =>
          prev.some((q) => q.id === current.id)
            ? prev
            : [...prev, {
                id:               current.id,
                text:             current.text,
                answer:           current.answer,
                conceptName:      current.conceptName,
                stageId:          currentTypeId,
                questionImageUrl: current.questionImageUrl,
                solutionImageUrl: current.solutionImageUrl,
                source:           current.isMock ? "mock" : "cms",
              }]
        );

        clearTimers();
        addTimer(() => {
          setMonsterCounter(false);
          setFeedback(null);
          setCardAnim("");
        }, 720);
      }

      // ── adaptive difficulty: level down + retry same concept on wrong ──────
      const downLevel = downAdaptiveLevel(adaptiveLevel);
      setAdaptiveLevel(downLevel);
      setQuestionIndex((i) => i + 1);
      // Almost Win → force LOW to give the easiest possible next question
      const retryLevel: QuestionLevel = correctCount === MONSTER_MAX_HP - 1 ? "LOW" : downLevel;
      setCurrentQuestion(pickRetryQuestion(questions, current.conceptName, retryLevel, current.id));
    }

    setInput("");
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [phase, input, current, combo, correctCount, skillCharge, shieldActive, selectedDifficulty, currentTypeId, questions.length, cmsQuestions.length, play, clearTimers, addTimer, markDailyComplete]);

  // ── stage control ─────────────────────────────────────────────────────────────

  /** Show difficulty picker before entering a type.
   *  Automatically sets gameMode from the region's fixed mode so the player
   *  never has to pick a mode manually. */
  const showDifficultySelect = useCallback((typeId: number) => {
    // Each region has a fixed mode — apply it before showing the difficulty screen.
    const info = getTypeInfo(typeId);
    setGameMode(info.mode);
    try { localStorage.setItem("mathGameMode", info.mode); } catch { /* ignore */ }

    // 지역 클릭 확인 로그
    console.log("[지역 선택]", {
      "selectedRegion.id":    info.id,
      "selectedRegion.title": info.title,
      "selectedRegion.type":  info.mode,
      "currentMode":          info.mode,
    });

    setPendingTypeId(typeId);
    setCmsQuestions([]);
    setCmsPool([]);
    setCmsResult(null);
    setPhase("difficultySelect");
    // Load ALL CMS concepts in parallel; each failure is logged but doesn't abort others.
    setCmsLoading(true);
    const validConcepts = CMS_CONCEPTS.filter((c) => !CMS_BLOCKED_IDS_STATIC.has(c.id));
    fetchMultipleConcepts(validConcepts).then(({ questions, failures }) => {
      setCmsPool(questions);
      // Build a summary CmsResult for the debug panel
      setCmsResult({
        questions,
        totalRaw:    questions.length,
        filterStats: {
          active:        questions.length,
          visible:       questions.length,
          scorable:      questions.length,
          shortAnswer:   questions.length,
          autoScoring1:  questions.length,
          nChoice0:      questions.length,
          numericAnswer: questions.length,
        },
        errorCode:   failures.length > 0 ? "PARTIAL_FAILURE" : null,
        errorDetail: failures.length > 0 ? `conceptId 로드 실패: ${failures.join(", ")}` : null,
        debug:       questions.length === 0 ? "CMS에서 문제를 가져오지 못했습니다. mock 문제를 사용합니다." : null,
      });
      setCmsLoading(false);
    }).catch(() => {
      setCmsPool([]);
      setCmsLoading(false);
    });
  }, []);

  /**
   * 월드 선택 화면에서 특정 지역을 선택할 때 호출.
   * - gameMode 를 해당 지역 mode 로 설정
   * - CMS 문제를 백그라운드 로드
   * - regionMap 페이즈로 전환 (지역 전용 맵 표시)
   */
  const enterWorld = useCallback((mode: GameMode) => {
    const typeInfo = FLAT_TYPES.find((t) => t.mode === mode) ?? FLAT_TYPES[0];
    setGameMode(mode);
    try { localStorage.setItem("mathGameMode", mode); } catch { /* ignore */ }
    setPendingTypeId(typeInfo.id);
    setCmsQuestions([]);
    setCmsPool([]);
    setCmsResult(null);
    setCmsLoading(true);
    console.log("[월드 진입]", { mode, typeId: typeInfo.id, zoneName: typeInfo.zoneName });
    const validConcepts = CMS_CONCEPTS.filter((c) => !CMS_BLOCKED_IDS_STATIC.has(c.id));
    fetchMultipleConcepts(validConcepts).then(({ questions, failures }) => {
      setCmsPool(questions);
      setCmsResult({
        questions,
        totalRaw:    questions.length,
        filterStats: {
          active: questions.length, visible: questions.length, scorable: questions.length,
          shortAnswer: questions.length, autoScoring1: questions.length,
          nChoice0: questions.length, numericAnswer: questions.length,
        },
        errorCode:   failures.length > 0 ? "PARTIAL_FAILURE" : null,
        errorDetail: failures.length > 0 ? `conceptId 로드 실패: ${failures.join(", ")}` : null,
        debug:       questions.length === 0 ? "CMS에서 문제를 가져오지 못했습니다. mock 사용." : null,
      });
      setCmsLoading(false);
    }).catch(() => {
      setCmsPool([]);
      setCmsLoading(false);
    });
    setPhase("regionMap");
  }, []);

  /** Clears the CMS pool and session questions, reverting to mock fallback. */
  const clearCmsQuestions = useCallback(() => {
    setCmsPool([]);
    setCmsQuestions([]);
    setCmsResult(null);
  }, []);

  const startType = useCallback((typeId: number, difficulty: Difficulty = "normal") => {
    const cfg = DIFFICULTY_CONFIG[difficulty];

    // ── Select mode-specific questions from the CMS pool ──────────────────────
    const hasCmsPool = cmsPool.length > 0;
    const sessionQuestions = hasCmsPool
      ? selectQuestionsForMode(cmsPool, gameMode, wrongQuestionIds)
      : [];

    // Fallback policy:
    // 1. CMS mode-filtered questions (preferred)
    // 2. Full CMS pool shuffled — when CMS has data but mode filter yielded nothing
    // 3. Mock questions — ONLY when CMS fetch failed or pool is empty
    const activePool =
      sessionQuestions.length > 0
        ? sessionQuestions
        : hasCmsPool
          ? shuffleArr(cmsPool).slice(0, 15)
          : getQuestionsForStage(typeId);

    const usingMock = !hasCmsPool;
    if (usingMock) {
      // Reason: errorCode from the most recent CMS fetch attempt, if any
      const reason = cmsResult?.errorCode
        ? `CMS 오류: ${cmsResult.errorCode}${cmsResult.errorDetail ? ` (${cmsResult.errorDetail})` : ""}`
        : "CMS 미로드 또는 응답 없음";
      console.warn(
        `[MOCK] conceptId=${typeId} | fallback=true | 사유: ${reason}` +
        ` | 게임모드=${gameMode}`,
      );
    }

    // ── Difficulty rules from CMS median difficulty ────────────────────────────
    const med     = medianDifficulty(sessionQuestions);
    const diffRule = CMS_DIFFICULTY_RULES[med] ?? CMS_DIFFICULTY_RULES[1];

    clearTimers();
    setCurrentTypeId(typeId);
    setSelectedDifficulty(difficulty);
    setCorrectCount(0);
    setQuestionIndex(0);
    setAdaptiveLevel("LOW");
    setCurrentQuestion(pickQuestion(activePool, "LOW"));
    setCmsQuestions(activePool);
    setCombo(0);
    // Time = base TOTAL_TIME + DIFFICULTY_CONFIG bonus + CMS difficulty bonus + zone-mode bonus
    setTimeLeft(TOTAL_TIME + cfg.timeBonus + (cmsPool.length > 0 ? diffRule.timeBonus : 0) + MODE_EXTRA_TIME[gameMode]);
    setFeedback(null);
    setFeedbackKey(0);
    setCardAnim("");
    setCharAttacking(false);
    setMonsterHit(false);
    setMonsterCounter(false);
    setDamageKey(0);
    setSkillCharge(0);
    setSkillReady(false);
    setShieldActive(false);
    // grow: 무제한 생명 (HP 개념 없음), puzzle: 관대하게 5칸, battle: 일반
    setPlayerLives(
      gameMode === "grow"   ? 99 :
      gameMode === "puzzle" ? 5  :
      difficulty === "hard" ? 2  : 3,
    );
    // grow mode EXP reset
    setGrowExp(0);
    setGrowLevel(1);
    setLevelUpOpen(false);
    setLevelUpChoices([]);
    setGrowScoreMult(1.0);
    setGrowExpMult(1.0);
    // Show travel screen first; useEffect below advances to "playing"
    setPhase("travel");
  }, [clearTimers, cmsPool, cmsResult, gameMode, wrongQuestionIds]);

  /** Fire the special skill (3-HP fixed damage) */
  const useSkill = useCallback(() => {
    if (phase !== "playing" || !skillReady) return;

    const SKILL_DAMAGE = 3;
    const coinMult     = DIFFICULTY_CONFIG[selectedDifficulty].coinMult;
    const newCount     = Math.min(correctCount + SKILL_DAMAGE, MONSTER_MAX_HP);
    const shouldClear  = newCount >= MONSTER_MAX_HP;

    setSkillCharge(0);
    setSkillReady(false);
    play("skill");
    setFeedbackKey((k) => k + 1);
    setFeedback("💥 스킬 발동!");
    setCardAnim("bounce");
    setCharAttacking(true);
    setDamageKey((k) => k + 1);
    setMonsterHit(true);

    clearTimers();

    addTimer(() => {
      setCorrectCount(newCount);
    }, 200);

    addTimer(() => {
      setCharAttacking(false);
      setMonsterHit(false);
      setFeedback(null);
      setCardAnim("");
    }, 800);

    if (shouldClear) {
      setCoins((c) => c + Math.round(20 * coinMult));
      setClearedTypeIds((prev) =>
      prev.includes(currentTypeId) ? prev : [...prev, currentTypeId]
    );
    setUnlockedTypeId((prev) => {
      const next = getNextType(currentTypeId);
      if (!next) return prev;
      return getTypeIndex(next.id) > getTypeIndex(prev) ? next.id : prev;
    });
    setStagesClearedToday((t) => t + 1);
      markDailyComplete(); // skill kills boss → daily goal met
      addTimer(() => { play("clear"); setPhase("stageClear"); }, 950);
    }
  }, [phase, skillReady, correctCount, selectedDifficulty, currentTypeId, play, clearTimers, addTimer, markDailyComplete]);

  /** Use a battle item (playing or review phase) */
  const useItem = useCallback((id: ItemId) => {
    if (inventory[id] <= 0) return;
    if (phase !== "playing" && phase !== "review") return;

    // Consume one unit
    setInventory((prev) => ({ ...prev, [id]: prev[id] - 1 }));

    if (id === "potion") {
      // Time potion — only in playing (review has no timer)
      if (phase !== "playing") return;
      play("item");
      setTimeLeft((t) => t + 10);
      setFeedbackKey((k) => k + 1);
      setFeedback("⏰ +10초!");
      clearTimers();
      addTimer(() => setFeedback(null), 800);

    } else if (id === "shield") {
      play("item");
      setShieldActive(true);
      setFeedbackKey((k) => k + 1);
      setFeedback("🛡️ 보호막 활성화!");
      clearTimers();
      addTimer(() => setFeedback(null), 800);

    } else if (id === "bomb") {
      play("skill");
      setFeedbackKey((k) => k + 1);
      setFeedback("💣 폭탄 투척!");
      setMonsterHit(true);
      setDamageKey((k) => k + 1);
      clearTimers();

      if (phase === "playing") {
        const BOMB_DAMAGE = 2;
        const coinMult    = DIFFICULTY_CONFIG[selectedDifficulty].coinMult;
        const newCount    = Math.min(correctCount + BOMB_DAMAGE, MONSTER_MAX_HP);
        const shouldClear = newCount >= MONSTER_MAX_HP;

        addTimer(() => { setCorrectCount(newCount); }, 200);
        addTimer(() => {
          setMonsterHit(false);
          setFeedback(null);
        }, 800);

        if (shouldClear) {
          setCoins((c) => c + Math.round(20 * coinMult));
          setClearedTypeIds((prev) => prev.includes(currentTypeId) ? prev : [...prev, currentTypeId]);
          setUnlockedTypeId((prev) => {
            const next = getNextType(currentTypeId);
            if (!next) return prev;
            return getTypeIndex(next.id) > getTypeIndex(prev) ? next.id : prev;
          });
          addTimer(() => setPhase("stageClear"), 950);
        }

      } else {
        // review: remove 2 wrong questions
        addTimer(() => {
          setWrongQuestions((prev) => {
            const updated = prev.slice(Math.min(2, prev.length));
            if (updated.length === 0) {
              setCoins((c) => c + 30);
              setReviewDoneToday((t) => t + 1);
              setLifetimeStats((s) => {
                const next = { ...s, reviewsDone: s.reviewsDone + 1 };
                saveLifetimeStats(next);
                return next;
              });
              setPhase("reviewClear");
            } else {
              setReviewIndex((i) => Math.min(i, updated.length - 1));
            }
            return updated;
          });
          setMonsterHit(false);
          setFeedback(null);
        }, 800);
      }
    }
  }, [
    inventory, phase, correctCount, selectedDifficulty, currentTypeId,
    shieldActive, play, clearTimers, addTimer,
  ]);

  /** Return to current region's map without resetting score/progress */
  const goToMap = useCallback(() => {
    clearTimers();
    setFeedback(null);
    setCardAnim("");
    setShopMsg(null);
    setPhase("regionMap");
  }, [clearTimers]);

  /** Open the shop */
  const goToShop = useCallback(() => {
    setShopMsg(null);
    setPhase("shop");
  }, []);

  /** Open teacher dashboard */
  const goToTeacherDashboard = useCallback(() => {
    clearTimers();
    setPhase("teacherDashboard");
  }, [clearTimers]);

  /** Toggle user role between student / teacher and persist */
  const toggleUserRole = useCallback(() => {
    setUserRole((prev) => {
      const next: UserRole = prev === "student" ? "teacher" : "student";
      saveUserRole(next);
      return next;
    });
  }, []);

  /** Claim a daily quest reward */
  const claimQuest = useCallback((id: QuestId, reward: number) => {
    if (claimedQuests.includes(id)) return;
    setClaimedQuests((prev) => [...prev, id]);
    setCoins((c) => c + reward);
  }, [claimedQuests]);

  /** Claim daily attendance reward */
  const claimAttendance = useCallback(() => {
    if (attendanceClaimed) return;
    setAttendanceClaimed(true);
    setCoins((c) => c + 20);
  }, [attendanceClaimed]);

  /** Enter review dungeon */
  const startReview = useCallback(() => {
    clearTimers();
    setReviewIndex(0);
    setReviewInitialCount(wrongQuestions.length);
    setFeedback(null);
    setFeedbackKey(0);
    setCardAnim("");
    setCharAttacking(false);
    setMonsterHit(false);
    setMonsterCounter(false);
    setDamageKey(0);
    setCombo(0);
    setInput("");
    setPhase("review");
  }, [clearTimers, wrongQuestions.length]);

  /** Check answer inside review dungeon */
  const checkReview = useCallback(() => {
    if (phase !== "review" || wrongQuestions.length === 0) return;

    const actualIdx = reviewIndex % wrongQuestions.length;
    const question  = wrongQuestions[actualIdx];

    if (normalizeAnswer(input) === normalizeAnswer(question.answer)) {
      play("correct");
      setLifetimeStats((prev) => {
        const next = { ...prev, totalSolved: prev.totalSolved + 1, totalCorrect: prev.totalCorrect + 1 };
        saveLifetimeStats(next);
        return next;
      });
      const updated = wrongQuestions.filter((_, i) => i !== actualIdx);
      setWrongQuestions(updated);
      setFeedbackKey((k) => k + 1);
      setFeedback("💡 약점 극복!");
      setCardAnim("bounce");
      setCharAttacking(true);
      setMonsterHit(true);
      setDamageKey((k) => k + 1);

      clearTimers();
      addTimer(() => {
        setCharAttacking(false);
        setMonsterHit(false);
        setFeedback(null);
        setCardAnim("");
        if (updated.length === 0) {
          setCoins((c) => c + 30);
          setReviewDoneToday((t) => t + 1);
          setLifetimeStats((s) => {
            const next = { ...s, reviewsDone: s.reviewsDone + 1 };
            saveLifetimeStats(next);
            return next;
          });
          setPhase("reviewClear");
        } else {
          setReviewIndex((i) => Math.min(i, updated.length - 1));
        }
      }, 720);
    } else if (shieldActive) {
      play("item");
      setLifetimeStats((prev) => {
        const next = { ...prev, totalSolved: prev.totalSolved + 1, totalWrong: prev.totalWrong + 1 };
        saveLifetimeStats(next);
        return next;
      });
      setShieldActive(false);
      setFeedbackKey((k) => k + 1);
      setFeedback("🛡️ 보호막 발동!");
      clearTimers();
      addTimer(() => setFeedback(null), 800);
    } else {
      play("wrong");
      setLifetimeStats((prev) => {
        const next = { ...prev, totalSolved: prev.totalSolved + 1, totalWrong: prev.totalWrong + 1 };
        saveLifetimeStats(next);
        return next;
      });
      setFeedbackKey((k) => k + 1);
      setFeedback("❌ 아직 어려워요!");
      setCardAnim("shake");
      setMonsterCounter(true);

      clearTimers();
      addTimer(() => {
        setFeedback(null);
        setCardAnim("");
        setMonsterCounter(false);
        setReviewIndex((i) => (i + 1) % wrongQuestions.length);
      }, 720);
    }

    setInput("");
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [phase, input, wrongQuestions, reviewIndex, shieldActive, play, clearTimers, addTimer]);

  const setAndSaveGameMode = useCallback((mode: GameMode) => {
    setGameMode(mode);
    try { localStorage.setItem("mathGameMode", mode); } catch { /* ignore */ }
  }, []);

  /** Continue to next type from stageClear — pick difficulty again */
  const goNextStage = useCallback(() => {
    const next = getNextType(currentTypeId);
    if (!next) goToResult();
    else showDifficultySelect(next.id);
  }, [currentTypeId, goToResult, showDifficultySelect]);

  /** Full reset — used only from the result screen */
  const restartAll = useCallback(() => {
    clearTimers();
    try { localStorage.removeItem(saveKey(_currentStudentId)); } catch { /* ignore */ }
    setUnlockedTypeId(FIRST_TYPE_ID);
    setClearedTypeIds([]);
    setScore(0);
    setCoins(0);
    setPurchasedCharacters([]);
    setSelectedCharacter(HERO_IMG);
    setWrongQuestions([]);
    setReviewIndex(0);
    setShopMsg(null);
    setClaimedQuests([]);
    setPhase("modeSelect");
  }, [clearTimers]);

  // ── derived ───────────────────────────────────────────────────────────────────
  const timerPct      = (timeLeft / TOTAL_TIME) * 100;
  const timerColor    = timeLeft > 30 ? "text-emerald-600" : timeLeft > 10 ? "text-orange-500" : "text-red-500";
  const timerBarColor = timeLeft > 30 ? "bg-emerald-400"   : timeLeft > 10 ? "bg-orange-400"   : "bg-red-400";

  // ─── teacher dashboard ──────────────────────────────────────────────────────
  if (phase === "teacherDashboard") {
    return (
      <TeacherDashboardScreen
        studentList={studentList}
        selectedStudentId={selectedStudentId}
        teacherConfig={teacherConfig}
        userRole={userRole}
        onSelectStudent={switchStudent}
        onSaveConfig={(cfg) => {
          setTeacherConfig(cfg);
          saveTeacherConfig(cfg);
        }}
        onToggleRole={toggleUserRole}
        onClose={() => setPhase("modeSelect")}
      />
    );
  }

  // ─── mode select screen ─────────────────────────────────────────────────────
  if (phase === "modeSelect") {
    const MODES: {
      id: LearningMode;
      emoji: string;
      label: string;
      desc: string;
      badge?: string;
      color: string;
      border: string;
      glow: string;
    }[] = [
      {
        id:    "growth",
        emoji: "🌱",
        label: "성장 모드",
        desc:  "차근차근 실력 키우기",
        badge: "추천",
        color: "linear-gradient(135deg,rgba(52,211,153,0.18) 0%,rgba(16,185,129,0.08) 100%)",
        border: "rgba(52,211,153,0.45)",
        glow:   "rgba(52,211,153,0.25)",
      },
      {
        id:    "challenge",
        emoji: "⚡",
        label: "도전 모드",
        desc:  "빠르게 풀고 점수 올리기",
        color: "linear-gradient(135deg,rgba(250,204,21,0.18) 0%,rgba(245,158,11,0.08) 100%)",
        border: "rgba(250,204,21,0.45)",
        glow:   "rgba(250,204,21,0.20)",
      },
      {
        id:    "review",
        emoji: "🔁",
        label: "복습 모드",
        desc:  "틀린 문제 다시 도전",
        color: "linear-gradient(135deg,rgba(129,140,248,0.18) 0%,rgba(99,102,241,0.08) 100%)",
        border: "rgba(129,140,248,0.45)",
        glow:   "rgba(129,140,248,0.22)",
      },
    ];

    // LearningMode(홈 카드) → GameMode 매핑
    const LEARNING_TO_GAME: Record<LearningMode, GameMode> = {
      growth:    "grow",
      challenge: "battle",
      review:    "puzzle",
    };

    const handleModeSelect = (mode: LearningMode) => {
      setLearningMode(mode);
      if (mode === "review" && wrongQuestions.length > 0) {
        // 오답이 있으면 복습 모드 바로 진입
        startReview();
      } else {
        // 홈 카드 클릭 → 해당 지역 전용 맵으로 바로 진입 (ready 우회)
        enterWorld(LEARNING_TO_GAME[mode]);
      }
    };

    const selectedStudentName = studentList.find((s) => s.id === selectedStudentId)?.name ?? "학생";

    /* ── 모드 카드 메타데이터 ── */
    type ModeCardMeta = {
      id:       LearningMode;
      emoji:    string;
      label:    string;
      desc:     string;
      badge?:   string;
      topBg:    string;   // 일러스트 상단 배경색
      topFrom:  string;   // 그라데이션 시작 (같은 계열, 살짝 어두운)
      glowColor:string;   // hover/active glow
      keywords: string[]; // 카드 안 작은 키워드 칩
    };

    const MODE_CARDS: ModeCardMeta[] = [
      {
        id:        "growth",
        /* 🌲 숲의 성장 지역 — 초원과 나무가 우거진 평화로운 시작 지역 */
        emoji:     "🌲",
        label:     "숲의 성장 지역",
        desc:      "숲 속 마을에서 차근차근 실력을 키워요",
        badge:     "추천",
        topBg:     "#065f46",
        topFrom:   "#047857",
        glowColor: "rgba(5,95,70,0.45)",
        keywords:  ["단계별 성장", "스탯 업", "무제한"],
      },
      {
        id:        "challenge",
        /* 🌋 불꽃의 협곡 — 용암과 바위가 솟은 스피드 도전 지역 */
        emoji:     "🌋",
        label:     "불꽃의 협곡",
        desc:      "협곡을 질주하며 최고 점수를 노려요",
        topBg:     "#991b1b",
        topFrom:   "#b91c1c",
        glowColor: "rgba(153,27,27,0.45)",
        keywords:  ["제한 시간", "콤보 보너스", "스피드"],
      },
      {
        id:        "review",
        /* 🏰 지혜의 탑 — 고대 마법 도서관이 있는 복습의 탑 */
        emoji:     "🏰",
        label:     "지혜의 탑",
        desc:      "탑 속 도서관에서 약점을 완전 극복",
        topBg:     "#4c1d95",
        topFrom:   "#5b21b6",
        glowColor: "rgba(76,29,149,0.45)",
        keywords:  ["약점 분석", "오답 노트", "완벽 마스터"],
      },
    ];

    return (
      <main
        className="min-h-screen flex flex-col overflow-hidden relative"
        style={{
          /* 3단 레이어: 하늘 → 초원 → 황혼 */
          background: "linear-gradient(180deg, #bfdbfe 0%, #a7f3d0 38%, #fef9c3 72%, #fed7aa 100%)",
        }}
      >
        {/* 배경 장식 레이어 — 구름 */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div className="animate-cloud-drift absolute text-5xl opacity-30" style={{ top: "6%",  left: "5%"  }}>☁️</div>
          <div className="animate-cloud-drift-slow absolute text-4xl opacity-20" style={{ top: "12%", right: "8%" }}>☁️</div>
          <div className="animate-cloud-drift absolute text-3xl opacity-25" style={{ top: "4%",  left: "45%" }}>☁️</div>
          {/* 별 장식 */}
          <div className="animate-star-twinkle absolute text-2xl opacity-40" style={{ top: "18%", left: "12%" }}>✨</div>
          <div className="animate-star-twinkle absolute text-xl  opacity-30" style={{ top: "22%", right: "15%", animationDelay: "0.8s" }}>⭐</div>
          {/* 지면 나무 실루엣 */}
          <div className="absolute bottom-0 left-0 right-0" style={{
            height: "80px",
            background: "linear-gradient(180deg, transparent 0%, rgba(16,185,129,0.12) 60%, rgba(5,150,105,0.18) 100%)",
          }} />
        </div>
        {/* ── 헤더 ── */}
        <div
          className="relative z-10 w-full mx-auto flex-shrink-0 px-5 pt-6 pb-2 flex items-center justify-between"
          style={{ maxWidth: "900px" }}
        >
          <div>
            <h1
              className="font-black leading-none"
              style={{
                fontSize:      "clamp(22px,6vw,28px)",
                letterSpacing: "-0.03em",
                color:         "#1e3a5f",
                textShadow:    "0 2px 8px rgba(255,255,255,0.6)",
              }}
            >
              매쓰플랫 퀘스트
            </h1>
            <p className="font-bold text-teal-700 mt-0.5 opacity-80" style={{ fontSize: "13px" }}>
              🗺️ 수학 탐험을 시작해보세요!
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* 교사용 버튼 — userRole에 따라 조건 노출 */}
            {userRole === "teacher" && (
              <button
                onClick={goToTeacherDashboard}
                className="rounded-xl px-3 py-1.5 font-black text-xs text-white transition-all active:scale-90"
                style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", boxShadow: "0 2px 8px rgba(109,40,217,0.35)" }}
                title="교사 대시보드"
              >
                👩‍🏫 교사용
              </button>
            )}
            {/* role 전환 버튼 (작게) */}
            <button
              onClick={toggleUserRole}
              className="rounded-xl px-2.5 py-1.5 text-[10px] font-bold transition-all active:scale-90"
              style={{ background: "rgba(0,0,0,0.06)", color: "#64748b" }}
              title={userRole === "teacher" ? "학생 모드로 전환" : "교사 모드로 전환"}
            >
              {userRole === "teacher" ? "학생용" : "교사용"}
            </button>
            <div className="flex items-center gap-1.5 rounded-2xl px-4 py-2 bg-amber-50">
              <span className="text-lg leading-none">💰</span>
              <span className="font-black text-amber-700" style={{ fontSize: "clamp(15px,4vw,19px)" }}>
                {coins}
              </span>
            </div>
          </div>
        </div>

        {/* ── 캐릭터 + 말풍선 (상단 중앙) ── */}
        <div
          className="relative z-10 w-full mx-auto flex-shrink-0 flex flex-col items-center gap-3 py-3 animate-pop-in"
          style={{ maxWidth: "900px" }}
        >
          <img
            src={HERO_IMG}
            alt="캐릭터"
            className="animate-idle-float"
            style={{
              width:     "clamp(100px,24vw,150px)",
              height:    "clamp(100px,24vw,150px)",
              objectFit: "contain",
              filter:    "drop-shadow(0 8px 20px rgba(0,0,0,0.18))",
            }}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          {/* 말풍선 */}
          <div className="relative">
            <div
              className="rounded-2xl px-5 py-3 bg-white text-center"
              style={{ boxShadow: "0 8px 28px rgba(79,70,229,0.18), 0 2px 8px rgba(0,0,0,0.1)" }}
            >
              <p className="font-bold text-slate-700" style={{ fontSize: "clamp(14px,3.8vw,17px)" }}>
                {selectedStudentName} 학생, 어떤 지역으로 모험을 떠날까요? 🗺️
              </p>
            </div>
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                top: "-8px",
                width: 0, height: 0,
                borderLeft:   "7px solid transparent",
                borderRight:  "7px solid transparent",
                borderBottom: "8px solid #fff",
              }}
            />
          </div>
        </div>

        {/* ── 카드 영역 ── */}
        <div
          className="relative z-10 flex-1 flex flex-col justify-center"
          style={{ minHeight: "0" }}
        >
          {/*
            Outer: overflow-x scroll (activates only when inner > outer width).
            Inner: min-width 100% + width max-content + justify-center
              → wide screen: min-width wins → cards centered
              → narrow screen: max-content wins → cards packed, outer scrolls
          */}
          <div
            style={{
              overflowX:                "auto",
              overflowY:                "hidden",
              WebkitOverflowScrolling:  "touch",
              scrollbarWidth:           "none",
              width:                    "100%",
            }}
          >
            <div
              style={{
                display:         "flex",
                gap:             "16px",
                padding:         "16px 24px",
                justifyContent:  "center",
                width:           "max-content",
                minWidth:        "100%",
                boxSizing:       "border-box",
                scrollSnapType:  "x mandatory",
              }}
            >
            {MODE_CARDS.map((m, i) => {
              const isCenter = i === 1;
              return (
                <div
                  key={m.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleModeSelect(m.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleModeSelect(m.id); } }}
                  className="rounded-3xl overflow-hidden cursor-pointer select-none animate-pop-in"
                  style={{
                    width:           "clamp(240px, calc(100vw - 48px), 290px)",
                    maxWidth:        "290px",
                    height:          "340px",
                    flexShrink:      0,
                    scrollSnapAlign: "center",
                    animationDelay:  `${i * 0.08}s`,
                    transform:       isCenter ? "scale(1.04)" : "scale(1)",
                    transformOrigin: "center center",
                    transition:      "transform 0.25s ease, box-shadow 0.25s ease",
                    boxShadow:       isCenter
                      ? `0 8px 32px ${m.glowColor}, 0 2px 8px rgba(0,0,0,0.08)`
                      : "0 4px 16px rgba(0,0,0,0.07)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = "scale(1.07)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = `0 16px 48px ${m.glowColor}, 0 4px 12px rgba(0,0,0,0.12)`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = isCenter ? "scale(1.04)" : "scale(1)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = isCenter
                      ? `0 8px 32px ${m.glowColor}, 0 2px 8px rgba(0,0,0,0.08)`
                      : "0 4px 16px rgba(0,0,0,0.07)";
                  }}
                >
                  {/* ── 상단 일러스트 영역 (60%) ── */}
                  <div
                    className="relative flex flex-col items-center justify-center"
                    style={{
                      height:     "204px",
                      background: `linear-gradient(160deg, ${m.topBg} 0%, ${m.topFrom} 100%)`,
                      overflow:   "hidden",
                    }}
                  >
                    {/* 하늘 배경 원 */}
                    <div className="absolute" style={{ width: "200px", height: "200px", borderRadius: "50%", background: "rgba(255,255,255,0.07)", top: "-50px", right: "-50px" }} />
                    <div className="absolute" style={{ width: "120px", height: "120px", borderRadius: "50%", background: "rgba(255,255,255,0.05)", bottom: "-25px", left: "-25px" }} />
                    {/* 별/파티클 */}
                    <div className="animate-star-twinkle absolute text-lg opacity-60" style={{ top: "18%", left: "12%" }}>✨</div>
                    <div className="animate-star-twinkle absolute text-base opacity-40" style={{ bottom: "22%", right: "14%", animationDelay: "1.1s" }}>⭐</div>
                    {/* 지형 지면 */}
                    <div
                      className="animate-terrain absolute bottom-0 left-0 right-0"
                      style={{
                        height:     "40px",
                        background: "rgba(255,255,255,0.08)",
                        borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
                      }}
                    />

                    {/* 메인 이모지 */}
                    <div
                      className="relative z-10 animate-idle-float"
                      style={{ fontSize: "72px", lineHeight: 1, filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.25))" }}
                    >
                      {m.emoji}
                    </div>

                    {/* 추천 배지 */}
                    {m.badge && (
                      <div
                        className="absolute top-3 right-3 text-xs font-semibold rounded-full px-2.5 py-1"
                        style={{ background: "rgba(255,255,255,0.25)", color: "#fff", backdropFilter: "blur(4px)" }}
                      >
                        ⭐ {m.badge}
                      </div>
                    )}

                    {/* 오답 대기 알림 (복습 모드) */}
                    {m.id === "review" && wrongQuestions.length > 0 && (
                      <div
                        className="absolute bottom-3 text-xs font-semibold rounded-full px-3 py-1"
                        style={{ background: "rgba(255,255,255,0.25)", color: "#fff", backdropFilter: "blur(4px)" }}
                      >
                        📝 {wrongQuestions.length}개 대기 중
                      </div>
                    )}
                  </div>

                  {/* ── 하단 텍스트 영역 (40%) ── */}
                  <div
                    className="flex flex-col justify-between"
                    style={{
                      height:     "136px",
                      padding:    "16px 18px 14px",
                      background: `linear-gradient(180deg, rgba(255,255,255,0.97) 0%, #fff 100%)`,
                    }}
                  >
                    <div>
                      <p className="font-black leading-tight mb-1" style={{ fontSize: "19px", letterSpacing: "-0.02em", color: "#1e293b" }}>
                        {m.label}
                      </p>
                      <p className="font-semibold leading-snug" style={{ fontSize: "13px", color: "#64748b" }}>
                        {m.desc}
                      </p>
                    </div>

                    {/* 키워드 칩 */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {m.keywords.map((kw) => (
                        <span
                          key={kw}
                          className="font-bold rounded-full px-2.5 py-1"
                          style={{ fontSize: "11px", background: `${m.glowColor.replace("0.45","0.12")}`, color: m.topBg, border: `1px solid ${m.glowColor.replace("0.45","0.3")}` }}
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>

          {/* 스크롤 힌트 점 */}
          <div className="flex items-center justify-center gap-1.5 pb-2">
            {MODE_CARDS.map((m, i) => (
              <div
                key={m.id}
                style={{
                  width:     i === 1 ? "20px" : "6px",
                  height:    "6px",
                  borderRadius: "9999px",
                  background: i === 1 ? "#2563eb" : "#cbd5e1",
                  transition: "all 0.2s",
                }}
              />
            ))}
          </div>
        </div>

        {/* ── 하단 요약 ── */}
        <div
          className="w-full mx-auto flex-shrink-0 flex items-center justify-center gap-3 pb-6 pt-1"
          style={{ maxWidth: "900px" }}
        >
          <span className="text-xs font-medium text-slate-400">💰 {coins}</span>
          {wrongQuestions.length > 0 && (
            <span className="text-xs font-medium text-slate-400">· 📝 오답 {wrongQuestions.length}</span>
          )}
          {lifetimeStats.streakDays > 0 && (
            <span className="text-xs font-medium text-slate-400">· 🔥 {lifetimeStats.streakDays}일</span>
          )}
        </div>
      </main>
    );
  }

  // ─── ready / world selection screen ──────────────────────────────────────────
  if (phase === "ready") {
    const modes: GameMode[] = ["grow", "battle", "puzzle"];
    return (
      <main
        className="min-h-screen flex flex-col overflow-hidden"
        style={{ background: "linear-gradient(180deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)" }}
      >
        {/* 배경 별 효과 */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {["✨","⭐","💫","✨","⭐","💫","✨","⭐"].map((s, i) => (
            <div key={i} className="animate-star-twinkle absolute" style={{
              top: `${5 + i * 12}%`, left: `${4 + i * 13}%`,
              fontSize: i % 2 === 0 ? "1.1rem" : "0.8rem", opacity: 0.3,
              animationDelay: `${i * 0.6}s`,
            }}>{s}</div>
          ))}
        </div>

        <div className="relative z-10 flex flex-col min-h-screen px-4 pt-5 pb-8">
          {/* ── 상단 헤더 ── */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setPhase("modeSelect")}
              className="rounded-2xl border border-white/20 bg-white/8 hover:bg-white/15 active:scale-95 text-white/70 px-4 py-2 font-bold text-sm transition-all"
            >
              ← 홈
            </button>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 rounded-2xl bg-white/10 px-3 py-1.5">
                <span className="text-sm">💰</span>
                <span className="font-black text-yellow-300 text-sm">{coins}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl bg-white/10 px-3 py-1.5">
                <span className="text-sm">🏆</span>
                <span className="font-black text-amber-300 text-sm">{bestScore}</span>
              </div>
              <button onClick={goToShop} className="rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 px-3 py-1.5 font-bold text-sm text-white/80 transition-all">
                🛒
              </button>
            </div>
          </div>

          {/* ── 타이틀 ── */}
          <div className="text-center mb-8">
            <p className="font-black text-white/30 text-xs tracking-[0.25em] uppercase mb-2">SELECT YOUR WORLD</p>
            <h1 className="font-black text-white text-3xl" style={{ textShadow: "0 0 30px rgba(255,255,255,0.2)", letterSpacing: "-0.02em" }}>
              지역 선택
            </h1>
            <p className="text-white/40 text-sm mt-1.5">어떤 세계에서 수학을 배울까요?</p>
          </div>

          {/* ── 월드 카드 3장 ── */}
          <div className="flex flex-col gap-4 max-w-md mx-auto w-full flex-1">
            {modes.map((mode) => {
              const wc = WORLD_CARDS[mode];
              const typeForMode = FLAT_TYPES.find((t) => t.mode === mode);
              const isCleared   = typeForMode ? clearedTypeIds.includes(typeForMode.id) : false;
              return (
                <button
                  key={mode}
                  onClick={() => enterWorld(mode)}
                  className="relative rounded-3xl overflow-hidden text-left transition-all active:scale-97 hover:scale-[1.02]"
                  style={{
                    background:    wc.bgCard,
                    border:        `2px solid ${wc.border}`,
                    boxShadow:     `0 8px 32px ${wc.glow}, 0 2px 8px rgba(0,0,0,0.4)`,
                    padding:       "20px 22px",
                  }}
                >
                  {/* 클리어 배지 */}
                  {isCleared && (
                    <div className="absolute top-3 right-3 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-black text-white">
                      ✅ 클리어
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    {/* 월드 이모지 */}
                    <div className="flex-shrink-0 text-5xl select-none" style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }}>
                      {wc.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* 배지 */}
                      <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 mb-1 font-bold text-[10px]"
                           style={{ background: `${wc.border}33`, color: "rgba(255,255,255,0.7)", border: `1px solid ${wc.border}` }}>
                        {wc.badge}
                      </div>
                      <div className="font-black text-white text-lg leading-tight">{wc.title}</div>
                      <div className="text-white/50 text-xs mt-0.5 leading-snug">{wc.desc}</div>
                    </div>
                    <div className="flex-shrink-0 text-white/40 text-2xl select-none">›</div>
                  </div>
                  {/* 노드 프리뷰 */}
                  <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${wc.border}44` }}>
                    {REGION_NODES[mode].map((n) => (
                      <div key={n.id} className="flex-1 rounded-xl py-1.5 text-center"
                           style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <div className="text-base">{n.emoji}</div>
                        <div className="font-bold text-white/60 text-[9px] mt-0.5">{n.subLabel}</div>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── 복습 숏컷 ── */}
          {wrongQuestions.length > 0 && (
            <div className="max-w-md mx-auto w-full mt-4">
              <button
                onClick={startReview}
                className="w-full rounded-2xl py-3 font-bold text-sm text-indigo-300 transition-all active:scale-95"
                style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)" }}
              >
                📋 오답 복습 ({wrongQuestions.length}문제)
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ─── regionMap screen — 지역 전용 스테이지 맵 ────────────────────────────────
  if (phase === "regionMap") {
    const wc          = WORLD_CARDS[gameMode];
    const nodes       = REGION_NODES[gameMode];
    const typeForMode = FLAT_TYPES.find((t) => t.mode === gameMode) ?? FLAT_TYPES[0];

    /** 노드 클릭 → 해당 난이도로 즉시 게임 시작 (CMS 미로드 시 difficultySelect 경유) */
    const handleNodeClick = (node: RegionNodeConfig) => {
      setSelectedDifficulty(node.difficulty);
      if (cmsLoading) {
        setPendingTypeId(typeForMode.id);
        setPhase("difficultySelect");
      } else {
        startType(typeForMode.id, node.difficulty);
      }
    };

    // 노드 원 크기: 첫 번째(쉬움)가 가장 크고 강조됨
    const nodeSizes = [84, 72, 64];
    // 경로가 지그재그로 보이도록 각 노드 오프셋
    const nodeAligns = ["justify-start", "justify-center", "justify-end"];
    const nodePaddings = ["pl-10", "px-0", "pr-10"];

    // 모드별 스테이지 색상
    const stageColors: Record<GameMode, { nodeFrom: string; nodeTo: string; pathColor: string; sky: string; ground: string; textShadow: string }> = {
      grow:   { nodeFrom: "#059669", nodeTo: "#10b981", pathColor: "#6ee7b7",  sky:    "#bae6fd", ground: "#166534", textShadow: "0 2px 8px rgba(5,150,105,0.7)"   },
      battle: { nodeFrom: "#dc2626", nodeTo: "#f97316", pathColor: "#fca5a5",  sky:    "#fed7aa", ground: "#7c2d12", textShadow: "0 2px 8px rgba(220,38,38,0.7)"  },
      puzzle: { nodeFrom: "#4f46e5", nodeTo: "#7c3aed", pathColor: "#a5b4fc",  sky:    "#e0e7ff", ground: "#1e1b4b", textShadow: "0 2px 8px rgba(79,70,229,0.7)"  },
    };
    const sc = stageColors[gameMode];

    return (
      <main
        className="min-h-screen flex flex-col overflow-hidden select-none"
        style={{ background: `linear-gradient(180deg, ${sc.sky} 0%, ${sc.sky} 55%, ${sc.ground} 100%)` }}
      >
        {/* 배경 — 구름/별 장식 */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {gameMode === "grow" && ["🌸","🍃","🌸","🌿","🌸"].map((s, i) => (
            <div key={i} className="absolute animate-star-twinkle"
                 style={{ top: `${8+i*7}%`, left: `${6+i*18}%`, fontSize: "1.4rem", opacity: 0.35, animationDelay: `${i*0.5}s` }}>{s}</div>
          ))}
          {gameMode === "battle" && ["🔥","⚡","💥","🔥","⚡"].map((s, i) => (
            <div key={i} className="absolute animate-star-twinkle"
                 style={{ top: `${6+i*8}%`, left: `${8+i*17}%`, fontSize: "1.2rem", opacity: 0.3, animationDelay: `${i*0.4}s` }}>{s}</div>
          ))}
          {gameMode === "puzzle" && ["✨","💫","⭐","✨","💫"].map((s, i) => (
            <div key={i} className="absolute animate-star-twinkle"
                 style={{ top: `${5+i*9}%`, left: `${5+i*20}%`, fontSize: "1.1rem", opacity: 0.4, animationDelay: `${i*0.6}s` }}>{s}</div>
          ))}
        </div>

        <div className="relative z-10 flex flex-col min-h-screen max-w-md mx-auto w-full">
          {/* ── 상단 헤더 바 ── */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <button
              onClick={() => setPhase("modeSelect")}
              className="rounded-2xl border border-black/15 bg-white/70 hover:bg-white/90 active:scale-95 text-slate-700 px-4 py-2 font-bold text-sm transition-all backdrop-blur-sm"
            >
              ← 홈
            </button>
            <div className="flex items-center gap-2">
              {cmsLoading
                ? <span className="text-xs font-bold text-slate-600 animate-pulse bg-white/60 rounded-full px-2.5 py-1">⏳ 준비 중</span>
                : <span className="text-xs font-bold text-emerald-700 bg-white/60 rounded-full px-2.5 py-1">✓ {cmsPool.length}문제</span>
              }
              <button onClick={goToShop}
                className="rounded-xl bg-white/70 hover:bg-white/90 active:scale-95 px-3 py-1.5 font-bold text-sm text-slate-600 transition-all backdrop-blur-sm">
                🛒
              </button>
            </div>
          </div>

          {/* ── 월드 제목 (맵 스타일) ── */}
          <div className="text-center px-4 pt-3 pb-5">
            <div className="text-4xl mb-1" style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }}>
              {wc.emoji}
            </div>
            <div className="font-black text-slate-900 text-xl leading-tight" style={{ textShadow: "0 1px 4px rgba(255,255,255,0.8)" }}>
              {wc.title}
            </div>
            <div className="font-bold text-slate-600 text-xs mt-0.5 tracking-wide uppercase">
              {wc.subtitle} · STAGE SELECT
            </div>
          </div>

          {/* ── 스테이지 노드 맵 ── */}
          <div className="flex-1 px-4 pb-6 flex flex-col">
            {nodes.map((node, idx) => {
              const nodeSize = nodeSizes[idx] ?? 64;
              const isFirst  = idx === 0;
              return (
                <div key={node.id}>
                  {/* 경로 라인 */}
                  {idx > 0 && (
                    <div
                      className={`flex ${nodeAligns[idx % 3]} h-12 items-center`}
                      style={{ paddingLeft: idx % 2 === 0 ? "3.5rem" : "0", paddingRight: idx % 2 !== 0 ? "3.5rem" : "0" }}
                    >
                      <svg width="40" height="48" viewBox="0 0 40 48" className="overflow-visible">
                        <path
                          d={idx % 2 === 0
                            ? "M 20 0 C 20 20, 8 28, 8 48"
                            : "M 20 0 C 20 20, 32 28, 32 48"}
                          fill="none"
                          stroke={sc.pathColor}
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray="6 4"
                        />
                      </svg>
                    </div>
                  )}

                  {/* 노드 행 */}
                  <div className={`flex ${nodeAligns[idx]} ${nodePaddings[idx]}`}>
                    <div className="flex flex-col items-center">
                      {/* 원형 노드 버튼 */}
                      <button
                        onClick={() => handleNodeClick(node)}
                        className="relative flex items-center justify-center rounded-full transition-all active:scale-90"
                        style={{
                          width:     nodeSize,
                          height:    nodeSize,
                          background: `linear-gradient(135deg, ${sc.nodeFrom}, ${sc.nodeTo})`,
                          boxShadow:  `0 0 0 ${isFirst ? 8 : 5}px ${sc.pathColor}66, 0 8px 24px ${wc.glow}`,
                        }}
                      >
                        {/* 펄스 링 (첫 번째 = 권장 스테이지) */}
                        {isFirst && (
                          <div
                            className="absolute inset-0 rounded-full animate-ping pointer-events-none"
                            style={{ background: `${sc.pathColor}44`, animationDuration: "2.2s" }}
                          />
                        )}

                        {/* 스테이지 번호 뱃지 */}
                        <div
                          className="absolute top-0 right-0 w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] text-white"
                          style={{ background: "rgba(0,0,0,0.45)", top: -4, right: -4, border: "2px solid white" }}
                        >
                          {idx + 1}
                        </div>

                        {/* 이모지 */}
                        <span style={{ fontSize: nodeSize * 0.42 }}>{node.emoji}</span>
                      </button>

                      {/* 이름 + 설명 (노드 아래) */}
                      <div className="mt-2 text-center" style={{ maxWidth: "96px" }}>
                        <div
                          className="font-black text-slate-900 leading-tight"
                          style={{ fontSize: isFirst ? "13px" : "11px", textShadow: "0 1px 3px rgba(255,255,255,0.9)" }}
                        >
                          {node.label}
                        </div>
                        <div className="font-bold text-slate-600 text-[10px] leading-tight mt-0.5">
                          {node.description}
                        </div>
                        {/* 난이도 뱃지: 별(★)로 표시 */}
                        <div
                          className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 mt-1 font-black text-[9px]"
                          style={{
                            background: node.difficulty === "easy"
                              ? "rgba(16,185,129,0.12)"
                              : node.difficulty === "normal"
                              ? "rgba(245,158,11,0.12)"
                              : "rgba(239,68,68,0.12)",
                            color: node.difficulty === "easy" ? "#059669"
                              : node.difficulty === "normal" ? "#d97706" : "#dc2626",
                            border: `1px solid ${node.difficulty === "easy" ? "rgba(16,185,129,0.3)" : node.difficulty === "normal" ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.3)"}`,
                          }}
                        >
                          {node.difficulty === "easy" ? "★☆☆" : node.difficulty === "normal" ? "★★☆" : "★★★"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── 하단 — 복습 숏컷 (오답 있을 때만) ── */}
          {wrongQuestions.length > 0 && (
            <div className="px-4 pb-5">
              <button
                onClick={startReview}
                className="w-full rounded-2xl py-2.5 font-bold text-sm transition-all active:scale-95"
                style={{ background: "rgba(255,255,255,0.7)", color: "#4f46e5", border: "1px solid rgba(99,102,241,0.3)", backdropFilter: "blur(8px)" }}
              >
                📋 복습 ({wrongQuestions.length})
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ─── shop screen ───────────────────────────────────────────────────────────────
  if (phase === "shop") {
    const handleBuy = (item: (typeof SHOP_ITEMS)[number]) => {
      if (purchasedCharacters.includes(item.id)) {
        setSelectedCharacter(item.emoji);
        setShopMsg(null);
        return;
      }
      if (coins < item.price) {
        setShopMsg(`💰 코인이 부족해요! (${item.price - coins}코인 더 필요)`);
        return;
      }
      setCoins((c) => c - item.price);
      setPurchasedCharacters((prev) => [...prev, item.id]);
      setSelectedCharacter(item.emoji);
      setShopMsg(`${item.emoji} ${item.name} 구매 완료!`);
    };

    return (
      <main className="min-h-screen bg-gradient-to-b from-violet-400 via-purple-400 to-indigo-500 flex flex-col items-center p-5 pt-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2 select-none">🏪</div>
          <h1 className="text-3xl font-black text-white drop-shadow">스킨 상점</h1>
          <div className="mt-2 inline-flex items-center gap-1.5 bg-white/20 rounded-full px-4 py-1.5 text-white font-black text-sm">
            💰 {coins} 코인 보유 중
          </div>
        </div>

        <div className="w-full max-w-sm flex flex-col gap-3">
          {/* Shop message toast */}
          {shopMsg && (
            <div
              className={`animate-pop-in rounded-2xl px-4 py-3 text-center text-sm font-black ${
                shopMsg.includes("부족")
                  ? "bg-red-100 text-red-600 border-2 border-red-200"
                  : "bg-emerald-100 text-emerald-700 border-2 border-emerald-200"
              }`}
            >
              {shopMsg}
            </div>
          )}

          {/* Default character (always owned) */}
          <div className="bg-white rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-3">
            <img src={selectedCharacter} width={56} />
              <div className="flex-1">
                <div className="font-black text-gray-800">기본 모험가</div>
                <div className="text-xs text-gray-400">항상 사용 가능</div>
              </div>
              <button
                onClick={() => {
                  setSelectedCharacter(HERO_IMG);
                  setShopMsg(null);
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
                  selectedCharacter === DEFAULT_CHARACTER
                    ? "bg-gray-200 text-gray-500 cursor-default"
                    : "bg-indigo-400 hover:bg-indigo-500 active:scale-95 text-white"
                }`}
                disabled={selectedCharacter === DEFAULT_CHARACTER}
              >
                {selectedCharacter === DEFAULT_CHARACTER ? "✅ 장착 중" : "선택"}
              </button>
            </div>
          </div>

          {/* Purchasable skins */}
          {SHOP_ITEMS.map((item) => {
            const isPurchased = purchasedCharacters.includes(item.id);
            const isSelected  = selectedCharacter === item.emoji;
            const canAfford   = coins >= item.price;

            return (
              <div
                key={item.id}
                className={`rounded-2xl p-4 shadow-lg border-2 transition-all ${
                  isSelected
                    ? "bg-white border-yellow-400"
                    : "bg-white border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-4xl select-none ${!isPurchased && !canAfford ? "grayscale opacity-60" : ""}`}>
                    {item.emoji}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="font-black text-gray-800">{item.name}</div>
                    <div className="text-xs text-gray-400">{item.desc}</div>
                    {!isPurchased && (
                      <div className={`text-xs font-black mt-0.5 ${canAfford ? "text-yellow-500" : "text-red-400"}`}>
                        💰 {item.price} 코인
                      </div>
                    )}
                  </div>

                  {/* Action button */}
                  {isSelected ? (
                    <span className="rounded-xl px-3 py-1.5 text-xs font-black bg-yellow-100 text-yellow-600">
                      ✅ 장착 중
                    </span>
                  ) : isPurchased ? (
                    <button
                      onClick={() => handleBuy(item)}
                      className="rounded-xl px-3 py-1.5 text-xs font-black bg-indigo-400 hover:bg-indigo-500 active:scale-95 text-white transition-all"
                    >
                      선택
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBuy(item)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
                        canAfford
                          ? "bg-yellow-400 hover:bg-yellow-500 active:scale-95 text-white"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      구매
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* ── Battle items section ── */}
          <div className="rounded-2xl bg-white/10 border border-white/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">⚔️</span>
              <span className="font-black text-white text-base">전투 아이템</span>
              <span className="text-white/50 text-xs ml-auto">전투 중 사용 가능</span>
            </div>

            <div className="flex flex-col gap-2">
              {BATTLE_ITEMS.map((item) => {
                const count     = inventory[item.id];
                const canAfford = coins >= item.price;

                return (
                  <div key={item.id} className="bg-white rounded-2xl p-3 shadow flex items-center gap-3">
                    <span className="text-3xl select-none">{item.emoji}</span>

                    <div className="flex-1 min-w-0">
                      <div className="font-black text-gray-800 text-sm">{item.name}</div>
                      <div className="text-[11px] text-gray-400">{item.desc}</div>
                      <div className={`text-xs font-black mt-0.5 ${canAfford ? "text-yellow-500" : "text-red-400"}`}>
                        💰 {item.price} 코인
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                      <span className="text-[11px] font-black text-indigo-500">보유 ×{count}</span>
                      <button
                        onClick={() => {
                          if (!canAfford) {
                            setShopMsg(`💰 코인이 부족해요! (${item.price - coins}코인 더 필요)`);
                            return;
                          }
                          setCoins((c) => c - item.price);
                          setInventory((prev) => ({ ...prev, [item.id]: prev[item.id] + 1 }));
                          setShopMsg(`${item.emoji} ${item.name} 구매!`);
                        }}
                        className={`rounded-xl px-3 py-1.5 text-xs font-black transition-all active:scale-95 ${
                          canAfford
                            ? "bg-yellow-400 hover:bg-yellow-500 text-white"
                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        구매
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Back to map */}
          <button
            onClick={goToMap}
            className="w-full rounded-2xl border-2 border-white/30 bg-white/20 hover:bg-white/30 active:scale-95 text-white p-3 font-bold text-sm transition-all mt-2"
          >
            🗺️ 맵으로 돌아가기
          </button>
        </div>
      </main>
    );
  }

  // ─── difficulty select screen (RPG event card style) ─────────────────────────
  if (phase === "difficultySelect") {
    const ps = getTypeInfo(pendingTypeId);
    const [selectedDiff, setSelectedDiff_local] = [selectedDifficulty, setSelectedDifficulty];

    // ── 모드별 테마 정의 ──────────────────────────────────────────────────────
    type EncounterTheme = {
      bg:       string;
      btnBg:    string;
      btnGlow:  string;
      btnText:  string;
      particles:string[];
    };
    const ENCOUNTER_THEME: Record<GameMode, EncounterTheme> = {
      battle: {
        bg:       "linear-gradient(180deg,#0f0c29 0%,#302b63 45%,#24243e 100%)",
        btnBg:    "linear-gradient(135deg,#dc2626,#7c3aed)",
        btnGlow:  "0 8px 32px rgba(220,38,38,0.5), 0 0 0 2px rgba(255,255,255,0.15)",
        btnText:  "⚔️ 전투 시작!",
        particles:["⭐","✨","⭐","💫"],
      },
      grow: {
        bg:       "linear-gradient(180deg,#052e16 0%,#064e3b 40%,#065f46 100%)",
        btnBg:    "linear-gradient(135deg,#059669,#10b981)",
        btnGlow:  "0 8px 32px rgba(16,185,129,0.5), 0 0 0 2px rgba(255,255,255,0.15)",
        btnText:  "🌱 훈련 시작!",
        particles:["🍃","🌿","🌱","✨"],
      },
      puzzle: {
        bg:       "linear-gradient(180deg,#1e1b4b 0%,#312e81 45%,#1e3a5f 100%)",
        btnBg:    "linear-gradient(135deg,#4f46e5,#0ea5e9)",
        btnGlow:  "0 8px 32px rgba(79,70,229,0.5), 0 0 0 2px rgba(255,255,255,0.15)",
        btnText:  "🧩 복습 시작!",
        particles:["🔮","💫","✨","⭐"],
      },
    };
    const theme = ENCOUNTER_THEME[gameMode];

    return (
      <main
        className="min-h-screen flex flex-col overflow-hidden"
        style={{ background: theme.bg }}
      >
        {/* ── 배경 장식 ── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {gameMode === "battle" && (
            <>
              <div className="absolute inset-0" style={{ background: `linear-gradient(180deg,${ps.skyFrom}33 0%,transparent 60%)` }} />
              <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)", backgroundSize: "20px 20px" }} />
            </>
          )}
          {theme.particles.map((p, i) => (
            <div
              key={i}
              className="animate-star-twinkle absolute"
              style={{
                top:  `${8 + i * 9}%`,
                left: i % 2 === 0 ? `${8 + i * 6}%` : undefined,
                right: i % 2 !== 0 ? `${8 + i * 4}%` : undefined,
                fontSize: i % 2 === 0 ? "1.5rem" : "1.2rem",
                opacity: 0.35,
                animationDelay: `${i * 0.5}s`,
              }}
            >{p}</div>
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center px-4 pt-6 pb-8 gap-5 min-h-screen">

          {/* 뒤로가기 */}
          <div className="w-full max-w-sm flex justify-start">
            <button
              onClick={() => setPhase("regionMap")}
              className="rounded-2xl border border-white/20 bg-white/10 hover:bg-white/20 active:scale-95 text-white px-4 py-2 font-bold text-sm transition-all backdrop-blur-sm"
            >
              ← 맵으로
            </button>
          </div>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              모드별 이벤트 카드
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

          {/* ────── 도전 모드: ENCOUNTER ────── */}
          {gameMode === "battle" && (
            <div
              className="w-full max-w-sm rounded-3xl overflow-hidden animate-pop-in"
              style={{
                background:     "linear-gradient(180deg,rgba(220,38,38,0.18) 0%,rgba(0,0,0,0.5) 100%)",
                border:         "2px solid rgba(239,68,68,0.4)",
                boxShadow:      "0 0 60px rgba(239,68,68,0.3), 0 20px 60px rgba(0,0,0,0.5)",
                backdropFilter: "blur(12px)",
              }}
            >
              {/* 경고 배너 */}
              <div
                className="flex items-center justify-center gap-2 py-2.5 animate-pulse"
                style={{ background: "linear-gradient(90deg,#dc2626,#991b1b)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}
              >
                <span className="text-base">⚠️</span>
                <span className="font-black text-white tracking-widest" style={{ fontSize: "13px", letterSpacing: "0.1em" }}>
                  ENCOUNTER!
                </span>
                <span className="text-base">⚠️</span>
              </div>

              {/* 플레이어 VS 몬스터 */}
              <div className="flex items-end justify-between px-6 pt-5 pb-3 gap-4">
                <div className="flex flex-col items-center gap-1.5">
                  <img
                    src={selectedCharacter}
                    alt="캐릭터"
                    className="animate-idle-float"
                    style={{ width: 64, height: 64, objectFit: "contain", filter: "drop-shadow(0 4px 12px rgba(59,130,246,0.5))" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  <span className="text-xs font-black text-blue-300">나</span>
                </div>
                <div
                  className="font-black text-white"
                  style={{ fontSize: "28px", textShadow: "0 0 20px rgba(255,255,255,0.5)", letterSpacing: "0.05em" }}
                >VS</div>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="animate-bounce" style={{ fontSize: "64px", lineHeight: 1, filter: "drop-shadow(0 4px 16px rgba(220,38,38,0.6))" }}>
                    {ps.monster}
                  </div>
                  <span className="text-xs font-black text-red-300">{ps.monsterName}</span>
                </div>
              </div>

              {/* 말풍선 + 스테이지 정보 */}
              <div className="mx-4 mb-1 px-4 py-2 rounded-2xl text-center animate-pop-in"
                   style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)" }}>
                <span className="font-black text-red-300" style={{ fontSize: "14px" }}>
                  ⚠️ 적이 나타났어요! 준비하세요!
                </span>
              </div>
              <div className="mx-4 mb-4 rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-lg">{ps.emoji}</span>
                  <span className="font-black text-white" style={{ fontSize: "15px" }}>{ps.zoneName}</span>
                  <span className="ml-auto text-[10px] font-bold rounded-full px-2 py-0.5 text-white/70" style={{ background: "rgba(255,255,255,0.12)" }}>
                    {GAME_MODE_META[gameMode].emoji} {GAME_MODE_META[gameMode].label} 모드
                  </span>
                </div>
                <div className="text-white/40 mb-1" style={{ fontSize: "11px" }}>{ps.title}</div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 3 }).map((_, i) => <span key={i} className="text-sm">❤️</span>)}
                    <span className="text-xs font-bold text-white/50 ml-1">×3</span>
                  </div>
                  {cmsLoading
                    ? <span className="text-xs font-bold text-white/40 animate-pulse">⏳ 문제 준비 중…</span>
                    : cmsPool.length > 0
                    ? <span className="text-xs font-bold text-emerald-400">✓ 문제 {cmsPool.length}개 준비됨</span>
                    : null}
                </div>
              </div>
            </div>
          )}

          {/* ────── 성장 모드: TRAINING ────── */}
          {gameMode === "grow" && (
            <div
              className="w-full max-w-sm rounded-3xl overflow-hidden animate-pop-in"
              style={{
                background:     "linear-gradient(180deg,rgba(16,185,129,0.14) 0%,rgba(0,0,0,0.35) 100%)",
                border:         "2px solid rgba(16,185,129,0.35)",
                boxShadow:      "0 0 50px rgba(16,185,129,0.18), 0 16px 48px rgba(0,0,0,0.4)",
                backdropFilter: "blur(12px)",
              }}
            >
              {/* 헤더 배너 */}
              <div
                className="flex items-center justify-center gap-2 py-2.5"
                style={{ background: "linear-gradient(90deg,#059669,#047857)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
              >
                <span className="text-base">🌱</span>
                <span className="font-black text-white tracking-widest" style={{ fontSize: "13px", letterSpacing: "0.1em" }}>
                  TRAINING
                </span>
                <span className="text-base">🌿</span>
              </div>

              {/* 캐릭터 중심 레이아웃 */}
              <div className="flex flex-col items-center gap-3 px-6 pt-5 pb-4">
                <img
                  src={selectedCharacter}
                  alt="캐릭터"
                  className="animate-idle-float"
                  style={{ width: 90, height: 90, objectFit: "contain", filter: "drop-shadow(0 6px 18px rgba(16,185,129,0.55))" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                <div className="text-center">
                  <div
                    className="font-black text-white mb-0.5"
                    style={{ fontSize: "clamp(15px,4vw,18px)", letterSpacing: "-0.01em" }}
                  >
                    {ps.emoji} {ps.zoneName}
                  </div>
                  <div className="text-emerald-300/70 mb-1" style={{ fontSize: "11px" }}>{ps.title}</div>
                  <p className="font-semibold text-emerald-300" style={{ fontSize: "13px" }}>
                    훈련을 시작해볼까요? 💪
                  </p>
                </div>

                {/* 스탯 미리보기 */}
                <div className="flex items-center gap-4 rounded-2xl px-4 py-2 w-full" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <span className="text-base">📈</span>
                    <span className="font-black text-sm">성장 게임</span>
                  </div>
                  <div className="ml-auto">
                    {cmsLoading
                      ? <span className="text-xs font-bold text-white/40 animate-pulse">⏳ 준비 중…</span>
                      : cmsPool.length > 0
                      ? <span className="text-xs font-bold text-emerald-400">✓ {cmsPool.length}문제</span>
                      : null}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ────── 퍼즐 모드: PUZZLE QUEST ────── */}
          {gameMode === "puzzle" && (
            <div
              className="w-full max-w-sm rounded-3xl overflow-hidden animate-pop-in"
              style={{
                background:     "linear-gradient(180deg,rgba(99,102,241,0.16) 0%,rgba(0,0,0,0.4) 100%)",
                border:         "2px solid rgba(99,102,241,0.4)",
                boxShadow:      "0 0 60px rgba(99,102,241,0.25), 0 20px 60px rgba(0,0,0,0.5)",
                backdropFilter: "blur(12px)",
              }}
            >
              {/* 헤더 배너 */}
              <div
                className="flex items-center justify-center gap-2 py-2.5"
                style={{ background: "linear-gradient(90deg,#4f46e5,#0ea5e9)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}
              >
                <span className="text-base">🧩</span>
                <span className="font-black text-white tracking-widest" style={{ fontSize: "13px", letterSpacing: "0.1em" }}>
                  PUZZLE QUEST
                </span>
                <span className="text-base">✨</span>
              </div>

              {/* 퍼즐 슬롯 프리뷰 + 캐릭터 */}
              <div className="px-6 pt-5 pb-2">
                <div className="flex items-center gap-4 mb-4">
                  <img
                    src={selectedCharacter}
                    alt="캐릭터"
                    className="animate-idle-float flex-shrink-0"
                    style={{ width: 72, height: 72, objectFit: "contain", filter: "drop-shadow(0 4px 16px rgba(99,102,241,0.6))" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  <div>
                    <div className="font-black text-white mb-0.5" style={{ fontSize: "clamp(13px,3.5vw,16px)", letterSpacing: "-0.01em" }}>
                      {ps.emoji} {ps.zoneName}
                    </div>
                    <div className="text-indigo-300/60 mb-1" style={{ fontSize: "10px" }}>{ps.title}</div>
                    <p className="font-semibold text-indigo-300" style={{ fontSize: "13px" }}>
                      기억 조각을 복구해볼까요? 🔮
                    </p>
                  </div>
                </div>

                {/* 퍼즐 슬롯 미리보기 */}
                <div className="grid grid-cols-5 gap-1.5 mb-3">
                  {["🔮","🎯","⚡","🌊","🍀"].map((emoji, i) => (
                    <div
                      key={i}
                      className="rounded-xl flex items-center justify-center aspect-square"
                      style={{
                        background: "rgba(99,102,241,0.15)",
                        border:     "1.5px dashed rgba(99,102,241,0.4)",
                        fontSize:   "1.1rem",
                        opacity:    0.45,
                      }}
                    >
                      <span className="opacity-30">?</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CMS 상태 */}
              <div className="mx-4 mb-4 rounded-2xl px-4 py-2 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-indigo-300 font-black text-sm">🧩 퍼즐 모드</span>
                <div className="ml-auto">
                  {cmsLoading
                    ? <span className="text-xs font-bold text-white/40 animate-pulse">⏳ 준비 중…</span>
                    : cmsPool.length > 0
                    ? <span className="text-xs font-bold text-sky-400">✓ {cmsPool.length}문제</span>
                    : null}
                </div>
              </div>
            </div>
          )}

          {/* ── 난이도 선택 (공통) ── */}
          <div className="w-full max-w-sm flex flex-col gap-2">
            <p className="text-center text-white/50 font-bold text-xs tracking-widest">DIFFICULTY</p>
            <div className="flex gap-2">
              {(["easy", "normal", "hard"] as const).map((diff) => {
                const cfg = DIFFICULTY_CONFIG[diff];
                const isActive = selectedDiff === diff;
                return (
                  <button
                    key={diff}
                    onClick={() => setSelectedDiff_local(diff)}
                    className="flex-1 rounded-2xl py-3 font-black text-sm transition-all active:scale-95"
                    style={{
                      background: isActive ? `linear-gradient(135deg,${cfg.bgFrom},${cfg.bgTo})` : "rgba(255,255,255,0.08)",
                      border:     isActive ? "2px solid rgba(255,255,255,0.4)" : "2px solid rgba(255,255,255,0.1)",
                      color:      isActive ? "#1e293b" : "rgba(255,255,255,0.5)",
                      boxShadow:  isActive ? "0 6px 20px rgba(0,0,0,0.3)" : "none",
                      transform:  isActive ? "scale(1.05)" : "scale(1)",
                    }}
                  >
                    <div className="text-xl mb-0.5">{cfg.emoji}</div>
                    <div>{cfg.label}</div>
                    <div className="text-[10px] mt-0.5 opacity-70">
                      {TOTAL_TIME + cfg.timeBonus}초 · 💰×{cfg.coinMult}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 시작 버튼 (모드별) ── */}
          <button
            onClick={() => startType(pendingTypeId, selectedDiff)}
            disabled={cmsLoading}
            className="w-full max-w-sm rounded-2xl py-4 font-black text-lg text-white game-btn transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background:    theme.btnBg,
              boxShadow:     theme.btnGlow,
              letterSpacing: "0.02em",
            }}
          >
            {cmsLoading ? "⏳ 문제 준비 중…" : theme.btnText}
          </button>

          {/* 개발자 패널 */}

        {/* ── 개발자(선생님) 전용 패널 — teacherMode일 때만 표시 ── */}
        {teacherMode && (
          <div className="w-full max-w-sm mt-4">
            <div className="rounded-2xl border border-white/20 bg-black/30 backdrop-blur-sm p-3 flex flex-col gap-2 text-[12px]">
              <div className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">
                🛠 개발자 패널
              </div>

              {/* 상태 요약 */}
              {cmsLoading ? (
                <div className="flex items-center gap-2 text-white/70 animate-pulse">
                  <span>⏳</span>
                  <span className="font-bold">CMS 로드 중…</span>
                </div>
              ) : cmsPool.length > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="font-black text-emerald-300">
                    ✓ CMS {cmsPool.length}개 로드됨
                  </span>
                  <button
                    onClick={clearCmsQuestions}
                    className="text-[10px] text-red-400 hover:text-red-300 font-bold transition-colors"
                  >
                    ✕ mock으로 되돌리기
                  </button>
                </div>
              ) : cmsResult?.errorCode ? (
                <div className="flex flex-col gap-0.5">
                  <div className="text-orange-300 font-bold text-[11px]">
                    ⚠ CMS 실패 — mock 사용
                  </div>
                  <div className="text-white/40 text-[10px] break-all">
                    {cmsResult.errorCode}: {cmsResult.errorDetail}
                  </div>
                </div>
              ) : (
                <div className="text-white/40 font-bold">📚 mock 문제 사용</div>
              )}

              {/* 문제 목록 미리보기 */}
              {cmsPool.length > 0 && (
                <div className="flex flex-col gap-1 mt-1">
                  {cmsPool.map((q, i) => (
                    <div
                      key={q.id}
                      className="flex flex-col gap-0.5 rounded-xl bg-white/5 px-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-2 text-white/60">
                        <span className="font-black text-white/30">#{i + 1}</span>
                        <span className="flex-1 truncate text-[11px]">
                          {q.text || q.conceptName || "이미지 문제"}
                        </span>
                        <span className={`font-bold text-[10px] ${q.level === "HIGH" ? "text-red-400" : q.level === "MEDIUM" ? "text-yellow-400" : "text-emerald-400"}`}>
                          {q.level}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px]">
                        <span className="text-white/30">
                          채점타입:
                          <span className={`ml-1 font-black ${q.autoScoringType === 1 ? "text-emerald-400" : "text-orange-400"}`}>
                            {q.autoScoringType ?? "–"}
                          </span>
                        </span>
                        <span className="text-white/30">
                          정답:
                          <span className="ml-1 font-black text-yellow-300/70">{q.answer}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 필터 통계 */}
              {cmsResult && !cmsLoading && (
                <details className="mt-1">
                  <summary className="text-[10px] text-white/30 cursor-pointer hover:text-white/50 font-bold select-none">
                    필터 통계 보기
                  </summary>
                  <div className="grid grid-cols-3 gap-1 mt-1.5 text-[10px]">
                    {(
                      [
                        ["전체",         cmsResult.totalRaw],
                        ["ACTIVE",       cmsResult.filterStats.active],
                        ["단답형",       cmsResult.filterStats.shortAnswer],
                        ["채점타입=1",   cmsResult.filterStats.autoScoring1],
                        ["nChoice=0",    cmsResult.filterStats.nChoice0],
                        ["사용 가능",    cmsResult.filterStats.numericAnswer],
                      ] as [string, number][]
                    ).map(([label, count]) => (
                      <div key={label} className="rounded-lg bg-white/5 px-2 py-1 flex justify-between">
                        <span className="text-white/40">{label}</span>
                        <span className="font-black text-white/70">{count}</span>
                      </div>
                    ))}
                    {cmsResult.debug && (
                      <div className="col-span-3 rounded-lg bg-yellow-500/10 px-2 py-1 text-yellow-400/70">
                        {cmsResult.debug}
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        )}
        </div>{/* end relative z-10 content wrapper */}
      </main>
    );
  }

  // ─── review dungeon screen ─────────────────────────────────────────────────────
  if (phase === "review") {
    const reviewQ   = wrongQuestions[reviewIndex % Math.max(wrongQuestions.length, 1)];
    const remaining = wrongQuestions.length;
    const reviewSolvedCount = Math.max(reviewInitialCount - remaining, 0);

    // Determine which stage this wrong question came from.
    // Priority: question's own stageId → current stage → STAGES[0] (last resort only)
    const reviewStageId = reviewQ?.stageId ?? currentTypeId;
    const reviewStage   = getTypeInfo(reviewStageId);
    const currentMonsterImage = reviewStage.monsterImage;
    const currentMonsterIcon  = reviewStage.monsterIcon;
    // Use weakness name instead of monster name in review
    const reviewWeaknessName = getWeaknessName(reviewQ?.conceptName ?? reviewStage.monsterName);
    const REVIEW_ARENA: BattleArenaInfo = {
      monster:      "🧠",
      monsterName:  reviewWeaknessName,
      groundColor:  reviewStage.groundColor,
      monsterImage: currentMonsterImage,
      monsterIcon:  currentMonsterIcon,
    };

    return (
      <main
        className="min-h-screen flex flex-col items-center justify-start p-3 pt-5"
        style={{ background: "linear-gradient(to bottom, #1a0533, #2d1060)" }}
      >
        {/* Large centered feedback overlay — same as playing */}
        {feedback && <FeedbackOverlay key={feedbackKey} feedback={feedback} />}

        {/* ── Outer wrapper — matches playing screen max-w-2xl ── */}
        <div className="w-full max-w-2xl flex flex-col items-center gap-3">

          {/* ── Top bar ── */}
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl select-none">🧠</span>
              <div>
                <div className="text-base font-black text-purple-100 leading-tight">약점 극복 도전</div>
                <div className="text-[11px] text-purple-300/70">이번엔 반드시 극복해요!</div>
              </div>
            </div>
            <button
              onClick={goToMap}
              className="rounded-2xl border border-purple-500/30 bg-purple-900/40 hover:bg-purple-900/60 active:scale-95 text-purple-300 px-3 py-1.5 font-bold text-xs transition-all"
            >
              🗺️ 맵으로
            </button>
          </div>

          {/* ── Progress bar ── */}
          <div className="w-full">
            <div className="flex justify-between text-[11px] text-purple-300/70 font-bold mb-1.5">
              <span>🧠 남은 약점</span>
              <span>{remaining} / {reviewInitialCount || remaining}</span>
            </div>
            <div className="h-3 bg-purple-900/60 rounded-full overflow-hidden border border-purple-500/30">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out bg-gradient-to-r from-purple-500 to-violet-400"
                style={{
                  width: `${reviewInitialCount > 0
                    ? Math.max((remaining / reviewInitialCount) * 100, 0)
                    : 100}%`,
                }}
              />
            </div>
          </div>

          {/* ── Item bar ── */}
          <div className="w-full max-w-lg flex gap-2 self-center">
            {BATTLE_ITEMS.map((item) => {
              const count    = inventory[item.id];
              const disabled = count === 0 || !item.reviewable;
              const isShieldOn = item.id === "shield" && shieldActive;

              return (
                <button
                  key={item.id}
                  onClick={() => useItem(item.id)}
                  disabled={disabled}
                  className={`flex-1 rounded-2xl py-2 px-1 text-center transition-all active:scale-90 flex flex-col items-center gap-0.5 border ${
                    disabled
                      ? "opacity-40 cursor-not-allowed bg-purple-900/30 border-purple-500/20"
                      : isShieldOn
                      ? "bg-blue-900/60 border-blue-400/60 shadow-lg animate-pulse"
                      : "bg-purple-900/50 hover:bg-purple-800/60 border-purple-500/30 shadow-md"
                  }`}
                >
                  <span className="text-lg leading-none">{item.emoji}</span>
                  <span className="text-[9px] font-black text-purple-200 leading-tight">{item.name}</span>
                  <span className={`text-[10px] font-black ${count > 0 && !disabled ? "text-purple-300" : "text-purple-500/50"}`}>
                    {item.reviewable ? `×${count}` : "–"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Battle Arena ── */}
          <div className="w-full max-w-lg self-center">
            <BattleArena
              arenaInfo={REVIEW_ARENA}
              monsterMaxHp={reviewInitialCount || remaining}
              correctCount={reviewSolvedCount}
              monsterHp={remaining}
              charAttacking={charAttacking}
              monsterHit={monsterHit}
              monsterCounter={monsterCounter}
              damageKey={damageKey}
              combo={combo}
              character={selectedCharacter}
            />
          </div>

          {/* ── Question card — full width up to max-w-2xl, same style as playing ── */}
          {reviewQ && (
            <div
              className={`w-full rounded-3xl shadow-2xl text-center mb-3 ${
                cardAnim === "bounce" ? "animate-card-bounce" :
                cardAnim === "shake"  ? "animate-shake"       : ""
              }`}
              style={{
                background: reviewQ.questionImageUrl
                  ? "#fff"
                  : "linear-gradient(160deg,#1e1b4b 0%,#312e81 60%,#1e1b4b 100%)",
                border: "1.5px solid rgba(139,92,246,0.35)",
                boxShadow: "0 8px 32px rgba(109,40,217,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              {/* Card header: source badge + concept label */}
              <div className="pt-4 pb-0 px-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide flex-shrink-0"
                    style={
                      reviewQ.source === "cms"
                        ? { background: "rgba(14,165,233,0.2)", color: "#7dd3fc" }
                        : { background: "rgba(139,92,246,0.2)", color: "#c4b5fd" }
                    }
                  >
                    {reviewQ.source === "cms" ? "🌐 CMS 연습 문제" : "⚠️ 전에 틀린 문제"}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black flex-shrink-0"
                    style={{ background: "rgba(34,197,94,0.15)", color: "#86efac" }}
                  >
                    {reviewQ.source === "cms" ? "📚 다시 연습해봐요" : "💪 이번엔 극복해봐요"}
                  </span>
                </div>
                {/* Concept name: 최대 2줄, overflow 방지 */}
                {(reviewWeaknessName || reviewQ.conceptName) && (
                  <p
                    className="text-xs font-bold text-purple-400 mt-1.5 text-left"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {reviewWeaknessName}
                    {reviewQ.conceptName && reviewQ.conceptName !== reviewWeaknessName
                      ? ` · ${reviewQ.conceptName}`
                      : ""}
                  </p>
                )}
              </div>

              {/* Problem display — same rules as playing screen */}
              {reviewQ.questionImageUrl ? (
                /* 이미지 문제: 높이 자동 확장, 클리핑 없음 */
                <div
                  className="mx-4 mt-3 mb-3 rounded-2xl select-none"
                  style={{ background: "#f8f9ff", padding: "12px" }}
                >
                  <QuestionDisplay question={reviewQ} />
                  <ImageLoadFallback />
                </div>
              ) : (
                /* 텍스트 문제: 다크 인디고 스타일 */
                <div
                  className="mx-4 mt-3 mb-3 rounded-2xl px-5 select-none relative flex items-center justify-center"
                  style={{
                    background: "rgba(15,10,40,0.55)",
                    border: "1.5px solid rgba(139,92,246,0.25)",
                    boxShadow: "inset 0 2px 12px rgba(109,40,217,0.2)",
                    minHeight: "120px",
                    padding: "24px 20px",
                    overflow: "hidden",
                  }}
                >
                  <QuestionDisplay
                    question={reviewQ}
                    style={{
                      fontSize: "clamp(2.4rem, 11vw, 3.4rem)",
                      color: "#f3e8ff",
                      textShadow: "0 2px 12px rgba(139,92,246,0.5)",
                    }}
                  />
                  <ImageLoadFallback />
                </div>
              )}

              {/* Spacer */}
              <div style={{ height: reviewQ.questionImageUrl ? "8px" : "16px" }} />

              {/* Input + submit — centred at max-w-lg within the wider card */}
              <div className="px-4 pb-5 flex flex-col gap-3 max-w-lg mx-auto">
                <input
                  ref={inputRef}
                  type="number"
                  inputMode="numeric"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && checkReview()}
                  placeholder="답을 입력하세요"
                  className="w-full rounded-2xl px-4 text-center font-black focus:outline-none transition-all"
                  style={{
                    background: "rgba(15,10,40,0.6)",
                    border: "2px solid rgba(139,92,246,0.35)",
                    color: "#ede9fe",
                    caretColor: "#a78bfa",
                    fontSize: "clamp(1.6rem,6vw,2rem)",
                    padding: "14px",
                  }}
                />
                <button
                  onClick={checkReview}
                  className="w-full rounded-2xl py-3.5 font-black text-lg text-white transition-all active:scale-95 shadow-lg"
                  style={{
                    background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
                    boxShadow: "0 4px 18px rgba(109,40,217,0.5)",
                  }}
                >
                  💪 극복하기!
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    );
  }

  // ─── review clear screen ───────────────────────────────────────────────────────
  if (phase === "reviewClear") {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#1a0533] via-[#2d1060] to-[#0d0826] flex items-center justify-center p-6">
        <div
          className="w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center animate-pop-in border border-purple-500/40"
          style={{ background: "rgba(45,16,96,0.95)" }}
        >
          <div className="text-6xl mb-3 select-none animate-bounce">🧠</div>
          <h2 className="text-3xl font-black text-purple-200 mb-1">실수 완전 정복!</h2>
          <p className="text-purple-300/70 text-sm mb-5">약점을 완전히 극복했어요! 💪</p>

          <div className="rounded-2xl border border-purple-500/30 p-4 mb-5"
            style={{ background: "rgba(26,5,51,0.6)" }}
          >
            <p className="text-xs text-purple-400 font-bold mb-1">약점 극복 보상!</p>
            <p className="text-4xl font-black text-yellow-400">+30 💰</p>
            <p className="text-purple-300/60 text-xs mt-1">오답 노트 정복 보상</p>
          </div>

          <button
            onClick={goToMap}
            className="w-full rounded-2xl bg-purple-500 hover:bg-purple-400 active:scale-95 text-white p-4 font-black text-lg transition-all shadow-lg"
          >
            🗺️ 맵으로 돌아가기
          </button>
        </div>
      </main>
    );
  }

  // ─── stage clear screen ────────────────────────────────────────────────────────
  if (phase === "stageClear") {
    const nextType  = getNextType(currentTypeId);
    const hasNext   = nextType !== null;
    const nextWorld = hasNext ? getWorldForType(nextType!.id) : null;
    const diffCfg   = DIFFICULTY_CONFIG[selectedDifficulty];

    return (
      <main
        className="min-h-screen flex items-center justify-center p-5 relative overflow-hidden"
        style={{ background: "linear-gradient(180deg,#1a1a2e 0%,#16213e 40%,#0f3460 100%)" }}
      >
        {/* 배경 파티클 */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {["🌟","✨","⭐","💫","🌟","✨"].map((s, i) => (
            <div
              key={i}
              className="animate-star-twinkle absolute"
              style={{
                top: `${10 + i * 14}%`,
                left: `${5 + i * 16}%`,
                fontSize: "1.5rem",
                opacity: 0.5,
                animationDelay: `${i * 0.4}s`,
              }}
            >{s}</div>
          ))}
        </div>

        <div className="relative z-10 w-full max-w-sm text-center flex flex-col gap-5 animate-pop-in">

          {/* 트로피 + 제목 */}
          <div>
            <div className="text-7xl mb-3 select-none animate-bounce" style={{ filter: "drop-shadow(0 4px 24px rgba(251,191,36,0.8))" }}>🏆</div>
            <div
              className="font-black text-white"
              style={{ fontSize: "clamp(26px,7vw,34px)", textShadow: "0 0 30px rgba(251,191,36,0.6)", letterSpacing: "-0.01em" }}
            >
              {GAME_TEXT[gameMode].clearTitle}
            </div>
            <p className="text-white/70 font-bold mt-1.5" style={{ fontSize: "14px" }}>
              {GAME_TEXT[gameMode].clearSubtitle(currentMonsterName)}
            </p>
            {/* 난이도 배지 */}
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-lg">{diffCfg.emoji}</span>
              <span className="font-black text-white/60" style={{ fontSize: "13px" }}>{diffCfg.label} 클리어</span>
            </div>
          </div>

          {/* 보상 카드 */}
          <div
            className="rounded-3xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "2px solid rgba(255,255,255,0.15)",
              backdropFilter: "blur(16px)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.1)",
            }}
          >
            {/* 헤더 */}
            <div
              className="px-5 py-3 font-black text-center tracking-widest"
              style={{
                background: "linear-gradient(135deg,rgba(251,191,36,0.2),rgba(245,158,11,0.1))",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                fontSize: "11px",
                color: "#fcd34d",
                letterSpacing: "0.12em",
              }}
            >
              ✨ REWARDS
            </div>
            <div className="grid grid-cols-3 gap-px py-4">
              <div className="text-center px-3">
                <div className="font-black text-yellow-400 tracking-widest mb-1" style={{ fontSize: "10px" }}>SCORE</div>
                <div className="font-black text-white" style={{ fontSize: "clamp(22px,6vw,28px)" }}>{score}</div>
              </div>
              <div className="text-center px-3" style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", borderRight: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="font-black text-yellow-400 tracking-widest mb-1" style={{ fontSize: "10px" }}>COINS</div>
                <div className="font-black text-amber-300" style={{ fontSize: "clamp(22px,6vw,28px)" }}>💰{coins}</div>
              </div>
              <div className="text-center px-3">
                <div className="font-black text-yellow-400 tracking-widest mb-1" style={{ fontSize: "10px" }}>COMBO</div>
                <div className="font-black text-orange-300" style={{ fontSize: "clamp(22px,6vw,28px)" }}>×{combo > 0 ? combo : "–"}</div>
              </div>
            </div>
            {/* 모드별 특별 보상 표시 */}
            {gameMode === "grow" ? (
              <div className="px-5 pb-4 flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 20 }}>⭐</span>
                  <span className="font-black text-emerald-300" style={{ fontSize: 16 }}>Lv.{growLevel} 달성!</span>
                </div>
                <div className="w-full rounded-full overflow-hidden mt-1" style={{ height: 8, background: "rgba(255,255,255,0.08)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min((growExp / EXP_PER_LEVEL) * 100, 100)}%`,
                      background: "linear-gradient(90deg,#34d399,#10b981)",
                      boxShadow: "0 0 8px rgba(16,185,129,0.6)",
                    }}
                  />
                </div>
                <div className="text-xs font-semibold text-emerald-400 mt-0.5">EXP {growExp} / {EXP_PER_LEVEL}</div>
              </div>
            ) : gameMode === "puzzle" ? (
              <div className="px-4 pb-4">
                <div className="text-center text-xs font-black text-violet-400 mb-1.5">🧩 퍼즐 완성!</div>
                <div className="grid grid-cols-9 gap-1 justify-items-center">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <span key={i} style={{ fontSize: 14 }}>{PUZZLE_CELL_EMOJIS[i]}</span>
                  ))}
                </div>
              </div>
            ) : playerLives > 0 ? (
              <div className="px-5 pb-3 flex items-center justify-center gap-2">
                {Array.from({ length: playerLives }).map((_, i) => (
                  <span key={i} style={{ fontSize: "18px" }}>❤️</span>
                ))}
                <span className="text-xs font-black text-red-300 ml-1">HP 잔여</span>
              </div>
            ) : null}
          </div>

          {/* Next goal teaser */}
          {hasNext && nextType && (
            <div
              className="rounded-2xl px-4 py-3 flex items-center gap-3 text-left"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1.5px solid rgba(255,255,255,0.12)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div
                className="flex-shrink-0 flex items-center justify-center rounded-2xl"
                style={{ width: 52, height: 52, background: "rgba(255,255,255,0.1)", fontSize: "28px" }}
              >
                {nextType.emoji}
              </div>
              <div className="min-w-0">
                <p className="font-black tracking-widest mb-0.5" style={{ fontSize: "10px", color: "#fcd34d" }}>NEXT CHALLENGE →</p>
                <p className="font-black text-white truncate" style={{ fontSize: "14px" }}>{nextType.title}</p>
                <p className="font-medium mt-0.5" style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                  {nextWorld ? `${nextWorld.name} · ` : ""}{GAME_TEXT[gameMode].nextTeaser(nextType.monsterName)}
                </p>
              </div>
            </div>
          )}

          {/* CTA buttons */}
          <div className="flex flex-col gap-2">
            {hasNext ? (
              <button
                onClick={goNextStage}
                className="w-full rounded-2xl p-4 font-black text-lg text-white transition-all active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
                  boxShadow: "0 6px 24px rgba(239,68,68,0.45), 0 0 0 3px rgba(255,255,255,0.3)",
                  animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
                }}
              >
                {GAME_TEXT[gameMode].nextBtn} → {nextType?.emoji}
              </button>
            ) : (
              <button
                onClick={goToResult}
                className="w-full rounded-2xl p-4 font-black text-lg text-white transition-all active:scale-95"
                style={{
                  background: "linear-gradient(135deg,#a855f7 0%,#ec4899 100%)",
                  boxShadow: "0 6px 24px rgba(168,85,247,0.45)",
                  animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
                }}
              >
                최종 결과 보기 🎉
              </button>
            )}

            <button
              onClick={goToMap}
              className="w-full rounded-2xl border-2 p-3 font-bold text-sm transition-all active:scale-95"
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "1.5px solid rgba(255,255,255,0.5)",
                color: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(6px)",
              }}
            >
              🗺️ 맵으로 돌아가기
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ─── result screen ─────────────────────────────────────────────────────────────
  if (phase === "result") {
    const stars = getStarCount(score);
    const MEDAL = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

    return (
      <main className="min-h-screen bg-gradient-to-b from-sky-300 to-emerald-300 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center animate-pop-in flex flex-col gap-4">

          {/* Header */}
          <div>
            <div className="text-6xl mb-2 select-none">🎉</div>
            <h2 className="text-2xl font-black text-orange-500">퀘스트 완료! 🎉</h2>
            <div className="text-3xl mt-1">{"⭐".repeat(stars)}</div>
          </div>

          {/* Score card */}
          <div className="rounded-2xl bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-100 p-5">
            {wasNewRecord && (
              <div className="inline-flex items-center gap-1 bg-gradient-to-r from-yellow-400 to-orange-400 text-white rounded-full px-3 py-0.5 text-xs font-black mb-2 animate-bounce">
                🏆 최고 기록 갱신!
              </div>
            )}
            <p className="text-[11px] text-gray-400 font-bold tracking-widest mb-1">이번 점수</p>
            <p className="text-5xl font-black text-yellow-500 leading-none">
              {score}<span className="text-xl ml-1 text-yellow-400">점</span>
            </p>
            {bestScore > 0 && (
              <p className="text-xs text-gray-400 mt-2 font-bold">
                🏆 최고 점수: <span className="text-yellow-600">{bestScore}점</span>
              </p>
            )}
            <p className="text-sm font-bold text-yellow-400 mt-1">💰 {coins} 코인</p>
          </div>

          {/* Recent scores */}
          {recentScores.length > 0 && (
            <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 text-left">
              <p className="text-[11px] font-black text-gray-400 tracking-widest mb-3 text-center">
                최근 기록
              </p>
              <div className="flex flex-col gap-1.5">
                {recentScores.map((s, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                      i === 0 && s === bestScore
                        ? "bg-yellow-50 border border-yellow-200"
                        : "bg-white border border-gray-100"
                    }`}
                  >
                    <span className="text-lg">{MEDAL[i]}</span>
                    <span className={`font-black text-lg ${i === 0 ? "text-yellow-500" : "text-gray-600"}`}>
                      {s}점
                    </span>
                    {i === 0 && s === bestScore && (
                      <span className="text-[10px] font-black text-yellow-500 bg-yellow-100 rounded-full px-2 py-0.5">
                        최고
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's learning summary */}
          <div className="rounded-2xl bg-cyan-50 border border-cyan-100 px-4 py-3 text-left">
            <p className="text-[11px] font-black text-cyan-600 tracking-widest mb-2 text-center">오늘의 학습</p>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <div className="text-xs text-gray-400 font-bold">문제</div>
                <div className="text-lg font-black text-cyan-600">{solvedToday}개</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 font-bold">복습 던전</div>
                <div className="text-lg font-black text-purple-500">{reviewDoneToday}회</div>
              </div>
            </div>
            <p className="text-center text-[11px] text-cyan-500 font-bold mt-2">
              {solvedToday >= 10
                ? "🌟 오늘 정말 열심히 했어요!"
                : solvedToday >= 5
                ? "💪 어제보다 성장했어요!"
                : "🌱 매일 조금씩 성장해요!"}
            </p>
          </div>

          {/* Encouragement */}
          <p className="text-gray-500 text-sm font-medium">
            {GAME_TEXT[gameMode].resultHero(score)}
          </p>

          <button
            onClick={restartAll}
            className="w-full rounded-2xl bg-yellow-400 hover:bg-yellow-500 active:scale-95 text-white p-4 font-black text-lg transition-all shadow-lg"
          >
            🔄 처음부터 다시!
          </button>
        </div>
      </main>
    );
  }

  // ─── travel screen ─────────────────────────────────────────────────────────────
  if (phase === "travel") {
    // 모드별 travel 화면 테마
    const travelMeta = {
      battle: {
        bg:         "linear-gradient(180deg,#0f0c29 0%,#302b63 50%,#1a1a2e 100%)",
        headline1:  "BATTLE",
        headline2:  "START!",
        h1Color:    "#ffffff",
        h2Color:    "#fcd34d",
        h1Shadow:   "0 0 30px rgba(239,68,68,0.8), 0 4px 16px rgba(0,0,0,0.5)",
        h2Shadow:   "0 0 20px rgba(251,191,36,0.8)",
        dotColor:   "#ef4444",
        dotGlow:    "rgba(239,68,68,0.8)",
        showVS:     true,
      },
      grow: {
        bg:         "linear-gradient(180deg,#052e16 0%,#064e3b 50%,#065f46 100%)",
        headline1:  "TRAINING",
        headline2:  "READY!",
        h1Color:    "#6ee7b7",
        h2Color:    "#ffffff",
        h1Shadow:   "0 0 30px rgba(16,185,129,0.8), 0 4px 16px rgba(0,0,0,0.5)",
        h2Shadow:   "0 0 20px rgba(255,255,255,0.5)",
        dotColor:   "#10b981",
        dotGlow:    "rgba(16,185,129,0.8)",
        showVS:     false,
      },
      puzzle: {
        bg:         "linear-gradient(180deg,#1e1b4b 0%,#312e81 50%,#1e3a5f 100%)",
        headline1:  "PUZZLE",
        headline2:  "START!",
        h1Color:    "#a5b4fc",
        h2Color:    "#ffffff",
        h1Shadow:   "0 0 30px rgba(99,102,241,0.8), 0 4px 16px rgba(0,0,0,0.5)",
        h2Shadow:   "0 0 20px rgba(255,255,255,0.5)",
        dotColor:   "#6366f1",
        dotGlow:    "rgba(99,102,241,0.8)",
        showVS:     false,
      },
    };
    const tm = travelMeta[gameMode];

    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center overflow-hidden relative"
        style={{ background: tm.bg }}
      >
        {/* 스캔라인 */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg,rgba(255,255,255,0.02) 0px,rgba(255,255,255,0.02) 1px,transparent 1px,transparent 4px)",
            backgroundSize: "100% 4px",
          }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm px-8">

          {/* 헤드라인 */}
          <div className="text-center animate-pop-in" style={{ animationDuration: "0.4s" }}>
            <div
              className="font-black tracking-widest"
              style={{ fontSize: "clamp(28px,8vw,36px)", color: tm.h1Color, textShadow: tm.h1Shadow, letterSpacing: "0.08em" }}
            >
              {tm.headline1}
            </div>
            <div
              className="font-black"
              style={{ fontSize: "clamp(20px,6vw,26px)", color: tm.h2Color, textShadow: tm.h2Shadow, letterSpacing: "0.12em" }}
            >
              {tm.headline2}
            </div>
          </div>

          {/* 도전 모드: VS 레이아웃 */}
          {tm.showVS ? (
            <div className="flex items-center justify-between w-full gap-4">
              <div className="flex flex-col items-center gap-2 flex-1">
                <img
                  src={selectedCharacter} alt="나"
                  className="animate-idle-float"
                  style={{ width: 72, height: 72, objectFit: "contain", filter: "drop-shadow(0 0 18px rgba(59,130,246,0.8))" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                <span className="text-xs font-black text-blue-300 tracking-wider">PLAYER</span>
              </div>
              <div className="font-black animate-bounce" style={{ fontSize: "24px", color: "#ef4444", textShadow: "0 0 16px rgba(239,68,68,0.9)", flexShrink: 0 }}>
                ⚔️<br />VS
              </div>
              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="animate-bounce" style={{ fontSize: "72px", lineHeight: 1, filter: "drop-shadow(0 0 20px rgba(220,38,38,0.9))" }}>
                  {typeInfo.monster}
                </div>
                <span className="text-xs font-black text-red-300 tracking-wider">{currentMonsterName.toUpperCase()}</span>
              </div>
            </div>
          ) : (
            /* 성장/퍼즐 모드: 캐릭터 중심 */
            <div className="flex flex-col items-center gap-3">
              <img
                src={selectedCharacter} alt="캐릭터"
                className="animate-idle-float"
                style={{
                  width: 96, height: 96,
                  objectFit: "contain",
                  filter: `drop-shadow(0 0 24px ${tm.dotGlow.replace("rgba","rgba").replace("0.8","0.9")})`,
                }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              <div className="text-center">
                <div className="font-black text-white" style={{ fontSize: "15px" }}>
                  {typeInfo.emoji} {typeInfo.title}
                </div>
                <div className="font-semibold mt-1" style={{ fontSize: "13px", color: tm.h1Color }}>
                  {gameMode === "grow" ? "차근차근 시작해볼까요? 💪" : "퍼즐을 완성해봐요! 🧩"}
                </div>
              </div>
            </div>
          )}

          {/* 스테이지 정보 (battle 모드) */}
          {tm.showVS && (
            <div
              className="w-full rounded-2xl px-4 py-3 text-center animate-pop-in"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", animationDelay: "0.2s" }}
            >
              <div className="font-black text-white" style={{ fontSize: "15px" }}>
                {typeInfo.emoji} {typeInfo.title}
              </div>
            </div>
          )}

          {/* 로딩 도트 */}
          <div className="flex gap-2">
            {[0, 200, 400].map((delay) => (
              <div
                key={delay}
                className="w-2.5 h-2.5 rounded-full animate-bounce"
                style={{ background: tm.dotColor, animationDelay: `${delay}ms`, boxShadow: `0 0 8px ${tm.dotGlow}` }}
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ─── playing screen ────────────────────────────────────────────────────────────

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-start p-4 pt-5"
      style={{
        background: `linear-gradient(160deg, ${typeInfo.skyFrom} 0%, ${typeInfo.skyTo} 60%, #d4f5a0 100%)`,
      }}
    >
      {/* ── Screen flash overlay ─────────────────────────────────── */}
      {screenFlash && (
        <div
          className={`fixed inset-0 pointer-events-none z-[120] ${
            screenFlash === "correct" ? "animate-flash-correct" : "animate-flash-wrong"
          }`}
          style={{
            background:
              screenFlash === "correct"
                ? "rgba(255,255,255,0.38)"
                : "rgba(239,68,68,0.32)",
          }}
        />
      )}

      {/* ── Level-up skill selection modal (grow mode) ───────────── */}
      {levelUpOpen && gameMode === "grow" && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
        >
          <div
            className="animate-pop-in w-full mx-4 rounded-3xl overflow-hidden"
            style={{
              maxWidth: 340,
              background: "linear-gradient(180deg,#064e3b 0%,#065f46 60%,#047857 100%)",
              border: "2.5px solid rgba(52,211,153,0.55)",
              boxShadow: "0 0 40px rgba(16,185,129,0.45), 0 20px 60px rgba(0,0,0,0.6)",
            }}
          >
            {/* Header */}
            <div
              className="text-center py-3"
              style={{ background: "linear-gradient(90deg,#059669,#10b981,#059669)" }}
            >
              <div className="text-3xl mb-0.5">🎊</div>
              <div className="font-black text-white" style={{ fontSize: "clamp(17px,4.5vw,20px)", letterSpacing: "-0.02em" }}>
                레벨 업!
              </div>
              <div className="font-semibold text-emerald-100" style={{ fontSize: 12 }}>
                Lv.{growLevel - 1} → Lv.{growLevel}
              </div>
            </div>

            {/* Instruction */}
            <div className="text-center pt-4 pb-2 px-4">
              <p className="font-black text-emerald-100" style={{ fontSize: 13 }}>
                능력을 하나 선택하세요 ✨
              </p>
            </div>

            {/* Skill choices */}
            <div className="flex flex-col gap-2.5 px-4 pb-5">
              {levelUpChoices.map((skill) => (
                <button
                  key={skill.id}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left game-btn"
                  style={{
                    background: "rgba(255,255,255,0.10)",
                    border: "1.5px solid rgba(52,211,153,0.4)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                  }}
                  onClick={() => {
                    // Apply skill effect
                    if (skill.kind === "time")   setTimeLeft((t) => t + 8);
                    if (skill.kind === "score")  setGrowScoreMult(1.5);
                    if (skill.kind === "coin")   setCoins((c) => c + 25);
                    if (skill.kind === "exp")    setGrowExpMult(1.5);
                    if (skill.kind === "shield") setShieldActive(true);
                    setLevelUpOpen(false);
                    setInput("");
                    inputRef.current?.focus();
                  }}
                >
                  <span
                    className="flex-shrink-0 flex items-center justify-center rounded-xl"
                    style={{ width: 40, height: 40, background: "rgba(52,211,153,0.18)", fontSize: 22 }}
                  >
                    {skill.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-white" style={{ fontSize: 14 }}>{skill.name}</div>
                    <div className="text-emerald-300" style={{ fontSize: 11 }}>{skill.desc}</div>
                  </div>
                  <span style={{ fontSize: 18, color: "rgba(52,211,153,0.7)" }}>▶</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Floating score numbers ────────────────────────────────── */}
      {floatingNums.map((num) => (
        <div
          key={num.id}
          className="fixed pointer-events-none z-[110] font-black text-2xl animate-float-score"
          style={{
            left: "50%",
            top: "42%",
            color: num.color,
            textShadow: "0 2px 10px rgba(0,0,0,0.55), 0 0 20px currentColor",
            whiteSpace: "nowrap",
          }}
        >
          {num.text}
        </div>
      ))}

      {/* ── Battle entry banner ───────────────────────────────────── */}
      {battleEntry && (
        <div
          className="fixed pointer-events-none z-[115] animate-battle-entry"
          style={{ top: "50%", left: "50%" }}
        >
          <div
            className="rounded-3xl px-10 py-5 text-center"
            style={{
              background: "linear-gradient(135deg,rgba(220,38,38,0.92),rgba(124,58,237,0.92))",
              backdropFilter: "blur(12px)",
              border: "2px solid rgba(255,255,255,0.25)",
              boxShadow: "0 0 60px rgba(220,38,38,0.5), 0 20px 40px rgba(0,0,0,0.4)",
            }}
          >
            <div className="text-5xl mb-2">{GAME_TEXT[gameMode].entryEmoji}</div>
            <div className="text-white font-black text-3xl tracking-wide" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
              {GAME_TEXT[gameMode].entryBanner}
            </div>
          </div>
        </div>
      )}

      {/* ── Large centered feedback overlay ── */}
      {feedback && <FeedbackOverlay key={feedbackKey} feedback={feedback} />}

      <div className="w-full max-w-2xl flex flex-col gap-3">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="rounded-2xl px-3 py-1.5 text-sm font-black text-white truncate"
                 style={{ background: "rgba(0,0,0,0.28)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)" }}>
              {typeInfo.emoji} {!current?.isMock && current?.conceptName ? current.conceptName : typeInfo.title}
            </div>
            {/* 문제 출처 배지: isMock 플래그 기준으로 표시 */}
            {cmsLoading ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-white/10 border border-white/20 px-2 py-0.5 text-[10px] font-black text-white/60 flex-shrink-0 animate-pulse">
                ⏳ 로드 중
              </span>
            ) : current?.isMock ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-white/10 border border-white/20 px-2 py-0.5 text-[10px] font-black text-white/50 flex-shrink-0">
                📚 연습문제
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-500/30 border border-sky-400/50 px-2 py-0.5 text-[10px] font-black text-sky-200 flex-shrink-0">
                🌐 CMS
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={toggleSound}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all active:scale-90"
              style={{ background: "rgba(255,255,255,0.25)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.3)" }}
              title={soundEnabled ? "사운드 끄기" : "사운드 켜기"}
            >
              {soundEnabled ? "🔊" : "🔇"}
            </button>
            <button
              onClick={goToMap}
              className="text-sm font-black transition-all active:scale-90 px-3 py-1.5 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.22)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.9)" }}
            >
              🗺️ 맵
            </button>
          </div>
        </div>

        {/* Stats row — 지역 모드별로 표시 내용이 다름 */}
        {(() => {
          // TIME 카드는 모든 모드 공통 (2번째 칸)
          const timeCard = (
            <div
              className="game-card rounded-2xl p-3 text-center"
              style={{
                background:     "rgba(255,255,255,0.92)",
                backdropFilter: "blur(10px)",
                border:         "1.5px solid rgba(255,255,255,0.7)",
                boxShadow:      "0 4px 20px rgba(79,70,229,0.1), inset 0 1px 2px rgba(255,255,255,0.9)",
              }}
            >
              <div className="ty-stat-label mb-1">TIME</div>
              <div className={`ty-stat-value ${timerColor}`}>{timeLeft}s</div>
              <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.1)" }}>
                <div className={`h-full rounded-full transition-all duration-1000 ${timerBarColor}`} style={{ width: `${timerPct}%` }} />
              </div>
            </div>
          );

          if (gameMode === "grow") {
            const expPct = Math.round(Math.min((growExp / EXP_PER_LEVEL), 1) * 100);
            return (
              <div className="grid grid-cols-4 gap-2">
                <StatCard label="COMBO" value={combo > 0 ? `×${combo}` : "–"}          valueColor={combo >= 5 ? "text-rose-500" : combo >= 3 ? "text-orange-400" : "text-orange-300"} />
                {timeCard}
                <StatCard label="정답"  value={`${correctCount}/${MONSTER_MAX_HP}`}    valueColor="text-emerald-500" />
                <StatCard label="EXP"   value={`${expPct}%`}                           valueColor="text-teal-500" />
              </div>
            );
          }

          if (gameMode === "puzzle") {
            const filledPieces = Math.round((correctCount / MONSTER_MAX_HP) * 9);
            return (
              <div className="grid grid-cols-4 gap-2">
                <StatCard label="조각"  value={`${filledPieces}/9`}                   valueColor="text-violet-600" />
                {timeCard}
                <StatCard label="정답"  value={`${correctCount}/${MONSTER_MAX_HP}`}    valueColor="text-violet-500" />
                <StatCard label="복습"  value={`${wrongQuestions.length}문제`}         valueColor="text-indigo-500" />
              </div>
            );
          }

          // battle (기본)
          return (
            <div className="grid grid-cols-4 gap-2">
              <StatCard label="SCORE" value={String(score)}              valueColor="text-yellow-500" />
              {timeCard}
              <StatCard label="COMBO" value={combo > 0 ? `×${combo}` : "–"} valueColor={combo >= 5 ? "text-rose-500" : combo >= 3 ? "text-orange-400" : "text-orange-300"} />
              {/* Coins — flashes when earned */}
              <div
                className={`game-card rounded-2xl p-3 text-center ${coinFlash ? "scale-125" : ""}`}
                style={{
                  background:     coinFlash ? "rgba(245,158,11,0.22)" : "rgba(255,255,255,0.92)",
                  backdropFilter: "blur(10px)",
                  border:         coinFlash ? "1.5px solid rgba(245,158,11,0.7)" : "1.5px solid rgba(255,255,255,0.7)",
                  boxShadow:      coinFlash
                    ? "0 0 20px rgba(245,158,11,0.55), 0 4px 16px rgba(245,158,11,0.2)"
                    : "0 4px 20px rgba(79,70,229,0.1), inset 0 1px 2px rgba(255,255,255,0.9)",
                  transition:     "background 0.22s, border 0.22s, box-shadow 0.22s, transform 0.15s",
                }}
              >
                <div className="ty-stat-label mb-1">COINS</div>
                <div className="ty-stat-value text-yellow-500">💰{coins}</div>
              </div>
            </div>
          );
        })()}

        {/* Skill gauge + Item bar — battle 모드 전용 */}
        {gameMode === "battle" && <div
          className="rounded-2xl px-4 py-2.5 flex items-center gap-3"
          style={{
            background: skillReady
              ? "linear-gradient(135deg,rgba(249,115,22,0.14),rgba(239,68,68,0.1))"
              : "rgba(255,255,255,0.75)",
            backdropFilter: "blur(8px)",
            border: skillReady ? "1.5px solid rgba(249,115,22,0.4)" : "1.5px solid rgba(0,0,0,0.06)",
            boxShadow: skillReady ? "0 0 16px rgba(249,115,22,0.18)" : "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <span className="text-lg select-none flex-shrink-0">{skillReady ? "🔥" : "⚡"}</span>
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="ty-stat-label" style={{ color: skillReady ? "#ea580c" : undefined }}>SKILL</span>
              <span className="text-sm font-black" style={{ color: skillReady ? "#ef4444" : "#9ca3af" }}>
                {skillReady ? "✦ 사용 가능!" : `${skillCharge}%`}
              </span>
            </div>
            {/* Skill gauge track */}
            <div className="rounded-full overflow-hidden" style={{
              height: "10px",
              background: "rgba(0,0,0,0.1)",
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.15)",
            }}>
              <div
                className="h-full rounded-full transition-all duration-300 relative overflow-hidden"
                style={{
                  width: `${skillCharge}%`,
                  background: skillReady
                    ? "linear-gradient(90deg,#dc2626,#f97316,#fbbf24)"
                    : "linear-gradient(90deg,#4f46e5,#7c3aed,#a855f7)",
                  boxShadow: skillReady ? "0 0 8px rgba(249,115,22,0.6)" : "none",
                }}
              >
                <div className="absolute inset-x-0 top-0 bottom-1/2 rounded-t-full" style={{ background: "rgba(255,255,255,0.3)" }} />
              </div>
            </div>
          </div>
          <button
            onClick={useSkill}
            disabled={!skillReady || phase !== "playing"}
            className={`game-btn flex-shrink-0 rounded-2xl px-4 py-2 text-sm font-black ${
              skillReady ? "text-white animate-pulse" : "text-gray-300 cursor-not-allowed"
            }`}
            style={{
              background: skillReady
                ? "linear-gradient(135deg,#dc2626,#f97316,#fbbf24)"
                : "rgba(0,0,0,0.05)",
              boxShadow: skillReady ? "0 4px 18px rgba(249,115,22,0.6), 0 1px 4px rgba(220,38,38,0.3)" : "none",
            }}
          >
            💥 스킬
          </button>
        </div>}

        {gameMode === "battle" && <div className="flex gap-2">
          {BATTLE_ITEMS.map((item) => {
            const count    = inventory[item.id];
            const disabled = count === 0 || (item.id === "potion" && phase !== "playing");
            const isShieldOn = item.id === "shield" && shieldActive;

            return (
              <button
                key={item.id}
                onClick={() => useItem(item.id)}
                disabled={disabled}
                className={`game-btn flex-1 rounded-2xl py-2 px-1 text-center flex flex-col items-center gap-0.5 ${
                  disabled  ? "opacity-35 cursor-not-allowed" :
                  isShieldOn ? "animate-pulse" : ""
                }`}
                style={{
                  background: disabled
                    ? "rgba(255,255,255,0.4)"
                    : isShieldOn
                    ? "linear-gradient(135deg,#bfdbfe,#93c5fd)"
                    : "rgba(255,255,255,0.9)",
                  border: isShieldOn
                    ? "1.5px solid rgba(59,130,246,0.5)"
                    : "1.5px solid rgba(0,0,0,0.07)",
                  boxShadow: isShieldOn
                    ? "0 4px 16px rgba(59,130,246,0.4)"
                    : disabled ? "none" : "0 2px 10px rgba(79,70,229,0.1)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <span className="text-lg leading-none">{item.emoji}</span>
                <span className="text-xs font-black text-gray-600 leading-tight">{item.name}</span>
                <span className={`text-xs font-black ${count > 0 ? "text-indigo-600" : "text-gray-400"}`}>
                  ×{count}
                </span>
              </button>
            );
          })}
        </div>}

        {/* Battle arena / Grow arena / Puzzle arena */}
        {gameMode === "grow" ? (
          <GrowArena
            correctCount={correctCount}
            monsterHp={monsterHp}
            charAttacking={charAttacking}
            monsterHit={monsterHit}
            monsterCounter={monsterCounter}
            damageKey={damageKey}
            combo={combo}
            character={selectedCharacter}
            growExp={growExp}
            growLevel={growLevel}
          />
        ) : gameMode === "puzzle" ? (
          <PuzzleArena
            correctCount={correctCount}
            monsterHp={monsterHp}
            charAttacking={charAttacking}
            monsterHit={monsterHit}
            monsterCounter={monsterCounter}
            damageKey={damageKey}
            combo={combo}
            character={selectedCharacter}
          />
        ) : (
          <BattleArena
            arenaInfo={{
              monster:      typeInfo.monster,
              monsterName:  currentMonsterName,
              groundColor:  typeInfo.groundColor,
              monsterImage: currentMonsterImage,
              monsterIcon:  currentMonsterIcon,
            }}
            correctCount={correctCount}
            monsterHp={monsterHp}
            charAttacking={charAttacking}
            monsterHit={monsterHit}
            monsterCounter={monsterCounter}
            damageKey={damageKey}
            combo={combo}
            character={selectedCharacter}
          />
        )}

        {/* ── 캐릭터 가이드 바 (문제 카드 위) ── */}
        {(() => {
          const guideState: CharState =
            screenFlash === "correct" ? "success" :
            screenFlash === "wrong"   ? "oops"    :
            timeLeft < 10             ? "focus"   : "idle";

          const guideMsg =
            screenFlash === "correct" ? "완벽해요! 🎉" :
            screenFlash === "wrong"   ? "괜찮아요, 다시 도전! 💪" :
            combo >= 5                ? "엄청난 콤보! 계속해요! 🔥" :
            combo >= 3                ? "콤보가 이어지고 있어요! ⚡" :
            timeLeft < 10             ? "서두르세요! 시간이 얼마 없어요! ⏰" :
            skillReady                ? "스킬을 사용해봐요! 💥" :
            gameMode === "grow"       ? "천천히, 정확하게 풀어볼까요? 🌱" :
            gameMode === "puzzle"     ? "퍼즐 조각을 맞춰볼까요? 🧩" :
                                       "집중! 몬스터를 물리쳐요! ⚔️";

          return (
            <div className="flex justify-start">
              <CharacterGuide
                message={guideMsg}
                charState={guideState}
                size={56}
                bubbleSide="right"
              />
            </div>
          );
        })()}

        {/* Question card */}
        <div
          key={questionIndex}
          className={`rounded-3xl text-center ${
            cardAnim === "bounce" ? "animate-card-bounce" :
            cardAnim === "shake"  ? "animate-shake"       : ""
          }`}
          style={{
            background: "#fff",
            boxShadow: "0 8px 32px rgba(99,102,241,0.15), 0 2px 8px rgba(0,0,0,0.08)",
            border: "3px solid #c7d2fe",
          }}
        >
          {/* Concept label + difficulty badges */}
          <div className="pt-4 pb-0 px-5 flex items-center justify-between gap-2">
            <span
              className="inline-block rounded-full px-3 py-1 text-xs font-black truncate"
              style={{ background: "#ede9fe", color: "#6d28d9", maxWidth: "55%" }}
              title={current.conceptTitle ?? current.conceptName}
            >
              {current.conceptTitle ?? current.conceptName}
            </span>
            {/* 난이도: 별(★)만 표시 — adaptive 3-star 기준 */}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black ${LEVEL_LABEL[adaptiveLevel].color}`}
              style={{
                background: adaptiveLevel === "HIGH"
                  ? "rgba(239,68,68,0.08)"
                  : adaptiveLevel === "MEDIUM"
                  ? "rgba(245,158,11,0.08)"
                  : "rgba(16,185,129,0.08)",
                border: adaptiveLevel === "HIGH"
                  ? "1px solid rgba(239,68,68,0.25)"
                  : adaptiveLevel === "MEDIUM"
                  ? "1px solid rgba(245,158,11,0.25)"
                  : "1px solid rgba(16,185,129,0.25)",
              }}
              title={`난이도: ${LEVEL_LABEL[adaptiveLevel].label}`}
            >
              {LEVEL_LABEL[adaptiveLevel].stars}
              <span style={{ fontSize: "9px", opacity: 0.7 }}>{LEVEL_LABEL[adaptiveLevel].label}</span>
            </span>
          </div>

          {/* ── Question display ── */}
          {current.questionImageUrl ? (
            /* 이미지 문제: 밝은 배경, 높이 자동 확장, 클리핑 없음 */
            <div
              className="mx-4 mt-3 mb-3 rounded-2xl select-none"
              style={{ background: "#f8f9ff", padding: "12px" }}
            >
              <QuestionDisplay question={current} />
              <ImageLoadFallback />
            </div>
          ) : (
            /* 텍스트 문제: 기존 다크 인디고 스타일 유지 */
            <div
              className="mx-4 mt-3 mb-3 rounded-2xl px-5 select-none relative flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 60%,#1e40af 100%)",
                boxShadow: "inset 0 2px 12px rgba(0,0,0,0.3), 0 4px 16px rgba(30,27,75,0.25)",
                minHeight: "150px",
                padding: "24px 20px",
                overflow: "hidden",
              }}
            >
              <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full pointer-events-none"
                   style={{ background: "rgba(139,92,246,0.2)", filter: "blur(16px)" }} />
              <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full pointer-events-none"
                   style={{ background: "rgba(59,130,246,0.2)", filter: "blur(16px)" }} />
              <QuestionDisplay
                question={current}
                style={{ fontSize: "clamp(2.5rem,10vw,4rem)" }}
              />
              <ImageLoadFallback />
            </div>
          )}

          <div style={{ height: current.questionImageUrl ? "8px" : "16px" }} />

          {/* ── 플레이어 상태 바 (모드별 분기) ── */}
          {gameMode === "battle" ? (
            /* 전투: 하트 HP */
            <div
              className="mx-4 rounded-2xl px-4 py-2 flex items-center justify-between"
              style={{
                background: playerLives <= 1
                  ? "linear-gradient(135deg,rgba(239,68,68,0.12),rgba(185,28,28,0.08))"
                  : "rgba(79,70,229,0.06)",
                border: playerLives <= 1
                  ? "1.5px solid rgba(239,68,68,0.3)"
                  : "1.5px solid rgba(79,70,229,0.12)",
              }}
            >
              <div className="flex items-center gap-2">
                <img src={selectedCharacter} alt="나" style={{ width: 28, height: 28, objectFit: "contain" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                <span className="font-black text-slate-600" style={{ fontSize: "12px" }}>나</span>
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: MAX_PLAYER_LIVES }).map((_, i) => (
                  <span key={i}
                    className={i < playerLives ? (playerLives <= 1 ? "animate-pulse" : "") : "opacity-20"}
                    style={{ fontSize: "20px", transition: "opacity 0.3s" }}
                  >
                    {i < playerLives ? "❤️" : "🖤"}
                  </span>
                ))}
              </div>
              {shieldActive && (
                <span className="text-sm font-black text-blue-500 animate-pulse">🛡️ 방어 중</span>
              )}
            </div>
          ) : gameMode === "grow" ? (
            /* 성장: 플레이어 LV + EXP 진행 바 */
            <div
              className="mx-4 rounded-2xl px-4 py-2.5"
              style={{ background: "rgba(16,185,129,0.08)", border: "1.5px solid rgba(16,185,129,0.2)" }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <img src={selectedCharacter} alt="나" style={{ width: 26, height: 26, objectFit: "contain" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  {/* LV = 플레이어 성장 레벨 (여기에만 표시) */}
                  <span
                    className="rounded-full px-2 py-0.5 font-black text-white"
                    style={{ fontSize: "11px", background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 2px 6px rgba(16,185,129,0.4)" }}
                  >
                    LV.{growLevel}
                  </span>
                </div>
                <span className="font-bold text-emerald-600" style={{ fontSize: "11px" }}>
                  EXP {growExp} / {EXP_PER_LEVEL}
                </span>
              </div>
              <div className="rounded-full overflow-hidden h-2.5" style={{ background: "rgba(0,0,0,0.08)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min((growExp / EXP_PER_LEVEL) * 100, 100)}%`,
                    background: "linear-gradient(90deg,#34d399,#10b981)",
                    boxShadow: "0 0 8px rgba(16,185,129,0.5)",
                  }}
                />
              </div>
            </div>
          ) : (
            /* 퍼즐: 조각 수집 진행 */
            <div
              className="mx-4 rounded-2xl px-4 py-2 flex items-center gap-3"
              style={{ background: "rgba(99,102,241,0.08)", border: "1.5px solid rgba(99,102,241,0.2)" }}
            >
              <img src={selectedCharacter} alt="나" style={{ width: 24, height: 24, objectFit: "contain" }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              <div className="flex-1">
                <div className="flex justify-between mb-1" style={{ fontSize: "10px" }}>
                  <span className="font-bold text-violet-600">🧩 퍼즐 조각</span>
                  <span className="font-black text-violet-700">
                    {Math.round((correctCount / MONSTER_MAX_HP) * 9)} / 9
                  </span>
                </div>
                <div className="rounded-full overflow-hidden h-2" style={{ background: "rgba(0,0,0,0.08)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(correctCount / MONSTER_MAX_HP) * 100}%`,
                      background: "linear-gradient(90deg,#a78bfa,#7c3aed)",
                    }}
                  />
                </div>
              </div>
              <span className="font-black text-violet-500" style={{ fontSize: "11px" }}>
                {wrongQuestions.length > 0 ? `📋 복습 ${wrongQuestions.length}개` : "🎯 도전 중"}
              </span>
            </div>
          )}

          {/* Answer input */}
          <div className="px-4 pb-5 flex flex-col gap-3">
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              className="w-full rounded-2xl border-[3px] border-indigo-200 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 focus:outline-none px-4 text-center font-black transition-all"
              style={{ fontSize: "clamp(2rem,7vw,2.8rem)", background: "#f8f9ff", padding: "16px" }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") checkAnswer(); }}
              placeholder="?"
              autoFocus
            />

            <button
              onClick={checkAnswer}
              className="game-btn w-full rounded-2xl font-black text-white"
              style={{
                padding:       "18px",
                fontSize:      "clamp(1.1rem,4vw,1.4rem)",
                background:    "linear-gradient(135deg,#f59e0b 0%,#ef4444 60%,#dc2626 100%)",
                boxShadow:     "0 6px 24px rgba(239,68,68,0.45), 0 2px 6px rgba(245,158,11,0.3)",
                letterSpacing: "0.02em",
              }}
            >
              {GAME_TEXT[gameMode].attackBtn}
            </button>
          </div>
        </div>

        <p className="text-center text-sm font-bold opacity-50" style={{ color: typeInfo.groundColor }}>
          Enter 키로도 공격할 수 있어요!
        </p>
      </div>
    </main>
  );
}

// ─── WorldMap ─────────────────────────────────────────────────────────────────
function WorldMap({
  unlockedTypeId,
  clearedTypeIds,
  score,
  bestScore,
  coins,
  selectedCharacter,
  wrongCount,
  questProgress,
  claimedQuests,
  attendanceClaimed,
  showTutorial,
  soundEnabled,
  lifetimeStats,
  stagesClearedCount,
  showStatsPanel,
  dailyCompleted,
  completionStreak,
  missionProgress,
  missionsBonusClaimed,
  teacherMode,
  teacherConfig,
  studentList,
  selectedStudentId,
  onSelectStudent,
  onOpenTeacher,
  onCloseTeacher,
  onSaveTeacherConfig,
  onOpenStats,
  onCloseStats,
  onSelectStage,
  onOpenShop,
  onOpenReview,
  onClaimQuest,
  onClaimAttendance,
  onOpenTutorial,
  onCloseTutorial,
  onToggleSound,
  onGoHome,
}: {
  unlockedTypeId:    number;
  clearedTypeIds:    number[];
  score:             number;
  bestScore:         number;
  coins:             number;
  selectedCharacter: string;
  wrongCount:        number;
  questProgress:     Record<QuestId, number>;
  claimedQuests:     QuestId[];
  attendanceClaimed: boolean;
  showTutorial:       boolean;
  soundEnabled:       boolean;
  lifetimeStats:      LifetimeStats;
  stagesClearedCount: number;
  showStatsPanel:     boolean;
  dailyCompleted:      boolean;
  completionStreak:    number;
  missionProgress:     Record<MissionId, number>;
  missionsBonusClaimed: boolean;
  teacherMode:          boolean;
  teacherConfig:        TeacherConfig;
  studentList:          Student[];
  selectedStudentId:    string;
  onSelectStudent:      (id: string) => void;
  onOpenTeacher:        () => void;
  onCloseTeacher:       () => void;
  onSaveTeacherConfig:  (cfg: TeacherConfig) => void;
  onOpenStats:         () => void;
  onCloseStats:        () => void;
  onSelectStage:       (id: number) => void;
  onOpenShop:          () => void;
  onOpenReview:        () => void;
  onClaimQuest:        (id: QuestId, reward: number) => void;
  onClaimAttendance:   () => void;
  onOpenTutorial:      () => void;
  onCloseTutorial:     () => void;
  onToggleSound:       () => void;
  onGoHome:            () => void;
}) {
  const allCleared = clearedTypeIds.length >= FLAT_TYPES.length;

  // ── local effect states ────────────────────────────────────────────────────
  const [clickedNodeId,   setClickedNodeId]   = useState<number | null>(null);
  const [showArrival,     setShowArrival]     = useState(false);
  const [charMoving,      setCharMoving]      = useState(false);
  const [missionExpanded, setMissionExpanded] = useState(false);
  const prevUnlockedRef2 = useRef(unlockedTypeId);
  const movingTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect unlockedTypeId change → moving state → arrival sparkle
  useEffect(() => {
    if (prevUnlockedRef2.current !== unlockedTypeId) {
      prevUnlockedRef2.current = unlockedTypeId;
      setCharMoving(true);
      if (movingTimerRef.current) clearTimeout(movingTimerRef.current);
      movingTimerRef.current = setTimeout(() => {
        setCharMoving(false);
        setShowArrival(true);
        const t2 = setTimeout(() => setShowArrival(false), 900);
        return () => clearTimeout(t2);
      }, 850);
    }
    return () => { if (movingTimerRef.current) clearTimeout(movingTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedTypeId]);

  // node spacing constants
  // (horizontal map constants removed — map is now vertical)

  return (
    <main
      className="min-h-screen flex flex-col relative"
      style={{ background: "linear-gradient(180deg,#bfdbfe 0%,#a7f3d0 40%,#fef9c3 75%,#fed7aa 100%)" }}
    >
      {/* 배경 장식 레이어 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="animate-cloud-drift absolute text-5xl opacity-20" style={{ top: "3%",  left: "4%"  }}>☁️</div>
        <div className="animate-cloud-drift-slow absolute text-4xl opacity-15" style={{ top: "8%",  right: "6%" }}>☁️</div>
        <div className="animate-star-twinkle absolute text-xl opacity-35" style={{ top: "15%", left: "15%" }}>✨</div>
        <div className="animate-star-twinkle absolute text-lg opacity-25" style={{ top: "20%", right: "18%", animationDelay: "1.4s" }}>⭐</div>
        <div className="absolute bottom-0 left-0 right-0" style={{
          height: "100px",
          background: "linear-gradient(180deg, transparent 0%, rgba(5,150,105,0.08) 50%, rgba(5,150,105,0.14) 100%)",
        }} />
      </div>

      {/* ════════════════════════════════════════════════════════════
          HUD  –  simplified sticky top bar
      ════════════════════════════════════════════════════════════ */}
      <div
        className="relative z-50 sticky top-0"
        style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.6)" }}
      >
        {/* ── Top utility strip: coins + sound + teacher ── */}
        <div
          className="flex items-center justify-between px-3 pt-2.5 pb-1"
          style={{ maxWidth: "900px", margin: "0 auto" }}
        >
          {/* Coins badge */}
          <div className="flex items-center gap-1.5 rounded-2xl px-3 py-1.5 bg-amber-50 border border-amber-100">
            <span className="text-base leading-none">💰</span>
            <span className="font-black text-amber-700 text-sm">{coins}</span>
          </div>

          {/* Utility icons: sound + teacher (teacher-only, kept for later dashboard hook) */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleSound}
              title={soundEnabled ? "사운드 끄기" : "사운드 켜기"}
              className="w-9 h-9 rounded-2xl flex items-center justify-center text-base bg-gray-100 transition-all active:scale-90 hover:bg-gray-200"
            >{soundEnabled ? "🔊" : "🔇"}</button>
            {/* 선생님 모드: 추후 교사 대시보드 진입점으로 확장 예정 */}
            <button
              onClick={onOpenTeacher}
              title="선생님 모드"
              className="w-9 h-9 rounded-2xl flex items-center justify-center text-base bg-gray-100 transition-all active:scale-90 hover:bg-gray-200"
            >👩‍🏫</button>
          </div>
        </div>

        {/* ── Student Navigation Bar ── */}
        {/*
          학생용 5탭 네비게이션.
          - 학생 이름/선택 UI는 이 바에서 완전히 제거.
          - 학생 선택(studentList)은 선생님 대시보드에서만 노출 예정.
          - 랭킹(반/그룹 단위)은 추후 이 탭 구조에 항목을 추가하는 방식으로 확장 가능.
        */}
        <nav
          className="flex items-center gap-1 px-3 pb-2"
          aria-label="주요 메뉴"
          style={{ maxWidth: "900px", margin: "0 auto" }}
        >
          {(
            [
              { id: "home",    label: "홈",   emoji: "🏠",  action: onGoHome,    active: false },
              { id: "map",     label: "모험", emoji: "🗺️",  action: () => {},    active: true  },
              { id: "growth",  label: "성장", emoji: "📈",  action: onOpenStats, active: false },
              { id: "records", label: "기록", emoji: "📋",  action: onOpenReview,active: false },
              { id: "shop",    label: "상점", emoji: "🛍️",  action: onOpenShop,  active: false },
            ] as { id: string; label: string; emoji: string; action: () => void; active: boolean }[]
          ).map((item) => (
            <button
              key={item.id}
              onClick={item.action}
              className="game-btn flex-1 rounded-2xl py-2 px-1 flex flex-col items-center gap-0.5 font-black transition-all"
              style={{
                fontSize:   "13px",
                background: item.active
                  ? "linear-gradient(135deg,#4f46e5,#6366f1)"
                  : "#f1f5f9",
                color:      item.active ? "#fff" : "#64748b",
                boxShadow:  item.active ? "0 4px 16px rgba(79,70,229,0.3)" : "none",
              }}
              aria-current={item.active ? "page" : undefined}
            >
              <span className="text-base leading-none">{item.emoji}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* ── Mission accordion (compact) ── */}
        {(() => {
          const missionsTotal = MISSIONS.length;
          const missionsDone  = MISSIONS.filter((m) => {
            const target = m.id === "solve" ? teacherConfig.solveTarget
                         : m.id === "combo" ? teacherConfig.comboTarget
                         :                    teacherConfig.stageTarget;
            return missionProgress[m.id] >= target;
          }).length;
          const allDone         = missionsDone === missionsTotal;
          const questsClaimable = QUESTS.filter(
            (q) => questProgress[q.id] >= q.target && !claimedQuests.includes(q.id)
          ).length;

          return (
            <div className="px-3 pb-2.5" style={{ maxWidth: "900px", margin: "0 auto" }}>
              {/* ── Accordion header row ── two separate elements to avoid button-in-button */}
              <div className="flex items-center gap-1">
                {/* Main clickable area (toggle) */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setMissionExpanded((v) => !v)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMissionExpanded((v) => !v); } }}
                  className="flex-1 flex items-center gap-2 rounded-2xl px-4 py-2.5 transition-all cursor-pointer select-none bg-gray-100 hover:bg-gray-200"
                >
                  <span className="text-base leading-none flex-shrink-0">
                    {missionsBonusClaimed ? "🎯" : allDone ? "✨" : "📋"}
                  </span>
                  <span className="font-semibold text-sm flex-shrink-0 text-slate-700">
                    오늘의 미션
                  </span>
                  <span className="font-medium text-sm flex-shrink-0 text-slate-400">
                    {missionsDone}/{missionsTotal}
                  </span>
                  <div className="flex-1" />
                  {!missionsBonusClaimed && allDone && (
                    <span className="font-semibold text-xs rounded-full px-2 py-0.5 flex-shrink-0 bg-orange-100 text-orange-700">
                      보상 +50💰
                    </span>
                  )}
                  {questsClaimable > 0 && (
                    <span className="font-semibold text-xs rounded-full px-2 py-0.5 flex-shrink-0 bg-amber-100 text-amber-700">
                      🏆 {questsClaimable}
                    </span>
                  )}
                  {attendanceClaimed && dailyCompleted && (
                    <span className="font-medium text-xs flex-shrink-0 text-green-600">
                      🔥 {completionStreak}일 연속
                    </span>
                  )}
                  <span
                    className="font-semibold text-xs flex-shrink-0 text-slate-400 transition-transform duration-200"
                    style={{ transform: missionExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                  >▾</span>
                </div>

                {/* Action buttons — outside the toggle div to avoid nesting */}
                {!attendanceClaimed && dailyCompleted && (
                  <button
                    onClick={onClaimAttendance}
                    className="font-semibold text-xs rounded-2xl px-3 py-2.5 flex-shrink-0 transition-all active:scale-95 bg-green-600 text-white hover:bg-green-700"
                  >🔥 +20💰</button>
                )}
                <button
                  title="튜토리얼"
                  onClick={onOpenTutorial}
                  className="flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-semibold text-slate-500 bg-gray-100 transition-all active:scale-90 hover:bg-gray-200"
                >?</button>
              </div>

              {missionExpanded && (
                <div className="mt-2 w-full">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>

                    {MISSIONS.map((m) => {
                      const target = m.id === "solve" ? teacherConfig.solveTarget
                                   : m.id === "combo" ? teacherConfig.comboTarget
                                   :                    teacherConfig.stageTarget;
                      const cur  = missionProgress[m.id];
                      const done = cur >= target;
                      const pct  = Math.min((cur / target) * 100, 100);
                      return (
                        <div key={m.id} className="relative rounded-2xl p-3.5 bg-white shadow-sm">
                          <span className="absolute top-2 right-2 text-[9px] font-semibold rounded-full px-1.5 py-0.5 bg-gray-100 text-slate-500">
                            일일
                          </span>
                          <div className="text-2xl mb-1 leading-none">{done ? "✅" : m.icon}</div>
                          <p className="text-sm font-semibold leading-snug mb-1.5 pr-6 text-slate-700">{m.label}</p>
                          <p className="text-lg font-black tabular-nums mb-1.5 leading-none"
                            style={{ color: done ? "#10b981" : "#2563eb" }}>
                            {cur}<span className="text-xs font-medium ml-0.5 opacity-40">/{target}</span>
                          </p>
                          <div className="h-1.5 rounded-full overflow-hidden bg-gray-100">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: done ? "#10b981" : "#2563eb" }} />
                          </div>
                        </div>
                      );
                    })}

                    {QUESTS.map((q) => {
                      const prog       = questProgress[q.id];
                      const isComplete = prog >= q.target;
                      const isClaimed  = claimedQuests.includes(q.id);
                      const pct        = Math.min((prog / q.target) * 100, 100);
                      return (
                        <div key={q.id} className="relative rounded-2xl p-3.5 bg-white shadow-sm">
                          <span className="absolute top-2 right-2 text-[9px] font-semibold rounded-full px-1.5 py-0.5 bg-gray-100 text-slate-500">업적</span>
                          <div className="text-2xl mb-1 leading-none">{isClaimed ? "✅" : isComplete ? "🔔" : "🏆"}</div>
                          <p className="text-sm font-semibold leading-snug mb-1.5 pr-6"
                            style={{ color: isClaimed ? "#9ca3af" : "#334155", textDecoration: isClaimed ? "line-through" : "none" }}>
                            {q.title}
                          </p>
                          {!isClaimed && isComplete ? (
                            <button onClick={() => onClaimQuest(q.id, q.reward)}
                              className="rounded-2xl px-3 py-1.5 text-sm font-semibold text-white bg-orange-500 active:scale-95 transition-all mb-1.5 hover:bg-orange-600">
                              +{q.reward}💰 받기
                            </button>
                          ) : (
                            <p className="text-lg font-black tabular-nums mb-1.5 leading-none"
                              style={{ color: isClaimed ? "#d1d5db" : isComplete ? "#f97316" : "#64748b" }}>
                              {Math.min(prog, q.target)}<span className="text-xs font-medium ml-0.5 opacity-40">/{q.target}</span>
                            </p>
                          )}
                          <div className="h-1.5 rounded-full overflow-hidden bg-gray-100">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: isClaimed ? "#d1d5db" : isComplete ? "#f97316" : "#2563eb" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {allDone && !missionsBonusClaimed && (
                    <div className="mt-2 rounded-2xl px-4 py-3 flex items-center gap-2 animate-pulse"
                      style={{ background: "#fef9c3", border: "2px solid #fbbf24" }}>
                      <span className="text-lg">🎯</span>
                      <p className="font-black text-amber-800 text-sm">미션 전체 완료! +50💰 자동 지급</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ════════════════════════════════════════════════════════════
          GAME MAP  –  vertical scrollable stage path
      ════════════════════════════════════════════════════════════ */}
      {/* ── 캐릭터 가이드 스트립 (맵 위 고정) ── */}
      {(() => {
        const mapMsg =
          allCleared                    ? "모든 스테이지 완료! 정말 대단해요! 🌟" :
          clearedTypeIds.length >= 3    ? `${clearedTypeIds.length}개 클리어! 계속 도전해요! 💪` :
          clearedTypeIds.length >= 1    ? "잘 하고 있어요! 다음 스테이지로! 🗺️" :
                                          "스테이지를 선택해 도전을 시작해볼까요? 🎮";
        const mapState: CharState =
          allCleared                    ? "success" :
          clearedTypeIds.length >= 1    ? "focus"   : "idle";
        return (
          <div className="relative z-10 w-full" style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,0.5)" }}>
            <div className="px-4 py-2" style={{ maxWidth: "900px", margin: "0 auto" }}>
              <CharacterGuide
                message={mapMsg}
                charState={mapState}
                size={52}
                bubbleSide="right"
              />
            </div>
          </div>
        );
      })()}

      <div
        className="relative z-10 flex-1 overflow-y-auto"
        style={{ minHeight: "0" }}
      >
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        {/* All-clear banner */}
        {allCleared && (
          <div className="flex justify-center pt-5 pb-2 animate-pop-in">
            <div
              className="rounded-3xl px-8 py-5 text-center"
              style={{ background: "linear-gradient(135deg,#fbbf24,#f97316)", boxShadow: "0 8px 32px rgba(251,191,36,0.4)" }}
            >
              <div className="text-4xl mb-1">🌟🌟🌟</div>
              <p className="text-white font-black text-lg">모든 스테이지 클리어!</p>
              <p className="text-white/80 text-sm mt-0.5">다시 도전해서 점수를 높여봐요!</p>
            </div>
          </div>
        )}

        {CHAPTERS.map((chapter) => {
          const typeNodes = chapter.types.map((t, tIdx) => {
            const flatTypeIdx = FLAT_TYPES.findIndex((ft) => ft.id === t.id);
            const isCleared   = clearedTypeIds.includes(t.id);
            // 각 지역이 독립적인 게임 모드이므로 잠금 없음 — 모든 지역에서 플레이 가능
            const isLocked    = false;
            // 진행 강조 표시: 아직 클리어하지 않은 지역 (= 도전 가능)
            const isCurrent   = !isCleared && !allCleared;
            const isLeft      = tIdx % 2 === 0;
            const prevIsLeft  = tIdx > 0 ? (tIdx - 1) % 2 === 0 : true;
            const stageNum    = flatTypeIdx + 1;
            // 클리어한 지역은 작게, 아직 안 한 지역은 크게 표시
            const nodeSize    = isCurrent ? 88 : 72;

            // Path + node colours
            const pathColor = isCleared ? "#10b981" : isCurrent ? "#3b82f6" : "#94a3b8";

            const handleSelect = () => {
              setClickedNodeId(t.id);
              setTimeout(() => setClickedNodeId(null), 700);
              onSelectStage(t.id);
            };
            const handleKey = (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelect(); }
            };

            return (
              <div key={t.id}>

                {/* ════ Bezier PATH connector ════ */}
                {tIdx > 0 && (
                  <div
                    className="pointer-events-none select-none"
                    style={{ height: "72px", position: "relative" }}
                  >
                    <svg
                      width="100%" height="72"
                      viewBox="0 0 100 72"
                      preserveAspectRatio="none"
                      style={{ position: "absolute", inset: 0, overflow: "visible" }}
                    >
                      {/* Shadow trace */}
                      <path
                        d={prevIsLeft ? "M 21,0 C 21,36 79,36 79,72" : "M 79,0 C 79,36 21,36 21,72"}
                        stroke="rgba(0,0,0,0.07)"
                        strokeWidth="9"
                        fill="none"
                        strokeLinecap="round"
                      />
                      {/* Main path */}
                      <path
                        d={prevIsLeft ? "M 21,0 C 21,36 79,36 79,72" : "M 79,0 C 79,36 21,36 21,72"}
                        stroke={pathColor}
                        strokeWidth={isCleared || isCurrent ? "6" : "5"}
                        strokeDasharray={isLocked || (!isCleared && !isCurrent) ? "9 7" : undefined}
                        fill="none"
                        strokeLinecap="round"
                        opacity={isLocked ? 0.35 : 1}
                      />
                      {/* Foot-dot markers on cleared / current paths */}
                      {(isCleared || isCurrent) && (
                        <>
                          <circle cx={prevIsLeft ? 37 : 63} cy="24" r="3.5" fill={pathColor} opacity="0.55" />
                          <circle cx="50"                   cy="36" r="3"   fill={pathColor} opacity="0.4"  />
                          <circle cx={prevIsLeft ? 63 : 37} cy="48" r="3.5" fill={pathColor} opacity="0.55" />
                        </>
                      )}
                    </svg>
                  </div>
                )}

                {/* ════ Node row ════ */}
                <div
                  className={`relative flex ${isLeft ? "justify-start" : "justify-end"} px-6`}
                >
                  <div
                    className="flex flex-col items-center"
                    style={{ gap: "8px", width: `${nodeSize + 44}px` }}
                  >

                    {/* Character above current node */}
                    {isCurrent && (
                      <img
                        src={HERO_IMG}
                        alt="캐릭터"
                        className="animate-idle-float"
                        style={{
                          width: 52, height: 52,
                          objectFit: "contain",
                          filter: "drop-shadow(0 4px 16px rgba(59,130,246,0.55))",
                          marginBottom: "-6px",
                          animationDuration: "2.8s",
                        }}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}

                    {/* ── NODE CIRCLE ── */}
                    <div
                      role={isLocked ? undefined : "button"}
                      tabIndex={isLocked ? undefined : 0}
                      onClick={isLocked ? undefined : handleSelect}
                      onKeyDown={isLocked ? undefined : handleKey}
                      className={`relative flex items-center justify-center rounded-full select-none${isCurrent ? " animate-pop-in" : ""}`}
                      style={{
                        width: nodeSize, height: nodeSize,
                        cursor: isLocked ? "default" : "pointer",
                        background: isLocked
                          ? "#dde1e9"
                          : isCleared
                          ? "linear-gradient(135deg,#059669,#10b981)"
                          : isCurrent
                          ? "linear-gradient(135deg,#1d4ed8,#4f46e5)"
                          : "linear-gradient(135deg,#475569,#64748b)",
                        boxShadow: isLocked ? "none"
                          : isCurrent
                          ? "0 0 0 10px rgba(59,130,246,0.18), 0 8px 28px rgba(37,99,235,0.45)"
                          : isCleared
                          ? "0 4px 18px rgba(5,150,105,0.45)"
                          : "0 4px 14px rgba(71,85,105,0.25)",
                        opacity: isLocked ? 0.48 : 1,
                        filter: isLocked ? "grayscale(0.5)" : "none",
                        transition: "transform 0.2s ease, box-shadow 0.2s ease",
                      }}
                      onMouseEnter={isLocked ? undefined : (e) => {
                        (e.currentTarget as HTMLDivElement).style.transform = "scale(1.13)";
                      }}
                      onMouseLeave={isLocked ? undefined : (e) => {
                        (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
                      }}
                    >
                      {/* Pulse ring for current node */}
                      {isCurrent && (
                        <div
                          className="absolute inset-0 rounded-full animate-ping pointer-events-none"
                          style={{ background: "rgba(59,130,246,0.18)", animationDuration: "2.2s" }}
                        />
                      )}

                      {/* Main emoji icon */}
                      <span style={{ fontSize: Math.round(nodeSize * 0.38), lineHeight: 1, userSelect: "none" }}>
                        {isLocked ? "🔒" : isCleared ? "✅" : t.emoji}
                      </span>

                      {/* Stage number badge */}
                      <div
                        className="absolute flex items-center justify-center rounded-full font-black text-white"
                        style={{
                          width: 22, height: 22,
                          fontSize: "10px",
                          top: -6, right: -6,
                          background: isLocked ? "#94a3b8" : isCleared ? "#065f46" : isCurrent ? "#1e3a8a" : "#334155",
                          border: "2.5px solid #fff",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
                        }}
                      >
                        {stageNum}
                      </div>

                      {/* Click ripple */}
                      {clickedNodeId === t.id && (
                        <span
                          className="absolute inset-0 rounded-full animate-ripple pointer-events-none"
                          style={{ background: "rgba(59,130,246,0.35)" }}
                        />
                      )}
                    </div>

                    {/* ── Label below node ── */}
                    <div className="text-center" style={{ maxWidth: "128px" }}>
                      {/* 지역 이름 */}
                      <div
                        className="font-black leading-tight"
                        style={{
                          fontSize: "12px",
                          color: isLocked ? "#94a3b8" : isCleared ? "#065f46" : isCurrent ? "#1e3a8a" : "#475569",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {isLocked ? "???" : t.zoneName}
                      </div>
                      {/* 모드 배지 */}
                      {!isLocked && (
                        <div
                          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 mt-1 font-bold"
                          style={{
                            fontSize: "9px",
                            background: isCleared ? "rgba(5,150,105,0.12)" : "rgba(0,0,0,0.05)",
                            color: isCleared ? "#059669" : "#64748b",
                          }}
                        >
                          {GAME_MODE_META[t.mode].emoji} {GAME_MODE_META[t.mode].label}
                        </div>
                      )}
                      <div
                        className="font-semibold mt-0.5"
                        style={{ fontSize: "11px", color: isCleared ? "#10b981" : isCurrent ? "#3b82f6" : "#94a3b8" }}
                      >
                        {isLocked ? "🔒 잠김" : isCleared ? "🚩 클리어" : isCurrent ? ZONE_STATUS_TEXT[t.mode] : `${GAME_MODE_META[t.mode].emoji} ${t.monsterName}`}
                      </div>
                    </div>

                    {/* ── 진입 가능 지역 — 모드별 info 카드 ── */}
                    {!isCleared && (() => {
                      // 지역 모드에 따른 카드 테마
                      const zoneTheme = {
                        grow:   { bannerBg: "linear-gradient(90deg,#d1fae5,#a7f3d0)", bannerBorder: "#6ee7b7", bannerIcon: "🌱", bannerText: `${t.zoneName}에 도착!`,          bannerSub: "훈련", btnBg: "linear-gradient(135deg,#059669,#10b981)", ctaText: "🌱 훈련 시작!", cardBorder: "#6ee7b7", cardShadow: "rgba(16,185,129,0.2)" },
                        battle: { bannerBg: "linear-gradient(90deg,#fef3c7,#fde68a)", bannerBorder: "#fcd34d", bannerIcon: "⚔️", bannerText: `${t.monsterName}이(가) 나타났다!`, bannerSub: "위험", btnBg: "linear-gradient(135deg,#dc2626,#7c3aed)", ctaText: "⚔️ 전투 시작!", cardBorder: "#fca5a5", cardShadow: "rgba(220,38,38,0.2)" },
                        puzzle: { bannerBg: "linear-gradient(90deg,#ede9fe,#ddd6fe)", bannerBorder: "#c4b5fd", bannerIcon: "🧩", bannerText: `${t.zoneName} 복습!`,           bannerSub: "복습", btnBg: "linear-gradient(135deg,#4f46e5,#0ea5e9)", ctaText: "🧩 복습 시작!", cardBorder: "#c4b5fd", cardShadow: "rgba(99,102,241,0.2)" },
                      }[t.mode];
                      return (
                        <div
                          className="animate-pop-in rounded-2xl overflow-hidden"
                          style={{
                            width: "calc(min(260px, 80vw))",
                            marginTop: "2px",
                            background: "rgba(255,255,255,0.97)",
                            backdropFilter: "blur(10px)",
                            border: `2px solid ${zoneTheme.cardBorder}`,
                            boxShadow: `0 10px 32px ${zoneTheme.cardShadow}, 0 2px 8px rgba(0,0,0,0.08)`,
                          }}
                        >
                          {/* Zone alert banner */}
                          <div
                            className="flex items-center gap-2 px-4 py-2"
                            style={{ background: zoneTheme.bannerBg, borderBottom: `1px solid ${zoneTheme.bannerBorder}` }}
                          >
                            <span style={{ fontSize: "14px" }}>{zoneTheme.bannerIcon}</span>
                            <span className="font-black text-slate-800 animate-pulse" style={{ fontSize: "12px" }}>
                              {zoneTheme.bannerText}
                            </span>
                            <span className="ml-auto font-bold text-slate-500" style={{ fontSize: "10px" }}>{zoneTheme.bannerSub}</span>
                          </div>
                          <div className="px-4 py-3">
                            {/* 지역명 + 수학 개념 */}
                            <p className="font-black text-slate-800 leading-snug" style={{ fontSize: "14px" }}>
                              {t.zoneName}
                            </p>
                            <p
                              className="text-slate-500 mt-0.5 mb-3"
                              style={{
                                fontSize: "11px",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {t.title}
                            </p>
                            <button
                              onClick={handleSelect}
                              className="w-full rounded-xl py-2.5 font-black text-sm text-white game-btn"
                              style={{ background: zoneTheme.btnBg, letterSpacing: "-0.01em" }}
                            >
                              {zoneTheme.ctaText}
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          });

          return (
            <div key={chapter.id} className="pb-6">
              {/* Chapter header */}
              <div className="mx-4 mt-6 mb-2">
                <div
                  className="rounded-2xl px-5 py-3 flex items-center gap-3"
                  style={{
                    background: "rgba(255,255,255,0.75)",
                    backdropFilter: "blur(8px)",
                    borderLeft: "4px solid #2563eb",
                    boxShadow: "0 2px 12px rgba(37,99,235,0.1)",
                  }}
                >
                  <span className="text-2xl flex-shrink-0">{chapter.emoji}</span>
                  <div>
                    <div className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest mb-0.5">소단원</div>
                    <div
                      className="font-black text-slate-800 leading-snug"
                      style={{
                        fontSize: "clamp(14px, 3.8vw, 18px)",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {chapter.name}
                    </div>
                  </div>
                </div>
              </div>

              {/* Nodes */}
              {typeNodes}
            </div>
          );
        })}

        {/* Bottom padding */}
        <div style={{ height: "40px" }} />
        </div>
      </div>

      {/* Stats panel */}
      {showStatsPanel && (
        <StatsPanel
          stats={lifetimeStats}
          stagesClearedCount={stagesClearedCount}
          onClose={onCloseStats}
        />
      )}

      {/* Tutorial modal */}
      {showTutorial && <TutorialModal onClose={onCloseTutorial} />}

      {/* Teacher mode panel */}
      {teacherMode && (
        <TeacherPanel
          config={teacherConfig}
          onSave={onSaveTeacherConfig}
          onClose={onCloseTeacher}
        />
      )}
    </main>
  );
}

// ─── BattleArena ──────────────────────────────────────────────────────────────
type TypeInfo = (typeof FLAT_TYPES)[number];

/** Shared props for all arena visualizations. */
type ArenaVisualizationProps = {
  correctCount:   number;
  monsterHp:      number;
  charAttacking:  boolean;
  monsterHit:     boolean;
  monsterCounter: boolean;
  damageKey:      number;
  combo:          number;
  character:      string;
  // grow mode extras
  growExp?:   number;
  growLevel?: number;
};

// ─── GrowArena ────────────────────────────────────────────────────────────────
const GROW_STAGES = ["🌱", "🌿", "🪴", "🌳", "🌸", "🌺"];

function GrowArena({ correctCount, monsterHit, monsterCounter, combo, character, growExp = 0, growLevel = 1 }: ArenaVisualizationProps) {
  const stage      = Math.min(correctCount, GROW_STAGES.length - 1);
  const plantEmoji = GROW_STAGES[stage];
  const stagePct   = (correctCount / MONSTER_MAX_HP) * 100;
  const expPct     = Math.min((growExp / EXP_PER_LEVEL) * 100, 100);

  return (
    <div
      className="rounded-3xl overflow-hidden select-none"
      style={{
        background: "linear-gradient(180deg,#bae6fd 0%,#bbf7d0 55%,#86efac 100%)",
        minHeight: 180,
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        border: "2px solid rgba(255,255,255,0.5)",
      }}
    >
      {/* Top bar: level badge + combo */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div
          className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5"
          style={{ background: "rgba(16,185,129,0.18)", border: "1.5px solid #10b981" }}
        >
          <span style={{ fontSize: 12 }}>⭐</span>
          <span className="font-black text-emerald-800" style={{ fontSize: 11 }}>Lv.{growLevel}</span>
        </div>
        <div className="text-xs font-black text-emerald-600">
          {combo >= 3 ? `🔥 ×${combo} 콤보!` : combo >= 2 ? "✌️ Good!" : ""}
        </div>
      </div>

      {/* Main area */}
      <div className="flex items-end justify-around px-6 pb-2 pt-1 gap-4">
        {/* Character (left) */}
        <div
          className={`flex-shrink-0 transition-transform ${monsterHit ? "scale-125" : "scale-100"}`}
          style={{ fontSize: 44 }}
        >
          {character.startsWith("/") ? (
            <img src={character} alt="character" style={{ width: 48, height: 48, objectFit: "contain" }} />
          ) : (
            <span>{character}</span>
          )}
        </div>

        {/* Central plant */}
        <div
          className={`text-7xl transition-transform duration-300 ${
            monsterCounter ? "animate-shake" : monsterHit ? "scale-125" : "scale-100"
          }`}
          style={{ filter: monsterHit ? "drop-shadow(0 0 20px rgba(34,197,94,0.9))" : "none" }}
        >
          {plantEmoji}
        </div>

        {/* Stage progress petals (right) */}
        <div className="flex-shrink-0 flex flex-col gap-0.5 items-center">
          {Array.from({ length: MONSTER_MAX_HP }).map((_, i) => (
            <span key={i} className={`text-sm ${i < correctCount ? "animate-pop-in" : "opacity-20"}`}>🌸</span>
          ))}
        </div>
      </div>

      {/* EXP bar */}
      <div className="mx-4 mb-1.5">
        <div className="flex justify-between text-[10px] font-black text-emerald-800 mb-0.5 opacity-80">
          <span>✨ 경험치</span>
          <span>{growExp} / {EXP_PER_LEVEL}</span>
        </div>
        <div className="rounded-full overflow-hidden h-3.5" style={{ background: "rgba(0,0,0,0.13)" }}>
          <div
            className="h-full rounded-full transition-all duration-600"
            style={{
              width: `${expPct}%`,
              background: "linear-gradient(90deg,#34d399,#10b981,#059669)",
              boxShadow: "0 0 10px rgba(16,185,129,0.7)",
            }}
          />
        </div>
      </div>

      {/* Stage progress bar */}
      <div className="mx-4 mb-3">
        <div className="flex justify-between text-[10px] font-black text-emerald-700 mb-0.5 opacity-70">
          <span>🌱 스테이지 진행</span>
          <span>{correctCount} / {MONSTER_MAX_HP}</span>
        </div>
        <div className="rounded-full overflow-hidden h-2" style={{ background: "rgba(0,0,0,0.10)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${stagePct}%`,
              background: "linear-gradient(90deg,#86efac,#4ade80)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── PuzzleArena ──────────────────────────────────────────────────────────────
// 3×3 board (9 cells) mapped from MONSTER_MAX_HP (5) correct answers.
const PUZZLE_TOTAL = 9;
const PUZZLE_CELL_COLORS = [
  "linear-gradient(135deg,#a855f7,#7c3aed)",
  "linear-gradient(135deg,#ec4899,#db2777)",
  "linear-gradient(135deg,#f59e0b,#d97706)",
  "linear-gradient(135deg,#06b6d4,#0284c7)",
  "linear-gradient(135deg,#22c55e,#16a34a)",
  "linear-gradient(135deg,#f43f5e,#e11d48)",
  "linear-gradient(135deg,#6366f1,#4f46e5)",
  "linear-gradient(135deg,#fb923c,#ea580c)",
  "linear-gradient(135deg,#34d399,#059669)",
];
const PUZZLE_CELL_EMOJIS = ["🔮", "🎯", "⚡", "🌊", "🍀", "💎", "🌟", "🎪", "🏆"];

function PuzzleArena({ correctCount, monsterCounter, monsterHit, combo }: ArenaVisualizationProps) {
  // Map 0-MONSTER_MAX_HP to 0-PUZZLE_TOTAL cells filled
  const filledCells = Math.round((correctCount / MONSTER_MAX_HP) * PUZZLE_TOTAL);
  const puzzlePct   = (correctCount / MONSTER_MAX_HP) * 100;

  return (
    <div
      className="rounded-3xl overflow-hidden select-none"
      style={{
        background: "linear-gradient(180deg,#0f0c29 0%,#1e1b4b 55%,#312e81 100%)",
        minHeight: 195,
        boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
        border: "2px solid rgba(139,92,246,0.22)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div
          className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5"
          style={{ background: "rgba(139,92,246,0.2)", border: "1.5px solid rgba(139,92,246,0.45)" }}
        >
          <span style={{ fontSize: 11 }}>🧩</span>
          <span className="font-black text-violet-300" style={{ fontSize: 11 }}>퍼즐 {filledCells} / {PUZZLE_TOTAL}</span>
        </div>
        <div className="text-xs font-black text-violet-300">
          {combo >= 3 ? `🔥 ×${combo} 콤보!` : combo >= 2 ? "✌️ Great!" : ""}
        </div>
      </div>

      {/* 3×3 Puzzle grid */}
      <div
        className={`grid grid-cols-3 gap-2 px-4 py-2 ${monsterCounter ? "animate-shake" : ""}`}
      >
        {Array.from({ length: PUZZLE_TOTAL }, (_, i) => {
          const revealed = i < filledCells;
          const isNew    = revealed && i === filledCells - 1 && monsterHit;
          return (
            <div
              key={i}
              className={`rounded-2xl flex items-center justify-center ${
                isNew ? "animate-pop-in" : ""
              }`}
              style={{
                aspectRatio: "1",
                background:  revealed ? PUZZLE_CELL_COLORS[i] : "rgba(255,255,255,0.05)",
                border:      revealed
                  ? "2px solid rgba(255,255,255,0.3)"
                  : "2px dashed rgba(255,255,255,0.13)",
                boxShadow:   revealed
                  ? `0 4px 18px rgba(139,92,246,0.5), inset 0 1px 3px rgba(255,255,255,0.2)`
                  : "none",
                transition:  "background 0.4s ease, box-shadow 0.4s ease",
              }}
            >
              {revealed ? (
                <span style={{ fontSize: 22, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))" }}>
                  {PUZZLE_CELL_EMOJIS[i]}
                </span>
              ) : (
                <span style={{ fontSize: 16, color: "rgba(255,255,255,0.15)", userSelect: "none" }}>✦</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Flash on correct */}
      {monsterHit && (
        <div className="text-center font-black text-violet-300 animate-pop-in" style={{ fontSize: "13px", marginBottom: 2 }}>
          🧩 조각 획득!
        </div>
      )}

      {/* Progress bar */}
      <div className="mx-4 mb-3 mt-1">
        <div className="flex justify-between text-[10px] font-black text-violet-400 mb-0.5 opacity-80">
          <span>✨ 완성도</span>
          <span>{correctCount} / {MONSTER_MAX_HP} 정답</span>
        </div>
        <div className="rounded-full overflow-hidden h-2.5" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${puzzlePct}%`,
              background: "linear-gradient(90deg,#a855f7,#6366f1,#3b82f6)",
              boxShadow: "0 0 10px rgba(168,85,247,0.7)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Minimal arena metadata needed by BattleArena — satisfied by TypeInfo or a review pseudo-type. */
type BattleArenaInfo = {
  monster:     string;
  monsterName: string;
  groundColor: string;
  /** Large battle sprite — 110px in the arena. */
  monsterImage: string;
  /** Small icon — shown in the HP bar (top-left). */
  monsterIcon:  string;
};

// ─── QuestionDisplay ──────────────────────────────────────────────────────────
/**
 * Renders either a text question or an image question depending on what the
 * GameQuestion contains.
 *
 * - Text question  : `q.text` is non-empty  → display as styled text.
 * - Image question : `q.questionImageUrl` is non-empty → display as <img>.
 * - Neither        : show a fallback message.
 */
function QuestionDisplay({
  question,
  className = "",
  style,
}: {
  question:  { text: string; questionImageUrl: string };
  className?: string;
  style?:     React.CSSProperties;
}) {
  if (question.text) {
    return (
      <p
        className={`relative font-black tracking-wide leading-none select-none ${className}`}
        style={{
          fontSize: "clamp(2.4rem,8vw,3.5rem)",
          color: "#ffffff",
          letterSpacing: "0.04em",
          textShadow: "0 2px 16px rgba(139,92,246,0.6)",
          ...style,
        }}
      >
        {question.text}
      </p>
    );
  }

  if (question.questionImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={question.questionImageUrl}
        alt="문제 이미지"
        className={`rounded-xl object-contain mx-auto block ${className}`}
        style={{
          width:     "100%",
          height:    "auto",
          maxWidth:  "100%",
          display:   "block",
          ...style,
        }}
        onError={(e) => {
          const el = e.currentTarget;
          el.style.display = "none";
          const fallback = el.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = "block";
        }}
      />
    );
  }

  // Fallback when neither text nor image is available.
  return (
    <p
      className={`text-white/50 text-base font-bold ${className}`}
      style={style}
    >
      문제를 불러오지 못했어요
    </p>
  );
}

// Image load-error fallback element (hidden by default, revealed by onError above).
function ImageLoadFallback() {
  return (
    <p className="text-white/50 text-base font-bold hidden">
      이미지를 불러오지 못했어요
    </p>
  );
}

function BattleArena({
  arenaInfo,
  monsterMaxHp = MONSTER_MAX_HP,
  correctCount,
  monsterHp,
  charAttacking,
  monsterHit,
  monsterCounter,
  damageKey,
  combo,
  character,
}: {
  arenaInfo:      BattleArenaInfo;
  monsterMaxHp?:  number;
  correctCount:   number;
  monsterHp:      number;
  charAttacking:  boolean;
  monsterHit:     boolean;
  monsterCounter: boolean;
  damageKey:      number;
  combo:          number;
  character:      string;
}) {
  const charLeft   = CHAR_LEFT[Math.min(correctCount, CHAR_LEFT.length - 1)];
  const isDefeated = monsterHp <= 0;
  const hpPct      = Math.max((monsterHp / monsterMaxHp) * 100, 0);

  const hpBarGradient =
    hpPct > 60 ? "linear-gradient(90deg,#059669,#10b981,#34d399)" :
    hpPct > 30 ? "linear-gradient(90deg,#b45309,#f59e0b,#fcd34d)" :
                 "linear-gradient(90deg,#991b1b,#ef4444,#fca5a5)";

  return (
    <div
      className="relative rounded-3xl overflow-hidden shadow-2xl"
      style={{
        height: "280px",
        backgroundImage:    "url('/assets/background/origbig.png')",
        backgroundSize:     "cover",
        backgroundPosition: "center 60%",
        backgroundColor:    "#7ec8a0",
      }}
    >
      {/* ── Ground strip ─────────────────────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-b-3xl pointer-events-none"
        style={{
          height: "50px",
          background: "linear-gradient(to top, rgba(20,83,45,0.7) 0%, rgba(22,163,74,0.3) 60%, transparent 100%)",
        }}
      />
      {/* Dashed path */}
      <div className="absolute bottom-[3.2rem] left-[12%] right-[20%] pointer-events-none" style={{ borderTop: "2px dashed rgba(255,255,255,0.3)" }} />

      {/* ── Monster HP bar (top overlay) ─────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-30 px-3 pt-2.5 pb-3"
           style={{ background: "linear-gradient(to bottom,rgba(0,0,0,0.55),rgba(0,0,0,0.3))", backdropFilter: "blur(6px)" }}>
        <div className="flex items-center gap-2">
          {/* Small monster icon — matches the large sprite */}
          <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
            {isDefeated ? (
              <span className="text-2xl leading-none select-none">💨</span>
            ) : (
              <img
                src={arenaInfo.monsterIcon}
                alt={arenaInfo.monsterName}
                style={{
                  width: "32px",
                  height: "32px",
                  objectFit: "contain",
                  filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))",
                }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const span = document.createElement("span");
                  span.style.fontSize = "1.5rem";
                  span.style.lineHeight = "1";
                  span.textContent = arenaInfo.monster;
                  e.currentTarget.parentElement?.appendChild(span);
                }}
              />
            )}
          </div>
          <div className="flex-1">
            <div className="flex justify-between mb-1.5">
              <span className="text-[11px] font-black text-white tracking-wider drop-shadow">{arenaInfo.monsterName}</span>
              <span className="text-[10px] font-black tabular-nums" style={{ color: hpPct > 60 ? "#6ee7b7" : hpPct > 30 ? "#fde68a" : "#fca5a5" }}>
                HP {Math.max(monsterHp, 0)}/{monsterMaxHp}
              </span>
            </div>
            {/* HP bar outer shell */}
            <div className="rounded-full overflow-hidden" style={{
              height: "14px",
              background: "rgba(0,0,0,0.5)",
              border: "1.5px solid rgba(255,255,255,0.15)",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4)",
            }}>
              {/* HP bar fill */}
              <div
                className={`h-full rounded-full transition-[width] duration-500 ease-out relative overflow-hidden ${hpPct <= 30 ? "animate-[pulse_0.8s_ease-in-out_infinite]" : ""}`}
                style={{ width: `${hpPct}%`, background: hpBarGradient }}
              >
                {/* Gloss on bar */}
                <div className="absolute inset-x-0 top-0 bottom-1/2 rounded-t-full pointer-events-none" style={{ background: "rgba(255,255,255,0.25)" }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Character (main.png) ───────────────────────────────────────────────── */}
      {/* Shadow under character */}
      <div
        className="absolute z-10 rounded-full pointer-events-none"
        style={{
          left:      charLeft,
          bottom:    "2.4rem",
          transform: "translateX(-50%)",
          width:     "72px",
          height:    "16px",
          background: "radial-gradient(ellipse, rgba(0,0,0,0.3) 0%, transparent 70%)",
          transition: "left 0.55s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      />
      <div
        className={`absolute z-20 ${charAttacking ? "animate-char-attack" : ""}`}
        style={{
          left:       charLeft,
          bottom:     "2.6rem",
          transform:  "translateX(-50%)",
          transition: "left 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)",
          filter:     charAttacking
            ? "drop-shadow(0 0 16px rgba(250,204,21,1)) drop-shadow(0 4px 12px rgba(0,0,0,0.5))"
            : "drop-shadow(0 4px 12px rgba(0,0,0,0.4))",
        }}
      >
        <img
          src={HERO_IMG}
          alt="hero"
          style={{ width: "80px", height: "auto", objectFit: "contain", display: "block" }}
          onError={(e) => {
            const el = e.currentTarget;
            el.style.display = "none";
            const span = document.createElement("span");
            span.style.fontSize = "4rem";
            span.style.lineHeight = "1";
            span.textContent = character;
            el.parentElement?.appendChild(span);
          }}
        />
      </div>

      {/* Slash burst when attacking */}
      {charAttacking && (
        <div
          className="absolute select-none pointer-events-none z-30 animate-pop-in"
          style={{ left: charLeft, bottom: "4.2rem", fontSize: "2.4rem", transform: "translateX(32px)" }}
        >
          ⚔️
        </div>
      )}
      {charAttacking && (
        <div
          className="absolute select-none pointer-events-none z-30 animate-pop-in"
          style={{ left: charLeft, bottom: "3rem", fontSize: "2rem", transform: "translateX(58px)", animationDelay: "60ms" }}
        >
          ✨
        </div>
      )}

      {/* Counter-attack hit marker */}
      {monsterCounter && (
        <div
          className="absolute text-4xl animate-pop-in select-none pointer-events-none z-30"
          style={{ left: charLeft, bottom: "5rem", transform: "translateX(-68px)" }}
        >
          💢
        </div>
      )}

      {/* ── Monster sprite ─────────────────────────────────────────────────────── */}
      <div
        className="absolute flex flex-col items-center z-20"
        style={{ right: "7%", bottom: "2.5rem" }}
      >
        {/* Floating damage number */}
        <div className="relative h-12 flex justify-center items-end">
          {damageKey > 0 && (
            <span
              key={damageKey}
              className="absolute left-1/2 bottom-0 font-black animate-damage-float select-none pointer-events-none"
              style={{
                fontSize: "2rem",
                color: "#ef4444",
                textShadow: "0 0 12px rgba(239,68,68,0.8), 0 2px 4px rgba(0,0,0,0.4)",
              }}
            >
              −1
            </span>
          )}
        </div>

        {/* Monster image */}
        {isDefeated ? (
          <span style={{ fontSize: "5rem", lineHeight: 1, opacity: 0.5, filter: "grayscale(1)" }}>💨</span>
        ) : (
          <img
            src={arenaInfo.monsterImage}
            alt={arenaInfo.monsterName}
            className={
              monsterHit     ? "animate-monster-hit"     :
              monsterCounter ? "animate-monster-counter" : ""
            }
            style={{
              width:  "110px",
              height: "auto",
              objectFit: "contain",
              display: "block",
              filter: monsterHit
                ? "drop-shadow(0 0 24px rgba(239,68,68,1)) drop-shadow(0 0 8px rgba(239,68,68,0.6)) brightness(1.8)"
                : "drop-shadow(0 6px 16px rgba(0,0,0,0.45))",
              transition: "filter 0.08s",
            }}
            onError={(e) => {
              // fallback to emoji if image fails to load
              e.currentTarget.style.display = "none";
              const span = document.createElement("span");
              span.style.fontSize = "5.5rem";
              span.style.lineHeight = "1";
              span.textContent = arenaInfo.monster;
              e.currentTarget.parentElement?.appendChild(span);
            }}
          />
        )}
      </div>

      {/* ── Combo flash ────────────────────────────────────────────────────────── */}
      {charAttacking && combo >= 3 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
          <div className="animate-pop-in bg-orange-400/90 text-white font-black text-base rounded-2xl px-6 py-2.5 shadow-2xl">
            🔥 {combo}콤보 공격!
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FeedbackOverlay ──────────────────────────────────────────────────────────
/**
 * Large centered feedback popup — mount with a changing `key` to re-trigger animation.
 * e.g. <FeedbackOverlay key={feedbackKey} feedback={feedback} />
 */
function FeedbackOverlay({ feedback }: { feedback: string }) {
  const style = (() => {
    // wrong-type feedback (battle / grow / puzzle variants)
    if (feedback.includes("반격") || feedback.includes("시들") || feedback.includes("틀렸어"))
                                   return { bg: "linear-gradient(135deg,#ef4444,#b91c1c)", glow: "rgba(239,68,68,0.6)",   icon: "💢" };
    // almost-win encouragement
    if (feedback.includes("아쉽다"))  return { bg: "linear-gradient(135deg,#f97316,#ea580c)", glow: "rgba(249,115,22,0.6)",  icon: "💪" };
    if (feedback.includes("스킬"))    return { bg: "linear-gradient(135deg,#f97316,#dc2626)", glow: "rgba(249,115,22,0.7)",  icon: "💥" };
    // crit-type (battle: 대박, grow: 활짝, puzzle: 완벽)
    if (feedback.includes("대박") || feedback.includes("활짝") || feedback.includes("완벽"))
                                   return { bg: "linear-gradient(135deg,#f59e0b,#d97706)", glow: "rgba(245,158,11,0.7)",  icon: "⚡" };
    // combo-type (battle: 콤보, grow: 연속, puzzle: 연속)
    if (feedback.includes("콤보") || feedback.includes("연속"))
                                   return { bg: "linear-gradient(135deg,#f97316,#ea580c)", glow: "rgba(249,115,22,0.6)",  icon: "🔥" };
    if (feedback.includes("오답 해결")) return { bg: "linear-gradient(135deg,#8b5cf6,#6d28d9)", glow: "rgba(139,92,246,0.7)", icon: "🌟" };
    if (feedback.includes("보호막"))    return { bg: "linear-gradient(135deg,#3b82f6,#1d4ed8)", glow: "rgba(59,130,246,0.7)",  icon: "🛡️" };
    if (feedback.includes("+10초"))     return { bg: "linear-gradient(135deg,#10b981,#047857)", glow: "rgba(16,185,129,0.7)",  icon: "⏰" };
    if (feedback.includes("폭탄"))      return { bg: "linear-gradient(135deg,#f97316,#b45309)", glow: "rgba(249,115,22,0.7)",  icon: "💣" };
    if (feedback.includes("❌"))        return { bg: "linear-gradient(135deg,#ef4444,#b91c1c)", glow: "rgba(239,68,68,0.6)",   icon: "💢" };
    return                                      { bg: "linear-gradient(135deg,#22c55e,#16a34a)", glow: "rgba(34,197,94,0.5)",   icon: "✨" };
  })();

  return (
    <div
      className="animate-feedback-burst fixed z-[150] pointer-events-none select-none"
      style={{ top: "42%", left: "50%" }}
    >
      <div
        className="rounded-3xl px-8 py-5 text-center"
        style={{
          background: style.bg,
          boxShadow: `0 0 0 6px rgba(255,255,255,0.15), 0 8px 40px ${style.glow}`,
          minWidth: "200px",
        }}
      >
        <div style={{ fontSize: (feedback.includes("대박") || feedback.includes("활짝") || feedback.includes("완벽")) ? "3.4rem" : "2.8rem", lineHeight: 1 }}>
          {style.icon}
        </div>
        <div
          className="font-black text-white mt-1 leading-tight"
          style={{
            fontSize: feedback.includes("대박")
              ? "clamp(2rem, 7.5vw, 2.8rem)"
              : "clamp(1.6rem, 6vw, 2.2rem)",
            textShadow: feedback.includes("대박")
              ? "0 0 20px rgba(255,255,255,0.8), 0 2px 8px rgba(0,0,0,0.4)"
              : "0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          {feedback}
        </div>
      </div>
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <div
      className="game-card rounded-2xl p-3 text-center"
      style={{
        background:    "rgba(255,255,255,0.92)",
        backdropFilter: "blur(10px)",
        border:        "1.5px solid rgba(255,255,255,0.7)",
        boxShadow:     "0 4px 20px rgba(79,70,229,0.1), inset 0 1px 2px rgba(255,255,255,0.9)",
      }}
    >
      <div className="ty-stat-label mb-1">{label}</div>
      <div className={`ty-stat-value ${valueColor}`}>{value}</div>
    </div>
  );
}

// ─── StatsPanel ───────────────────────────────────────────────────────────────
/** Raw JSON export record (English keys — for developer / API use). */
function buildJsonRecord(stats: LifetimeStats, stagesClearedCount: number) {
  const accuracy = stats.totalSolved > 0
    ? Math.round((stats.totalCorrect / stats.totalSolved) * 100)
    : 0;
  return {
    exportDate:        todayStr(),
    totalSolved:       stats.totalSolved,
    totalCorrect:      stats.totalCorrect,
    totalWrong:        stats.totalWrong,
    accuracy:          `${accuracy}%`,
    bestCombo:         stats.bestCombo,
    clearedTypeIds:    stagesClearedCount,
    reviewsDone:       stats.reviewsDone,
    streakDays:        stats.streakDays,
    lastCompletedDate: stats.lastCompletedDate,
  };
}

/** Korean-header CSV row for teacher / Excel use. */
function buildCsvRow(stats: LifetimeStats, stagesClearedCount: number): { headers: string[]; values: (string | number)[] } {
  const accuracy = stats.totalSolved > 0
    ? Math.round((stats.totalCorrect / stats.totalSolved) * 100)
    : 0;
  return {
    headers: ["날짜", "총 문제 수", "정답 수", "오답 수", "정답률", "최고 콤보", "클리어 스테이지", "연속 학습일"],
    values:  [
      todayStr(),
      stats.totalSolved,
      stats.totalCorrect,
      stats.totalWrong,
      `${accuracy}%`,
      stats.bestCombo,
      stagesClearedCount,
      stats.streakDays,
    ],
  };
}

function exportStats(stats: LifetimeStats, stagesClearedCount: number, format: "json" | "excel") {
  const today = todayStr();

  if (format === "json") {
    const record = buildJsonRecord(stats, stagesClearedCount);
    const blob   = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    triggerDownload(blob, `mathgame_stats_${today}.json`);
  } else {
    // CSV with UTF-8 BOM so Excel opens Korean text correctly
    const { headers, values } = buildCsvRow(stats, stagesClearedCount);
    const escape = (v: string | number) => {
      const s = String(v);
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv  = "\uFEFF" + headers.map(escape).join(",") + "\n" + values.map(escape).join(",");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    triggerDownload(blob, `mathgame_report_${today}.csv`);
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── 학습 리포트 생성 ──────────────────────────────────────────────────────────
type ReportLine = {
  kind: "summary" | "good" | "warn" | "tip";
  icon: string;
  text: string;
};

function buildReport(stats: LifetimeStats, stagesClearedCount: number): ReportLine[] {
  const accuracy = stats.totalSolved > 0
    ? Math.round((stats.totalCorrect / stats.totalSolved) * 100)
    : 0;

  const lines: ReportLine[] = [];

  // No data yet
  if (stats.totalSolved === 0) {
    lines.push({ kind: "tip", icon: "🌱", text: "아직 학습 기록이 없어요. 첫 번째 문제에 도전해봐요!" });
    return lines;
  }

  // ── 요약 ──
  lines.push({
    kind: "summary",
    icon: "📚",
    text: `총 ${stats.totalSolved}문제를 풀었고, 정답률은 ${accuracy}%예요.`,
  });

  // ── 정답/오답 ──
  if (accuracy >= 90) {
    lines.push({ kind: "good", icon: "✨", text: `정답률 ${accuracy}%! 정말 훌륭해요. 거의 모든 문제를 맞혔어요.` });
  } else if (accuracy >= 70) {
    lines.push({ kind: "good", icon: "💪", text: `정답률 ${accuracy}%로 안정적이에요. 조금만 더 집중하면 90%도 가능해요!` });
  } else {
    lines.push({ kind: "warn", icon: "📝", text: `정답률이 ${accuracy}%예요. 틀린 문제를 복습하면 빠르게 나아질 수 있어요.` });
  }

  // ── 스테이지 ──
  if (stagesClearedCount >= 3) {
    lines.push({ kind: "good", icon: "🗺️", text: `${stagesClearedCount}개의 스테이지를 클리어했어요! 퀘스트 마스터에 가까워지고 있어요.` });
  } else if (stagesClearedCount > 0) {
    lines.push({ kind: "summary", icon: "🗺️", text: `${stagesClearedCount}개의 스테이지를 클리어했어요.` });
  }

  // ── 콤보 ──
  if (stats.bestCombo >= 5) {
    lines.push({ kind: "good", icon: "🔥", text: `최고 ${stats.bestCombo}콤보를 달성했어요! 연속 집중력이 뛰어나요.` });
  } else if (stats.bestCombo >= 3) {
    lines.push({ kind: "summary", icon: "⚡", text: `최고 ${stats.bestCombo}콤보를 달성했어요. 더 긴 콤보에 도전해봐요!` });
  }

  // ── 오답 ──
  if (stats.totalWrong > 0) {
    lines.push({
      kind: stats.totalWrong >= 5 ? "warn" : "summary",
      icon: "❌",
      text: `틀린 문제가 ${stats.totalWrong}개 있어요.${stats.reviewsDone === 0 ? " 복습 던전에서 확인해보면 좋아요!" : ""}`,
    });
  }

  // ── 복습 ──
  if (stats.reviewsDone > 0) {
    lines.push({ kind: "good", icon: "🔮", text: `복습 던전을 ${stats.reviewsDone}번 완료해서 틀린 문제를 꼼꼼히 점검했어요.` });
  }

  // ── 스트릭 ──
  if (stats.streakDays >= 7) {
    lines.push({ kind: "good", icon: "🌟", text: `${stats.streakDays}일 연속 학습 중이에요! 이 습관이 실력을 만들어요.` });
  } else if (stats.streakDays >= 3) {
    lines.push({ kind: "good", icon: "🔥", text: `${stats.streakDays}일 연속 꾸준히 학습하고 있어요. 잘하고 있어요!` });
  }

  // ── 추천 ──
  if (accuracy < 60 || stats.totalWrong >= 5) {
    lines.push({ kind: "tip", icon: "💡", text: "다음에는 복습 던전으로 틀린 문제를 다시 확인해보면 좋아요." });
  } else if (stats.reviewsDone === 0 && stats.totalWrong > 0) {
    lines.push({ kind: "tip", icon: "💡", text: "복습 던전에서 틀린 문제를 한 번 더 풀어보면 완벽해질 수 있어요!" });
  } else if (stagesClearedCount === 0) {
    lines.push({ kind: "tip", icon: "💡", text: "첫 스테이지에 도전해서 수학 퀘스트를 시작해봐요!" });
  } else {
    lines.push({ kind: "tip", icon: "💡", text: "다음 스테이지에 도전해서 더 어려운 문제에 맞서봐요!" });
  }

  return lines;
}

function StatsPanel({
  stats,
  stagesClearedCount,
  onClose,
}: {
  stats:              LifetimeStats;
  stagesClearedCount: number;
  onClose:            () => void;
}) {
  const [showReport, setShowReport] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const accuracy = stats.totalSolved > 0
    ? Math.round((stats.totalCorrect / stats.totalSolved) * 100)
    : 0;

  const streakMsg =
    stats.streakDays >= 7 ? "🌟 일주일 연속 학습! 정말 대단해요!"  :
    stats.streakDays >= 3 ? `🔥 ${stats.streakDays}일 연속 학습 중이에요!` :
    stats.streakDays >= 1 ? "📅 오늘도 함께 성장해요!"              :
    "🌱 학습을 시작해봐요!";

  const rows: { icon: string; label: string; value: string }[] = [
    { icon: "📚", label: "총 풀이 문제",    value: `${stats.totalSolved}개` },
    { icon: "✅", label: "총 정답",          value: `${stats.totalCorrect}개` },
    { icon: "🎯", label: "정답률",           value: `${accuracy}%` },
    { icon: "❌", label: "오답 수",          value: `${stats.totalWrong}개` },
    { icon: "🔥", label: "최고 콤보",        value: `${stats.bestCombo}콤보` },
    { icon: "🗺️", label: "클리어 스테이지", value: `${stagesClearedCount}개` },
    { icon: "🔮", label: "복습 던전 완료",   value: `${stats.reviewsDone}회` },
    { icon: "📅", label: "연속 학습일",      value: `${stats.streakDays}일` },
  ];

  const reportLines = buildReport(stats, stagesClearedCount);

  // kind → style map
  const kindStyle: Record<ReportLine["kind"], { bg: string; border: string; text: string }> = {
    summary: { bg: "#f0f9ff", border: "#bae6fd", text: "#0369a1" },
    good:    { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
    warn:    { bg: "#fefce8", border: "#fde68a", text: "#92400e" },
    tip:     { bg: "#fdf4ff", border: "#e9d5ff", text: "#6b21a8" },
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-pop-in"
        style={{ maxHeight: "92dvh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex-shrink-0 px-6 pt-5 pb-4"
          style={{ background: "linear-gradient(135deg,#0e7490,#0891b2)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-white leading-tight">
                {showReport ? "📋 학습 리포트" : "📊 내 학습 기록"}
              </h2>
              <p className="text-cyan-100/80 text-[11px] mt-0.5">{streakMsg}</p>
            </div>
            {/* View toggle */}
            <button
              onClick={() => setShowReport((v) => !v)}
              className="rounded-xl px-3 py-1.5 text-xs font-black transition-all active:scale-95"
              style={{
                background: showReport ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.3)",
                color: "#fff",
              }}
            >
              {showReport ? "📊 기록 보기" : "📋 리포트"}
            </button>
          </div>
        </div>

        {/* ── Body (scrollable) ── */}
        <div className="bg-white flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2" style={{ scrollbarWidth: "none" }}>

          {showReport ? (
            /* ── 학습 리포트 뷰 ── */
            <>
              <p className="text-[11px] text-gray-400 font-bold text-center mb-1">
                학부모·선생님께 전달할 수 있는 학습 요약이에요
              </p>
              <div className="flex flex-col gap-2">
                {reportLines.map((line, i) => {
                  const s = kindStyle[line.kind];
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-2xl px-4 py-3"
                      style={{ background: s.bg, border: `1px solid ${s.border}` }}
                    >
                      <span className="text-lg flex-shrink-0 mt-0.5">{line.icon}</span>
                      <p className="text-sm font-bold leading-snug" style={{ color: s.text }}>
                        {line.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* ── 기록 그리드 뷰 ── */
            <>
              <div className="grid grid-cols-2 gap-2">
                {rows.map((r) => (
                  <div key={r.label} className="rounded-2xl bg-gray-50 border border-gray-100 px-3 py-2.5 flex items-center gap-2">
                    <span className="text-lg flex-shrink-0">{r.icon}</span>
                    <div className="min-w-0">
                      <div className="text-[10px] text-gray-400 font-bold leading-tight truncate">{r.label}</div>
                      <div className="text-sm font-black text-gray-700 leading-tight">{r.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── 선생님용 데이터 내보내기 (accordion) ── */}
          <div className="mt-1 rounded-2xl border border-gray-100 overflow-hidden">
            <button
              onClick={() => setShowExport((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
            >
              <span className="text-[11px] font-black text-gray-500">🗂️ 선생님용 데이터 내보내기</span>
              <span className="text-gray-300 text-xs">{showExport ? "▲" : "▼"}</span>
            </button>
            {showExport && (
              <div className="flex flex-col gap-2 px-4 pb-4">
                {/* Primary: Excel download */}
                <button
                  onClick={() => exportStats(stats, stagesClearedCount, "excel")}
                  className="w-full rounded-xl py-2.5 font-black text-sm text-white transition-all active:scale-95 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}
                >
                  📊 엑셀 다운로드
                </button>
                <p className="text-[10px] text-gray-400 text-center -mt-1">
                  한글 컬럼 포함 · 엑셀/Numbers에서 바로 열기 가능
                </p>
                {/* Secondary: JSON (developer) */}
                <button
                  onClick={() => exportStats(stats, stagesClearedCount, "json")}
                  className="w-full rounded-xl py-2 font-bold text-xs text-gray-400 border border-gray-200 bg-gray-50 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  ⚙️ 데이터 원본 (개발자용)
                </button>
              </div>
            )}
          </div>

          {/* ── 닫기 ── */}
          <button
            onClick={onClose}
            className="mt-1 w-full rounded-2xl py-3 font-black text-sm text-white transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg,#0e7490,#0891b2)" }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TeacherDashboardScreen ───────────────────────────────────────────────────
/**
 * 교사용 대시보드 전용 화면.
 * - 학생 목록 / 선택
 * - 선택된 학생의 학습 현황 (오늘/전체)
 * - 미션 목표 설정
 * - CSV / JSON 내보내기
 */
function TeacherDashboardScreen({
  studentList,
  selectedStudentId,
  teacherConfig,
  userRole,
  onSelectStudent,
  onSaveConfig,
  onToggleRole,
  onClose,
}: {
  studentList:       Student[];
  selectedStudentId: string;
  teacherConfig:     TeacherConfig;
  userRole:          UserRole;
  onSelectStudent:   (id: string) => void;
  onSaveConfig:      (cfg: TeacherConfig) => void;
  onToggleRole:      () => void;
  onClose:           () => void;
}) {
  const [activeId,    setActiveId]    = useState(selectedStudentId);
  const [configDraft, setConfigDraft] = useState<TeacherConfig>({ ...teacherConfig });
  const [configSaved, setConfigSaved] = useState(false);
  const [activeTab,   setActiveTab]   = useState<"report" | "config">("report");

  // ── 선택된 학생의 저장 데이터 로드 ──
  const save   = loadSave(activeId);
  const daily  = loadDaily(activeId);
  const stats  = loadLifetimeStats(activeId);

  const accuracy = stats.totalSolved > 0
    ? Math.round((stats.totalCorrect / stats.totalSolved) * 100)
    : 0;

  const clearCount = save.clearedTypeIds.length;

  // 추천 복습 지역: 가장 많은 오답이 속한 stageId 기준
  const stageWrongCounts: Record<number, number> = {};
  save.wrongQuestions.forEach((q) => {
    stageWrongCounts[q.stageId] = (stageWrongCounts[q.stageId] ?? 0) + 1;
  });
  const worstStageId = Object.entries(stageWrongCounts).sort(([, a], [, b]) => b - a)[0]?.[0];
  const worstTypeInfo = worstStageId ? (() => {
    try { return getTypeInfo(Number(worstStageId)); } catch { return null; }
  })() : null;

  // 평균 정답 간격(ms) → 실제 데이터 없으므로 총 문제 / 스테이지 수 기반 rough 추정
  const avgPerStage = clearCount > 0 ? Math.round(stats.totalSolved / clearCount) : 0;

  const handleSaveConfig = () => {
    onSaveConfig({ ...configDraft });
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 1800);
  };

  const activeStudent = studentList.find((s) => s.id === activeId) ?? studentList[0];

  return (
    <main
      className="min-h-screen flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(180deg,#1e1b4b 0%,#312e81 40%,#1e1b4b 100%)" }}
    >
      {/* ── 헤더 ── */}
      <div
        className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
      >
        <button
          onClick={onClose}
          className="rounded-xl px-3 py-1.5 font-bold text-sm text-white/70 transition-all active:scale-90"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          ← 학생 화면
        </button>
        <div className="flex flex-col items-center">
          <span className="text-xl">👩‍🏫</span>
          <span className="font-black text-white text-sm mt-0.5">교사 대시보드</span>
        </div>
        <button
          onClick={onToggleRole}
          className="rounded-xl px-3 py-1.5 font-bold text-xs transition-all active:scale-90"
          style={{
            background: userRole === "teacher"
              ? "rgba(239,68,68,0.15)"
              : "rgba(16,185,129,0.15)",
            color: userRole === "teacher" ? "#fca5a5" : "#6ee7b7",
            border: `1px solid ${userRole === "teacher" ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
          }}
        >
          {userRole === "teacher" ? "👦 학생 전환" : "👩‍🏫 교사 전환"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 max-w-lg mx-auto w-full">

        {/* ── 학생 선택 ── */}
        <section>
          <p className="text-white/40 text-[11px] font-black tracking-widest uppercase mb-2">학생 선택</p>
          <div className="flex flex-wrap gap-2">
            {studentList.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setActiveId(s.id);
                  onSelectStudent(s.id);
                }}
                className="rounded-2xl px-3 py-2 font-black text-sm transition-all active:scale-90"
                style={{
                  background: activeId === s.id
                    ? "linear-gradient(135deg,#7c3aed,#6d28d9)"
                    : "rgba(255,255,255,0.07)",
                  color:      activeId === s.id ? "#fff" : "rgba(255,255,255,0.55)",
                  border:     activeId === s.id
                    ? "1.5px solid rgba(167,139,250,0.5)"
                    : "1.5px solid rgba(255,255,255,0.1)",
                  boxShadow:  activeId === s.id ? "0 4px 16px rgba(109,40,217,0.4)" : "none",
                }}
              >
                👦 {s.name}
              </button>
            ))}
          </div>
        </section>

        {/* ── 탭 ── */}
        <div className="flex gap-2">
          {(["report", "config"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 rounded-2xl py-2 font-black text-sm transition-all active:scale-95"
              style={{
                background: activeTab === tab
                  ? "linear-gradient(135deg,#4f46e5,#6366f1)"
                  : "rgba(255,255,255,0.06)",
                color:      activeTab === tab ? "#fff" : "rgba(255,255,255,0.4)",
                border:     activeTab === tab
                  ? "1.5px solid rgba(99,102,241,0.5)"
                  : "1.5px solid rgba(255,255,255,0.08)",
              }}
            >
              {tab === "report" ? "📋 학습 리포트" : "⚙️ 수업 설정"}
            </button>
          ))}
        </div>

        {/* ── 리포트 탭 ── */}
        {activeTab === "report" && (
          <>
            {/* 학생 요약 */}
            <section
              className="rounded-3xl p-4"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">👦</span>
                <div>
                  <div className="font-black text-white text-base">{activeStudent?.name ?? "-"}</div>
                  <div className="text-white/40 text-[11px]">현재 선택된 학생</div>
                </div>
              </div>

              {/* 오늘 학습 */}
              <p className="text-white/30 text-[10px] font-black tracking-widest uppercase mb-2">오늘 학습</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { icon: "📚", label: "푼 문제",  value: `${daily.solvedToday}문제` },
                  { icon: "🔥", label: "최고 콤보", value: `×${stats.bestCombo}` },
                  { icon: "🗺️", label: "스테이지",  value: `${daily.stagesClearedToday}클리어` },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl px-2 py-2.5 text-center"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <div className="text-lg mb-0.5">{item.icon}</div>
                    <div className="font-black text-white text-sm leading-tight">{item.value}</div>
                    <div className="text-white/35 text-[9px] mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>

              {/* 전체 기록 */}
              <p className="text-white/30 text-[10px] font-black tracking-widest uppercase mb-2">전체 기록</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: "✅", label: "총 문제 수",  value: `${stats.totalSolved}문제` },
                  { icon: "🎯", label: "정답률",      value: `${accuracy}%` },
                  { icon: "🗺️", label: "클리어 스테이지", value: `${clearCount}개` },
                  { icon: "📅", label: "연속 학습일",  value: `${stats.streakDays}일` },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl px-3 py-2.5 flex items-center gap-2"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <span className="text-base flex-shrink-0">{item.icon}</span>
                    <div>
                      <div className="font-black text-white text-sm leading-tight">{item.value}</div>
                      <div className="text-white/35 text-[9px]">{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 정답률 시각화 */}
            <section
              className="rounded-3xl p-4"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <p className="text-white/40 text-[11px] font-black tracking-widest uppercase mb-3">정답률 현황</p>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 rounded-full overflow-hidden" style={{ height: 12, background: "rgba(255,255,255,0.08)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${accuracy}%`,
                      background: accuracy >= 80
                        ? "linear-gradient(90deg,#34d399,#10b981)"
                        : accuracy >= 60
                        ? "linear-gradient(90deg,#fbbf24,#f59e0b)"
                        : "linear-gradient(90deg,#f87171,#ef4444)",
                      boxShadow: "0 0 8px rgba(16,185,129,0.4)",
                    }}
                  />
                </div>
                <span className="font-black text-white text-sm flex-shrink-0">{accuracy}%</span>
              </div>
              <p className="text-white/30 text-xs">
                {accuracy >= 80 ? "👏 우수한 학습 성과예요!" : accuracy >= 60 ? "💪 꾸준히 성장 중이에요." : "📝 오답 복습이 필요해요."}
              </p>
            </section>

            {/* 오답 개념 & 추천 복습 */}
            <section
              className="rounded-3xl p-4"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <p className="text-white/40 text-[11px] font-black tracking-widest uppercase mb-3">오답 분석</p>
              {save.wrongQuestions.length === 0 ? (
                <p className="text-white/30 text-sm">✅ 현재 오답 문제가 없어요.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">📝</span>
                    <div>
                      <div className="font-black text-white text-sm">오답 {save.wrongQuestions.length}문제</div>
                      <div className="text-white/40 text-xs">복습이 필요한 문제들</div>
                    </div>
                  </div>
                  {worstTypeInfo && (
                    <div
                      className="rounded-2xl px-3 py-2 mt-2 flex items-center gap-2"
                      style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}
                    >
                      <span className="text-lg">{worstTypeInfo.emoji}</span>
                      <div>
                        <div className="font-black text-amber-300 text-xs">추천 복습 지역</div>
                        <div className="font-bold text-white text-sm">{worstTypeInfo.title}</div>
                      </div>
                    </div>
                  )}
                </>
              )}
              {avgPerStage > 0 && (
                <div className="mt-3 text-white/30 text-[11px]">
                  스테이지당 평균 {avgPerStage}문제 풀이
                </div>
              )}
            </section>

            {/* 데이터 내보내기 */}
            <section>
              <p className="text-white/40 text-[11px] font-black tracking-widest uppercase mb-2">데이터 내보내기</p>
              <div className="flex gap-2">
                <button
                  onClick={() => exportStats(stats, clearCount, "excel")}
                  className="flex-1 rounded-2xl py-2.5 font-black text-sm text-white transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}
                >
                  📊 엑셀 다운로드
                </button>
                <button
                  onClick={() => exportStats(stats, clearCount, "json")}
                  className="rounded-2xl px-4 py-2.5 font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1"
                  style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  ⚙️ JSON
                </button>
              </div>
            </section>
          </>
        )}

        {/* ── 수업 설정 탭 ── */}
        {activeTab === "config" && (
          <section
            className="rounded-3xl p-4 flex flex-col gap-3"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <p className="text-white/40 text-[11px] font-black tracking-widest uppercase mb-1">미션 목표 설정</p>
            <p className="text-white/30 text-xs -mt-1 mb-2">학생 화면에 표시되는 오늘의 미션 목표를 조정합니다.</p>

            {(
              [
                { key: "solveTarget" as const, icon: "📚", label: "문제 풀기 목표", unit: "문제", min: 1, max: 50 },
                { key: "comboTarget" as const, icon: "🔥", label: "콤보 달성 목표", unit: "회",   min: 1, max: 20 },
                { key: "stageTarget" as const, icon: "🗺️", label: "스테이지 클리어", unit: "개",  min: 1, max: FLAT_TYPES.length },
              ]
            ).map((f) => (
              <div
                key={f.key}
                className="rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <span className="text-xl flex-shrink-0">{f.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-sm">{f.label}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setConfigDraft((d) => ({ ...d, [f.key]: Math.max(f.min, d[f.key] - 1) }))}
                    className="w-8 h-8 rounded-xl text-white font-black text-base transition-all active:scale-90"
                    style={{ background: "rgba(255,255,255,0.1)" }}
                  >−</button>
                  <span className="font-black text-white text-base w-8 text-center">
                    {configDraft[f.key]}
                  </span>
                  <button
                    onClick={() => setConfigDraft((d) => ({ ...d, [f.key]: Math.min(f.max, d[f.key] + 1) }))}
                    className="w-8 h-8 rounded-xl text-white font-black text-base transition-all active:scale-90"
                    style={{ background: "rgba(255,255,255,0.1)" }}
                  >+</button>
                  <span className="text-white/30 text-[11px] w-8">{f.unit}</span>
                </div>
              </div>
            ))}

            <button
              onClick={handleSaveConfig}
              className="w-full rounded-2xl py-3 font-black text-sm transition-all active:scale-95 mt-1"
              style={{
                background: configSaved
                  ? "linear-gradient(135deg,#10b981,#059669)"
                  : "linear-gradient(135deg,#7c3aed,#6d28d9)",
                color: "#fff",
                boxShadow: configSaved
                  ? "0 4px 16px rgba(16,185,129,0.4)"
                  : "0 4px 16px rgba(109,40,217,0.4)",
              }}
            >
              {configSaved ? "✅ 저장 완료!" : "💾 저장"}
            </button>

            {/* 난이도/지역 안내 */}
            <div
              className="rounded-2xl px-4 py-3 mt-1"
              style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}
            >
              <p className="font-black text-indigo-300 text-xs mb-2">📍 현재 학생 진도 현황</p>
              {save.clearedTypeIds.length === 0 ? (
                <p className="text-white/30 text-xs">아직 클리어한 지역이 없어요.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {save.clearedTypeIds.map((id) => {
                    let info: { emoji: string; title: string } | null = null;
                    try { info = getTypeInfo(id); } catch { info = null; }
                    return info ? (
                      <span
                        key={id}
                        className="rounded-full px-2.5 py-1 text-[11px] font-black"
                        style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}
                      >
                        {info.emoji} {info.title}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}

// ─── TeacherPanel ─────────────────────────────────────────────────────────────
function TeacherPanel({
  config,
  onSave,
  onClose,
}: {
  config:  TeacherConfig;
  onSave:  (cfg: TeacherConfig) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<TeacherConfig>({ ...config });
  const [saved, setSaved] = useState(false);

  const fields: {
    key:   keyof TeacherConfig;
    icon:  string;
    label: string;
    unit:  string;
    min:   number;
    max:   number;
  }[] = [
    { key: "solveTarget", icon: "📚", label: "문제 풀기",        unit: "개", min: 1, max: 50 },
    { key: "comboTarget", icon: "🔥", label: "콤보 달성",        unit: "회", min: 1, max: 20 },
    { key: "stageTarget", icon: "🗺️", label: "스테이지 클리어", unit: "개", min: 1, max: FLAT_TYPES.length },
  ];

  const handleSave = () => {
    onSave(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 pt-6 pb-4 text-center"
          style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}
        >
          <div className="text-4xl mb-1 select-none">👩‍🏫</div>
          <h2 className="text-xl font-black text-white">선생님 모드</h2>
          <p className="text-purple-200/80 text-xs mt-0.5">오늘의 미션 목표를 직접 설정하세요</p>
        </div>

        {/* Body */}
        <div className="bg-white px-5 py-5 flex flex-col gap-3">

          {/* Mission input fields */}
          {fields.map((f) => (
            <div
              key={f.key}
              className="flex items-center gap-3 rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3"
            >
              <span className="text-2xl flex-shrink-0">{f.icon}</span>
              <p className="flex-1 text-sm font-black text-gray-600">{f.label}</p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setDraft((d) => ({ ...d, [f.key]: Math.max(f.min, d[f.key] - 1) }))}
                  className="w-8 h-8 rounded-full bg-gray-200 font-black text-gray-600 flex items-center justify-center text-base transition-all active:scale-90 hover:bg-gray-300"
                >
                  −
                </button>
                <span className="text-xl font-black text-gray-700 w-8 text-center tabular-nums">
                  {draft[f.key]}
                </span>
                <button
                  onClick={() => setDraft((d) => ({ ...d, [f.key]: Math.min(f.max, d[f.key] + 1) }))}
                  className="w-8 h-8 rounded-full bg-gray-200 font-black text-gray-600 flex items-center justify-center text-base transition-all active:scale-90 hover:bg-gray-300"
                >
                  +
                </button>
                <span className="text-xs text-gray-400 w-4 text-left">{f.unit}</span>
              </div>
            </div>
          ))}

          {/* Save confirmation */}
          {saved && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-center text-sm font-black text-emerald-600 animate-pop-in">
              ✅ 미션이 업데이트됐어요!
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            className="w-full rounded-2xl py-3 font-black text-sm text-white transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}
          >
            🎯 미션 생성
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full rounded-2xl py-2.5 font-bold text-sm text-gray-400 border border-gray-200 bg-gray-50 transition-all active:scale-95"
          >
            완료
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TutorialModal ────────────────────────────────────────────────────────────
function TutorialModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const total = TUTORIAL_STEPS.length;
  const current = TUTORIAL_STEPS[step];
  const isLast = step === total - 1;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-5"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
    >
      {/* Card */}
      <div
        className="relative w-full max-w-xs rounded-3xl overflow-hidden shadow-2xl animate-pop-in"
        style={{ background: "linear-gradient(160deg,#1e293b,#0f172a)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {/* Top accent strip */}
        <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg,#6366f1,#a855f7,#ec4899)" }} />

        {/* Skip button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white/60 text-xs font-bold transition-colors"
        >
          건너뛰기
        </button>

        {/* Content */}
        <div className="px-7 pt-8 pb-6 flex flex-col items-center text-center">
          {/* Step icon */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-5 shadow-xl"
            style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.3),rgba(168,85,247,0.2))", border: "2px solid rgba(139,92,246,0.4)" }}
          >
            {current.icon}
          </div>

          {/* Step title */}
          <h2 className="text-white font-black text-lg mb-3">{current.title}</h2>

          {/* Step description */}
          <p className="text-white/60 text-sm leading-relaxed whitespace-pre-line mb-6">
            {current.desc}
          </p>

          {/* Dot indicators */}
          <div className="flex gap-2 mb-6">
            {TUTORIAL_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className="rounded-full transition-all"
                style={{
                  width:      i === step ? "20px" : "8px",
                  height:     "8px",
                  background: i === step ? "#818cf8" : "rgba(255,255,255,0.2)",
                }}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 w-full">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex-1 rounded-2xl py-3 text-sm font-black text-white/50 transition-all active:scale-95"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                ← 이전
              </button>
            )}
            <button
              onClick={() => isLast ? onClose() : setStep((s) => s + 1)}
              className="flex-1 rounded-2xl py-3 text-sm font-black text-white transition-all active:scale-95"
              style={{ background: isLast ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#6366f1,#4f46e5)" }}
            >
              {isLast ? "🚀 시작하기!" : "다음 →"}
            </button>
          </div>

          {/* Step counter */}
          <p className="mt-4 text-white/25 text-[10px] font-bold">
            {step + 1} / {total}
          </p>
        </div>
      </div>
    </div>
  );
}
