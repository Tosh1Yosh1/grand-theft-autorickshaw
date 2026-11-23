import * as THREE from 'three';
import { EventBus } from './EventBus';
import { applyGraphics } from './graphics';
import { Input } from './input/Input';
import { FIXED_DT, Physics } from './Physics';
import { store } from './store';
import type { GameContext, GameSystem } from './System';

const MAX_STEPS_PER_FRAME = 5; // avoid the spiral of death on slow frames

export class Engine {
  readonly ctx: GameContext;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  /** Post-processing replaces the plain render call. */
  renderOverride: ((dt: number) => void) | null = null;
  /** Called after the canvas is resized (post-processing needs to know). */
  onResize: ((w: number, h: number) => void) | null = null;
  private systems: GameSystem[] = [];
  private accumulator = 0;
  private lastTime = 0;
  private running = false;

  /** Rolling frame stats for the debug panel. */
  readonly stats = { fps: 0, frameMs: 0, drawCalls: 0, triangles: 0, bodies: 0 };
  private fpsFrames = 0;
  private fpsTime = 0;

  private constructor(container: HTMLElement, physics: Physics) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.info.autoReset = false; // count the whole frame (shadows + post passes), reset per frame
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Sun-baked dusty sky + pollution haze. Proper grade/LUT arrives with post-processing.
    scene.background = new THREE.Color('#f2c38b');
    scene.fog = new THREE.Fog('#f2c38b', 40, 260);

    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 1500);

    const hemi = new THREE.HemisphereLight('#ffe7c2', '#8a5a3a', 1.1);
    this.hemi = hemi;
    scene.add(hemi);
    this.sun = new THREE.DirectionalLight('#ffd49a', 2.4);
    this.sun.position.set(30, 50, 20);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -60;
    sc.right = sc.top = 60;
    sc.far = 260;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);

    this.ctx = {
      scene,
      camera,
      renderer,
      physics,
      input: new Input(renderer.domElement),
      events: new EventBus(),
      store,
      services: {},
    };

    const st = store.getState().settings;
    applyGraphics(renderer, scene, this.sun, st.graphics, st.retro);
    store.subscribe((s, prev) => {
      if (s.settings.graphics !== prev.settings.graphics || s.settings.retro !== prev.settings.retro) {
        applyGraphics(renderer, scene, this.sun, s.settings.graphics, s.settings.retro);
        this.resize();
      }
    });

    window.addEventListener('resize', this.resize);
    this.resize();
  }

  static async create(container: HTMLElement): Promise<Engine> {
    const physics = await Physics.create();
    return new Engine(container, physics);
  }

  async add(system: GameSystem): Promise<void> {
    await system.init?.(this.ctx);
    this.systems.push(system);
    this.systems.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.ctx.renderer.setAnimationLoop(this.frame);
  }

  stop(): void {
    this.running = false;
    this.ctx.renderer.setAnimationLoop(null);
  }

  private frame = (now: number): void => {
    this.ctx.renderer.info.reset();
    const realDt = Math.min((now - this.lastTime) / 1000, 0.25);
    this.lastTime = now;
    const { timeScale, paused, physicsWireframe } = store.getState().debug;
    const dt = paused ? 0 : realDt * timeScale;

    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      for (const s of this.systems) s.fixedUpdate?.(FIXED_DT);
      this.ctx.physics.step();
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    this.ctx.physics.sync(this.accumulator / FIXED_DT);

    for (const s of this.systems) s.update?.(dt);
    this.ctx.physics.updateDebug(this.ctx.scene, physicsWireframe);
    if (this.renderOverride) this.renderOverride(realDt);
    else this.ctx.renderer.render(this.ctx.scene, this.ctx.camera);
    this.ctx.input.endFrame();

    this.updateStats(realDt);
  };

  private updateStats(realDt: number): void {
    this.fpsFrames++;
    this.fpsTime += realDt;
    if (this.fpsTime >= 0.5) {
      this.stats.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.stats.frameMs = +((this.fpsTime / this.fpsFrames) * 1000).toFixed(1);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
    const info = this.ctx.renderer.info.render;
    this.stats.drawCalls = info.calls;
    this.stats.triangles = info.triangles;
    this.stats.bodies = this.ctx.physics.bodyCount;
  }

  private resize = (): void => {
    const { renderer, camera } = this.ctx;
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    this.onResize?.(w, h);
  };
}
