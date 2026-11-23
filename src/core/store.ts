import { createStore } from 'zustand/vanilla';
import { safeStorage } from './storage';

export type GraphicsPreset = 'potato' | 'normal' | 'ultra';

export interface Settings {
  profanity: boolean;
  graphics: GraphicsPreset;
  mouseSensitivity: number;
  invertY: boolean;
  masterVolume: number;
  hornVolume: number;
  radioVolume: number;
  subtitles: boolean;
  /** Early-2000s console look: low internal res, chunky pixels, heavier haze. */
  retro: boolean;
}

export interface PlayerState {
  money: number; // rupees
  health: number; // 0-100, shown as chai cups later
}

export interface DebugState {
  visible: boolean;
  timeScale: number;
  paused: boolean;
  physicsWireframe: boolean;
}

export interface GameState {
  settings: Settings;
  player: PlayerState;
  debug: DebugState;
  setSettings: (patch: Partial<Settings>) => void;
  setPlayer: (patch: Partial<PlayerState>) => void;
  setDebug: (patch: Partial<DebugState>) => void;
}

const SETTINGS_KEY = 'gtar.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  profanity: true,
  graphics: 'normal',
  mouseSensitivity: 1,
  invertY: false,
  masterVolume: 0.8,
  hornVolume: 0.8,
  radioVolume: 0.6,
  subtitles: true,
  retro: false,
};

export const store = createStore<GameState>()((set) => ({
  settings: { ...DEFAULT_SETTINGS, ...safeStorage.get<Partial<Settings>>(SETTINGS_KEY, {}) },
  player: { money: 420, health: 100 },
  debug: { visible: false, timeScale: 1, paused: false, physicsWireframe: false },
  setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  setPlayer: (patch) => set((s) => ({ player: { ...s.player, ...patch } })),
  setDebug: (patch) => set((s) => ({ debug: { ...s.debug, ...patch } })),
}));

store.subscribe((s, prev) => {
  if (s.settings !== prev.settings) safeStorage.set(SETTINGS_KEY, s.settings);
});
