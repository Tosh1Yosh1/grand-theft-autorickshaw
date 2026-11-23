import type * as THREE from 'three';
import { BARK_SPEAKERS, BARKS, type BarkSituation } from '../content/barks';
import { pickLine, type Line } from '../content/lines';
import { store } from '../core/store';
import { showSubtitle } from '../ui/subtitles';

let lastBark = -Infinity;
const HEAR_DISTANCE = 22;

/**
 * NPC says something, as a subtitle. Only if Pappu is close enough to hear and nobody
 * spoke in the last couple of seconds (Mumbhai is loud, but subtitles need to be readable).
 */
export function bark(situation: BarkSituation | readonly Line[], speaker: string, from: THREE.Vector3 | null, listener: THREE.Vector3 | null, force = false): boolean {
  const now = performance.now() / 1000;
  if (!force && now - lastBark < 2.2) return false;
  if (from && listener && from.distanceTo(listener) > HEAR_DISTANCE) return false;
  const s = store.getState().settings;
  if (!s.subtitles) return false;
  lastBark = now;
  const pool = typeof situation === 'string' ? BARKS[situation] : situation;
  showSubtitle(pickLine(pool, s.profanity), BARK_SPEAKERS[speaker] ?? speaker, 3.2);
  return true;
}
