import type { GameQuestion } from "../types/gameQuestion";

/**
 * A single CMS concept configuration.
 * Used to batch-load problems from multiple concepts.
 */
export type ConceptConfig = {
  id:    number;
  title: string;
  unit:  string;
};

/** Detailed result from the CMS fetch. */
export type CmsFetchResult = {
  questions:   GameQuestion[];
  totalRaw:    number;
  filterStats: {
    active:        number;
    visible:       number;
    scorable:      number;
    shortAnswer:   number;
    autoScoring1:  number;
    nChoice0:      number;
    numericAnswer: number;
  };
  /** Human-readable error code, if any. */
  errorCode:   string | null;
  /** Human-readable detail string, if any. */
  errorDetail: string | null;
  /** Non-fatal diagnostic from the server. */
  debug:       string | null;
};

const EMPTY_STATS: CmsFetchResult["filterStats"] = {
  active: 0, visible: 0, scorable: 0, shortAnswer: 0,
  autoScoring1: 0, nChoice0: 0, numericAnswer: 0,
};

function makeError(errorCode: string, errorDetail: string): CmsFetchResult {
  return {
    questions:   [],
    totalRaw:    0,
    filterStats: { ...EMPTY_STATS },
    errorCode,
    errorDetail,
    debug:       null,
  };
}

/**
 * Fetches problems from the Mathflat CMS via the secure server-side proxy at
 * `/api/mathflat-problems`.  The auth token never leaves the server.
 *
 * Always resolves (never throws) — check `errorCode` to detect failures.
 *
 * @param conceptId       CMS concept ID (default 15553)
 * @param stageIdOverride Re-maps `stageId` on every question so they integrate
 *   with the game's stage system.
 */
export async function fetchMathflatProblems(
  conceptId: number | string = 15553,
  stageIdOverride?: number,
): Promise<CmsFetchResult> {
  // Guard: conceptId must be a valid positive integer before sending to the API
  const parsedId = typeof conceptId === "number" ? conceptId : parseInt(String(conceptId), 10);
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    const msg = `유효하지 않은 conceptId: ${conceptId}`;
    console.warn("[fetchMathflat]", msg);
    return makeError("INVALID_CONCEPT_ID", msg);
  }

  let res: Response;
  try {
    res = await fetch(`/api/mathflat-problems?conceptId=${parsedId}`);
  } catch (err) {
    const msg = `네트워크 오류: ${String(err)}`;
    console.warn("[fetchMathflat]", msg);
    return makeError("NETWORK_ERROR", msg);
  }

  // Parse JSON safely regardless of HTTP status.
  let json: Record<string, unknown>;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch (parseErr) {
    const msg = `응답 JSON 파싱 실패 (HTTP ${res.status}): ${String(parseErr)}`;
    console.warn("[fetchMathflat]", msg);
    return makeError("PARSE_ERROR", msg);
  }

  // Server returned an error response.
  if (!res.ok || json.ok === false) {
    const code   = (json.errorCode as string | undefined) ?? `HTTP_${res.status}`;
    const detail = (json.message   as string | undefined) ?? `서버 오류 (${res.status})`;
    console.warn("[fetchMathflat] CMS 오류 (mock으로 fallback):", code, detail);
    return makeError(code, detail);
  }

  // Success path.
  const raw         = (json.questions  as GameQuestion[]                        | undefined) ?? [];
  const totalRaw    = (json.totalRaw   as number                                | undefined) ?? 0;
  const filterStats = (json.filterStats as CmsFetchResult["filterStats"]        | undefined) ?? { ...EMPTY_STATS };
  const debug       = (json.debug      as string                                | undefined) ?? null;

  console.log("[fetchMathflat] totalRaw:", totalRaw, "| filterStats:", filterStats);

  const remapped =
    stageIdOverride == null
      ? raw
      : raw.map((q) => ({ ...q, stageId: stageIdOverride }));

  return {
    questions:   remapped,
    totalRaw,
    filterStats,
    errorCode:   null,
    errorDetail: null,
    debug,
  };
}

/**
 * Loads problems from multiple CMS concepts in parallel.
 * Each failed concept is logged with console.warn but does NOT abort the rest.
 *
 * @param concepts  List of concepts to load.
 * @returns         Merged question array + list of failed conceptIds.
 */
export async function fetchMultipleConcepts(
  concepts: ConceptConfig[],
): Promise<{ questions: GameQuestion[]; failures: number[] }> {
  const settled = await Promise.allSettled(
    concepts.map((c) => fetchMathflatProblems(c.id)),
  );

  const questions: GameQuestion[] = [];
  const failures:  number[]       = [];

  settled.forEach((result, i) => {
    const concept = concepts[i];
    if (result.status === "rejected") {
      console.warn(`[CMS] conceptId ${concept.id} 로드 실패 (rejected):`, result.reason);
      failures.push(concept.id);
      return;
    }

    const value = result.value;
    if (value.errorCode) {
      console.warn(`[CMS] conceptId ${concept.id} 로드 실패 (errorCode=${value.errorCode}):`, value.errorDetail ?? "");
      failures.push(concept.id);
      return;
    }

    questions.push(...value.questions);
  });

  return { questions, failures };
}
