import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { cityUniforms } from '../world/city/materials';
import type { Engine } from './Engine';
import { profileFor } from './graphics';
import type { GameContext, GameSystem } from './System';
import { debugFolder } from '../ui/debugPanel';

/**
 * Sun-baked grade: warm split-toning (a hand-rolled "LUT"), contrast, saturation, pollution haze
 * tint, vignette and film grain. Retro mode adds posterisation for that 2004 console crunch.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uNight: { value: 0 },
    uWarmth: { value: 0.09 },
    uContrast: { value: 1.08 },
    uSaturation: { value: 1.18 },
    uVignette: { value: 0.35 },
    uGrain: { value: 0.035 },
    uRetro: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uNight, uWarmth, uContrast, uSaturation, uVignette, uGrain, uRetro;
    uniform vec2 uResolution;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // Split-tone: warm orange highlights, slightly teal-purple shadows (bluer at night).
      vec3 hi = vec3(1.0, 0.86, 0.62);
      vec3 lo = mix(vec3(0.42, 0.36, 0.5), vec3(0.3, 0.38, 0.6), uNight);
      c = mix(c, c * mix(lo * 1.6, hi * 1.15, smoothstep(0.05, 0.75, l)), uWarmth * 2.0);
      c = (c - 0.5) * uContrast + 0.5;
      l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaturation);
      // Dusty haze lifts the blacks a touch.
      c = mix(c, vec3(0.85, 0.7, 0.55), 0.05 * (1.0 - uNight));
      if (uRetro > 0.5) {
        c = floor(c * 24.0 + 0.5) / 24.0;
        c *= 0.97 + 0.03 * step(0.5, fract(vUv.y * uResolution.y * 0.5));
      }
      vec2 d = vUv - 0.5;
      c *= 1.0 - dot(d, d) * uVignette * 2.2;
      c += (rand(vUv * uResolution + fract(uTime) * 100.0) - 0.5) * uGrain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export class PostFX implements GameSystem {
  readonly name = 'postfx';
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private grade!: ShaderPass;

  constructor(private readonly engine: Engine) {}

  init(ctx: GameContext): void {
    const { renderer, scene, camera } = ctx;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.4, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    const resize = (w: number, h: number) => {
      this.composer.setPixelRatio(renderer.getPixelRatio());
      this.composer.setSize(w, h);
      const pr = renderer.getPixelRatio();
      this.grade.uniforms.uResolution!.value.set(w * pr, h * pr);
      // Bloom at half res: cheaper and softer.
      this.bloom.resolution.set((w * pr) / 2, (h * pr) / 2);
    };
    this.engine.onResize = resize;
    resize(window.innerWidth, window.innerHeight);

    this.engine.renderOverride = (dt) => {
      const { graphics, retro } = ctx.store.getState().settings;
      const prof = profileFor(graphics, retro);
      if (!prof.postFx) {
        renderer.render(scene, camera);
        return;
      }
      this.bloom.enabled = prof.bloom;
      const night = cityUniforms.uNight.value;
      this.bloom.strength = 0.25 + night * 0.35;
      this.bloom.threshold = 0.92 - night * 0.12;
      const u = this.grade.uniforms;
      u.uTime!.value += dt;
      u.uNight!.value = night;
      u.uRetro!.value = retro ? 1 : 0;
      this.composer.render(dt);
    };

    const f = debugFolder('Post FX');
    const u = this.grade.uniforms;
    f.add(u.uWarmth!, 'value', 0, 0.5, 0.01).name('Warmth');
    f.add(u.uContrast!, 'value', 0.8, 1.5, 0.01).name('Contrast');
    f.add(u.uSaturation!, 'value', 0, 2, 0.01).name('Saturation');
    f.add(u.uVignette!, 'value', 0, 1, 0.01).name('Vignette');
    f.add(u.uGrain!, 'value', 0, 0.15, 0.005).name('Grain');
  }
}
