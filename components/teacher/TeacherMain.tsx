"use client";

import { useState } from "react";
import { loadTeacherAppSettings, getActiveClass } from "../../lib/teacherStorage";
import { TEXTBOOK_OPTIONS } from "../../types/teacher";

type Props = {
  onGoClassSettings: () => void;
  onGoDashboard: () => void;
  onGoStudentView: () => void;
  onBack: () => void;   // 게임 화면으로 돌아가기
  onExit: () => void;   // 모드 선택 화면으로
};

export default function TeacherMain({ onGoClassSettings, onGoDashboard, onGoStudentView, onBack, onExit }: Props) {
  const [settings] = useState(() => loadTeacherAppSettings());
  const activeClass = getActiveClass(settings);
  const textbook = TEXTBOOK_OPTIONS.find((t) => t.id === activeClass.textbookId);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "linear-gradient(180deg, #bfdbfe 0%, #a7f3d0 38%, #fef9c3 72%, #fed7aa 100%)",
      }}
    >
      {/* 배경 구름 장식 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute text-5xl opacity-30" style={{ top: "6%", left: "5%" }}>☁️</div>
        <div className="absolute text-4xl opacity-20" style={{ top: "12%", right: "8%" }}>☁️</div>
        <div className="absolute text-3xl opacity-25" style={{ top: "4%", left: "45%" }}>☁️</div>
      </div>

      {/* 헤더 */}
      <div
        className="relative z-10 w-full mx-auto flex-shrink-0 px-5 pt-6 pb-2 flex items-center justify-between"
        style={{ maxWidth: "900px" }}
      >
        <div>
          <h1
            className="font-black leading-none"
            style={{ fontSize: "clamp(20px,5vw,26px)", letterSpacing: "-0.03em", color: "#1e3a5f", textShadow: "0 2px 8px rgba(255,255,255,0.6)" }}
          >
            매쓰플랫 퀘스트
          </h1>
          <p className="font-bold text-teal-700 mt-0.5 opacity-80" style={{ fontSize: "12px" }}>
            👩‍🏫 교사 관리 메뉴
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="rounded-xl px-3 py-1.5 text-xs font-bold transition-all active:scale-90"
            style={{ background: "rgba(0,0,0,0.07)", color: "#64748b" }}
          >
            ← 게임으로
          </button>
          <button
            onClick={onExit}
            className="rounded-xl px-3 py-1.5 text-xs font-bold transition-all active:scale-90"
            style={{ background: "rgba(0,0,0,0.07)", color: "#94a3b8" }}
          >
            처음으로
          </button>
        </div>
      </div>

      {/* 학급 요약 카드 */}
      <div
        className="relative z-10 mx-auto mt-4 px-5 w-full"
        style={{ maxWidth: "900px" }}
      >
        <div
          className="rounded-3xl px-6 py-5"
          style={{
            background: "linear-gradient(135deg,rgba(255,255,255,0.85),rgba(240,249,255,0.9))",
            boxShadow: "0 4px 24px rgba(14,165,233,0.15)",
            border: "1px solid rgba(255,255,255,0.9)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">현재 학급</div>
              <div className="font-black text-slate-800 text-2xl">{activeClass.name}</div>
              <div className="text-sky-600 text-sm mt-1 font-medium">📚 {textbook?.name ?? "교과서 미선택"}</div>
            </div>
            <div className="flex text-right gap-1 self-center">
              <div className="font-black text-emerald-500 text-4xl leading-none">{settings.students.length}</div>
              <div className="text-slate-400 text-xs mt-1 self-center">명</div>
            </div>
          </div>
        </div>
      </div>

      {/* 메뉴 카드 3개 */}
      <div
        className="relative z-10 mx-auto mt-5 px-5 w-full flex flex-col gap-3"
        style={{ maxWidth: "900px" }}
      >
        {/* 학급 관리 */}
        <button
          onClick={onGoClassSettings}
          className="rounded-3xl px-6 py-5 flex items-center gap-5 text-left transition-all active:scale-98"
          style={{
            background: "linear-gradient(135deg,rgba(255,255,255,0.88),rgba(233,213,255,0.9))",
            boxShadow: "0 4px 20px rgba(124,58,237,0.15)",
            border: "1px solid rgba(255,255,255,0.9)",
          }}
        >
          <div className="rounded-2xl flex items-center justify-center flex-shrink-0" style={{ width: 56, height: 56, background: "linear-gradient(135deg,#7c3aed,#6d28d9)", boxShadow: "0 4px 12px rgba(109,40,217,0.4)" }}>
            <span style={{ fontSize: 26 }}>📚</span>
          </div>
          <div className="flex-1">
            <div className="font-black text-slate-800 text-lg">학급 관리</div>
            <div className="text-slate-500 text-sm mt-0.5">교과서 선택 · 학급 정보 · 학생 목록</div>
          </div>
          <div className="text-slate-400 text-xl font-light">›</div>
        </button>

        {/* 대시보드 */}
        <button
          onClick={onGoDashboard}
          className="rounded-3xl px-6 py-5 flex items-center gap-5 text-left transition-all active:scale-98"
          style={{
            background: "linear-gradient(135deg,rgba(255,255,255,0.88),rgba(209,250,229,0.9))",
            boxShadow: "0 4px 20px rgba(16,185,129,0.15)",
            border: "1px solid rgba(255,255,255,0.9)",
          }}
        >
          <div className="rounded-2xl flex items-center justify-center flex-shrink-0" style={{ width: 56, height: 56, background: "linear-gradient(135deg,#059669,#10b981)", boxShadow: "0 4px 12px rgba(16,185,129,0.4)" }}>
            <span style={{ fontSize: 26 }}>📊</span>
          </div>
          <div className="flex-1">
            <div className="font-black text-slate-800 text-lg">대시보드</div>
            <div className="text-slate-500 text-sm mt-0.5">학생별 학습 리포트 · 수업 설정</div>
          </div>
          <div className="text-slate-400 text-xl font-light">›</div>
        </button>

        {/* 학생 화면 보기 */}
        <button
          onClick={onGoStudentView}
          className="rounded-3xl px-6 py-5 flex items-center gap-5 text-left transition-all active:scale-98"
          style={{
            background: "linear-gradient(135deg,rgba(255,255,255,0.88),rgba(186,230,253,0.9))",
            boxShadow: "0 4px 20px rgba(14,165,233,0.15)",
            border: "1px solid rgba(255,255,255,0.9)",
          }}
        >
          <div className="rounded-2xl flex items-center justify-center flex-shrink-0" style={{ width: 56, height: 56, background: "linear-gradient(135deg,#0369a1,#0ea5e9)", boxShadow: "0 4px 12px rgba(14,165,233,0.4)" }}>
            <span style={{ fontSize: 26 }}>🎮</span>
          </div>
          <div className="flex-1">
            <div className="font-black text-slate-800 text-lg">학생 화면 보기</div>
            <div className="text-slate-500 text-sm mt-0.5">학생 게임 화면 직접 체험</div>
          </div>
          <div className="text-slate-400 text-xl font-light">›</div>
        </button>
      </div>
    </div>
  );
}
