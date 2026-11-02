/**
 * Tiny synthesized sound kit — no audio files. Every sound is built from oscillators and
 * filtered noise, routed through a soft convolution reverb so it all sits in the same "room".
 */
type Wave = OscillatorType;

interface ToneOpts {
  freq: number;
  to?: number; // glide target
  type?: Wave;
  attack?: number;
  decay?: number;
  gain?: number;
  when?: number;
  wet?: number;
  detune?: number;
}

// Major pentatonic — any sequence of these notes sounds pleasant, so rapid clicks become a melody.
const PENTA = [0, 2, 4, 7, 9];
const C5 = 523.25;
const note = (semi: number) => C5 * 2 ** (semi / 12);

class SoundKit {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private dry!: GainNode;
  private wetBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private volume = 0.5;
  private muted = false;

  setVolume(volume: number, muted: boolean): void {
    this.volume = volume;
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : volume * volume, this.ctx.currentTime, 0.03);
  }

  /** Must be called from a user gesture (browsers block autoplay). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume * this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    this.dry = ctx.createGain();
    this.dry.connect(this.master);
    const verb = ctx.createConvolver();
    verb.buffer = this.impulse(1.8, 2.6);
    this.wetBus = ctx.createGain();
    this.wetBus.gain.value = 0.32;
    this.wetBus.connect(verb).connect(this.master);

    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
    }
    return buf;
  }

  private ready(): AudioContext | null {
    if (!this.ctx || this.muted || this.volume <= 0) return null;
    if (this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  /**
   * Smooth limiter for rapid sounds. Instead of a hard per-second cap (which made fast
   * tapping go silent and then come back), it only enforces a tiny gap between voices
   * and returns a gain factor that ducks gently as the tap rate climbs.
   */
  private rate = 0; // exponentially smoothed sounds per second
  private lastAt = 0;
  private duck(minGapMs = 22): number {
    const now = performance.now();
    const dt = Math.max(1, now - this.lastAt);
    if (dt < minGapMs) return 0;
    this.lastAt = now;
    this.rate = this.rate * Math.exp(-dt / 400) + 1000 / 400;
    // ~1.0 up to 8 taps/s, easing down to ~0.45 around 30 taps/s
    return Math.max(0.45, Math.min(1, 1.25 - this.rate / 32));
  }

  /** UI sounds (buys, ticks) get their own small gap so they never steal a tap's slot. */
  private lastUi = 0;
  private allow(): boolean {
    const now = performance.now();
    if (now - this.lastUi < 14) return false;
    this.lastUi = now;
    return true;
  }

  private tone(o: ToneOpts): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + (o.when ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.detune) osc.detune.value = o.detune;
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.decay ?? 0.2));
    const attack = o.attack ?? 0.004;
    const decay = o.decay ?? 0.2;
    const peak = o.gain ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    osc.connect(g);
    g.connect(this.dry);
    if (o.wet) {
      const w = ctx.createGain();
      w.gain.value = o.wet;
      g.connect(w).connect(this.wetBus);
    }
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
  }

  private noise(o: { when?: number; decay?: number; gain?: number; freq?: number; q?: number; type?: BiquadFilterType; sweepTo?: number; wet?: number; attack?: number }): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + (o.when ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.frequency.setValueAtTime(o.freq ?? 2000, t);
    if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t + (o.decay ?? 0.2));
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    const attack = o.attack ?? 0.002;
    const decay = o.decay ?? 0.15;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(f).connect(g).connect(this.dry);
    if (o.wet) {
      const w = ctx.createGain();
      w.gain.value = o.wet;
      g.connect(w).connect(this.wetBus);
    }
    src.start(t, Math.random() * 0.5);
    src.stop(t + attack + decay + 0.05);
  }

  /* ------------------------------------------------------------- sounds */

  tapSounds = true;

  click(combo: number, crit: boolean): void {
    if (!this.ready() || !this.tapSounds) return;
    const v = this.duck();
    if (v <= 0) return;
    const step = Math.min(14, Math.floor(combo / 3));
    const semi = PENTA[step % 5] + 12 * Math.floor(step / 5) - 12;
    const f = note(semi);
    // a water "bloop" (fast upward pitch sweep) under a glassy note on the scale
    this.tone({ freq: 180 + Math.random() * 40, to: 520 + Math.random() * 120, decay: 0.06, gain: 0.13 * v, type: 'sine' });
    this.tone({ freq: f, decay: 0.2, gain: 0.07 * v, type: 'triangle', wet: 0.5 });
    if (v > 0.7) this.tone({ freq: f * 2, decay: 0.1, gain: 0.022 * v, type: 'sine', detune: 6, wet: 0.3 });
    if (v > 0.7) this.noise({ decay: 0.03, gain: 0.025, freq: 1400, q: 3 });
    if (crit) {
      this.tone({ freq: f * 1.5, decay: 0.5, gain: 0.08, type: 'sine', wet: 0.8, when: 0.02 });
      this.tone({ freq: f * 3, decay: 0.35, gain: 0.04, type: 'sine', wet: 0.8, when: 0.04 });
      this.noise({ decay: 0.25, gain: 0.07, freq: 7000, q: 2, wet: 0.5 });
    }
  }

  buy(count = 1): void {
    if (!this.ready() || !this.allow()) return;
    // a muffled metal clunk, like a hatch closing, then a bright tick
    this.tone({ freq: 190, to: 120, decay: 0.09, gain: 0.14, type: 'triangle' });
    this.tone({ freq: 880, decay: 0.18, gain: 0.05, type: 'sine', when: 0.03, wet: 0.5 });
    if (count > 1) this.tone({ freq: 1320, decay: 0.2, gain: 0.04, type: 'sine', when: 0.07, wet: 0.5 });
    this.noise({ decay: 0.04, gain: 0.06, freq: 1800, q: 1.5 });
  }

  denied(): void {
    if (!this.ready() || !this.allow()) return;
    this.tone({ freq: 140, to: 95, decay: 0.12, gain: 0.14, type: 'triangle' });
    this.tone({ freq: 147, to: 100, decay: 0.12, gain: 0.08, type: 'square', when: 0.005 });
  }

  upgrade(): void {
    if (!this.ready()) return;
    [0, 4, 7, 12].forEach((s, i) => this.tone({ freq: note(s), decay: 0.3, gain: 0.07, type: 'triangle', when: i * 0.045, wet: 0.6 }));
  }

  skill(): void {
    if (!this.ready()) return;
    this.tone({ freq: note(-12), decay: 0.6, gain: 0.12, type: 'sine', wet: 0.6 });
    [7, 12, 16, 19].forEach((s, i) => this.tone({ freq: note(s), decay: 0.6, gain: 0.05, type: 'sine', when: 0.05 + i * 0.06, wet: 0.9 }));
    this.noise({ decay: 0.5, gain: 0.04, freq: 6000, sweepTo: 12000, q: 3, wet: 1 });
  }

  achievement(): void {
    if (!this.ready()) return;
    [[0, 0], [4, 0.09], [7, 0.18], [12, 0.3]].forEach(([s, w]) => {
      this.tone({ freq: note(s), decay: 0.45, gain: 0.08, type: 'triangle', when: w, wet: 0.7 });
      this.tone({ freq: note(s + 12), decay: 0.3, gain: 0.02, type: 'sine', when: w, wet: 0.7 });
    });
  }

  cometSpawn(): void {
    if (!this.ready()) return;
    // little ascending bubble trill
    [0, 1, 2, 3].forEach((i) => this.tone({ freq: 300 + i * 90, to: 700 + i * 120, decay: 0.05, gain: 0.04, type: 'sine', when: i * 0.07 }));
    this.tone({ freq: note(19), decay: 0.8, gain: 0.025, type: 'sine', when: 0.3, wet: 1 });
  }

  cometCatch(): void {
    if (!this.ready()) return;
    [12, 16, 19, 24, 28].forEach((s, i) => this.tone({ freq: note(s), decay: 0.4, gain: 0.06, type: 'sine', when: i * 0.035, wet: 0.9 }));
    this.noise({ decay: 0.4, gain: 0.08, freq: 8000, q: 1.5, wet: 0.6 });
  }

  /** A distant whale-like call, then a soft chord. */
  event(good: boolean): void {
    if (!this.ready()) return;
    this.tone({ freq: 210, to: 140, attack: 0.35, decay: 1.6, gain: 0.07, type: 'sine', wet: 1 });
    this.tone({ freq: 140, to: 260, attack: 0.3, decay: 1.2, gain: 0.05, type: 'sine', when: 1.1, wet: 1 });
    const chord = good ? [0, 4, 7, 11] : [0, 3, 7, 10];
    chord.forEach((s, i) => this.tone({ freq: note(s - 12), attack: 0.2, decay: 1.4, gain: 0.035, type: 'triangle', when: 0.4 + i * 0.09, wet: 1 }));
  }

  /** Sinking: a pressure rumble, rushing water, then a sonar ping from far below. */
  rebirth(): void {
    if (!this.ready()) return;
    this.tone({ freq: 70, to: 32, decay: 2.4, gain: 0.32, type: 'sine' });
    this.noise({ decay: 2.2, attack: 0.05, gain: 0.22, freq: 1800, sweepTo: 90, q: 0.7, type: 'lowpass', wet: 1 });
    this.tone({ freq: note(7), decay: 1.6, gain: 0.06, type: 'sine', when: 1.3, wet: 1 });
    this.tone({ freq: note(7), decay: 1.2, gain: 0.025, type: 'sine', when: 2.1, wet: 1 });
  }

  /** The lure flares: a rising rush into a bright major chord. */
  flare(): void {
    if (!this.ready()) return;
    this.noise({ decay: 0.9, attack: 0.35, gain: 0.1, freq: 400, sweepTo: 6000, q: 1.2, wet: 0.8 });
    this.tone({ freq: 110, to: 440, attack: 0.3, decay: 0.5, gain: 0.12, type: 'sawtooth', wet: 0.5 });
    [0, 4, 7, 12, 16].forEach((s, i) => this.tone({ freq: note(s), attack: 0.02, decay: 1.2, gain: 0.06, type: 'triangle', when: 0.32 + i * 0.03, wet: 1 }));
  }

  /** Air bubble collected: a quick rising pop. */
  bubble(): void {
    if (!this.ready() || !this.allow()) return;
    this.tone({ freq: 320, to: 900, decay: 0.08, gain: 0.08, type: 'sine', wet: 0.4 });
    this.tone({ freq: 640, to: 1400, decay: 0.06, gain: 0.04, type: 'sine', when: 0.05, wet: 0.4 });
  }

  /** Hull hit: a heavy metallic thud. */
  hurt(): void {
    if (!this.ready()) return;
    this.tone({ freq: 120, to: 45, decay: 0.35, gain: 0.3, type: 'sine' });
    this.tone({ freq: 230, to: 160, decay: 0.25, gain: 0.08, type: 'square', wet: 0.5 });
    this.noise({ decay: 0.25, gain: 0.12, freq: 900, q: 0.8, type: 'lowpass' });
  }

  /** Dash: a rush of water. */
  dash(): void {
    if (!this.ready()) return;
    this.noise({ decay: 0.35, attack: 0.02, gain: 0.12, freq: 2500, sweepTo: 400, q: 0.8, wet: 0.4 });
    this.tone({ freq: 180, to: 90, decay: 0.25, gain: 0.08, type: 'sine' });
  }

  /** Eel coil zap. */
  zap(): void {
    if (!this.ready()) return;
    this.tone({ freq: 1600, to: 300, decay: 0.15, gain: 0.05, type: 'sawtooth' });
    this.noise({ decay: 0.12, gain: 0.06, freq: 6000, q: 2 });
  }

  /** Low air alarm: two short beeps. */
  alarm(): void {
    if (!this.ready()) return;
    this.tone({ freq: 880, decay: 0.12, gain: 0.07, type: 'square' });
    this.tone({ freq: 880, decay: 0.12, gain: 0.07, type: 'square', when: 0.2 });
  }

  tick(): void {
    if (!this.ready() || !this.allow()) return;
    this.tone({ freq: 1800, decay: 0.03, gain: 0.03, type: 'sine' });
  }
}

export const sound = new SoundKit();
