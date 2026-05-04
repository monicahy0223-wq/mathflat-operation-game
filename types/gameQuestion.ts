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
};
