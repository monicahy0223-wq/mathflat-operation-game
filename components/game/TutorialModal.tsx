"use client";

import { useState } from "react";

const TUTORIAL_STEPS = [
  {
    icon:  "⚔️",
    title: "문제를 풀어 공격하기",
    desc:  "수학 문제의 정답을 입력하면\n몬스터를 공격할 수 있어요!\n5번 맞히면 스테이지 클리어!",
  },
  {
    icon:  "💰",
    title: "코인과 콤보",
    desc:  "연속으로 맞히면 콤보가 올라가고\n더 많은 코인을 얻을 수 있어요!\n콤보를 끊지 말고 도전해봐요.",
  },
  {
    icon:  "🗺️",
    title: "스테이지 클리어",
    desc:  "스테이지를 클리어하면\n다음 맵이 열려요!\n모든 퀘스트를 완료해보세요.",
  },
  {
    icon:  "🏪",
    title: "상점에서 캐릭터 구매",
    desc:  "모은 코인으로 상점에서\n귀여운 캐릭터 스킨을\n구매할 수 있어요!",
  },
] as const;

export function TutorialModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const total = TUTORIAL_STEPS.length;
  const current = TUTORIAL_STEPS[step];
  const isLast = step === total - 1;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-5"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative w-full max-w-xs rounded-3xl overflow-hidden shadow-2xl animate-pop-in"
        style={{ background: "linear-gradient(160deg,#1e293b,#0f172a)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg,#6366f1,#a855f7,#ec4899)" }} />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white/60 text-xs font-bold transition-colors"
        >
          건너뛰기
        </button>

        <div className="px-7 pt-8 pb-6 flex flex-col items-center text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-5 shadow-xl"
            style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.3),rgba(168,85,247,0.2))", border: "2px solid rgba(139,92,246,0.4)" }}
          >
            {current.icon}
          </div>

          <h2 className="text-white font-black text-lg mb-3">{current.title}</h2>

          <p className="text-white/60 text-sm leading-relaxed whitespace-pre-line mb-6">
            {current.desc}
          </p>

          <div className="flex gap-2 mb-6">
            {TUTORIAL_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className="rounded-full transition-all"
                style={{
                  width:      i === step ? "20px" : "8px",
                  height:     "8px",
                  background: i === step ? "#818cf8" : "rgba(255,255,255,0.2)",
                }}
              />
            ))}
          </div>

          <div className="flex gap-3 w-full">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex-1 rounded-2xl py-3 text-sm font-black text-white/50 transition-all active:scale-95"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                ← 이전
              </button>
            )}
            <button
              onClick={() => isLast ? onClose() : setStep((s) => s + 1)}
              className="flex-1 rounded-2xl py-3 text-sm font-black text-white transition-all active:scale-95"
              style={{ background: isLast ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#6366f1,#4f46e5)" }}
            >
              {isLast ? "🚀 시작하기!" : "다음 →"}
            </button>
          </div>

          <p className="mt-4 text-white/25 text-[10px] font-bold">
            {step + 1} / {total}
          </p>
        </div>
      </div>
    </div>
  );
}
