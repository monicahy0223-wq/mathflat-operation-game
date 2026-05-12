"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import MathGame from "../MathGame";
import { loadTeacherAppSettings } from "../../lib/teacherStorage";
import type { StudentRecord } from "../../types/teacher";

// ── localStorage 키 (MathGame.tsx와 동일) ─────────────────────────────────────
const saveKey  = (id: string) => `mathGameSave_${id}`;
const dailyKey = (id: string) => `mathGameDaily_${id}`;
const statsKey = (id: string) => `mathGameStats_${id}`;

type StudentSnapshot = {
  totalSolved:        number;
  totalCorrect:       number;
  bestCombo:          number;
  solvedToday:        number;
  stagesClearedToday: number;
  clearedCount:       number;
  wrongCount:         number;
};

function readSnapshot(id: string): StudentSnapshot {
  const empty: StudentSnapshot = { totalSolved: 0, totalCorrect: 0, bestCombo: 0, solvedToday: 0, stagesClearedToday: 0, clearedCount: 0, wrongCount: 0 };
  try {
    const stats   = JSON.parse(localStorage.getItem(statsKey(id)) ?? "{}");
    const rawDaily = JSON.parse(localStorage.getItem(dailyKey(id)) ?? "{}");
    const save    = JSON.parse(localStorage.getItem(saveKey(id))   ?? "{}");
    const today   = new Date().toISOString().split("T")[0];
    const daily   = rawDaily.lastDate === today ? rawDaily : {};
    const n = (v: unknown) => (typeof v === "number" && v >= 0 ? v : 0);
    return {
      totalSolved:        n(stats.totalSolved),
      totalCorrect:       n(stats.totalCorrect),
      bestCombo:          n(stats.bestCombo),
      solvedToday:        n(daily.solvedToday),
      stagesClearedToday: n(daily.stagesClearedToday),
      clearedCount:       Array.isArray(save.clearedTypeIds) ? save.clearedTypeIds.length : 0,
      wrongCount:         Array.isArray(save.wrongQuestions) ? save.wrongQuestions.length : 0,
    };
  } catch { return empty; }
}

type Props = { onBack: () => void };

export default function TeacherStudentView({ onBack }: Props) {
  const settings = loadTeacherAppSettings();
  const students = settings.students;

  const [snapshots, setSnapshots]         = useState<Record<string, StudentSnapshot>>({});
  const [viewingId, setViewingId]         = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen]   = useState(false);
  const overlayRef                        = useRef<HTMLDivElement>(null);

  // 학생 데이터 스냅샷 로드 (1초마다 갱신)
  useEffect(() => {
    function refresh() {
      const next: Record<string, StudentSnapshot> = {};
      students.forEach((s) => { next[s.id] = readSnapshot(s.id); });
      setSnapshots(next);
    }
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [students.length]);

  // 전체화면 토글
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await overlayRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── 학생 게임 화면 오버레이 ──────────────────────────────────────────────────
  if (viewingId !== null) {
    const student = students.find((s) => s.id === viewingId);
    return (
      <div ref={overlayRef} style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", background: "#000" }}>
        {/* 오버레이 헤더 (전체화면일 때는 숨겨지므로 게임 안에 포함) */}
        <div
          className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", zIndex: 10000 }}
        >
          <button
            onClick={() => { if (document.fullscreenElement) document.exitFullscreen(); setViewingId(null); }}
            className="rounded-xl px-3 py-1.5 text-xs font-bold text-white transition-all active:scale-90"
            style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}
          >
            ← 목록으로
          </button>
          <span className="font-black text-white text-sm">👦 {student?.name ?? ""} 화면</span>
          <div className="flex-1" />
          <button
            onClick={toggleFullscreen}
            className="rounded-xl px-3 py-1.5 text-xs font-bold text-white transition-all active:scale-90 flex items-center gap-1.5"
            style={{ background: isFullscreen ? "rgba(239,68,68,0.2)" : "rgba(99,102,241,0.3)", border: `1px solid ${isFullscreen ? "rgba(239,68,68,0.4)" : "rgba(99,102,241,0.5)"}` }}
          >
            {isFullscreen ? "⛶ 전체화면 종료" : "⛶ 전체화면"}
          </button>
        </div>
        {/* 게임 화면 — onExit 미전달로 게임 내부 "처음으로" 버튼 숨김, 검은 바로만 제어 */}
        <div className="flex-1 overflow-hidden">
          <MathGame
            studentMode
            initialStudentId={viewingId}
          />
        </div>
      </div>
    );
  }

  // ── 학생 선택 화면 ────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg,#0f172a 0%,#1e3a5f 50%,#0d2a4a 100%)", color: "#e2e8f0" }}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors font-bold text-lg leading-none">←</button>
        <h1 className="font-black text-white text-xl">학생 화면 보기</h1>
        <div className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-emerald-300" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
          ● 실시간
        </div>
      </div>

      {/* 학생 카드 목록 */}
      <div className="flex-1 overflow-auto px-5 py-5 max-w-2xl w-full mx-auto">
        {students.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm gap-2 mt-20">
            <span className="text-4xl">👤</span>
            <p>등록된 학생이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {students.map((student) => {
              const snap = snapshots[student.id] ?? { totalSolved: 0, totalCorrect: 0, bestCombo: 0, solvedToday: 0, stagesClearedToday: 0, clearedCount: 0, wrongCount: 0 };
              const accuracy = snap.totalSolved > 0 ? Math.round((snap.totalCorrect / snap.totalSolved) * 100) : 0;
              return (
                <StudentCard
                  key={student.id}
                  student={student}
                  snap={snap}
                  accuracy={accuracy}
                  onView={() => setViewingId(student.id)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 학생 미리보기 카드 ─────────────────────────────────────────────────────────
function StudentCard({
  student,
  snap,
  accuracy,
  onView,
}: {
  student: StudentRecord;
  snap: StudentSnapshot;
  accuracy: number;
  onView: () => void;
}) {
  return (
    <div
      className="rounded-3xl overflow-hidden flex flex-col cursor-pointer transition-all hover:scale-[1.02] active:scale-98"
      style={{ background: "linear-gradient(160deg,#0c1a3a 0%,#1a3a6e 60%,#0e2a52 100%)", border: "1px solid rgba(59,130,246,0.25)", boxShadow: "0 4px 24px rgba(14,165,233,0.12)" }}
      onClick={onView}
    >
      {/* 카드 상단: 게임 배경 느낌 */}
      <div
        className="px-5 pt-5 pb-4 flex items-center gap-4"
        style={{ background: "linear-gradient(135deg,rgba(30,58,138,0.6),rgba(14,165,233,0.15))", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div
          className="rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ width: 52, height: 52, background: "linear-gradient(135deg,#1d4ed8,#3b82f6)", boxShadow: "0 4px 12px rgba(59,130,246,0.4)", fontSize: 26 }}
        >
          👦
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-black text-white text-lg leading-tight">{student.name}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: snap.solvedToday > 0 ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)", color: snap.solvedToday > 0 ? "#34d399" : "#64748b" }}
            >
              {snap.solvedToday > 0 ? `오늘 ${snap.solvedToday}문제` : "오늘 미접속"}
            </span>
          </div>
        </div>
      </div>

      {/* 카드 하단: 통계 */}
      <div className="px-5 py-4 flex flex-col gap-3">
        {/* 정답률 바 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider">정답률</span>
            <span className="font-black text-white text-sm">{snap.totalSolved > 0 ? `${accuracy}%` : "—"}</span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.07)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${accuracy}%`,
                background: accuracy >= 80 ? "linear-gradient(90deg,#34d399,#10b981)" : accuracy >= 60 ? "linear-gradient(90deg,#fbbf24,#f59e0b)" : snap.totalSolved === 0 ? "transparent" : "linear-gradient(90deg,#f87171,#ef4444)",
              }}
            />
          </div>
        </div>

        {/* 통계 그리드 */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: "✅", label: "총 문제",  value: snap.totalSolved > 0 ? `${snap.totalSolved}` : "—" },
            { icon: "🗺️", label: "클리어",  value: snap.clearedCount > 0 ? `${snap.clearedCount}개` : "—" },
            { icon: "🔥", label: "최고 콤보", value: snap.bestCombo > 0 ? `×${snap.bestCombo}` : "—" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl px-2 py-2 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 14 }}>{item.icon}</div>
              <div className="font-black text-white text-xs mt-0.5 leading-tight">{item.value}</div>
              <div className="text-white/30 text-[9px] mt-0.5">{item.label}</div>
            </div>
          ))}
        </div>

        {/* 게임 화면 보기 버튼 */}
        <button
          onClick={(e) => { e.stopPropagation(); onView(); }}
          className="w-full rounded-2xl py-3 font-black text-sm text-white transition-all active:scale-95 flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)", boxShadow: "0 4px 12px rgba(37,99,235,0.4)" }}
        >
          <span>🎮</span>
          <span>게임 화면 보기</span>
        </button>
      </div>
    </div>
  );
}
