import * as THREE from 'three';
import type { PappuRig } from './PappuModel';

export type AnimState = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'crouch' | 'sit';

/**
 * Procedural animation for the placeholder rig. When a GLB with clips arrives,
 * replace this with an AnimationMixer driven by the same AnimState.
 */
export class PappuAnimator {
  state: AnimState = 'idle';
  private phase = 0;
  private time = 0;
  private bellyVel = 0;
  private bellyOffset = 0;
  /** Extra arm pose from combat etc. 0..1 blend, set externally. */
  punch = 0;
  punchSide: 1 | -1 = 1;

  constructor(private readonly rig: PappuRig) {}

  update(dt: number, horizontalSpeed: number, verticalVel: number): void {
    const r = this.rig;
    this.time += dt;
    const k = 1 - Math.exp(-14 * dt); // blend factor toward target pose
    const lerp = (obj: THREE.Object3D, axis: 'x' | 'y' | 'z', target: number) => {
      obj.rotation[axis] += (target - obj.rotation[axis]) * k;
    };

    const moving = this.state === 'walk' || this.state === 'run';
    const stride = this.state === 'run' ? 1.0 : 0.6;
    this.phase += dt * (moving ? 2.2 + horizontalSpeed * 1.25 : 0);
    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);

    let hipL = 0, hipR = 0, kneeL = 0, kneeR = 0, shL = 0, shR = 0, elL = 0, elR = 0;
    let bodyY = 0, lean = 0, shZ = 0.08;

    switch (this.state) {
      case 'idle': {
        const breathe = Math.sin(this.time * 2) * 0.012;
        bodyY = breathe;
        shL = shR = 0.05;
        elL = elR = -0.15;
        break;
      }
      case 'walk':
      case 'run':
        hipL = s * stride;
        hipR = -s * stride;
        kneeL = Math.max(0, -c) * stride * 1.3;
        kneeR = Math.max(0, c) * stride * 1.3;
        shL = -s * stride * 0.9;
        shR = s * stride * 0.9;
        elL = elR = this.state === 'run' ? -1.3 : -0.35;
        bodyY = Math.abs(c) * (this.state === 'run' ? 0.07 : 0.03);
        lean = this.state === 'run' ? 0.18 : 0.05;
        break;
      case 'jump':
        hipL = -0.9; hipR = 0.3; kneeL = 1.2; kneeR = 0.5;
        shL = shR = -2.6; elL = elR = -0.3; shZ = 0.5;
        break;
      case 'fall': {
        const flail = Math.sin(this.time * 18) * 0.6;
        hipL = 0.3 + flail * 0.3; hipR = -0.3 - flail * 0.3; kneeL = kneeR = 0.6;
        shL = -2 + flail; shR = -2 - flail; elL = elR = -0.4; shZ = 0.9;
        break;
      }
      case 'crouch':
        hipL = hipR = -1.0; kneeL = kneeR = 1.6; bodyY = -0.25; lean = 0.25;
        shL = shR = -0.4; elL = elR = -0.8;
        break;
      case 'sit': // driving pose
        hipL = hipR = -1.45; kneeL = kneeR = 1.45; bodyY = -0.05;
        shL = shR = -1.1; elL = elR = -0.5; shZ = 0.15;
        break;
    }

    // Combat override on one arm.
    if (this.punch > 0) {
      const p = this.punch;
      if (this.punchSide === 1) { shL = THREE.MathUtils.lerp(shL, -1.55, p); elL = THREE.MathUtils.lerp(elL, 0, p); }
      else { shR = THREE.MathUtils.lerp(shR, -1.55, p); elR = THREE.MathUtils.lerp(elR, 0, p); }
    }

    lerp(r.hipL, 'x', hipL); lerp(r.hipR, 'x', hipR);
    lerp(r.kneeL, 'x', kneeL); lerp(r.kneeR, 'x', kneeR);
    lerp(r.shoulderL, 'x', shL); lerp(r.shoulderR, 'x', shR);
    lerp(r.shoulderL, 'z', shZ); lerp(r.shoulderR, 'z', -shZ);
    lerp(r.elbowL, 'x', elL); lerp(r.elbowR, 'x', elR);
    lerp(r.body, 'x', lean);
    r.body.position.y += (bodyY - r.body.position.y) * k;

    // Paunch jiggle: a spring that lags behind vertical motion. Very important tech.
    const accel = -verticalVel * 0.4 + (moving ? c * horizontalSpeed * 0.15 : 0);
    this.bellyVel += (-this.bellyOffset * 120 - this.bellyVel * 9 + accel) * dt;
    this.bellyOffset += this.bellyVel * dt;
    const j = THREE.MathUtils.clamp(this.bellyOffset, -0.12, 0.12);
    r.belly.scale.set(1 - j * 0.5, 0.95 + j, 1.05 - j * 0.3);

    // Moustache twitch now and then.
    r.moustache.rotation.z = Math.sin(this.time * 9) * (Math.sin(this.time * 0.7) > 0.95 ? 0.08 : 0);
  }
}
