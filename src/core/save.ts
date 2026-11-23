import type { GameContext } from './System';
import { safeStorage } from './storage';
import type { PlayerState, ProgressState } from './store';

const KEY = 'gtar.save.v1';

interface SaveData {
  v: 1;
  savedAt: number;
  player: Omit<PlayerState, 'wanted'>;
  progress: ProgressState;
  hour: number;
}

export function hasSave(): boolean {
  return safeStorage.get<SaveData | null>(KEY, null) !== null;
}

export function saveGame(ctx: GameContext): boolean {
  const st = ctx.store.getState();
  const { wanted: _w, ...player } = st.player;
  void _w;
  const data: SaveData = { v: 1, savedAt: Date.now(), player, progress: st.progress, hour: ctx.services.dayNight?.hour ?? 9 };
  return safeStorage.set(KEY, data);
}

/** Restores progress; Pappu always wakes up at Pandey Niwas. */
export function loadGame(ctx: GameContext): boolean {
  const data = safeStorage.get<SaveData | null>(KEY, null);
  if (!data || data.v !== 1) return false;
  const st = ctx.store.getState();
  st.setPlayer({ ...data.player, wanted: 0 });
  st.setProgress(data.progress);
  if (ctx.services.dayNight) ctx.services.dayNight.hour = data.hour;
  const home = ctx.services.city?.landmarks.safehouse;
  if (home) ctx.services.player?.teleport(home.clone().setY(0.3));
  return true;
}

export function deleteSave(): void {
  safeStorage.remove(KEY);
}

export function saveInfo(): string | null {
  const data = safeStorage.get<SaveData | null>(KEY, null);
  if (!data) return null;
  return `${new Date(data.savedAt).toLocaleString()} · ${data.progress.completed.length} missions`;
}
