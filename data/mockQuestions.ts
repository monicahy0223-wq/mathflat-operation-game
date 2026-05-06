import type { GameQuestion, QuestionLevel } from "../types/gameQuestion";

// ── level → numeric difficulty (CMS mapDifficulty 와 동일한 규칙) ──────────
const LEVEL_TO_DIFFICULTY: Record<QuestionLevel, number> = {
  LOW:    1,
  MEDIUM: 3,
  HIGH:   5,
};

// ── operator colour tokens ────────────────────────────────────────────────
const OP_COLOR: Record<string, string> = {
  "+": "#6366f1", // indigo
  "-": "#f97316", // orange
};

/**
 * 수식 문자열 "A op B = ?" 을 세로식 SVG 데이터 URL로 변환합니다.
 * CMS 이미지 문제와 동일한 렌더링 경로(밝은 배경, questionImageUrl)를 사용하기
 * 위해 이 URL 을 questionImageUrl 에 설정하고 text 는 비워둡니다.
 *
 * 지원 형태: "35 + 23 = ?", "201 - 78 = ?" 등
 */
function makeSvgUrl(expr: string): string {
  const m = expr.trim().match(/^(-?\d+)\s*([+\-])\s*(-?\d+)\s*=\s*\?$/);
  if (!m) return "";

  const [, a, op, b] = m;
  const opColor = OP_COLOR[op] ?? "#6366f1";

  // 숫자 너비에 맞게 캔버스를 늘림 (최소 260, 자릿수 당 32px 추가)
  const digits = Math.max(a.length, b.length);
  const W = Math.max(260, 140 + digits * 42);
  const H = 172;

  // 답 칸 언더라인 시작 x (오른쪽 정렬 기준)
  const lineEnd = W - 20;
  const lineStart = lineEnd - 80 - Math.max(0, digits - 2) * 32;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
      `<rect width="${W}" height="${H}" fill="#f0f4ff" rx="14"/>` +
      // ── 첫째 줄: 피연산자 A (오른쪽 정렬) ──────────────────────────────
      `<text x="${lineEnd}" y="60"` +
        ` text-anchor="end"` +
        ` font-size="48" font-family="Courier New,Courier,monospace" font-weight="800"` +
        ` fill="#0f172a">${a}</text>` +
      // ── 둘째 줄: 연산자 + 피연산자 B ────────────────────────────────────
      `<text x="24" y="110"` +
        ` text-anchor="start"` +
        ` font-size="48" font-family="Courier New,Courier,monospace" font-weight="800"` +
        ` fill="${opColor}">${op}</text>` +
      `<text x="${lineEnd}" y="110"` +
        ` text-anchor="end"` +
        ` font-size="48" font-family="Courier New,Courier,monospace" font-weight="800"` +
        ` fill="#0f172a">${b}</text>` +
      // ── 구분선 ───────────────────────────────────────────────────────────
      `<line x1="14" y1="126" x2="${W - 14}" y2="126"` +
        ` stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round"/>` +
      // ── 답 칸 (언더라인 스타일) ──────────────────────────────────────────
      `<line x1="${lineStart}" y1="160" x2="${lineEnd}" y2="160"` +
        ` stroke="#a5b4fc" stroke-width="4" stroke-linecap="round"/>` +
    `</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock questions
// stageId = conceptId in CHAPTERS:
//   15553 → 받아올림이 없는 (세 자리 수)+(세 자리 수)
//   15554 → 실생활 문제 해결하기
//   15552 → 여러 가지 방법으로 덧셈하기
//
// text 필드: 원본 수식 (getQuestionsForStage 에서 SVG 로 변환 후 text 는 지워짐)
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_QUESTIONS: (Omit<GameQuestion, "questionImageUrl" | "isMock"> & { text: string })[] = [
  // ── conceptId 15553: 받아올림이 없는 (세 자리 수)+(세 자리 수) ──────────
  // LOW
  { id:  1, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "35 + 23 = ?",  answer: "58",  level: "LOW"    },
  { id:  2, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "24 + 34 = ?",  answer: "58",  level: "LOW"    },
  { id:  3, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "41 + 48 = ?",  answer: "89",  level: "LOW"    },
  { id:  4, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "53 + 26 = ?",  answer: "79",  level: "LOW"    },
  { id:  5, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "62 + 17 = ?",  answer: "79",  level: "LOW"    },
  // MEDIUM
  { id:  6, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "35 + 37 = ?",  answer: "72",  level: "MEDIUM" },
  { id:  7, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "27 + 38 = ?",  answer: "65",  level: "MEDIUM" },
  { id:  8, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "45 + 38 = ?",  answer: "83",  level: "MEDIUM" },
  { id:  9, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "56 + 29 = ?",  answer: "85",  level: "MEDIUM" },
  { id: 10, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "48 + 36 = ?",  answer: "84",  level: "MEDIUM" },
  // HIGH
  { id: 16, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "67 + 75 = ?",  answer: "142", level: "HIGH"   },
  { id: 17, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "85 + 67 = ?",  answer: "152", level: "HIGH"   },
  { id: 18, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "93 + 48 = ?",  answer: "141", level: "HIGH"   },
  { id: 19, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "76 + 86 = ?",  answer: "162", level: "HIGH"   },
  { id: 20, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "88 + 57 = ?",  answer: "145", level: "HIGH"   },

  // ── conceptId 15554: 실생활 문제 해결하기 ──────────────────────────────
  // LOW
  { id: 21, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "38 + 45 = ?",  answer: "83",  level: "LOW"    },
  { id: 22, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "47 + 36 = ?",  answer: "83",  level: "LOW"    },
  { id: 23, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "55 + 28 = ?",  answer: "83",  level: "LOW"    },
  { id: 24, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "29 + 54 = ?",  answer: "83",  level: "LOW"    },
  { id: 25, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "64 + 19 = ?",  answer: "83",  level: "LOW"    },
  // MEDIUM
  { id: 11, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "67 + 36 = ?",  answer: "103", level: "MEDIUM" },
  { id: 12, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "58 + 63 = ?",  answer: "121", level: "MEDIUM" },
  { id: 13, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "75 + 37 = ?",  answer: "112", level: "MEDIUM" },
  { id: 14, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "67 + 67 = ?",  answer: "134", level: "MEDIUM" },
  { id: 15, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "84 + 57 = ?",  answer: "141", level: "MEDIUM" },
  // HIGH
  { id: 26, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "138 + 75 = ?", answer: "213", level: "HIGH"   },
  { id: 27, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "247 + 86 = ?", answer: "333", level: "HIGH"   },
  { id: 28, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "365 + 78 = ?", answer: "443", level: "HIGH"   },
  { id: 29, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "456 + 67 = ?", answer: "523", level: "HIGH"   },
  { id: 30, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "189 + 95 = ?", answer: "284", level: "HIGH"   },

  // ── conceptId 15552: 여러 가지 방법으로 덧셈하기 ──────────────────────
  // LOW
  { id: 31, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "58 - 34 = ?",  answer: "24",  level: "LOW"    },
  { id: 32, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "79 - 43 = ?",  answer: "36",  level: "LOW"    },
  { id: 33, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "96 - 52 = ?",  answer: "44",  level: "LOW"    },
  { id: 34, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "87 - 61 = ?",  answer: "26",  level: "LOW"    },
  { id: 35, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "65 - 23 = ?",  answer: "42",  level: "LOW"    },
  // MEDIUM
  { id: 41, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "63 - 35 = ?",  answer: "28",  level: "MEDIUM" },
  { id: 42, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "89 - 48 = ?",  answer: "41",  level: "MEDIUM" },
  { id: 43, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "75 - 38 = ?",  answer: "37",  level: "MEDIUM" },
  { id: 44, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "64 - 35 = ?",  answer: "29",  level: "MEDIUM" },
  { id: 45, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "91 - 38 = ?",  answer: "53",  level: "MEDIUM" },
  // HIGH
  { id: 36, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "134 - 67 = ?", answer: "67",  level: "HIGH"   },
  { id: 37, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "201 - 78 = ?", answer: "123", level: "HIGH"   },
  { id: 38, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "300 - 84 = ?", answer: "216", level: "HIGH"   },
  { id: 39, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "152 - 69 = ?", answer: "83",  level: "HIGH"   },
  { id: 40, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "243 - 87 = ?", answer: "156", level: "HIGH"   },
];

/**
 * CMS 를 사용할 수 없을 때 fallback 으로 호출됩니다.
 * 각 문제는 다음 처리를 거칩니다.
 *  - questionImageUrl: 세로식 SVG 데이터 URL 생성 (CMS 이미지 문제와 동일한 렌더링 경로)
 *  - text: "" (SVG 이미지 렌더링 우선)
 *  - difficulty: level 에서 CMS 규칙과 동일하게 매핑 (LOW=1, MEDIUM=3, HIGH=5)
 *  - autoScoringType: 1 (단일 정답 자동채점, CMS 와 동일)
 *  - conceptId: stageId 와 동일
 *  - isMock: true
 */
export function getQuestionsForStage(stageId: number): GameQuestion[] {
  return MOCK_QUESTIONS
    .filter((q) => q.stageId === stageId)
    .map((q): GameQuestion => ({
      ...q,
      questionImageUrl: makeSvgUrl(q.text),
      text:             "",
      difficulty:       LEVEL_TO_DIFFICULTY[q.level],
      autoScoringType:  1,
      conceptId:        q.stageId,
      isMock:           true,
    }));
}
