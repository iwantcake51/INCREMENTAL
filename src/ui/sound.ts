// Tiny synthesized sounds: a chime for big news and a muffled boom for nearby blasts. No audio files.
let ctx: AudioContext | null = null;
let enabled = true;
let lastBoom = 0;

export function setSound(on: boolean) { enabled = on; }

function ac() {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function chime(kind: "good" | "bad" | "neutral" = "neutral") {
  if (!enabled) return;
  try {
    const a = ac(), now = a.currentTime;
    const notes = kind === "bad" ? [392, 311] : kind === "good" ? [523, 659, 784] : [587, 880];
    notes.forEach((f, i) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, now + i * 0.09);
      g.gain.linearRampToValueAtTime(0.08, now + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.6);
      o.connect(g).connect(a.destination); o.start(now + i * 0.09); o.stop(now + i * 0.09 + 0.7);
    });
  } catch { /* audio unavailable */ }
}

export function boom(strength = 0.5) {
  if (!enabled) return;
  const t = performance.now();
  if (t - lastBoom < 120) return;
  lastBoom = t;
  try {
    const a = ac(), now = a.currentTime, len = Math.floor(a.sampleRate * 0.9);
    const buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 3);
    const src = a.createBufferSource(); src.buffer = buf;
    const lp = a.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, now); lp.frequency.exponentialRampToValueAtTime(60, now + 0.8);
    const g = a.createGain(); g.gain.value = 0.12 * strength;
    src.connect(lp).connect(g).connect(a.destination); src.start(now);
  } catch { /* audio unavailable */ }
}
