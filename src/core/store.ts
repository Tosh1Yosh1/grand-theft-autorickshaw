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
  /** Browser text-to-speech reads the radio hosts. */
  radioVoice: boolean;
}

export type WeaponId = 'fists' | 'chappal' | 'bat' | 'slingshot' | 'belan';

export interface PlayerState {
  money: number; // rupees
  health: number; // 0-100, shown as chai cups
  wanted: number; // 0-5 chappals
  weapons: WeaponId[];
  weapon: WeaponId;
  respect: number;
}

export interface ProgressState {
  completed: string[];
  unlockedVehicles: string[];
  stats: Record<string, number>;
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
  progress: ProgressState;
  debug: DebugState;
  setSettings: (patch: Partial<Settings>) => void;
  setPlayer: (patch: Partial<PlayerState>) => void;
  setProgress: (patch: Partial<ProgressState>) => void;
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
  radioVoice: true,
};

export const store = createStore<GameState>()((set) => ({
  settings: { ...DEFAULT_SETTINGS, ...safeStorage.get<Partial<Settings>>(SETTINGS_KEY, {}) },
  player: { money: 4200, health: 100, wanted: 0, weapons: ['fists', 'chappal'], weapon: 'fists', respect: 0 },
  progress: { completed: [], unlockedVehicles: ['auto'], stats: {} },
  debug: { visible: false, timeScale: 1, paused: false, physicsWireframe: false },
  setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  setPlayer: (patch) => set((s) => ({ player: { ...s.player, ...patch } })),
  setProgress: (patch) => set((s) => ({ progress: { ...s.progress, ...patch } })),
  setDebug: (patch) => set((s) => ({ debug: { ...s.debug, ...patch } })),
}));

store.subscribe((s, prev) => {
  if (s.settings !== prev.settings) safeStorage.set(SETTINGS_KEY, s.settings);
});
