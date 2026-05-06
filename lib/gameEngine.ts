// ─── Grading status ───────────────────────────────────────────────────────────
/**
 * "correct"      – 정답
 * "wrong"        – 오답
 * "needs_review" – 자동 채점 불가 (autoScoringType=0, 빈 정답 등)
 *                  UI에서는 HP 차감 없이 재입력 안내를 표시합니다.
 */
export type GradingStatus = "correct" | "wrong" | "needs_review";

export type AnswerResult = {
  isCorrect:         boolean;
  gradingStatus:     GradingStatus;
  nextCombo:         number;
  addedScore:        number;
  nextCorrectCount:  number;
  shouldClearStage:  boolean;
  /** 실제로 일치한 정답 후보 문자열 */
  matchedCandidate?: string;
};

type CheckAnswerParams = {
  userAnswer:       string;
  correctAnswer:    string;
  /**
   * 추가 정답 후보 (CMS answerData가 배열/객체인 경우 API에서 미리 분해해 전달).
   * correctAnswer 와 합산하여 전체 후보 집합을 구성합니다.
   */
  answerCandidates?: string[];
  combo:            number;
  correctCount:     number;
  clearCount?:      number;
  /**
   * CMS 자동 채점 타입.
   *  1  = 단일 정답 (trim + 공백/쉼표 제거 후 문자열 비교)
   *  0  = 자동 채점 불가 → needs_review 반환
   *  2+ = 향후 확장 예정 (현재는 type-1 fallback)
   * undefined → 1 로 처리 (mock 문제 포함 backward compat)
   */
  autoScoringType?: number;
};

// ─── 정규화 전략 ───────────────────────────────────────────────────────────────

/**
 * 기본 정규화: 앞뒤 공백 제거 + 내부 공백 전부 제거 + 천 단위 쉼표 제거
 * (autoScoringType=1 공식 규칙)
 */
export function normalizeAnswer(s: string): string {
  return (s ?? "").trim().replace(/\s+/g, "").replace(/,/g, "");
}

/**
 * 숫자만 추출 비교용.
 * "368쪽" → "368"  |  "−15" → "-15"  |  "1,200" → "1200" (normalizeAnswer 후)
 * 소수점 포함: "3.14" → "3.14"
 */
function digitsOnly(s: string): string {
  return s.replace(/[^0-9.\-]/g, "").trim();
}

/**
 * 하나의 입력 문자열에서 비교에 사용할 모든 variant를 생성합니다.
 * Set으로 중복 제거 후 반환.
 */
function buildVariants(raw: string): string[] {
  const normalized = normalizeAnswer(raw);
  const digits     = digitsOnly(normalized);
  const variants   = new Set<string>();

  variants.add(raw);            // 원문
  variants.add(raw.trim());     // trim 만
  variants.add(normalized);     // 공백·쉼표 제거

  if (digits) {
    variants.add(digits);       // 숫자만 추출

    // 수치 동치: "1.0" === "1", "01" === "1"
    const numVal = parseFloat(digits);
    if (!isNaN(numVal)) {
      variants.add(String(numVal));              // JS canonical (1, 3.14)
      variants.add(String(Math.round(numVal)));  // 정수형 (소수점 반올림)
      variants.add(numVal.toFixed(0));           // "0" 패딩 없는 정수 문자열
    }
  }

  // 빈 문자열이 들어가면 항상 일치하므로 제거
  variants.delete("");
  return [...variants];
}

// ─── 다중 후보 매칭 ────────────────────────────────────────────────────────────

/**
 * userAnswer 의 모든 variant 를 각 candidate 의 variant 와 교차 비교합니다.
 * 하나라도 일치하면 matched=true + 일치한 candidate 를 반환합니다.
 */
function multiMatch(
  userAnswer:  string,
  candidates:  string[],
): { matched: boolean; candidate?: string } {
  const userVariants = buildVariants(userAnswer);

  for (const candidate of candidates) {
    const candidateVariants = buildVariants(candidate);
    for (const uv of userVariants) {
      if (candidateVariants.includes(uv)) {
        return { matched: true, candidate };
      }
    }
  }
  return { matched: false };
}

// ─── 채점 판정 ─────────────────────────────────────────────────────────────────

function grade(
  userAnswer:     string,
  candidates:     string[],
  autoScoringType: number,
): { status: GradingStatus; candidate?: string } {
  // 자동 채점 불가 → 검토 필요
  if (autoScoringType === 0) {
    return { status: "needs_review" };
  }

  // 유효한 정답 후보가 없음 → 검토 필요
  const validCandidates = candidates.filter((c) => c != null && c.trim() !== "");
  if (validCandidates.length === 0) {
    return { status: "needs_review" };
  }

  const { matched, candidate } = multiMatch(userAnswer, validCandidates);
  return matched
    ? { status: "correct", candidate }
    : { status: "wrong" };
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * mock/CMS 문제를 동일하게 처리하는 통합 채점 함수.
 * false-negative 를 줄이기 위해 다중 정규화 전략을 적용합니다.
 */
export function checkAnswerResult({
  userAnswer,
  correctAnswer,
  answerCandidates = [],
  combo,
  correctCount,
  clearCount      = 5,
  autoScoringType = 1,
}: CheckAnswerParams): AnswerResult {
  // 전체 정답 후보: correctAnswer + 추가 후보 (중복 제거)
  const allCandidates = Array.from(
    new Set([correctAnswer, ...answerCandidates]),
  );

  const { status: gradingStatus, candidate: matchedCandidate } =
    grade(userAnswer, allCandidates, autoScoringType);

  // ── 디버그 로그 (토큰/민감정보 미포함) ──
  console.log("[채점]", {
    userInput:                 userAnswer,
    normalizedUserInput:       normalizeAnswer(userAnswer),
    extractedAnswerCandidates: allCandidates,
    matchedCandidate:          matchedCandidate ?? null,
    gradingStatus,
    autoScoringType,
  });

  if (gradingStatus !== "correct") {
    return {
      isCorrect:        false,
      gradingStatus,
      nextCombo:        0,
      addedScore:       0,
      nextCorrectCount: correctCount,
      shouldClearStage: false,
    };
  }

  const nextCombo        = combo + 1;
  const addedScore       = 10 * nextCombo;
  const nextCorrectCount = correctCount + 1;

  return {
    isCorrect:        true,
    gradingStatus:    "correct",
    nextCombo,
    addedScore,
    nextCorrectCount,
    shouldClearStage: nextCorrectCount >= clearCount,
    matchedCandidate,
  };
}

export function getStarCount(score: number) {
  if (score >= 120) return 3;
  if (score >= 80)  return 2;
  return 1;
}
