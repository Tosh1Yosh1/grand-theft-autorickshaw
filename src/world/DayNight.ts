import * as THREE from 'three';
import type { Engine } from '../core/Engine';
import type { GameContext, GameSystem } from '../core/System';
import { debugFolder } from '../ui/debugPanel';
import { cityUniforms } from './city/materials';

/** Colour keys through the day: [hour, zenith, horizon, sunColor, sunIntensity, hemiIntensity] */
const KEYS: [number, string, string, string, number, number][] = [
  [0, '#070b1f', '#1d1b3a', '#8fa8ff', 0.25, 0.5],
  [5, '#0d1430', '#3a2f55', '#8fa8ff', 0.2, 0.5],
  [6.5, '#5d77b3', '#ffb37a', '#ffb070', 1.4, 0.9],
  [9, '#7fb0dd', '#f6d7a7', '#fff3dd', 2.3, 1.1],
  [13, '#86b7df', '#f4dcb2', '#fff8ee', 2.4, 1.15],
  [16.5, '#7ea4cf', '#f6c38b', '#ffd49a', 2.6, 1.05],
  [18.2, '#4a4378', '#ff8a4c', '#ff8a4c', 1.6, 1.0],
  [19.5, '#141938', '#5b3a5e', '#8fa8ff', 0.3, 0.6],
  [24, '#070b1f', '#1d1b3a', '#8fa8ff', 0.25, 0.5],
];

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // always at the far plane
}`;
const skyFrag = /* glsl */ `
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uNight;
varying vec3 vDir;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(max(h, 0.0), 0.55));
  // Smog band hugging the horizon.
  col = mix(col, uHorizon * 1.05, smoothstep(0.12, 0.0, abs(h)) * 0.6);
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(s, 600.0) * 4.0 + pow(s, 12.0) * 0.35) * (1.0 - uNight * 0.85);
  // Stars, but only a few: it is still a polluted city.
  float star = step(0.9965, hash(floor(d * 350.0))) * uNight * smoothstep(0.1, 0.4, h);
  col += vec3(star);
  gl_FragColor = vec4(col, 1.0);
}`;

export class DayNight implements GameSystem {
  readonly name = 'dayNight';
  readonly priority = 90;
  /** Hour of day, 0..24. */
  hour = 16.5;
  readonly tuning = { cycleMinutes: 12, frozen: false };
  private ctx!: GameContext;
  private sky!: THREE.Mesh;
  private skyMat!: THREE.ShaderMaterial;
  private moon!: THREE.DirectionalLight;
  /** Fakes the sodium streetlight pool around Pappu at night (one light instead of hundreds). */
  private fill!: THREE.PointLight;
  private readonly sunDir = new THREE.Vector3();
  private readonly tmp = { zenith: new THREE.Color(), horizon: new THREE.Color(), sun: new THREE.Color(), a: new THREE.Color(), b: new THREE.Color() };

  constructor(private readonly engine: Engine) {}

  init(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.services.dayNight = this;
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new THREE.Color() },
        uHorizon: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color() },
        uNight: cityUniforms.uNight,
      },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1;
    ctx.scene.add(this.sky);
    ctx.scene.background = null;
    this.moon = new THREE.DirectionalLight('#8fa8ff', 0);
    ctx.scene.add(this.moon);
    this.fill = new THREE.PointLight('#ffb366', 0, 30, 1.4);
    ctx.scene.add(this.fill);

    const f = debugFolder('Time of day', false);
    f.add(this, 'hour', 0, 24, 0.05).listen().name('Hour');
    f.add(this.tuning, 'cycleMinutes', 1, 60, 1).name('Full day (real min)');
    f.add(this.tuning, 'frozen').name('Freeze time');
  }

  /** 0 = full day, 1 = full night. */
  get night(): number {
    return cityUniforms.uNight.value;
  }

  get clockText(): string {
    const h = Math.floor(this.hour);
    const m = Math.floor((this.hour - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  update(dt: number): void {
    if (!this.tuning.frozen) this.hour = (this.hour + (dt * 24) / (this.tuning.cycleMinutes * 60)) % 24;
    cityUniforms.uTime.value += dt;
    const { camera, scene } = this.ctx;

    // Sun path: rises in the east (+x), sets in the west, tilted south for nicer shadows.
    const t = ((this.hour - 6) / 12) * Math.PI;
    const elev = Math.sin(t);
    this.sunDir.set(Math.cos(t), Math.max(elev, -0.3), 0.35).normalize();

    const [z, h, sc, si, hi] = this.sample();
    const night = THREE.MathUtils.smoothstep(-elev, -0.02, 0.25);
    cityUniforms.uNight.value = night;

    this.skyMat.uniforms.uZenith!.value.copy(z);
    this.skyMat.uniforms.uHorizon!.value.copy(h);
    this.skyMat.uniforms.uSunDir!.value.copy(this.sunDir);
    this.skyMat.uniforms.uSunColor!.value.copy(sc);
    this.sky.position.copy(camera.position);
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(h);

    // Sun follows the player so the shadow map covers what we see.
    const focus = this.ctx.services.player?.position ?? camera.position;
    const sun = this.engine.sun;
    sun.color.copy(sc);
    sun.intensity = elev > -0.05 ? si : 0;
    sun.position.copy(focus).addScaledVector(this.sunDir, 120);
    sun.target.position.copy(focus);
    sun.target.updateMatrixWorld();
    this.moon.intensity = night * 0.6;
    this.fill.intensity = night * 60;
    this.fill.position.set(focus.x + 3, focus.y + 8, focus.z + 2);
    this.moon.position.set(focus.x - 50, focus.y + 100, focus.z + 30);
    this.engine.hemi.intensity = hi;
    this.engine.hemi.color.copy(h).lerp(z, 0.5);
  }

  private sample(): [THREE.Color, THREE.Color, THREE.Color, number, number] {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1]![0] <= this.hour) i++;
    const a = KEYS[i]!;
    const b = KEYS[i + 1]!;
    const f = (this.hour - a[0]) / (b[0] - a[0]);
    const T = this.tmp;
    T.zenith.set(a[1]).lerp(T.b.set(b[1]), f);
    T.horizon.set(a[2]).lerp(T.b.set(b[2]), f);
    T.sun.set(a[3]).lerp(T.b.set(b[3]), f);
    return [T.zenith, T.horizon, T.sun, a[4] + (b[4] - a[4]) * f, a[5] + (b[5] - a[5]) * f];
  }
}
