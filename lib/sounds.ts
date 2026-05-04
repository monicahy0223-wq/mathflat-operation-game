/**
 * Synthesized sound effects via Web Audio API.
 * No external files — all sounds are generated procedurally.
 * AudioContext is created lazily on first play() call (browser autoplay policy).
 */

export type SoundEffect = "correct" | "wrong" | "critical" | "skill" | "clear" | "item";

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!_ctx) {
      _ctx = new (
        window.AudioContext ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).webkitAudioContext
      )();
    }
    if (_ctx.state === "suspended") void _ctx.resume();
    return _ctx;
  } catch {
    return null;
  }
}

/** Schedule a single oscillator tone. */
function tone(
  ac:       AudioContext,
  freq:     number,
  start:    number,
  duration: number,
  volume  = 0.28,
  type: OscillatorType = "sine",
  freqEnd?: number,
): void {
  try {
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(freqEnd, 10), // must be > 0
        start + duration,
      );
    }

    // Soft attack → quick decay to avoid clicks
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

    osc.start(start);
    osc.stop(start + duration + 0.05);
  } catch { /* ignore node errors */ }
}

// ─── sound definitions ────────────────────────────────────────────────────────

const SOUND_FNS: Record<SoundEffect, (ac: AudioContext, t: number) => void> = {

  /** 정답: bright double-ding */
  correct(ac, t) {
    tone(ac, 660, t,        0.13, 0.22);
    tone(ac, 880, t + 0.08, 0.10, 0.16);
  },

  /** 오답: short descending buzz */
  wrong(ac, t) {
    tone(ac, 220, t, 0.20, 0.25, "sawtooth", 110);
  },

  /** 대박 공격: three rising harmonics */
  critical(ac, t) {
    tone(ac, 440,  t,        0.07, 0.32);
    tone(ac, 880,  t,        0.11, 0.26);
    tone(ac, 1320, t + 0.05, 0.14, 0.20);
  },

  /** 스킬 발동: low rumble + mid sweep + bright burst */
  skill(ac, t) {
    tone(ac, 110, t,        0.30, 0.30, "sawtooth", 55);
    tone(ac, 330, t + 0.04, 0.24, 0.22, "sine",    165);
    tone(ac, 880, t + 0.02, 0.14, 0.15, "sine",    440);
  },

  /** 스테이지 클리어: ascending four-note fanfare */
  clear(ac, t) {
    ([523, 659, 784, 1047] as const).forEach((freq, i) => {
      tone(ac, freq, t + i * 0.13, 0.28, 0.24);
    });
  },

  /** 아이템 사용: quick two-tone blip */
  item(ac, t) {
    tone(ac, 440, t,        0.06, 0.20);
    tone(ac, 554, t + 0.06, 0.10, 0.16);
  },
};

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Play a synthesized sound effect.
 * Safe to call even when AudioContext is not yet available.
 */
export function playSound(effect: SoundEffect): void {
  const ac = getCtx();
  if (!ac) return;
  try {
    SOUND_FNS[effect](ac, ac.currentTime);
  } catch { /* ignore */ }
}
