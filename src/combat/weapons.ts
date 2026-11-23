import type { WeaponId } from '../core/store';

export interface WeaponDef {
  id: WeaponId;
  /** Melee reach in metres (0 = ranged). */
  reach: number;
  /** Half-angle of the hit cone, radians. */
  cone: number;
  cooldown: number;
  /** How hard targets fly. */
  force: number;
  /** Damage to NPCs (100 = down for sure). */
  damage: number;
  ranged?: 'chappal' | 'stone';
  /** Belan: everything it touches is KO'd, no questions. */
  oneHit?: boolean;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  fists: { id: 'fists', reach: 1.5, cone: 0.9, cooldown: 0.35, force: 3, damage: 25 },
  chappal: { id: 'chappal', reach: 0, cone: 0, cooldown: 0.9, force: 4, damage: 30, ranged: 'chappal' },
  bat: { id: 'bat', reach: 2.2, cone: 1.1, cooldown: 0.6, force: 7, damage: 50 },
  slingshot: { id: 'slingshot', reach: 0, cone: 0, cooldown: 0.5, force: 3, damage: 35, ranged: 'stone' },
  belan: { id: 'belan', reach: 1.8, cone: 1.0, cooldown: 0.7, force: 10, damage: 999, oneHit: true },
};

export const WEAPON_ORDER: WeaponId[] = ['fists', 'chappal', 'bat', 'slingshot', 'belan'];
