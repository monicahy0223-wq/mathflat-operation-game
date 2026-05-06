import type { GameQuestion } from "../types/gameQuestion";

/**
 * Mock questions used as fallback when the CMS API is unavailable.
 *
 * stageId values now match the conceptId in CHAPTERS:
 *   15553 → 받아올림이 없는 (세 자리 수)+(세 자리 수)
 *   15554 → 실생활 문제 해결하기
 *   15552 → 여러 가지 방법으로 덧셈하기
 */
const MOCK_QUESTIONS: GameQuestion[] = [
  // ── conceptId 15553: 받아올림이 없는 (세 자리 수)+(세 자리 수) ──────────
  // LOW
  { id:  1, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "35 + 23 = ?",  answer: "58",  level: "LOW",    questionImageUrl: "" },
  { id:  2, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "24 + 34 = ?",  answer: "58",  level: "LOW",    questionImageUrl: "" },
  { id:  3, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "41 + 48 = ?",  answer: "89",  level: "LOW",    questionImageUrl: "" },
  { id:  4, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "53 + 26 = ?",  answer: "79",  level: "LOW",    questionImageUrl: "" },
  { id:  5, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "62 + 17 = ?",  answer: "79",  level: "LOW",    questionImageUrl: "" },
  // MEDIUM
  { id:  6, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "35 + 37 = ?",  answer: "72",  level: "MEDIUM", questionImageUrl: "" },
  { id:  7, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "27 + 38 = ?",  answer: "65",  level: "MEDIUM", questionImageUrl: "" },
  { id:  8, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "45 + 38 = ?",  answer: "83",  level: "MEDIUM", questionImageUrl: "" },
  { id:  9, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "56 + 29 = ?",  answer: "85",  level: "MEDIUM", questionImageUrl: "" },
  { id: 10, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "48 + 36 = ?",  answer: "84",  level: "MEDIUM", questionImageUrl: "" },
  // HIGH
  { id: 16, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "67 + 75 = ?",  answer: "142", level: "HIGH",   questionImageUrl: "" },
  { id: 17, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "85 + 67 = ?",  answer: "152", level: "HIGH",   questionImageUrl: "" },
  { id: 18, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "93 + 48 = ?",  answer: "141", level: "HIGH",   questionImageUrl: "" },
  { id: 19, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "76 + 86 = ?",  answer: "162", level: "HIGH",   questionImageUrl: "" },
  { id: 20, stageId: 15553, conceptName: "받아올림이 없는 (세 자리 수)+(세 자리 수)", text: "88 + 57 = ?",  answer: "145", level: "HIGH",   questionImageUrl: "" },

  // ── conceptId 15554: 실생활 문제 해결하기 ──────────────────────────────
  // LOW
  { id: 21, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "38 + 45 = ?",  answer: "83",  level: "LOW",    questionImageUrl: "" },
  { id: 22, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "47 + 36 = ?",  answer: "83",  level: "LOW",    questionImageUrl: "" },
  { id: 23, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "55 + 28 = ?",  answer: "83",  level: "LOW",    questionImageUrl: "" },
  { id: 24, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "29 + 54 = ?",  answer: "83",  level: "LOW",    questionImageUrl: "" },
  { id: 25, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "64 + 19 = ?",  answer: "83",  level: "LOW",    questionImageUrl: "" },
  // MEDIUM
  { id: 11, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "67 + 36 = ?",  answer: "103", level: "MEDIUM", questionImageUrl: "" },
  { id: 12, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "58 + 63 = ?",  answer: "121", level: "MEDIUM", questionImageUrl: "" },
  { id: 13, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "75 + 37 = ?",  answer: "112", level: "MEDIUM", questionImageUrl: "" },
  { id: 14, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "67 + 67 = ?",  answer: "134", level: "MEDIUM", questionImageUrl: "" },
  { id: 15, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "84 + 57 = ?",  answer: "141", level: "MEDIUM", questionImageUrl: "" },
  // HIGH
  { id: 26, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "138 + 75 = ?", answer: "213", level: "HIGH",   questionImageUrl: "" },
  { id: 27, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "247 + 86 = ?", answer: "333", level: "HIGH",   questionImageUrl: "" },
  { id: 28, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "365 + 78 = ?", answer: "443", level: "HIGH",   questionImageUrl: "" },
  { id: 29, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "456 + 67 = ?", answer: "523", level: "HIGH",   questionImageUrl: "" },
  { id: 30, stageId: 15554, conceptName: "실생활 문제 해결하기", text: "189 + 95 = ?", answer: "284", level: "HIGH",   questionImageUrl: "" },

  // ── conceptId 15552: 여러 가지 방법으로 덧셈하기 ──────────────────────
  // LOW
  { id: 31, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "58 - 34 = ?",  answer: "24",  level: "LOW",    questionImageUrl: "" },
  { id: 32, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "79 - 43 = ?",  answer: "36",  level: "LOW",    questionImageUrl: "" },
  { id: 33, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "96 - 52 = ?",  answer: "44",  level: "LOW",    questionImageUrl: "" },
  { id: 34, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "87 - 61 = ?",  answer: "26",  level: "LOW",    questionImageUrl: "" },
  { id: 35, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "65 - 23 = ?",  answer: "42",  level: "LOW",    questionImageUrl: "" },
  // MEDIUM
  { id: 41, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "63 - 35 = ?",  answer: "28",  level: "MEDIUM", questionImageUrl: "" },
  { id: 42, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "89 - 48 = ?",  answer: "41",  level: "MEDIUM", questionImageUrl: "" },
  { id: 43, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "75 - 38 = ?",  answer: "37",  level: "MEDIUM", questionImageUrl: "" },
  { id: 44, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "64 - 35 = ?",  answer: "29",  level: "MEDIUM", questionImageUrl: "" },
  { id: 45, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "91 - 38 = ?",  answer: "53",  level: "MEDIUM", questionImageUrl: "" },
  // HIGH
  { id: 36, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "134 - 67 = ?", answer: "67",  level: "HIGH",   questionImageUrl: "" },
  { id: 37, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "201 - 78 = ?", answer: "123", level: "HIGH",   questionImageUrl: "" },
  { id: 38, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "300 - 84 = ?", answer: "216", level: "HIGH",   questionImageUrl: "" },
  { id: 39, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "152 - 69 = ?", answer: "83",  level: "HIGH",   questionImageUrl: "" },
  { id: 40, stageId: 15552, conceptName: "여러 가지 방법으로 덧셈하기", text: "243 - 87 = ?", answer: "156", level: "HIGH",   questionImageUrl: "" },
];

/**
 * Returns mock questions for the given conceptId (= stageId).
 * Each question is tagged with isMock: true so callers can distinguish
 * fallback data from real CMS content.
 * Called only when CMS questions are unavailable.
 */
export function getQuestionsForStage(stageId: number): GameQuestion[] {
  return MOCK_QUESTIONS
    .filter((q) => q.stageId === stageId)
    .map((q) => ({ ...q, isMock: true as const }));
}
