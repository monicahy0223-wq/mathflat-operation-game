"use client";

export function FeedbackOverlay({ feedback }: { feedback: string }) {
  const style = (() => {
    if (feedback.includes("반격") || feedback.includes("시들") || feedback.includes("틀렸어"))
                                   return { bg: "linear-gradient(135deg,#ef4444,#b91c1c)", glow: "rgba(239,68,68,0.6)",   icon: "💢" };
    if (feedback.includes("아쉽다"))  return { bg: "linear-gradient(135deg,#f97316,#ea580c)", glow: "rgba(249,115,22,0.6)",  icon: "💪" };
    if (feedback.includes("스킬"))    return { bg: "linear-gradient(135deg,#f97316,#dc2626)", glow: "rgba(249,115,22,0.7)",  icon: "💥" };
    if (feedback.includes("대박") || feedback.includes("활짝") || feedback.includes("완벽"))
                                   return { bg: "linear-gradient(135deg,#f59e0b,#d97706)", glow: "rgba(245,158,11,0.7)",  icon: "⚡" };
    if (feedback.includes("콤보") || feedback.includes("연속"))
                                   return { bg: "linear-gradient(135deg,#f97316,#ea580c)", glow: "rgba(249,115,22,0.6)",  icon: "🔥" };
    if (feedback.includes("오답 해결")) return { bg: "linear-gradient(135deg,#8b5cf6,#6d28d9)", glow: "rgba(139,92,246,0.7)", icon: "🌟" };
    if (feedback.includes("보호막"))    return { bg: "linear-gradient(135deg,#3b82f6,#1d4ed8)", glow: "rgba(59,130,246,0.7)",  icon: "🛡️" };
    if (feedback.includes("+10초"))     return { bg: "linear-gradient(135deg,#10b981,#047857)", glow: "rgba(16,185,129,0.7)",  icon: "⏰" };
    if (feedback.includes("폭탄"))      return { bg: "linear-gradient(135deg,#f97316,#b45309)", glow: "rgba(249,115,22,0.7)",  icon: "💣" };
    if (feedback.includes("❌"))        return { bg: "linear-gradient(135deg,#ef4444,#b91c1c)", glow: "rgba(239,68,68,0.6)",   icon: "💢" };
    return                                      { bg: "linear-gradient(135deg,#22c55e,#16a34a)", glow: "rgba(34,197,94,0.5)",   icon: "✨" };
  })();

  return (
    <div
      className="animate-feedback-burst fixed z-[150] pointer-events-none select-none"
      style={{ top: "42%", left: "50%" }}
    >
      <div
        className="rounded-3xl px-8 py-5 text-center"
        style={{
          background: style.bg,
          boxShadow: `0 0 0 6px rgba(255,255,255,0.15), 0 8px 40px ${style.glow}`,
          minWidth: "200px",
        }}
      >
        <div style={{ fontSize: (feedback.includes("대박") || feedback.includes("활짝") || feedback.includes("완벽")) ? "3.4rem" : "2.8rem", lineHeight: 1 }}>
          {style.icon}
        </div>
        <div
          className="font-black text-white mt-1 leading-tight"
          style={{
            fontSize: feedback.includes("대박")
              ? "clamp(2rem, 7.5vw, 2.8rem)"
              : "clamp(1.6rem, 6vw, 2.2rem)",
            textShadow: feedback.includes("대박")
              ? "0 0 20px rgba(255,255,255,0.8), 0 2px 8px rgba(0,0,0,0.4)"
              : "0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          {feedback}
        </div>
      </div>
    </div>
  );
}
