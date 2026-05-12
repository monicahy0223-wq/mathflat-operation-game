"use client";

// ── Local constants (mirror values from MathGame.tsx) ─────────────────────────
const MONSTER_MAX_HP = 5;
const EXP_PER_LEVEL  = 100;
const CHAR_LEFT      = ["10%", "20%", "30%", "38%", "46%", "54%"];
const HERO_IMG       = "/assets/character/main.png";

// ── Shared props for all arena visualizations ─────────────────────────────────
export type ArenaVisualizationProps = {
  correctCount:   number;
  monsterHp:      number;
  charAttacking:  boolean;
  monsterHit:     boolean;
  monsterCounter: boolean;
  damageKey:      number;
  combo:          number;
  character:      string;
  growExp?:       number;
  growLevel?:     number;
};

// ── GrowArena ─────────────────────────────────────────────────────────────────
const GROW_STAGES = ["🌱", "🌿", "🪴", "🌳", "🌸", "🌺"];

export function GrowArena({ correctCount, monsterHit, monsterCounter, combo, character, growExp = 0, growLevel = 1 }: ArenaVisualizationProps) {
  const stage      = Math.min(correctCount, GROW_STAGES.length - 1);
  const plantEmoji = GROW_STAGES[stage];
  const stagePct   = (correctCount / MONSTER_MAX_HP) * 100;
  const expPct     = Math.min((growExp / EXP_PER_LEVEL) * 100, 100);

  return (
    <div
      className="rounded-3xl overflow-hidden select-none"
      style={{
        background: "linear-gradient(180deg,#bae6fd 0%,#bbf7d0 55%,#86efac 100%)",
        minHeight: 180,
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        border: "2px solid rgba(255,255,255,0.5)",
      }}
    >
      {/* Top bar: level badge + combo */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div
          className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5"
          style={{ background: "rgba(16,185,129,0.18)", border: "1.5px solid #10b981" }}
        >
          <span style={{ fontSize: 12 }}>⭐</span>
          <span className="font-black text-emerald-800" style={{ fontSize: 11 }}>Lv.{growLevel}</span>
        </div>
        <div className="text-xs font-black text-emerald-600">
          {combo >= 3 ? `🔥 ×${combo} 콤보!` : combo >= 2 ? "✌️ Good!" : ""}
        </div>
      </div>

      {/* Main area */}
      <div className="flex items-end justify-around px-6 pb-2 pt-1 gap-4">
        {/* Character (left) */}
        <div
          className={`flex-shrink-0 transition-transform ${monsterHit ? "scale-125" : "scale-100"}`}
          style={{ fontSize: 44 }}
        >
          {character.startsWith("/") ? (
            <img src={character} alt="character" style={{ width: 48, height: 48, objectFit: "contain" }} />
          ) : (
            <span>{character}</span>
          )}
        </div>

        {/* Central plant */}
        <div
          className={`text-7xl transition-transform duration-300 ${
            monsterCounter ? "animate-shake" : monsterHit ? "scale-125" : "scale-100"
          }`}
          style={{ filter: monsterHit ? "drop-shadow(0 0 20px rgba(34,197,94,0.9))" : "none" }}
        >
          {plantEmoji}
        </div>

        {/* Stage progress petals (right) */}
        <div className="flex-shrink-0 flex flex-col gap-0.5 items-center">
          {Array.from({ length: MONSTER_MAX_HP }).map((_, i) => (
            <span key={i} className={`text-sm ${i < correctCount ? "animate-pop-in" : "opacity-20"}`}>🌸</span>
          ))}
        </div>
      </div>

      {/* EXP bar */}
      <div className="mx-4 mb-1.5">
        <div className="flex justify-between text-[10px] font-black text-emerald-800 mb-0.5 opacity-80">
          <span>✨ 경험치</span>
          <span>{growExp} / {EXP_PER_LEVEL}</span>
        </div>
        <div className="rounded-full overflow-hidden h-3.5" style={{ background: "rgba(0,0,0,0.13)" }}>
          <div
            className="h-full rounded-full transition-all duration-600"
            style={{
              width: `${expPct}%`,
              background: "linear-gradient(90deg,#34d399,#10b981,#059669)",
              boxShadow: "0 0 10px rgba(16,185,129,0.7)",
            }}
          />
        </div>
      </div>

      {/* Stage progress bar */}
      <div className="mx-4 mb-3">
        <div className="flex justify-between text-[10px] font-black text-emerald-700 mb-0.5 opacity-70">
          <span>🌱 스테이지 진행</span>
          <span>{correctCount} / {MONSTER_MAX_HP}</span>
        </div>
        <div className="rounded-full overflow-hidden h-2" style={{ background: "rgba(0,0,0,0.10)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${stagePct}%`,
              background: "linear-gradient(90deg,#86efac,#4ade80)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── PuzzleArena ───────────────────────────────────────────────────────────────
const PUZZLE_TOTAL = 9;
const PUZZLE_CELL_COLORS = [
  "linear-gradient(135deg,#a855f7,#7c3aed)",
  "linear-gradient(135deg,#ec4899,#db2777)",
  "linear-gradient(135deg,#f59e0b,#d97706)",
  "linear-gradient(135deg,#06b6d4,#0284c7)",
  "linear-gradient(135deg,#22c55e,#16a34a)",
  "linear-gradient(135deg,#f43f5e,#e11d48)",
  "linear-gradient(135deg,#6366f1,#4f46e5)",
  "linear-gradient(135deg,#fb923c,#ea580c)",
  "linear-gradient(135deg,#34d399,#059669)",
];
const PUZZLE_CELL_EMOJIS = ["🔮", "🎯", "⚡", "🌊", "🍀", "💎", "🌟", "🎪", "🏆"];

export function PuzzleArena({ correctCount, monsterCounter, monsterHit, combo }: ArenaVisualizationProps) {
  const filledCells = Math.round((correctCount / MONSTER_MAX_HP) * PUZZLE_TOTAL);
  const puzzlePct   = (correctCount / MONSTER_MAX_HP) * 100;

  return (
    <div
      className="rounded-3xl overflow-hidden select-none"
      style={{
        background: "linear-gradient(180deg,#0f0c29 0%,#1e1b4b 55%,#312e81 100%)",
        minHeight: 195,
        boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
        border: "2px solid rgba(139,92,246,0.22)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div
          className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5"
          style={{ background: "rgba(139,92,246,0.2)", border: "1.5px solid rgba(139,92,246,0.45)" }}
        >
          <span style={{ fontSize: 11 }}>🧩</span>
          <span className="font-black text-violet-300" style={{ fontSize: 11 }}>퍼즐 {filledCells} / {PUZZLE_TOTAL}</span>
        </div>
        <div className="text-xs font-black text-violet-300">
          {combo >= 3 ? `🔥 ×${combo} 콤보!` : combo >= 2 ? "✌️ Great!" : ""}
        </div>
      </div>

      {/* 3×3 Puzzle grid */}
      <div
        className={`grid grid-cols-3 gap-2 px-4 py-2 ${monsterCounter ? "animate-shake" : ""}`}
      >
        {Array.from({ length: PUZZLE_TOTAL }, (_, i) => {
          const revealed = i < filledCells;
          const isNew    = revealed && i === filledCells - 1 && monsterHit;
          return (
            <div
              key={i}
              className={`rounded-2xl flex items-center justify-center ${
                isNew ? "animate-pop-in" : ""
              }`}
              style={{
                aspectRatio: "1",
                background:  revealed ? PUZZLE_CELL_COLORS[i] : "rgba(255,255,255,0.05)",
                border:      revealed
                  ? "2px solid rgba(255,255,255,0.3)"
                  : "2px dashed rgba(255,255,255,0.13)",
                boxShadow:   revealed
                  ? `0 4px 18px rgba(139,92,246,0.5), inset 0 1px 3px rgba(255,255,255,0.2)`
                  : "none",
                transition:  "background 0.4s ease, box-shadow 0.4s ease",
              }}
            >
              {revealed ? (
                <span style={{ fontSize: 22, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))" }}>
                  {PUZZLE_CELL_EMOJIS[i]}
                </span>
              ) : (
                <span style={{ fontSize: 16, color: "rgba(255,255,255,0.15)", userSelect: "none" }}>✦</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Flash on correct */}
      {monsterHit && (
        <div className="text-center font-black text-violet-300 animate-pop-in" style={{ fontSize: "13px", marginBottom: 2 }}>
          🧩 조각 획득!
        </div>
      )}

      {/* Progress bar */}
      <div className="mx-4 mb-3 mt-1">
        <div className="flex justify-between text-[10px] font-black text-violet-400 mb-0.5 opacity-80">
          <span>✨ 완성도</span>
          <span>{correctCount} / {MONSTER_MAX_HP} 정답</span>
        </div>
        <div className="rounded-full overflow-hidden h-2.5" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${puzzlePct}%`,
              background: "linear-gradient(90deg,#a855f7,#6366f1,#3b82f6)",
              boxShadow: "0 0 10px rgba(168,85,247,0.7)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── BattleArena ───────────────────────────────────────────────────────────────
export type BattleArenaInfo = {
  monster:      string;
  monsterName:  string;
  groundColor:  string;
  monsterImage: string;
  monsterIcon:  string;
};

export function QuestionDisplay({
  question,
  className = "",
  style,
}: {
  question:   { text: string; questionImageUrl: string };
  className?: string;
  style?:     React.CSSProperties;
}) {
  if (question.text) {
    return (
      <p
        className={`relative font-black tracking-wide leading-none select-none ${className}`}
        style={{
          fontSize: "clamp(2.4rem,8vw,3.5rem)",
          color: "#ffffff",
          letterSpacing: "0.04em",
          textShadow: "0 2px 16px rgba(139,92,246,0.6)",
          ...style,
        }}
      >
        {question.text}
      </p>
    );
  }

  if (question.questionImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={question.questionImageUrl}
        alt="문제 이미지"
        className={`rounded-xl object-contain mx-auto block ${className}`}
        style={{
          width:    "100%",
          height:   "auto",
          maxWidth: "100%",
          display:  "block",
          ...style,
        }}
        onError={(e) => {
          const el = e.currentTarget;
          el.style.display = "none";
          const fallback = el.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = "block";
        }}
      />
    );
  }

  return (
    <p
      className={`text-white/50 text-base font-bold ${className}`}
      style={style}
    >
      문제를 불러오지 못했어요
    </p>
  );
}

export function ImageLoadFallback() {
  return (
    <p className="text-white/50 text-base font-bold hidden">
      이미지를 불러오지 못했어요
    </p>
  );
}

export function BattleArena({
  arenaInfo,
  monsterMaxHp = MONSTER_MAX_HP,
  correctCount,
  monsterHp,
  charAttacking,
  monsterHit,
  monsterCounter,
  damageKey,
  combo,
  character,
}: {
  arenaInfo:      BattleArenaInfo;
  monsterMaxHp?:  number;
  correctCount:   number;
  monsterHp:      number;
  charAttacking:  boolean;
  monsterHit:     boolean;
  monsterCounter: boolean;
  damageKey:      number;
  combo:          number;
  character:      string;
}) {
  const charLeft   = CHAR_LEFT[Math.min(correctCount, CHAR_LEFT.length - 1)];
  const isDefeated = monsterHp <= 0;
  const hpPct      = Math.max((monsterHp / monsterMaxHp) * 100, 0);

  const hpBarGradient =
    hpPct > 60 ? "linear-gradient(90deg,#059669,#10b981,#34d399)" :
    hpPct > 30 ? "linear-gradient(90deg,#b45309,#f59e0b,#fcd34d)" :
                 "linear-gradient(90deg,#991b1b,#ef4444,#fca5a5)";

  return (
    <div
      className="relative rounded-3xl overflow-hidden shadow-2xl"
      style={{
        height: "280px",
        backgroundImage:    "url('/assets/background/origbig.png')",
        backgroundSize:     "cover",
        backgroundPosition: "center 60%",
        backgroundColor:    "#7ec8a0",
      }}
    >
      {/* ── Ground strip ── */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-b-3xl pointer-events-none"
        style={{
          height: "50px",
          background: "linear-gradient(to top, rgba(20,83,45,0.7) 0%, rgba(22,163,74,0.3) 60%, transparent 100%)",
        }}
      />
      {/* Dashed path */}
      <div className="absolute bottom-[3.2rem] left-[12%] right-[20%] pointer-events-none" style={{ borderTop: "2px dashed rgba(255,255,255,0.3)" }} />

      {/* ── Monster HP bar (top overlay) ── */}
      <div className="absolute top-0 left-0 right-0 z-30 px-3 pt-2.5 pb-3"
           style={{ background: "linear-gradient(to bottom,rgba(0,0,0,0.55),rgba(0,0,0,0.3))", backdropFilter: "blur(6px)" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
            {isDefeated ? (
              <span className="text-2xl leading-none select-none">💨</span>
            ) : (
              <img
                src={arenaInfo.monsterIcon}
                alt={arenaInfo.monsterName}
                style={{
                  width: "32px",
                  height: "32px",
                  objectFit: "contain",
                  filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))",
                }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const span = document.createElement("span");
                  span.style.fontSize = "1.5rem";
                  span.style.lineHeight = "1";
                  span.textContent = arenaInfo.monster;
                  e.currentTarget.parentElement?.appendChild(span);
                }}
              />
            )}
          </div>
          <div className="flex-1">
            <div className="flex justify-between mb-1.5">
              <span className="text-[11px] font-black text-white tracking-wider drop-shadow">{arenaInfo.monsterName}</span>
              <span className="text-[10px] font-black tabular-nums" style={{ color: hpPct > 60 ? "#6ee7b7" : hpPct > 30 ? "#fde68a" : "#fca5a5" }}>
                HP {Math.max(monsterHp, 0)}/{monsterMaxHp}
              </span>
            </div>
            <div className="rounded-full overflow-hidden" style={{
              height: "14px",
              background: "rgba(0,0,0,0.5)",
              border: "1.5px solid rgba(255,255,255,0.15)",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4)",
            }}>
              <div
                className={`h-full rounded-full transition-[width] duration-500 ease-out relative overflow-hidden ${hpPct <= 30 ? "animate-[pulse_0.8s_ease-in-out_infinite]" : ""}`}
                style={{ width: `${hpPct}%`, background: hpBarGradient }}
              >
                <div className="absolute inset-x-0 top-0 bottom-1/2 rounded-t-full pointer-events-none" style={{ background: "rgba(255,255,255,0.25)" }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Character (hero.png) ── */}
      <div
        className="absolute z-10 rounded-full pointer-events-none"
        style={{
          left:      charLeft,
          bottom:    "2.4rem",
          transform: "translateX(-50%)",
          width:     "72px",
          height:    "16px",
          background: "radial-gradient(ellipse, rgba(0,0,0,0.3) 0%, transparent 70%)",
          transition: "left 0.55s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      />
      <div
        className={`absolute z-20 ${charAttacking ? "animate-char-attack" : ""}`}
        style={{
          left:       charLeft,
          bottom:     "2.6rem",
          transform:  "translateX(-50%)",
          transition: "left 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)",
          filter:     charAttacking
            ? "drop-shadow(0 0 16px rgba(250,204,21,1)) drop-shadow(0 4px 12px rgba(0,0,0,0.5))"
            : "drop-shadow(0 4px 12px rgba(0,0,0,0.4))",
        }}
      >
        <img
          src={HERO_IMG}
          alt="hero"
          style={{ width: "80px", height: "auto", objectFit: "contain", display: "block" }}
          onError={(e) => {
            const el = e.currentTarget;
            el.style.display = "none";
            const span = document.createElement("span");
            span.style.fontSize = "4rem";
            span.style.lineHeight = "1";
            span.textContent = character;
            el.parentElement?.appendChild(span);
          }}
        />
      </div>

      {/* Slash burst when attacking */}
      {charAttacking && (
        <div
          className="absolute select-none pointer-events-none z-30 animate-pop-in"
          style={{ left: charLeft, bottom: "4.2rem", fontSize: "2.4rem", transform: "translateX(32px)" }}
        >
          ⚔️
        </div>
      )}
      {charAttacking && (
        <div
          className="absolute select-none pointer-events-none z-30 animate-pop-in"
          style={{ left: charLeft, bottom: "3rem", fontSize: "2rem", transform: "translateX(58px)", animationDelay: "60ms" }}
        >
          ✨
        </div>
      )}

      {/* Counter-attack hit marker */}
      {monsterCounter && (
        <div
          className="absolute text-4xl animate-pop-in select-none pointer-events-none z-30"
          style={{ left: charLeft, bottom: "5rem", transform: "translateX(-68px)" }}
        >
          💢
        </div>
      )}

      {/* ── Monster sprite ── */}
      <div
        className="absolute flex flex-col items-center z-20"
        style={{ right: "7%", bottom: "2.5rem" }}
      >
        <div className="relative h-12 flex justify-center items-end">
          {damageKey > 0 && (
            <span
              key={damageKey}
              className="absolute left-1/2 bottom-0 font-black animate-damage-float select-none pointer-events-none"
              style={{
                fontSize: "2rem",
                color: "#ef4444",
                textShadow: "0 0 12px rgba(239,68,68,0.8), 0 2px 4px rgba(0,0,0,0.4)",
              }}
            >
              −1
            </span>
          )}
        </div>

        {isDefeated ? (
          <span style={{ fontSize: "5rem", lineHeight: 1, opacity: 0.5, filter: "grayscale(1)" }}>💨</span>
        ) : (
          <img
            src={arenaInfo.monsterImage}
            alt={arenaInfo.monsterName}
            className={
              monsterHit     ? "animate-monster-hit"     :
              monsterCounter ? "animate-monster-counter" : ""
            }
            style={{
              width:  "110px",
              height: "auto",
              objectFit: "contain",
              display: "block",
              filter: monsterHit
                ? "drop-shadow(0 0 24px rgba(239,68,68,1)) drop-shadow(0 0 8px rgba(239,68,68,0.6)) brightness(1.8)"
                : "drop-shadow(0 6px 16px rgba(0,0,0,0.45))",
              transition: "filter 0.08s",
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
              const span = document.createElement("span");
              span.style.fontSize = "5.5rem";
              span.style.lineHeight = "1";
              span.textContent = arenaInfo.monster;
              e.currentTarget.parentElement?.appendChild(span);
            }}
          />
        )}
      </div>

      {/* ── Combo flash ── */}
      {charAttacking && combo >= 3 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
          <div className="animate-pop-in bg-orange-400/90 text-white font-black text-base rounded-2xl px-6 py-2.5 shadow-2xl">
            🔥 {combo}콤보 공격!
          </div>
        </div>
      )}
    </div>
  );
}
