import type { MusicStyle } from '../content/radio';

/** Pentatonic-ish scales (semitones from root). Purely musical, no samples, no copyrighted melodies. */
const SCALES: Record<MusicStyle, number[]> = {
  filmy: [0, 1, 4, 5, 7, 8, 11, 12],
  stadium: [0, 4, 7, 12],
  drone: [0, 7, 12],
  sitarish: [0, 2, 3, 5, 7, 9, 10, 12],
  lofi: [0, 3, 5, 7, 10, 12],
  jingle: [0, 4, 7, 9, 12],
};
const BPM: Record<MusicStyle, number> = { filmy: 104, stadium: 60, drone: 50, sitarish: 84, lofi: 78, jingle: 130 };

/**
 * Generative background music for radio stations. A tiny step sequencer with
 * look-ahead scheduling on the WebAudio clock.
 */
export class MusicEngine {
  private timer = 0;
  private nextTime = 0;
  private step = 0;
  private melodyNote = 0;
  private drone: OscillatorNode[] = [];
  private crowd: AudioBufferSourceNode | null = null;
  private readonly out: GainNode;

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
    private style: MusicStyle,
    private readonly root = 196,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = 0.5;
    this.out.connect(destination);
  }

  start(): void {
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(), 50);
    if (this.style === 'drone') this.startDrone();
    if (this.style === 'stadium') this.startCrowd();
  }

  /** Duck under host speech. */
  setLevel(level: number): void {
    this.out.gain.setTargetAtTime(level, this.ctx.currentTime, 0.2);
  }

  stop(): void {
    clearInterval(this.timer);
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.1);
    for (const o of this.drone) o.stop(t + 0.5);
    this.crowd?.stop(t + 0.5);
    setTimeout(() => this.out.disconnect(), 800);
  }

  private freq(degree: number, octave = 0): number {
    const sc = SCALES[this.style];
    const n = sc[((degree % sc.length) + sc.length) % sc.length]! + 12 * (octave + Math.floor(degree / sc.length));
    return this.root * Math.pow(2, n / 12);
  }

  private schedule(): void {
    const stepDur = 60 / BPM[this.style] / 4; // 16th notes
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(s: number, t: number, dur: number): void {
    const beat = s % 16;
    switch (this.style) {
      case 'filmy':
        // Dhol: dha . . dhin . dhin dha . (repeat)
        if ([0, 6, 8].includes(beat)) this.drum(t, 70, 0.5);
        if ([3, 10, 14].includes(beat)) this.slap(t, 0.25);
        if (s % 2 === 0) this.walkMelody(t, dur * 2, 'square', 0.07, 1);
        if (beat === 0) this.pad(t, dur * 16, [0, 2, 4]);
        break;
      case 'lofi':
        if (beat === 0 || beat === 10) this.drum(t, 55, 0.45);
        if (beat === 4 || beat === 12) this.slap(t, 0.12);
        if (s % 2 === 1) this.hat(t, 0.04);
        if (beat === 0) this.pad(t, dur * 16, [0, 2, 4, 6], 'sine', 0.05);
        break;
      case 'sitarish':
        if (Math.random() < 0.45) this.pluck(t, this.walk(), 0.12);
        if (beat === 0) this.drum(t, 90, 0.2);
        break;
      case 'drone':
        if (s % 32 === 0) this.bell(t, this.freq(Math.floor(Math.random() * 3) * 2, 2));
        break;
      case 'stadium':
        if (beat === 0 && Math.random() < 0.2) this.drum(t, 60, 0.3); // the lone drummer in the stands
        break;
      case 'jingle':
        if (s % 2 === 0) this.walkMelody(t, dur * 2, 'triangle', 0.09, 1);
        if (beat % 4 === 0) this.drum(t, 80, 0.35);
        break;
    }
  }

  private walk(): number {
    this.melodyNote = Math.max(0, Math.min(10, this.melodyNote + Math.floor(Math.random() * 5) - 2));
    return this.freq(this.melodyNote, 1);
  }

  private walkMelody(t: number, dur: number, wave: OscillatorType, vol: number, octave: number): void {
    if (Math.random() < 0.25) return; // rests make it musical-ish
    this.melodyNote = Math.max(0, Math.min(10, this.melodyNote + Math.floor(Math.random() * 5) - 2));
    this.tone(t, this.freq(this.melodyNote, octave), dur * 0.9, wave, vol);
  }

  private tone(t: number, f: number, dur: number, wave: OscillatorType, vol: number): void {
    const o = this.ctx.createOscillator();
    o.type = wave;
    o.frequency.value = f;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private pad(t: number, dur: number, degrees: number[], wave: OscillatorType = 'triangle', vol = 0.035): void {
    for (const d of degrees) {
      const o = this.ctx.createOscillator();
      o.type = wave;
      o.frequency.value = this.freq(d, 0) / 2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.3);
      g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(g).connect(this.out);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  private pluck(t: number, f: number, vol: number): void {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 1.01, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4000, t);
    lp.frequency.exponentialRampToValueAtTime(600, t + 0.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(lp).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.65);
  }

  private bell(t: number, f: number): void {
    for (const [mult, v] of [[1, 0.06], [2.76, 0.03], [5.4, 0.015]] as const) this.tone(t, f * mult, 2.5, 'sine', v);
  }

  private drum(t: number, f: number, vol: number): void {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(f * 2, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.15);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.3);
  }

  private noise(): AudioBuffer {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  private slap(t: number, vol: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(bp).connect(g).connect(this.out);
    src.start(t);
    src.stop(t + 0.15);
  }

  private hat(t: number, vol: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise();
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(hp).connect(g).connect(this.out);
    src.start(t);
    src.stop(t + 0.06);
  }

  private startDrone(): void {
    for (const [f, v] of [[this.root / 2, 0.05], [(this.root / 2) * 1.5, 0.035], [this.root, 0.025]] as const) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      const g = this.ctx.createGain();
      g.gain.value = v;
      o.connect(lp).connect(g).connect(this.out);
      o.start();
      this.drone.push(o);
    }
  }

  private startCrowd(): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise();
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.6;
    const g = this.ctx.createGain();
    g.gain.value = 0.08;
    src.connect(bp).connect(g).connect(this.out);
    src.start();
    this.crowd = src;
  }
}
