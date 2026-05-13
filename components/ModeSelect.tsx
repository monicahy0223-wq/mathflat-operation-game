"use client";

type Props = {
  onSelect: (mode: "teacher" | "student") => void;
};

export default function ModeSelect({ onSelect }: Props) {
  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(180deg,#083344 0%,#0c4a6e 20%,#0369a1 40%,#0ea5e9 62%,#7dd3fc 82%,#e0f2fe 100%)" }}
    >
      {/* ── 배경 장식 ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* ── 상단 구름 이모지 ── */}
        <img src="/assets/decoration/cloud.svg" className="absolute opacity-20" style={{ top: "6%", left: "4%", width: 64 }} />
        <img src="/assets/decoration/cloud.svg" className="absolute opacity-15" style={{ top: "9.5%", right: "5.5%", width: 52 }} />
        <img src="/assets/decoration/cloud.svg" className="absolute opacity-18" style={{ top: "3%", left: "46%", width: 44 }} />
        <div className="absolute opacity-50" style={{ top: "13%", left: "7%", fontSize: 28 }}>✨</div>
        <div className="absolute opacity-40" style={{ top: "17%", right: "9%", fontSize: 22 }}>⭐</div>
        <div className="absolute bottom-0 left-0 right-0 flex justify-around items-end" style={{ opacity: 0.22 }}>
          <span style={{ fontSize: 68 }}>🌲</span>
          <span style={{ fontSize: 50 }}>🌳</span>
          <span style={{ fontSize: 76 }}>🌲</span>
          <span style={{ fontSize: 58 }}>🌳</span>
          <span style={{ fontSize: 64 }}>🌲</span>
          <span style={{ fontSize: 46 }}>🌳</span>
        </div>
      </div>

      {/* ── 메인 콘텐츠 ── */}
      <div className="relative flex flex-col flex-1 px-3 pt-12 pb-8 gap-6 max-w-lg mx-auto w-full" style={{ zIndex: 1 }}>

        {/* ① 타이틀 */}
        <div className="text-center">
          <div
            className="mx-auto mb-3 flex items-center justify-center rounded-3xl"
            style={{ width: 88, height: 88, background: "linear-gradient(135deg,#0ea5e9,#10b981)", boxShadow: "0 8px 36px rgba(14,165,233,0.6)", fontSize: 48 }}
          >
            🗺️
          </div>
          <h1
            className="font-black text-white leading-tight"
            style={{ fontSize: "clamp(30px,8vw,40px)", letterSpacing: "-0.03em", textShadow: "0 4px 24px rgba(0,0,0,0.35)" }}
          >
            매쓰플랫 퀘스트
          </h1>
          <p className="font-bold mt-2 text-sky-100" style={{ fontSize: 15, textShadow: "0 2px 10px rgba(0,0,0,0.25)" }}>
            수학으로 완성하는 대모험! ⚔️
          </p>
        </div>

        {/* ② 가치 칩 + 게임 화면 */}
        <div className="flex flex-col gap-3">
          {/* 가치 칩 */}
          <div className="flex gap-2 justify-center flex-wrap">
            {[
              { emoji: "📚", text: "교육과정 완벽 반영" },
              { emoji: "🏆", text: "성취 기반 레벨업" },
              { emoji: "📊", text: "학습 현황 분석" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-1.5 rounded-full px-3 py-1"
                style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.35)", backdropFilter: "blur(8px)" }}>
                <span style={{ fontSize: 13 }}>{item.emoji}</span>
                <span className="font-bold text-white" style={{ fontSize: 11 }}>{item.text}</span>
              </div>
            ))}
          </div>

          {/* ─ 전투 씬 (가로 넓은 대표 카드) ─ */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              backgroundImage: "url('/assets/background/origbig.png')",
              backgroundSize: "cover", backgroundPosition: "center 55%",
              height: 148,
              position: "relative",
              boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
              border: "1.5px solid rgba(251,113,133,0.45)",
            }}
          >
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.22)" }} />

            {/* 몬스터 HP 오버레이 — 상단 */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "7px 12px", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <img src="/assets/monster/dino.png" alt="" style={{ width: 20, height: 20, objectFit: "contain" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.15)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: "35%", height: "100%", background: "linear-gradient(90deg,#ef4444,#f87171)", borderRadius: 999 }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 900, color: "#fca5a5" }}>HP 2/5</span>
              </div>
            </div>

            {/* 콤보 */}
            <div style={{ position: "absolute", top: 36, right: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: "#fcd34d", background: "rgba(245,158,11,0.25)", border: "1px solid rgba(245,158,11,0.5)", borderRadius: 999, padding: "3px 8px" }}>
                🔥 ×4 COMBO
              </span>
            </div>

            {/* 캐릭터 vs 몬스터 */}
            <div style={{ position: "absolute", bottom: 36, left: 16, right: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <img src="/assets/character/hero.png" alt="" style={{ width: 48, height: 48, objectFit: "contain" }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              <img src="/assets/monster/dino.png" alt="" style={{ width: 56, height: 56, objectFit: "contain" }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            </div>

            {/* 문제 — 하단 */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(15,10,60,0.9)", padding: "7px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "rgba(199,210,254,0.7)", fontSize: 10, fontWeight: 700 }}>⚔️ 전투 모드</span>
              <span style={{ color: "white", fontSize: 15, fontWeight: 900, letterSpacing: "-0.02em" }}>324 + 215 = ?</span>
              <span style={{ color: "#fbbf24", fontSize: 10, fontWeight: 900 }}>SCORE 480</span>
            </div>
          </div>

          {/* ─ 성장 + 스테이지 클리어 (하단 2열) ─ */}
          <div className="grid grid-cols-2 gap-3">

            {/* 성장 씬 */}
            <div className="rounded-2xl overflow-hidden flex flex-col"
              style={{ background: "linear-gradient(160deg,#bae6fd 0%,#bbf7d0 50%,#86efac 100%)", border: "1.5px solid rgba(52,211,153,0.45)", boxShadow: "0 6px 20px rgba(0,0,0,0.3)" }}>
              <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "10px 12px 8px" }}>
                {/* 레벨 + EXP */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 900, color: "#064e3b", background: "rgba(16,185,129,0.2)", border: "1.5px solid #10b981", borderRadius: 999, padding: "1px 7px" }}>LV.3</span>
                    <div style={{ flex: 1, height: 5, background: "rgba(0,0,0,0.12)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: "68%", height: "100%", background: "linear-gradient(90deg,#34d399,#6ee7b7)" }} />
                    </div>
                  </div>
                </div>
                {/* 성장 씬 */}
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                  <img src="/assets/character/hero.png" alt="" style={{ width: 32, height: 32, objectFit: "contain" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  <span style={{ fontSize: 36, lineHeight: 1, filter: "drop-shadow(0 4px 8px rgba(16,185,129,0.4))" }}>🌸</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span key={i} style={{ fontSize: 8, opacity: i <= 3 ? 1 : 0.2 }}>{i <= 3 ? "🌸" : "○"}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ background: "rgba(5,95,70,0.88)", padding: "4px 10px", textAlign: "center" }}>
                <span style={{ color: "#6ee7b7", fontWeight: 900, fontSize: 10 }}>🌱 성장 모드</span>
              </div>
            </div>

            {/* 지혜의 탑 씬 */}
            <div className="rounded-2xl overflow-hidden flex flex-col"
              style={{ background: "linear-gradient(160deg,#0d0a2e 0%,#1e1058 40%,#2d1b6b 100%)", border: "1.5px solid rgba(167,139,250,0.45)", boxShadow: "0 6px 20px rgba(0,0,0,0.3)" }}>
              <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "10px 12px 8px" }}>
                {/* 층수 + 진행 바 */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 900, color: "#e9d5ff", background: "rgba(139,92,246,0.25)", border: "1.5px solid #a78bfa", borderRadius: 999, padding: "1px 7px" }}>2층</span>
                    <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.1)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: "40%", height: "100%", background: "linear-gradient(90deg,#7c3aed,#a78bfa)" }} />
                    </div>
                  </div>
                </div>
                {/* 플레이 씬 */}
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                  <img src="/assets/character/hero.png" alt="" style={{ width: 32, height: 32, objectFit: "contain" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  <span style={{ fontSize: 36, lineHeight: 1, filter: "drop-shadow(0 0 14px rgba(167,139,250,0.9))" }}>🗼</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 9, opacity: 1 }}>✦</span>
                    <span style={{ fontSize: 9, opacity: 1 }}>📖</span>
                    <span style={{ fontSize: 9, opacity: 0.2 }}>○</span>
                  </div>
                </div>
              </div>
              <div style={{ background: "rgba(49,10,101,0.88)", padding: "4px 10px", textAlign: "center" }}>
                <span style={{ color: "#c4b5fd", fontWeight: 900, fontSize: 10 }}>🏰 지혜의 탑</span>
              </div>
            </div>

          </div>
        </div>

        {/* ③ 모드 선택 버튼 */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => onSelect("teacher")}
            className="w-full rounded-3xl flex items-center gap-5 transition-all active:scale-[0.97]"
            style={{
              padding: "18px 24px",
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(18px)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
              border: "2px solid rgba(255,255,255,0.32)",
            }}
          >
            <div className="rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ width: 58, height: 58, background: "linear-gradient(135deg,#7c3aed,#6d28d9)", fontSize: 30, boxShadow: "0 4px 14px rgba(109,40,217,0.5)" }}>
              👩‍🏫
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="font-black text-white" style={{ fontSize: 20, letterSpacing: "-0.02em" }}>선생님이신가요?</div>
              <div className="text-white/60 font-semibold mt-0.5" style={{ fontSize: 12 }}>학생들의 학습 현황을 한눈에!</div>
            </div>
          </button>
          <button
            onClick={() => onSelect("student")}
            className="w-full rounded-3xl flex items-center gap-5 transition-all active:scale-[0.97]"
            style={{
              padding: "18px 24px",
              background: "linear-gradient(135deg,#0369a1 0%,#0ea5e9 55%,#38bdf8 100%)",
              boxShadow: "0 10px 36px rgba(3,105,161,0.6), 0 2px 10px rgba(0,0,0,0.2)",
              border: "2px solid rgba(255,255,255,0.3)",
            }}
          >
            <div className="rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ width: 64, height: 64, background: "rgba(255,255,255,0.2)", fontSize: 34, backdropFilter: "blur(8px)" }}>
              🎮
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="font-black text-white" style={{ fontSize: 22, letterSpacing: "-0.02em" }}>학생인가요?</div>
              <div className="text-sky-100 font-semibold mt-0.5" style={{ fontSize: 13 }}>지금 바로 탐험 시작! →</div>
            </div>
          </button>
        </div>

        <p className="text-center text-white/35 font-medium" style={{ fontSize: 11 }}>
          MathFlat Quest · powered by 매쓰플랫
        </p>
      </div>
    </div>
  );
}
