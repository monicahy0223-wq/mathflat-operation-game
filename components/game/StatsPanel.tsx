"use client";

import { useState } from "react";

export type LifetimeStats = {
  totalSolved:       number;
  totalCorrect:      number;
  totalWrong:        number;
  bestCombo:         number;
  reviewsDone:       number;
  streakDays:        number;
  lastCompletedDate: string;
};

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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

export function exportStats(stats: LifetimeStats, stagesClearedCount: number, format: "json" | "excel") {
  const today = todayStr();

  if (format === "json") {
    const record = buildJsonRecord(stats, stagesClearedCount);
    const blob   = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    triggerDownload(blob, `mathgame_stats_${today}.json`);
  } else {
    const { headers, values } = buildCsvRow(stats, stagesClearedCount);
    const escape = (v: string | number) => {
      const s = String(v);
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv  = "﻿" + headers.map(escape).join(",") + "\n" + values.map(escape).join(",");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    triggerDownload(blob, `mathgame_report_${today}.csv`);
  }
}

export type ReportLine = {
  kind: "summary" | "good" | "warn" | "tip";
  icon: string;
  text: string;
};

export function buildReport(stats: LifetimeStats, stagesClearedCount: number): ReportLine[] {
  const accuracy = stats.totalSolved > 0
    ? Math.round((stats.totalCorrect / stats.totalSolved) * 100)
    : 0;

  const lines: ReportLine[] = [];

  if (stats.totalSolved === 0) {
    lines.push({ kind: "tip", icon: "🌱", text: "아직 학습 기록이 없어요. 첫 번째 문제에 도전해봐요!" });
    return lines;
  }

  lines.push({
    kind: "summary",
    icon: "📚",
    text: `총 ${stats.totalSolved}문제를 풀었고, 정답률은 ${accuracy}%예요.`,
  });

  if (accuracy >= 90) {
    lines.push({ kind: "good", icon: "✨", text: `정답률 ${accuracy}%! 정말 훌륭해요. 거의 모든 문제를 맞혔어요.` });
  } else if (accuracy >= 70) {
    lines.push({ kind: "good", icon: "💪", text: `정답률 ${accuracy}%로 안정적이에요. 조금만 더 집중하면 90%도 가능해요!` });
  } else {
    lines.push({ kind: "warn", icon: "📝", text: `정답률이 ${accuracy}%예요. 틀린 문제를 복습하면 빠르게 나아질 수 있어요.` });
  }

  if (stagesClearedCount >= 3) {
    lines.push({ kind: "good", icon: "🗺️", text: `${stagesClearedCount}개의 스테이지를 클리어했어요! 퀘스트 마스터에 가까워지고 있어요.` });
  } else if (stagesClearedCount > 0) {
    lines.push({ kind: "summary", icon: "🗺️", text: `${stagesClearedCount}개의 스테이지를 클리어했어요.` });
  }

  if (stats.bestCombo >= 5) {
    lines.push({ kind: "good", icon: "🔥", text: `최고 ${stats.bestCombo}콤보를 달성했어요! 연속 집중력이 뛰어나요.` });
  } else if (stats.bestCombo >= 3) {
    lines.push({ kind: "summary", icon: "⚡", text: `최고 ${stats.bestCombo}콤보를 달성했어요. 더 긴 콤보에 도전해봐요!` });
  }

  if (stats.totalWrong > 0) {
    lines.push({
      kind: stats.totalWrong >= 5 ? "warn" : "summary",
      icon: "❌",
      text: `틀린 문제가 ${stats.totalWrong}개 있어요.${stats.reviewsDone === 0 ? " 복습 던전에서 확인해보면 좋아요!" : ""}`,
    });
  }

  if (stats.reviewsDone > 0) {
    lines.push({ kind: "good", icon: "🔮", text: `복습 던전을 ${stats.reviewsDone}번 완료해서 틀린 문제를 꼼꼼히 점검했어요.` });
  }

  if (stats.streakDays >= 7) {
    lines.push({ kind: "good", icon: "🌟", text: `${stats.streakDays}일 연속 학습 중이에요! 이 습관이 실력을 만들어요.` });
  } else if (stats.streakDays >= 3) {
    lines.push({ kind: "good", icon: "🔥", text: `${stats.streakDays}일 연속 꾸준히 학습하고 있어요. 잘하고 있어요!` });
  }

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

export function StatCard({
  label,
  value,
  valueColor,
}: {
  label:      string;
  value:      string;
  valueColor: string;
}) {
  return (
    <div
      className="game-card rounded-2xl p-3 text-center"
      style={{
        background:     "rgba(255,255,255,0.92)",
        backdropFilter: "blur(10px)",
        border:         "1.5px solid rgba(255,255,255,0.7)",
        boxShadow:      "0 4px 20px rgba(79,70,229,0.1), inset 0 1px 2px rgba(255,255,255,0.9)",
      }}
    >
      <div className="ty-stat-label mb-1">{label}</div>
      <div className={`ty-stat-value ${valueColor}`}>{value}</div>
    </div>
  );
}

export function StatsPanel({
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

          {/* ── 선생님용 데이터 내보내기 ── */}
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
