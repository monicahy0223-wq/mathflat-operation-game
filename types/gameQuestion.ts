export type QuestionLevel = "LOW" | "MEDIUM" | "HIGH";

/**
 * A single game question.
 *
 * This shape is the contract between the UI and the question source
 * (mock data today, CMS API tomorrow).
 *
 * - Text-only questions: populate `text`, leave `questionImageUrl` as "".
 * - Image-only questions: populate `questionImageUrl`, leave `text` as "".
 */
export type GameQuestion = {
  id:               number;
  /** Which game stage this question belongs to. */
  stageId:          number;
  conceptName:      string;
  /** Plain-text question string. Empty when the question is image-based. */
  text:             string;
  answer:           string;
  level:            QuestionLevel;
  /** URL of the question image. Empty when the question is text-based. */
  questionImageUrl: string;
  solutionImageUrl?: string;
  /**
   * CMS 자동 채점 타입.
   *  1 = 단일 정답 숫자/문자열 비교 (MVP 지원)
   *  0 = 자동 채점 불가
   *  3–7 = 향후 확장 예정
   * undefined = mock 문제 (autoScoringType=1 로직 적용)
   */
  autoScoringType?: number;
  /** CMS concept ID this question belongs to. */
  conceptId?:    number;
  /** Human-readable concept/unit title. */
  conceptTitle?: string;
  /**
   * CMS numeric difficulty (1–5).
   *  1 = 가장 쉬움, 5 = 가장 어려움.
   *  Derived from CMS problemLevel (LOW→1, MEDIUM→3, HIGH→5).
   *  undefined = mock 문제.
   */
  difficulty?:   number;
  /**
   * 추가 정답 후보 목록.
   * CMS answerData 가 JSON 배열/객체인 경우 API 라우트에서 분해하여 저장합니다.
   * checkAnswerResult 에서 correctAnswer(answer 필드)와 합산하여 비교합니다.
   */
  answerCandidates?: string[];
  /**
   * true = CMS 호출 실패 또는 필터 결과 0개로 인한 fallback mock 문제.
   * CMS 문제에는 이 필드가 없거나 undefined.
   */
  isMock?:       boolean;
};
