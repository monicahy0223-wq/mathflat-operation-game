export type AnswerResult = {
  isCorrect: boolean;
  nextCombo: number;
  addedScore: number;
  nextCorrectCount: number;
  shouldClearStage: boolean;
};

type CheckAnswerParams = {
  userAnswer:      string;
  correctAnswer:   string;
  combo:           number;
  correctCount:    number;
  clearCount?:     number;
  /**
   * CMS 자동 채점 타입.
   *  1  = 단일 정답 (trim + 공백/쉼표 제거 후 문자열 비교) — MVP 구현
   *  0  = 자동 채점 불가 (게임에서 제외해야 함)
   *  2+ = 향후 확장 예정 (현재는 exact-match fallback)
   * undefined → 1 로 처리 (mock 문제 포함 backward compat)
   */
  autoScoringType?: number;
};

/**
 * autoScoringType=1 정규화 규칙:
 * 1. 앞뒤 공백 제거
 * 2. 내부 공백 전부 제거
 * 3. 천 단위 쉼표 제거
 * 4. 숫자 문자열로 비교
 */
export function normalizeAnswer(s: string): string {
  return (s ?? "").trim().replace(/\s+/g, "").replace(/,/g, "");
}

/** autoScoringType 에 따라 정답 여부를 판단합니다. */
function isAnswerCorrect(
  userAnswer: string,
  correctAnswer: string,
  autoScoringType: number,
): boolean {
  switch (autoScoringType) {
    case 1:
      // 단일 정답 — normalize 후 문자열 일치
      return normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer);

    // case 3: — 향후 구현 (예: 분수 정답)
    // case 4: — 향후 구현 (예: 식 정답)

    default:
      // 지원하지 않는 타입은 exact-match fallback (autoScoringType=0 포함)
      return userAnswer.trim() === correctAnswer.trim();
  }
}

export function checkAnswerResult({
  userAnswer,
  correctAnswer,
  combo,
  correctCount,
  clearCount = 5,
  autoScoringType = 1,
}: CheckAnswerParams): AnswerResult {
  const isCorrect = isAnswerCorrect(userAnswer, correctAnswer, autoScoringType);

  if (!isCorrect) {
    return {
      isCorrect: false,
      nextCombo: 0,
      addedScore: 0,
      nextCorrectCount: correctCount,
      shouldClearStage: false,
    };
  }

  const nextCombo        = combo + 1;
  const addedScore       = 10 * nextCombo;
  const nextCorrectCount = correctCount + 1;

  return {
    isCorrect: true,
    nextCombo,
    addedScore,
    nextCorrectCount,
    shouldClearStage: nextCorrectCount >= clearCount,
  };
}

export function getStarCount(score: number) {
  if (score >= 120) return 3;
  if (score >= 80)  return 2;
  return 1;
}
