"use client";

import { useState } from "react";
import { loadTeacherAppSettings } from "../../lib/teacherStorage";

// ── localStorage 키 (MathGame.tsx와 동일) ─────────────────────────────────────
const saveKey  = (id: string) => `mathGameSave_${id}`;
const dailyKey = (id: string) => `mathGameDaily_${id}`;
const statsKey = (id: string) => `mathGameStats_${id}`;
const TEACHER_CONFIG_KEY = "mathGameTeacherConfig";

// ── 지역 정보 (CHAPTERS의 types와 동일) ──────────────────────────────────────
const ZONE_INFO: Record<number, { emoji: string; title: string }> = {
  15553: { emoji: "🌱", title: "받아올림이 없는 (세 자리 수)+(세 자리 수)" },
  15554: { emoji: "🔥", title: "실생활 문제 해결하기" },
  15552: { emoji: "⚡", title: "여러 가지 방법으로 덧셈하기" },
};

// ── 타입 정의 ─────────────────────────────────────────────────────────────────
type Stats = {
  totalSolved:  number;
  totalCorrect: number;
  bestCombo:    number;
  streakDays:   number;
};
type Daily = {
  solvedToday:        number;
  comboToday:         number;
  stagesClearedToday: number;
};
type Save = {
  clearedTypeIds: number[];
  wrongQuestions: { stageId: number }[];
};
type TeacherConfig = {
  solveTarget: number;
  comboTarget: number;
  stageTarget: number;
};

// ── 데이터 로더 ───────────────────────────────────────────────────────────────
function loadStats(id: string): Stats {
  try {
    const raw = localStorage.getItem(statsKey(id));
    if (!raw) return { totalSolved: 0, totalCorrect: 0, bestCombo: 0, streakDays: 0 };
    const p = JSON.parse(raw);
    const n = (v: unknown) => (typeof v === "number" && v >= 0 ? v : 0);
    return { totalSolved: n(p.totalSolved), totalCorrect: n(p.totalCorrect), bestCombo: n(p.bestCombo), streakDays: n(p.streakDays) };
  } catch { return { totalSolved: 0, totalCorrect: 0, bestCombo: 0, streakDays: 0 }; }
}

function loadDailyData(id: string): Daily {
  try {
    const raw = localStorage.getItem(dailyKey(id));
    if (!raw) return { solvedToday: 0, comboToday: 0, stagesClearedToday: 0 };
    const p = JSON.parse(raw);
    const today = new Date().toISOString().split("T")[0];
    if (p.lastDate !== today) return { solvedToday: 0, comboToday: 0, stagesClearedToday: 0 };
    const n = (v: unknown) => (typeof v === "number" && v >= 0 ? v : 0);
    return { solvedToday: n(p.solvedToday), comboToday: n(p.comboToday), stagesClearedToday: n(p.stagesClearedToday) };
  } catch { return { solvedToday: 0, comboToday: 0, stagesClearedToday: 0 }; }
}

function loadSaveData(id: string): Save {
  try {
    const raw = localStorage.getItem(saveKey(id));
    if (!raw) return { clearedTypeIds: [], wrongQuestions: [] };
    const p = JSON.parse(raw);
    return {
      clearedTypeIds: Array.isArray(p.clearedTypeIds) ? p.clearedTypeIds : [],
      wrongQuestions: Array.isArray(p.wrongQuestions) ? p.wrongQuestions : [],
    };
  } catch { return { clearedTypeIds: [], wrongQuestions: [] }; }
}

function loadTeacherConfig(): TeacherConfig {
  try {
    const raw = localStorage.getItem(TEACHER_CONFIG_KEY);
    if (!raw) return { solveTarget: 5, comboTarget: 3, stageTarget: 1 };
    const p = JSON.parse(raw);
    const posInt = (v: unknown, d: number) => typeof v === "number" && Number.isInteger(v) && v >= 1 ? v : d;
    return { solveTarget: posInt(p.solveTarget, 5), comboTarget: posInt(p.comboTarget, 3), stageTarget: posInt(p.stageTarget, 1) };
  } catch { return { solveTarget: 5, comboTarget: 3, stageTarget: 1 }; }
}

function saveTeacherConfig(c: TeacherConfig) {
  try { localStorage.setItem(TEACHER_CONFIG_KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

function exportCsv(studentName: string, stats: Stats, save: Save) {
  const today = new Date().toISOString().split("T")[0];
  const accuracy = stats.totalSolved > 0 ? Math.round((stats.totalCorrect / stats.totalSolved) * 100) : 0;
  const headers = ["학생명", "총 문제 수", "정답 수", "정답률(%)", "최고 콤보", "클리어 지역 수", "연속 학습일"];
  const values  = [studentName, stats.totalSolved, stats.totalCorrect, accuracy, stats.bestCombo, save.clearedTypeIds.length, stats.streakDays];
  const escape  = (v: string | number) => { const s = String(v); return s.includes(",") ? `"${s}"` : s; };
  const csv     = "﻿" + headers.map(escape).join(",") + "\n" + values.map(escape).join(",");
  const blob    = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement("a");
  a.href = url; a.download = `report_${studentName}_${today}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Props ─────────────────────────────────────────────────────────────────────
type Props = { onBack: () => void };

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────
export default function TeacherDashboard({ onBack }: Props) {
  const settings = loadTeacherAppSettings();
  const students = settings.students;

  const [activeId,     setActiveId]     = useState(students[0]?.id ?? "");
  const [activeTab,    setActiveTab]    = useState<"report" | "config">("report");
  const [configDraft,  setConfigDraft]  = useState<TeacherConfig>(() => loadTeacherConfig());
  const [configSaved,  setConfigSaved]  = useState(false);

  const activeStudent = students.find((s) => s.id === activeId) ?? students[0];

  // 선택된 학생 데이터
  const stats  = activeId ? loadStats(activeId)      : { totalSolved: 0, totalCorrect: 0, bestCombo: 0, streakDays: 0 };
  const daily  = activeId ? loadDailyData(activeId)  : { solvedToday: 0, comboToday: 0, stagesClearedToday: 0 };
  const save   = activeId ? loadSaveData(activeId)   : { clearedTypeIds: [], wrongQuestions: [] };

  const accuracy = stats.totalSolved > 0 ? Math.round((stats.totalCorrect / stats.totalSolved) * 100) : 0;

  // 오답 많은 지역 찾기
  const stageWrong: Record<number, number> = {};
  save.wrongQuestions.forEach((q) => { stageWrong[q.stageId] = (stageWrong[q.stageId] ?? 0) + 1; });
  const worstStageId = Object.entries(stageWrong).sort(([, a], [, b]) => b - a)[0]?.[0];
  const worstZone = worstStageId ? ZONE_INFO[Number(worstStageId)] : null;

  function handleSaveConfig() {
    saveTeacherConfig(configDraft);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 1800);
  }

  if (students.length === 0) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg,#1e1b4b 0%,#312e81 40%,#1e1b4b 100%)" }}>
        <div className="flex items-center gap-3 px-4 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <button onClick={onBack} className="rounded-xl px-3 py-1.5 font-bold text-sm text-white/70" style={{ background: "rgba(255,255,255,0.08)" }}>← 뒤로</button>
          <span className="font-black text-white text-xl ml-1">대시보드</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
          등록된 학생이 없습니다. 학급 관리에서 학생을 추가하세요.
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col overflow-hidden" style={{ background: "linear-gradient(180deg,#1e1b4b 0%,#312e81 40%,#1e1b4b 100%)" }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <button onClick={onBack} className="rounded-xl px-3 py-1.5 font-bold text-sm text-white/70 transition-all active:scale-90" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
          ← 뒤로
        </button>
        <div className="flex flex-col items-center">
          <span className="text-xl">👩‍🏫</span>
          <span className="font-black text-white text-sm mt-0.5">교사 대시보드</span>
        </div>
        <div style={{ width: 72 }} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 max-w-lg mx-auto w-full">

        {/* 학생 선택 */}
        <section>
          <p className="text-white/40 text-[11px] font-black tracking-widest uppercase mb-2">학생 선택</p>
          <div className="flex flex-wrap gap-2">
            {students.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className="rounded-2xl px-3 py-2 font-black text-sm transition-all active:scale-90"
                style={{
                  background: activeId === s.id ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : "rgba(255,255,255,0.07)",
                  color:      activeId === s.id ? "#fff" : "rgba(255,255,255,0.55)",
                  border:     activeId === s.id ? "1.5px solid rgba(167,139,250,0.5)" : "1.5px solid rgba(255,255,255,0.1)",
                  boxShadow:  activeId === s.id ? "0 4px 16px rgba(109,40,217,0.4)" : "none",
                }}
              >
                👦 {s.name}
              </button>
            ))}
          </div>
        </section>

        {/* 탭 */}
        <div className="flex gap-2">
          {(["report", "config"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 rounded-2xl py-2 font-black text-sm transition-all active:scale-95"
              style={{
                background: activeTab === tab ? "linear-gradient(135deg,#4f46e5,#6366f1)" : "rgba(255,255,255,0.06)",
                color:      activeTab === tab ? "#fff" : "rgba(255,255,255,0.4)",
                border:     activeTab === tab ? "1.5px solid rgba(99,102,241,0.5)" : "1.5px solid rgba(255,255,255,0.08)",
              }}
            >
              {tab === "report" ? "📋 학습 리포트" : "⚙️ 수업 설정"}
            </button>
          ))}
        </div>

        {/* ── 학습 리포트 탭 ── */}
        {activeTab === "report" && (
          <>
            {/* 학생 요약 */}
            <section className="rounded-3xl p-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">👦</span>
                <div>
                  <div className="font-black text-white text-base">{activeStudent?.name ?? "-"}</div>
                  <div className="text-white/40 text-[11px]">현재 선택된 학생</div>
                </div>
              </div>

              <p className="text-white/30 text-[10px] font-black tracking-widest uppercase mb-2">오늘 학습</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { icon: "📚", label: "푼 문제",   value: `${daily.solvedToday}문제` },
                  { icon: "🔥", label: "최고 콤보", value: `×${stats.bestCombo}` },
                  { icon: "🗺️", label: "스테이지",  value: `${daily.stagesClearedToday}클리어` },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl px-2 py-2.5 text-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="text-lg mb-0.5">{item.icon}</div>
                    <div className="font-black text-white text-sm leading-tight">{item.value}</div>
                    <div className="text-white/35 text-[9px] mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>

              <p className="text-white/30 text-[10px] font-black tracking-widest uppercase mb-2">전체 기록</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: "✅", label: "총 문제 수",      value: `${stats.totalSolved}문제` },
                  { icon: "🎯", label: "정답률",          value: `${accuracy}%` },
                  { icon: "🗺️", label: "클리어 지역",    value: `${save.clearedTypeIds.length}개` },
                  { icon: "📅", label: "연속 학습일",     value: `${stats.streakDays}일` },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl px-3 py-2.5 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span className="text-base flex-shrink-0">{item.icon}</span>
                    <div>
                      <div className="font-black text-white text-sm leading-tight">{item.value}</div>
                      <div className="text-white/35 text-[9px]">{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 정답률 바 */}
            <section className="rounded-3xl p-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <p className="text-white/40 text-[11px] font-black tracking-widest uppercase mb-3">정답률 현황</p>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 rounded-full overflow-hidden" style={{ height: 12, background: "rgba(255,255,255,0.08)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${accuracy}%`,
                      background: accuracy >= 80 ? "linear-gradient(90deg,#34d399,#10b981)" : accuracy >= 60 ? "linear-gradient(90deg,#fbbf24,#f59e0b)" : "linear-gradient(90deg,#f87171,#ef4444)",
                      boxShadow: "0 0 8px rgba(16,185,129,0.4)",
                    }}
                  />
                </div>
                <span className="font-black text-white text-sm flex-shrink-0">{accuracy}%</span>
              </div>
              <p className="text-white/30 text-xs">
                {accuracy >= 80 ? "👏 우수한 학습 성과예요!" : accuracy >= 60 ? "💪 꾸준히 성장 중이에요." : stats.totalSolved === 0 ? "🌱 아직 학습 기록이 없어요." : "📝 오답 복습이 필요해요."}
              </p>
            </section>

            {/* 오답 분석 */}
            <section className="rounded-3xl p-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <p className="text-white/40 text-[11px] font-black tracking-widest uppercase mb-3">오답 분석</p>
              {save.wrongQuestions.length === 0 ? (
                <p className="text-white/30 text-sm">✅ 현재 오답 문제가 없어요.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">📝</span>
                    <div>
                      <div className="font-black text-white text-sm">오답 {save.wrongQuestions.length}문제</div>
                      <div className="text-white/40 text-xs">복습이 필요한 문제들</div>
                    </div>
                  </div>
                  {worstZone && (
                    <div className="rounded-2xl px-3 py-2 mt-2 flex items-center gap-2" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}>
                      <span className="text-lg">{worstZone.emoji}</span>
                      <div>
                        <div className="font-black text-amber-300 text-xs">추천 복습 지역</div>
                        <div className="font-bold text-white text-sm">{worstZone.title}</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* 진도 현황 */}
            {save.clearedTypeIds.length > 0 && (
              <section className="rounded-3xl p-4" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                <p className="font-black text-indigo-300 text-xs mb-2">📍 클리어한 지역</p>
                <div className="flex flex-wrap gap-1.5">
                  {save.clearedTypeIds.map((id) => {
                    const zone = ZONE_INFO[id];
                    return zone ? (
                      <span key={id} className="rounded-full px-2.5 py-1 text-[11px] font-black" style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}>
                        {zone.emoji} {zone.title}
                      </span>
                    ) : null;
                  })}
                </div>
              </section>
            )}

            {/* 내보내기 */}
            <section>
              <p className="text-white/40 text-[11px] font-black tracking-widest uppercase mb-2">데이터 내보내기</p>
              <button
                onClick={() => activeStudent && exportCsv(activeStudent.name, stats, save)}
                className="w-full rounded-2xl py-2.5 font-black text-sm text-white transition-all active:scale-95 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}
              >
                📊 CSV 다운로드
              </button>
            </section>
          </>
        )}

        {/* ── 수업 설정 탭 ── */}
        {activeTab === "config" && (
          <section className="rounded-3xl p-4 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <p className="text-white/40 text-[11px] font-black tracking-widest uppercase mb-1">미션 목표 설정</p>
            <p className="text-white/30 text-xs -mt-1 mb-2">학생 화면에 표시되는 오늘의 미션 목표를 조정합니다.</p>
            {(
              [
                { key: "solveTarget" as const, icon: "📚", label: "문제 풀기 목표", unit: "문제", min: 1, max: 50 },
                { key: "comboTarget" as const, icon: "🔥", label: "콤보 달성 목표", unit: "회",   min: 1, max: 20 },
                { key: "stageTarget" as const, icon: "🗺️", label: "스테이지 클리어", unit: "개",  min: 1, max: 3 },
              ]
            ).map((f) => (
              <div key={f.key} className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="text-xl flex-shrink-0">{f.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-sm">{f.label}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => setConfigDraft((d) => ({ ...d, [f.key]: Math.max(f.min, d[f.key] - 1) }))} className="w-8 h-8 rounded-xl text-white font-black text-base transition-all active:scale-90" style={{ background: "rgba(255,255,255,0.1)" }}>−</button>
                  <span className="font-black text-white text-base w-8 text-center">{configDraft[f.key]}</span>
                  <button onClick={() => setConfigDraft((d) => ({ ...d, [f.key]: Math.min(f.max, d[f.key] + 1) }))} className="w-8 h-8 rounded-xl text-white font-black text-base transition-all active:scale-90" style={{ background: "rgba(255,255,255,0.1)" }}>+</button>
                  <span className="text-white/30 text-[11px] w-8">{f.unit}</span>
                </div>
              </div>
            ))}
            <button
              onClick={handleSaveConfig}
              className="w-full rounded-2xl py-3 font-black text-sm transition-all active:scale-95 mt-1"
              style={{
                background: configSaved ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#7c3aed,#6d28d9)",
                color: "#fff",
                boxShadow: configSaved ? "0 4px 16px rgba(16,185,129,0.4)" : "0 4px 16px rgba(109,40,217,0.4)",
              }}
            >
              {configSaved ? "✅ 저장 완료!" : "💾 저장"}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
