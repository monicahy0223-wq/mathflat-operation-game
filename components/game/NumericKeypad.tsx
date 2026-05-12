"use client";

import { useState } from "react";

type GameMode = "battle" | "grow" | "puzzle";

export type KeypadTheme = GameMode | "review";

export type ExtraKey = { label: string; onPress: () => void };

export interface NumericKeypadProps {
  onDigit:     (d: string) => void;
  onBackspace: () => void;
  onConfirm:   () => void;
  theme?:      KeypadTheme;
  disabled?:   boolean;
  extraKeys?:  ExtraKey[];
}

export const KEYPAD_THEME_STYLES: Record<KeypadTheme, {
  wrap:        React.CSSProperties;
  digit:       React.CSSProperties;
  digitHover:  React.CSSProperties;
  backspace:   React.CSSProperties;
  confirm:     React.CSSProperties;
  display:     React.CSSProperties;
  glow:        string;
}> = {
  grow: {
    wrap:       { background: "linear-gradient(160deg,#052e16 0%,#064e3b 80%)", borderRadius: "20px", padding: "12px", border: "1.5px solid rgba(16,185,129,0.35)", boxShadow: "0 8px 32px rgba(16,185,129,0.18)" },
    digit:      { background: "linear-gradient(135deg,#d1fae5 0%,#a7f3d0 100%)", color: "#064e3b", border: "1.5px solid rgba(16,185,129,0.25)", borderRadius: "14px", fontWeight: 900, fontSize: "clamp(1.35rem,5vw,1.75rem)", boxShadow: "0 3px 8px rgba(16,185,129,0.18), inset 0 1px 0 rgba(255,255,255,0.6)" },
    digitHover: { background: "linear-gradient(135deg,#a7f3d0 0%,#6ee7b7 100%)", boxShadow: "0 4px 16px rgba(16,185,129,0.40), inset 0 1px 0 rgba(255,255,255,0.5)" },
    backspace:  { background: "linear-gradient(135deg,#fef3c7 0%,#fde68a 100%)", color: "#78350f", border: "1.5px solid rgba(245,158,11,0.35)", borderRadius: "14px", fontWeight: 900, boxShadow: "0 3px 8px rgba(245,158,11,0.18)" },
    confirm:    { background: "linear-gradient(135deg,#059669 0%,#047857 100%)", color: "#fff", border: "none", borderRadius: "14px", fontWeight: 900, fontSize: "clamp(1rem,4vw,1.2rem)", boxShadow: "0 4px 16px rgba(5,150,105,0.45)" },
    display:    { background: "rgba(5,46,22,0.7)", border: "2px solid rgba(16,185,129,0.4)", color: "#d1fae5", caretColor: "#6ee7b7", borderRadius: "14px" },
    glow:       "rgba(16,185,129,0.55)",
  },
  battle: {
    wrap:       { background: "linear-gradient(160deg,#1c0700 0%,#450a0a 80%)", borderRadius: "20px", padding: "12px", border: "1.5px solid rgba(239,68,68,0.45)", boxShadow: "0 8px 32px rgba(239,68,68,0.22)" },
    digit:      { background: "linear-gradient(135deg,#292524 0%,#3f3f46 100%)", color: "#fca5a5", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: "14px", fontWeight: 900, fontSize: "clamp(1.35rem,5vw,1.75rem)", boxShadow: "0 3px 8px rgba(239,68,68,0.20), inset 0 1px 0 rgba(255,255,255,0.08)" },
    digitHover: { background: "linear-gradient(135deg,#57534e 0%,#78716c 100%)", boxShadow: "0 4px 16px rgba(239,68,68,0.45), inset 0 1px 0 rgba(255,255,255,0.1)" },
    backspace:  { background: "linear-gradient(135deg,#292524 0%,#3f3f46 100%)", color: "#fbbf24", border: "1.5px solid rgba(245,158,11,0.35)", borderRadius: "14px", fontWeight: 900, boxShadow: "0 3px 8px rgba(245,158,11,0.18)" },
    confirm:    { background: "linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)", color: "#fff", border: "none", borderRadius: "14px", fontWeight: 900, fontSize: "clamp(1rem,4vw,1.2rem)", boxShadow: "0 4px 16px rgba(220,38,38,0.55)" },
    display:    { background: "rgba(28,7,0,0.8)", border: "2px solid rgba(239,68,68,0.45)", color: "#fca5a5", caretColor: "#f87171", borderRadius: "14px" },
    glow:       "rgba(239,68,68,0.65)",
  },
  puzzle: {
    wrap:       { background: "linear-gradient(160deg,#1e1b4b 0%,#312e81 80%)", borderRadius: "20px", padding: "12px", border: "1.5px solid rgba(99,102,241,0.45)", boxShadow: "0 8px 32px rgba(99,102,241,0.22)" },
    digit:      { background: "linear-gradient(135deg,#1e1b4b 0%,#2e1065 100%)", color: "#c4b5fd", border: "1.5px solid rgba(139,92,246,0.35)", borderRadius: "14px", fontWeight: 900, fontSize: "clamp(1.35rem,5vw,1.75rem)", boxShadow: "0 3px 8px rgba(99,102,241,0.22), inset 0 1px 0 rgba(255,255,255,0.08)" },
    digitHover: { background: "linear-gradient(135deg,#312e81 0%,#4c1d95 100%)", boxShadow: "0 4px 16px rgba(139,92,246,0.55), inset 0 1px 0 rgba(255,255,255,0.1)" },
    backspace:  { background: "linear-gradient(135deg,#1e1b4b 0%,#2e1065 100%)", color: "#fbbf24", border: "1.5px solid rgba(245,158,11,0.35)", borderRadius: "14px", fontWeight: 900, boxShadow: "0 3px 8px rgba(245,158,11,0.18)" },
    confirm:    { background: "linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%)", color: "#fff", border: "none", borderRadius: "14px", fontWeight: 900, fontSize: "clamp(1rem,4vw,1.2rem)", boxShadow: "0 4px 16px rgba(109,40,217,0.55)" },
    display:    { background: "rgba(15,10,40,0.8)", border: "2px solid rgba(139,92,246,0.45)", color: "#ede9fe", caretColor: "#a78bfa", borderRadius: "14px" },
    glow:       "rgba(139,92,246,0.65)",
  },
  review: {
    wrap:       { background: "linear-gradient(160deg,#1e1b4b 0%,#2e1065 80%)", borderRadius: "20px", padding: "12px", border: "1.5px solid rgba(139,92,246,0.45)", boxShadow: "0 8px 32px rgba(139,92,246,0.20)" },
    digit:      { background: "linear-gradient(135deg,#1e1b4b 0%,#2e1065 100%)", color: "#ddd6fe", border: "1.5px solid rgba(139,92,246,0.30)", borderRadius: "14px", fontWeight: 900, fontSize: "clamp(1.35rem,5vw,1.75rem)", boxShadow: "0 3px 8px rgba(139,92,246,0.18), inset 0 1px 0 rgba(255,255,255,0.06)" },
    digitHover: { background: "linear-gradient(135deg,#312e81 0%,#4c1d95 100%)", boxShadow: "0 4px 16px rgba(139,92,246,0.50), inset 0 1px 0 rgba(255,255,255,0.08)" },
    backspace:  { background: "linear-gradient(135deg,#1e1b4b 0%,#2e1065 100%)", color: "#fbbf24", border: "1.5px solid rgba(245,158,11,0.35)", borderRadius: "14px", fontWeight: 900, boxShadow: "0 3px 8px rgba(245,158,11,0.15)" },
    confirm:    { background: "linear-gradient(135deg,#7c3aed 0%,#5b21b6 100%)", color: "#fff", border: "none", borderRadius: "14px", fontWeight: 900, fontSize: "clamp(1rem,4vw,1.2rem)", boxShadow: "0 4px 16px rgba(109,40,217,0.50)" },
    display:    { background: "rgba(15,10,40,0.75)", border: "2px solid rgba(139,92,246,0.40)", color: "#ede9fe", caretColor: "#a78bfa", borderRadius: "14px" },
    glow:       "rgba(139,92,246,0.60)",
  },
};

export function NumericKeypad({
  onDigit,
  onBackspace,
  onConfirm,
  theme    = "battle",
  disabled = false,
  extraKeys = [],
}: NumericKeypadProps) {
  const s = KEYPAD_THEME_STYLES[theme];
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  const handlePress = (key: string, action: () => void) => {
    if (disabled) return;
    setPressedKey(key);
    action();
    setTimeout(() => setPressedKey(null), 120);
  };

  const KEY_ROWS = [
    ["7", "8", "9"],
    ["4", "5", "6"],
    ["1", "2", "3"],
  ];

  return (
    <div style={{ ...s.wrap, display: "flex", flexDirection: "column", gap: "8px", userSelect: "none" }}>
      {KEY_ROWS.map((row) => (
        <div key={row.join("")} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {row.map((d) => {
            const isPressed = pressedKey === d;
            return (
              <button
                key={d}
                type="button"
                disabled={disabled}
                onClick={() => handlePress(d, () => onDigit(d))}
                style={{
                  ...s.digit,
                  ...(isPressed ? s.digitHover : {}),
                  transform: isPressed ? "scale(0.92)" : "scale(1)",
                  transition: "transform 0.10s ease, box-shadow 0.12s ease, background 0.12s ease",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.5 : 1,
                  minHeight: "clamp(44px,11vw,56px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: s.digit.border,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
      ))}

      {/* Bottom row: [extra/⌫] [0] [확인] */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
        {extraKeys.length > 0 ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => handlePress("extra0", extraKeys[0].onPress)}
            style={{
              ...s.backspace,
              transform: pressedKey === "extra0" ? "scale(0.92)" : "scale(1)",
              transition: "transform 0.10s ease, box-shadow 0.12s ease",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
              minHeight: "clamp(44px,11vw,56px)",
              fontSize: "clamp(1rem,4vw,1.25rem)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {extraKeys[0].label}
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => handlePress("⌫", onBackspace)}
            style={{
              ...s.backspace,
              transform: pressedKey === "⌫" ? "scale(0.92)" : "scale(1)",
              transition: "transform 0.10s ease, box-shadow 0.12s ease",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
              minHeight: "clamp(44px,11vw,56px)",
              fontSize: "clamp(1.1rem,4.5vw,1.4rem)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            ⌫
          </button>
        )}

        {/* 0 */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handlePress("0", () => onDigit("0"))}
          style={{
            ...s.digit,
            ...(pressedKey === "0" ? s.digitHover : {}),
            transform: pressedKey === "0" ? "scale(0.92)" : "scale(1)",
            transition: "transform 0.10s ease, box-shadow 0.12s ease, background 0.12s ease",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
            minHeight: "clamp(44px,11vw,56px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          0
        </button>

        {/* 확인 */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handlePress("✓", onConfirm)}
          style={{
            ...s.confirm,
            transform: pressedKey === "✓" ? "scale(0.92)" : "scale(1)",
            transition: "transform 0.10s ease, box-shadow 0.12s ease",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
            minHeight: "clamp(44px,11vw,56px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          확인
        </button>
      </div>

      {extraKeys.length > 1 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${extraKeys.length - 1}, 1fr)`, gap: "8px" }}>
          {extraKeys.slice(1).map((ek, i) => {
            const keyId = `extra${i + 1}`;
            return (
              <button
                key={keyId}
                type="button"
                disabled={disabled}
                onClick={() => handlePress(keyId, ek.onPress)}
                style={{
                  ...s.backspace,
                  transform: pressedKey === keyId ? "scale(0.92)" : "scale(1)",
                  transition: "transform 0.10s ease",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.5 : 1,
                  minHeight: "clamp(44px,11vw,56px)",
                  fontSize: "clamp(1rem,4vw,1.25rem)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {ek.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
