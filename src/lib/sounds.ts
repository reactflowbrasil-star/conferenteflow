// Sound utilities using WebAudio API (no asset loading needed)
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, gain = 0.25, type: OscillatorType = "sine") {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export function playSuccessBeep() {
  tone(1200, 0, 0.09, 0.3, "triangle");
  tone(1800, 0.07, 0.12, 0.28, "triangle");
  if ("vibrate" in navigator) navigator.vibrate(25);
}

export function playErrorBeep() {
  tone(280, 0, 0.18, 0.35, "sawtooth");
  tone(180, 0.18, 0.25, 0.35, "sawtooth");
  if ("vibrate" in navigator) navigator.vibrate([60, 50, 60]);
}

export function playCompleteFanfare() {
  tone(880, 0, 0.18, 0.4, "square");
  tone(1320, 0.22, 0.18, 0.4, "square");
  tone(1760, 0.44, 0.4, 0.5, "square");
  if ("vibrate" in navigator) navigator.vibrate([120, 60, 120, 60, 240]);
}
