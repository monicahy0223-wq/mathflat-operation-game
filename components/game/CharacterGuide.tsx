"use client";

import { useState, useEffect } from "react";

export const DEFAULT_CHARACTER = "🧍";
export const HERO_IMG = "/assets/character/main.png";

export type CharState = "idle" | "focus" | "success" | "oops";

const CHAR_IMGS: Record<CharState, string> = {
  idle:    "/assets/character/main.png",
  focus:   "/assets/character/focus.png",
  success: "/assets/character/success.png",
  oops:    "/assets/character/oops.png",
};

export function CharacterGuide({
  message,
  charState = "idle",
  size = 72,
  bubbleSide = "right",
  className = "",
}: {
  message:     string;
  charState?:  CharState;
  size?:       number;
  bubbleSide?: "left" | "right";
  className?:  string;
}) {
  const [imgSrc, setImgSrc] = useState(CHAR_IMGS[charState]);

  useEffect(() => {
    setImgSrc(CHAR_IMGS[charState]);
  }, [charState]);

  const handleImgError = () => setImgSrc(HERO_IMG);

  const charEl = (
    <div className="flex-shrink-0">
      <img
        src={imgSrc}
        alt="캐릭터"
        onError={handleImgError}
        className={
          charState === "success" || charState === "oops"
            ? "animate-bounce"
            : charState === "idle"
            ? "animate-idle-float"
            : ""
        }
        style={{
          width:     size,
          height:    size,
          objectFit: "contain",
          display:   "block",
          filter:
            charState === "success" ? "drop-shadow(0 0 10px rgba(16,185,129,0.6))" :
            charState === "oops"    ? "drop-shadow(0 0 10px rgba(239,68,68,0.5))"  :
            charState === "focus"   ? "drop-shadow(0 0 8px rgba(37,99,235,0.5))"   :
                                     "drop-shadow(0 6px 14px rgba(0,0,0,0.15))",
          animationDuration: charState === "idle" ? "2.8s" : "0.75s",
          transition: "filter 0.3s",
        }}
      />
    </div>
  );

  const bubbleEl = (
    <div className="bubble-card relative" style={{ maxWidth: "360px" }}>
      <div
        className="rounded-2xl px-5 py-3.5 bg-white"
        style={{
          boxShadow: "0 8px 28px rgba(79,70,229,0.18), 0 2px 8px rgba(0,0,0,0.1)",
          border:    "2px solid rgba(79,70,229,0.12)",
        }}
      >
        <p className="ty-bubble text-slate-700" style={{ fontSize: "20px" }}>
          {message}
        </p>
      </div>
      {bubbleSide === "right" ? (
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            left:         "-10px",
            width:        0, height: 0,
            borderTop:    "9px solid transparent",
            borderBottom: "9px solid transparent",
            borderRight:  "10px solid #fff",
            filter:       "drop-shadow(-2px 0 2px rgba(79,70,229,0.1))",
          }}
        />
      ) : (
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            right:        "-10px",
            width:        0, height: 0,
            borderTop:    "9px solid transparent",
            borderBottom: "9px solid transparent",
            borderLeft:   "10px solid #fff",
            filter:       "drop-shadow(2px 0 2px rgba(79,70,229,0.1))",
          }}
        />
      )}
    </div>
  );

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {bubbleSide === "right" ? <>{charEl}{bubbleEl}</> : <>{bubbleEl}{charEl}</>}
    </div>
  );
}

export function CharAvatar({
  src,
  size = 56,
  style: extraStyle,
  className = "",
}: {
  src: string;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt="character"
      width={size}
      height={size}
      style={{
        objectFit: "contain",
        display: "block",
        ...extraStyle,
      }}
      className={className}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}
