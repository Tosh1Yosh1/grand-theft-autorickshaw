import * as THREE from 'three';
import type { GameContext, GameSystem } from '../System';

/**
 * Phase 0 stand-in camera: click to lock the mouse, WASD to fly, E/Q up/down, Shift for speed.
 * Replaced by the third-person camera in Phase 1.
 */
export class FlyCamera implements GameSystem {
  readonly name = 'flyCamera';
  private ctx!: GameContext;
  private yaw = -Math.PI / 4;
  private pitch = -0.25;
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly move = new THREE.Vector3();

  init(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.camera.position.set(-14, 9, 14);
    ctx.renderer.domElement.addEventListener('click', () => ctx.input.requestPointerLock());
  }

  update(dt: number): void {
    const { input, camera, store } = this.ctx;
    const { mouseSensitivity, invertY } = store.getState().settings;
    const k = 0.0022 * mouseSensitivity;
    this.yaw -= input.mouseDelta.x * k;
    this.pitch -= input.mouseDelta.y * k * (invertY ? -1 : 1);
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.5, 1.5);
    this.euler.set(this.pitch, this.yaw, 0);
    camera.quaternion.setFromEuler(this.euler);

    // Use real-ish dt so you can still fly around while debug-paused.
    const step = Math.max(dt, store.getState().debug.paused ? 1 / 60 : 0);
    const speed = input.isDown('sprint') ? 30 : 10;
    this.move.set(input.axis('moveLeft', 'moveRight'), input.axis('flyDown', 'flyUp'), -input.axis('moveBack', 'moveForward'));
    if (this.move.lengthSq() === 0) return;
    this.move.normalize().multiplyScalar(speed * step);
    const vertical = this.move.y;
    this.move.y = 0;
    this.move.applyEuler(new THREE.Euler(0, this.yaw, 0));
    camera.position.add(this.move);
    camera.position.y = Math.max(0.5, camera.position.y + vertical);
  }
}
