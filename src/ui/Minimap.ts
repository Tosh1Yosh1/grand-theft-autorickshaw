import * as THREE from 'three';
import type { GameContext, GameSystem } from '../core/System';
import { mapToCanvas, renderCityMap } from './cityMap';

const SCALE = 1.2; // px per metre on the base map
const SIZE = 170;
const RANGE = 0.85; // zoom

/** Rotating minimap with cows, cops, missions, objective and landmarks. */
export class Minimap implements GameSystem {
  readonly name = 'minimap';
  readonly priority = 120;
  private ctx!: GameContext;
  private base!: HTMLCanvasElement;
  private canvas!: HTMLCanvasElement;
  private g!: CanvasRenderingContext2D;
  private time = 0;

  init(ctx: GameContext): void {
    this.ctx = ctx;
    this.base = renderCityMap(SCALE);
    const wrap = document.createElement('div');
    wrap.className = 'minimap';
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE * 2;
    wrap.append(this.canvas);
    document.getElementById('overlay')!.append(wrap);
    this.g = this.canvas.getContext('2d')!;
  }

  update(dt: number): void {
    this.time += dt;
    const s = this.ctx.services;
    const focus = s.vehicles?.current?.position ?? s.player?.position;
    if (!focus) return;
    const yaw = s.camera?.yaw ?? 0;
    const g = this.g;
    const W = SIZE * 2;
    g.save();
    g.clearRect(0, 0, W, W);
    g.beginPath();
    g.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
    g.clip();
    g.translate(W / 2, W / 2);
    g.rotate(yaw);
    g.scale(RANGE, RANGE);
    const px = mapToCanvas(focus.x, SCALE);
    const pz = mapToCanvas(focus.z, SCALE);
    g.drawImage(this.base, -px, -pz);
    const dot = (p: THREE.Vector3, color: string, r = 4, label?: string) => {
      const x = mapToCanvas(p.x, SCALE) - px;
      const y = mapToCanvas(p.z, SCALE) - pz;
      g.fillStyle = color;
      g.beginPath();
      g.arc(x, y, r / RANGE, 0, Math.PI * 2);
      g.fill();
      if (label) {
        g.save();
        g.translate(x, y);
        g.rotate(-yaw);
        g.fillStyle = '#000';
        g.font = `bold ${11 / RANGE}px Arial`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(label, 0, 1);
        g.restore();
      }
    };
    const lm = s.city?.landmarks;
    if (lm) {
      dot(lm.safehouse, '#ffd6a5', 8, 'H');
      dot(lm.dentingPainting, '#90e0ef', 8, 'P');
      dot(lm.netaOffice, '#ffffff', 8, 'N');
    }
    // Cows are important map information in Mumbhai.
    for (const c of s.animals?.cows ?? []) dot(c.pos, '#f1ede4', 5, 'C');
    const flash = Math.sin(this.time * 10) > 0;
    for (const p of s.peds?.peds ?? []) if (p.type === 'cop' || p.type === 'squad') dot(p.pos, flash ? '#ff3b30' : '#2a5cff', 4);
    for (const v of s.vehicles?.vehicles ?? []) if (v.ai) dot(v.position, flash ? '#2a5cff' : '#ff3b30', 6);
    const missions = s.missions;
    if (missions && !missions.run) for (const d of missions.available()) if (lm) dot(d.start({ landmarks: lm }), '#ff9f1c', 8, '!');
    const target = missions?.currentTarget();
    if (target) dot(target, '#ffd60a', 8, '★');
    const wp = s.phone?.waypoint;
    if (wp) dot(wp, '#ff4d6d', 7, 'W');
    g.restore();
    // Player arrow (always points up = camera forward).
    const heading = s.vehicles?.current?.heading ?? s.player?.heading ?? 0;
    g.save();
    g.translate(W / 2, W / 2);
    g.rotate(yaw - heading + Math.PI);
    g.fillStyle = '#ffd60a';
    g.strokeStyle = '#000';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -12);
    g.lineTo(8, 9);
    g.lineTo(0, 4);
    g.lineTo(-8, 9);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    // North marker.
    g.save();
    g.translate(W / 2, W / 2);
    g.rotate(yaw);
    g.fillStyle = '#fff';
    g.font = 'bold 20px Arial';
    g.textAlign = 'center';
    g.fillText('N', 0, -W / 2 + 22);
    g.restore();
  }
}
