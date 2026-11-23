import { ADS, STATIONS, type Station } from '../content/radio';
import { resolveLine, type Line } from '../content/lines';
import type { GameContext, GameSystem } from '../core/System';
import { audio } from './AudioManager';
import { MusicEngine } from './MusicEngine';

type Segment = { kind: 'song'; title: string; artist: string; lyrics: Line[] } | { kind: 'host'; line: Line } | { kind: 'ad'; line: Line };

/**
 * In-vehicle radio. R cycles stations (and off). Each station = generative music + a host
 * reading original scripts (optional browser TTS) + parody ads. Text shows on a ticker.
 */
export class Radio implements GameSystem {
  readonly name = 'radio';
  /** -1 = off. */
  station = 0;
  private ctx!: GameContext;
  private music: MusicEngine | null = null;
  private playing: number | null = null;
  private segment: Segment | null = null;
  private segTime = 0;
  private lineIndex = 0;
  private ticker!: HTMLDivElement;
  private queue: Segment[] = [];

  init(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.services.radio = this;
    this.ticker = document.createElement('div');
    this.ticker.className = 'radio-ticker';
    document.getElementById('overlay')!.append(this.ticker);
  }

  get current(): Station | null {
    return this.station >= 0 ? STATIONS[this.station]! : null;
  }

  next(): void {
    this.station = this.station + 1 >= STATIONS.length ? -1 : this.station + 1;
    audio.beep(this.station < 0 ? 300 : 1200, 0.04, 0.06);
  }

  private stopAll(): void {
    this.music?.stop();
    this.music = null;
    this.playing = null;
    this.segment = null;
    this.queue = [];
    this.speak(null);
    this.ticker.classList.remove('show');
  }

  private buildQueue(st: Station): void {
    const segs: Segment[] = [];
    const hosts = [...st.lines].sort(() => Math.random() - 0.5);
    const songs = [...(st.songs ?? [])].sort(() => Math.random() - 0.5);
    for (let i = 0; i < 4; i++) {
      if (songs[i]) segs.push({ kind: 'song', ...songs[i]! });
      segs.push({ kind: 'host', line: hosts[(i * 2) % hosts.length]! });
      segs.push({ kind: 'host', line: hosts[(i * 2 + 1) % hosts.length]! });
      segs.push({ kind: 'ad', line: ADS[Math.floor(Math.random() * ADS.length)]! });
    }
    this.queue = segs;
  }

  update(dt: number): void {
    const s = this.ctx.services;
    const inVehicle = !!s.vehicles?.current;
    if (inVehicle && this.ctx.input.wasPressed('radio') && this.ctx.clock.scale !== 0) this.next();
    const want = inVehicle ? this.station : -1;
    const ac = audio.context;
    if (want !== this.playing) {
      this.stopAll();
      if (want >= 0 && ac && audio.radio) {
        const st = STATIONS[want]!;
        this.music = new MusicEngine(ac, audio.radio, st.style, [196, 220, 174, 233, 207][want % 5]);
        this.music.start();
        this.playing = want;
        this.buildQueue(st);
      }
    }
    if (this.playing === null) return;
    const st = STATIONS[this.playing]!;
    this.segTime -= dt;
    if (!this.segment || this.segTime <= 0) this.nextSegment(st);
    if (this.segment?.kind === 'song') {
      const lyr = this.segment.lyrics;
      const i = Math.floor((24 - this.segTime) / 6) % lyr.length;
      if (i !== this.lineIndex) {
        this.lineIndex = i;
        this.show(st, `♪ ${this.segment.title} — ${this.segment.artist}`, resolveLine(lyr[i]!, this.profanity));
      }
    }
  }

  private get profanity(): boolean {
    return this.ctx.store.getState().settings.profanity;
  }

  private nextSegment(st: Station): void {
    if (!this.queue.length) this.buildQueue(st);
    this.segment = this.queue.shift()!;
    if (this.segment.kind === 'song') {
      this.segTime = 24;
      this.lineIndex = -1;
      this.music?.setLevel(0.6);
      this.speak(null);
    } else {
      const text = resolveLine(this.segment.line, this.profanity);
      this.segTime = Math.max(5, text.length * 0.075);
      this.music?.setLevel(0.18);
      this.show(st, this.segment.kind === 'ad' ? '📢 Vigyapan' : `🎙 ${st.host}`, text);
      this.speak(text);
    }
  }

  private show(st: Station, title: string, text: string): void {
    this.ticker.innerHTML = `<div class="rt-station" style="color:${st.color}">📻 ${st.freq} ${st.name}</div><div class="rt-title">${title}</div><div class="rt-text">${text}</div>`;
    this.ticker.classList.add('show');
  }

  /** Browser text-to-speech for hosts and ads (if enabled). Pass null to stop. */
  private speak(text: string | null): void {
    const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
    if (!synth) return;
    synth.cancel();
    const settings = this.ctx.store.getState().settings;
    if (!text || !settings.radioVoice) return;
    const u = new SpeechSynthesisUtterance(text.replace(/[^\p{L}\p{N}\s.,!?'₹-]/gu, ''));
    const voice = synth.getVoices().find((v) => v.lang === 'en-IN') ?? synth.getVoices().find((v) => v.lang.startsWith('hi'));
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? 'en-IN';
    u.rate = 1.05;
    u.pitch = this.segment?.kind === 'ad' ? 1.4 : 1.1;
    u.volume = settings.radioVolume * settings.masterVolume;
    synth.speak(u);
  }
}
