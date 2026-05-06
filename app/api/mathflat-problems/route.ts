import { NextRequest, NextResponse } from "next/server";
import type { GameQuestion, QuestionLevel } from "../../../types/gameQuestion";

const CMS_BASE = "https://cms-api.mathflat.com";

/**
 * Flat shape returned by the CMS `/problems/scorable` endpoint.
 * Fields are top-level — there is no nested `concept` object.
 *
 * autoScoringType / nChoice may be absent on older records; treat as
 * undefined and fall back gracefully in the filter step.
 */
type CmsProblem = {
  id:               number;
  status:           string;
  hide:             number;
  scorable:         number;
  problemType:      string;
  problemLevel:     string;
  answerData:       string;
  problemImageUri:  string;
  solutionImageUri?: string;
  conceptId:        number;
  unitName:         string;
  /** 0=자동채점불가, 1=단일정답, 3~7=향후확장. 없으면 undefined. */
  autoScoringType?: number;
  /** 선택지 수. 0=주관식. 없으면 undefined. */
  nChoice?:         number;
};

type CmsResponse = {
  data?: unknown[];
  [key: string]: unknown;
};

/** Detailed result returned to the client. */
type RouteResult = {
  ok:        true;
  questions: GameQuestion[];
  totalRaw:  number;
  filterStats: {
    active:        number;
    visible:       number;
    scorable:      number;
    shortAnswer:   number;
    autoScoring1:  number;
    nChoice0:      number;
    numericAnswer: number;
  };
  debug?: string;
};

type ErrorResult = {
  ok:        false;
  errorCode: string;
  message:   string;
};

function mapLevel(raw: string): QuestionLevel {
  if (raw === "HIGH")   return "HIGH";
  if (raw === "MEDIUM") return "MEDIUM";
  return "LOW";
}

/**
 * Maps CMS problemLevel to a numeric difficulty (1–5).
 * Handles both descriptive strings ("LOW"/"MEDIUM"/"HIGH") and
 * numeric strings ("1"–"5") in case the CMS returns them.
 */
function mapDifficulty(raw: string): number {
  const n = parseInt(raw ?? "", 10);
  if (!isNaN(n) && n >= 1 && n <= 5) return n;
  if (raw === "HIGH")   return 4;
  if (raw === "MEDIUM") return 3;
  return 1; // LOW or unknown
}

function isSingleNumber(s: string): boolean {
  return /^-?\d+(\.\d+)?$/.test((s ?? "").trim());
}

/**
 * answerData 필드에서 가능한 정답 후보를 모두 추출합니다.
 * - 문자열(단일 숫자): [값 자체]
 * - JSON 배열:         각 요소를 문자열로 변환
 * - JSON 객체:         answer / correctAnswer / answers / solutionAnswer / score.answer 탐색
 * - 파싱 실패:         원문 그대로 반환
 */
function extractAnswerCandidates(raw: string): string[] {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return [];

  // 단순 숫자 문자열 → 추가 파싱 불필요
  if (isSingleNumber(trimmed)) return [trimmed];

  // JSON 파싱 시도
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // 파싱 실패 → 원문 반환
    return [trimmed];
  }

  if (Array.isArray(parsed)) {
    return parsed.map((v) => String(v).trim()).filter(Boolean);
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    // 우선순위: answer > correctAnswer > answers(배열) > solutionAnswer > score.answer
    const candidates: string[] = [];
    const addField = (v: unknown) => {
      if (typeof v === "string" && v.trim()) candidates.push(v.trim());
      else if (typeof v === "number") candidates.push(String(v));
      else if (Array.isArray(v)) v.forEach((x) => addField(x));
    };
    addField(obj["answer"]);
    addField(obj["correctAnswer"]);
    addField(obj["answers"]);
    addField(obj["solutionAnswer"]);
    // score.answer 탐색
    if (typeof obj["score"] === "object" && obj["score"] !== null) {
      addField((obj["score"] as Record<string, unknown>)["answer"]);
    }
    if (candidates.length) return [...new Set(candidates)];
  }

  // 숫자로 직접 변환된 경우
  if (typeof parsed === "number") return [String(parsed)];

  return [trimmed];
}

/** Safely cast an unknown item to CmsProblem if it has the required fields. */
function isCmsProblem(p: unknown): p is CmsProblem {
  return (
    typeof p === "object" &&
    p !== null &&
    "id"              in p &&
    "status"          in p &&
    "problemImageUri" in p
  );
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<RouteResult | ErrorResult>> {
  // ── 1. Auth token ──────────────────────────────────────────────────────────
  const token = process.env.MATHFLAT_AUTH_TOKEN;
  if (!token) {
    console.error("[CMS] MATHFLAT_AUTH_TOKEN is not set.");
    return NextResponse.json(
      { ok: false, errorCode: "TOKEN_MISSING", message: "MATHFLAT_AUTH_TOKEN 환경변수가 서버에 설정되지 않았습니다." },
      { status: 500 },
    );
  }
  console.log("[CMS] Token present, length =", token.length);

  // ── 2. Validate & build CMS URL ───────────────────────────────────────────
  const rawConceptId = request.nextUrl.searchParams.get("conceptId");

  // Guard: conceptId must be a positive integer string
  if (!rawConceptId || !/^\d+$/.test(rawConceptId.trim())) {
    console.error("[CMS] Invalid or missing conceptId:", rawConceptId);
    return NextResponse.json(
      {
        ok:        false,
        errorCode: "INVALID_CONCEPT_ID",
        message:   `conceptId가 없거나 유효한 정수가 아닙니다: "${rawConceptId}"`,
      },
      { status: 400 },
    );
  }

  const conceptId = rawConceptId.trim();
  // Build the SQL-like query exactly as CMS expects, then encode the value
  const queryValue = `where concept.concept_id = ${conceptId}`;
  const cmsUrl = `${CMS_BASE}/problems/scorable?query=${encodeURIComponent(queryValue)}`;

  // ── Debug logging ─────────────────────────────────────────────────────────
  console.log("[CMS] conceptId     :", conceptId);
  console.log("[CMS] queryValue    :", queryValue);
  console.log("[CMS] encoded query :", encodeURIComponent(queryValue));
  console.log("[CMS] full URL      :", cmsUrl);

  // ── 3. Call CMS ────────────────────────────────────────────────────────────
  let cmsJson: CmsResponse;
  try {
    const res = await fetch(cmsUrl, {
      headers: { "x-auth-token": token },
      cache: "no-store",
    });

    const rawText = await res.text();
    console.log("[CMS] HTTP status:", res.status);
    console.log("[CMS] Response (first 600 chars):", rawText.slice(0, 600));

    if (!res.ok) {
      console.warn(`[CMS] HTTP ${res.status} — conceptId=${conceptId} | body: ${rawText.slice(0, 300)}`);
      return NextResponse.json(
        {
          ok:        false,
          errorCode: `CMS_HTTP_${res.status}`,
          message:   `CMS ${res.status}: ${rawText.slice(0, 200)}`,
        },
        { status: 200 },
      );
    }

    try {
      cmsJson = JSON.parse(rawText) as CmsResponse;
    } catch (parseErr) {
      console.warn("[CMS] JSON parse failed:", parseErr);
      return NextResponse.json(
        {
          ok:        false,
          errorCode: "CMS_PARSE_ERROR",
          message:   `응답 JSON 파싱 실패. 원문: ${rawText.slice(0, 200)}`,
        },
        { status: 200 },
      );
    }
  } catch (fetchErr) {
    console.warn("[CMS] fetch() threw:", fetchErr);
    return NextResponse.json(
      {
        ok:        false,
        errorCode: "CMS_FETCH_FAILED",
        message:   `네트워크 오류: ${String(fetchErr)}`,
      },
      { status: 200 },
    );
  }

  // ── 4. Unwrap data array ───────────────────────────────────────────────────
  const rawItems = Array.isArray(cmsJson.data) ? cmsJson.data : [];
  console.log("[CMS] Total raw items:", rawItems.length);

  if (rawItems.length === 0) {
    console.warn("[CMS] data[] is empty. Response top-level keys:", Object.keys(cmsJson));
  }

  // Cast to CmsProblem — guard with type predicate so unknown fields don't crash.
  const raw = rawItems.filter(isCmsProblem);

  // ── 5. Filter pipeline ─────────────────────────────────────────────────────
  // Step 1: 활성 문제
  const afterActive = raw.filter((p) => p.status === "ACTIVE");
  // Step 2: 공개 문제
  const afterVisible = afterActive.filter((p) => p.hide === 0);
  // Step 3: 자동채점 대상
  const afterScorable = afterVisible.filter((p) => p.scorable === 1);
  // Step 4: 단답형 (SHORT_ANSWER)
  const afterShortAnswer = afterScorable.filter((p) => p.problemType === "SHORT_ANSWER");
  // Step 5: autoScoringType === 1 (단일 정답 자동채점)
  //   undefined → 1로 간주 (필드 없는 구버전 레코드 backward compat)
  //   0 = 채점 불가, 3~7 = 향후 확장 → 제외
  const afterAutoScoring1 = afterShortAnswer.filter(
    (p) => (p.autoScoringType ?? 1) === 1,
  );
  // Step 6: 선택지 없는 주관식 (nChoice === 0)
  //   undefined → 0으로 간주
  const afterNChoice0 = afterAutoScoring1.filter(
    (p) => (p.nChoice ?? 0) === 0,
  );
  // Step 7: answerData가 단일 숫자 정답
  const afterNumeric = afterNChoice0.filter((p) => isSingleNumber(p.answerData));

  const filterStats = {
    active:        afterActive.length,
    visible:       afterVisible.length,
    scorable:      afterScorable.length,
    shortAnswer:   afterShortAnswer.length,
    autoScoring1:  afterAutoScoring1.length,
    nChoice0:      afterNChoice0.length,
    numericAnswer: afterNumeric.length,
  };
  console.log("[CMS] Filter stats:", filterStats);

  // ── 6. Map to GameQuestion (flat field access) ─────────────────────────────
  const questions: GameQuestion[] = afterNumeric.map(
    (p): GameQuestion => {
      const candidates = extractAnswerCandidates(p.answerData);
      // candidates[0] 을 primary answer 로, 나머지를 answerCandidates 로 분리
      const primaryAnswer  = candidates[0] ?? p.answerData.trim();
      const extraCandidates = candidates.slice(1);
      return {
        id:               p.id,
        stageId:          p.conceptId,
        conceptName:      p.unitName ?? "",
        text:             "",
        answer:           primaryAnswer,
        answerCandidates: extraCandidates.length ? extraCandidates : undefined,
        level:            mapLevel(p.problemLevel),
        questionImageUrl: p.problemImageUri  ?? "",
        solutionImageUrl: p.solutionImageUri ?? "",
        autoScoringType:  p.autoScoringType ?? 1,
        conceptId:        p.conceptId,
        conceptTitle:     p.unitName ?? "",
        difficulty:       mapDifficulty(p.problemLevel),
      };
    },
  );

  return NextResponse.json({
    ok: true,
    questions,
    totalRaw: rawItems.length,
    filterStats,
    debug: rawItems.length === 0
      ? `data 배열이 비어 있습니다. 응답 최상위 키: ${Object.keys(cmsJson).join(", ")}`
      : undefined,
  });
}
