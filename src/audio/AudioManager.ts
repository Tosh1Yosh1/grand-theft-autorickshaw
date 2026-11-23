import { store } from '../core/store';

/**
 * Procedural sound (WebAudio). No audio files yet: horns, engines and thuds are synthesized.
 * Real CC0 recordings can replace these later (see TODO_ASSETS.md); howler.js will load those.
 */
export type HornKind = 'auto' | 'car' | 'bike' | 'truck' | 'bus' | 'cart';

const HORNS: Record<HornKind, { freqs: number[]; wave: OscillatorType; cutoff: number }> = {
  auto: { freqs: [392, 494], wave: 'square', cutoff: 2600 },
  car: { freqs: [415, 523], wave: 'sawtooth', cutoff: 3000 },
  bike: { freqs: [587, 740], wave: 'square', cutoff: 3500 },
  truck: { freqs: [196, 247, 294], wave: 'sawtooth', cutoff: 1800 },
  bus: { freqs: [220, 277], wave: 'sawtooth', cutoff: 1600 },
  cart: { freqs: [880], wave: 'triangle', cutoff: 5000 }, // a bell. Moo not included.
};

class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private hornBus!: GainNode;
  private sfx!: GainNode;
  readonly radio: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  /** Call from any user gesture; browsers block audio until then. */
  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return; // no audio, no problem
      }
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.hornBus = this.gain(this.master);
      this.sfx = this.gain(this.master);
      (this as { radio: GainNode | null }).radio = this.gain(this.master);
      this.applyVolumes();
      store.subscribe((s, p) => s.settings !== p.settings && this.applyVolumes());
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  private gain(to: AudioNode): GainNode {
    const g = this.ctx!.createGain();
    g.connect(to);
    return g;
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const s = store.getState().settings;
    this.master.gain.value = s.masterVolume;
    this.hornBus.gain.value = s.hornVolume;
    this.sfx.gain.value = 1;
    if (this.radio) this.radio.gain.value = s.radioVolume;
  }

  /** Start a horn; call the returned function to stop it. */
  horn(kind: HornKind): () => void {
    const ctx = this.ctx;
    if (!ctx) return () => {};
    const spec = HORNS[kind];
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.02);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = spec.cutoff;
    lp.connect(out);
    out.connect(this.hornBus);
    const oscs = spec.freqs.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = spec.wave;
      o.frequency.value = f;
      o.detune.value = i * 7;
      o.connect(lp);
      o.start();
      return o;
    });
    if (kind === 'cart') out.gain.setTargetAtTime(0, ctx.currentTime + 0.05, 0.25); // bell decays by itself
    return () => {
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setTargetAtTime(0, t, 0.03);
      oscs.forEach((o) => o.stop(t + 0.2));
    };
  }

  /** Low thump + rattle, for potholes and crashes. intensity 0..1 */
  thud(intensity: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 300 + intensity * 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5 * Math.min(1, intensity + 0.2), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    src.connect(lp).connect(g).connect(this.sfx);
    src.start(t);
    src.stop(t + 0.4);
  }

  /** Short beep for UI, meter clicks, phone. */
  beep(freq = 880, duration = 0.08, volume = 0.15): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + duration + 0.02);
  }

  /** A continuous engine voice. Set rpm 0..1 every frame; stop() when done. */
  engine(kind: 'twoStroke' | 'petrol' | 'diesel'): { set(rpm: number, load: number): void; stop(): void } {
    const ctx = this.ctx;
    if (!ctx) return { set() {}, stop() {} };
    const base = kind === 'twoStroke' ? 38 : kind === 'diesel' ? 30 : 45;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const putt = ctx.createOscillator(); // amplitude flutter: the "phat-phat"
    putt.type = 'square';
    const puttGain = ctx.createGain();
    puttGain.gain.value = kind === 'twoStroke' ? 0.5 : 0.2;
    const amp = ctx.createGain();
    amp.gain.value = 0.5;
    putt.connect(puttGain).connect(amp.gain);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const out = ctx.createGain();
    out.gain.value = 0.0;
    o.connect(amp).connect(lp).connect(out).connect(this.sfx);
    o.start();
    putt.start();
    out.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.3);
    return {
      set(rpm, load) {
        const t = ctx.currentTime;
        o.frequency.setTargetAtTime(base + rpm * base * 3.2, t, 0.05);
        putt.frequency.setTargetAtTime(base * 0.5 + rpm * base * 1.6, t, 0.05);
        lp.frequency.setTargetAtTime(500 + load * 1500 + rpm * 800, t, 0.05);
        out.gain.setTargetAtTime(0.08 + load * 0.08, t, 0.1);
      },
      stop() {
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(0, t, 0.08);
        o.stop(t + 0.5);
        putt.stop(t + 0.5);
      },
    };
  }

  private noiseBuffer(): AudioBuffer {
    if (!this.noise) {
      const ctx = this.ctx!;
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }
}

export const audio = new AudioManagerImpl();
