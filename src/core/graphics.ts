import * as THREE from 'three';
import type { GraphicsPreset } from './store';

export interface GraphicsProfile {
  pixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  fogNear: number;
  fogFar: number;
  bloom: boolean;
  postFx: boolean;
}

export function profileFor(preset: GraphicsPreset, retro = false): GraphicsProfile {
  const dpr = window.devicePixelRatio || 1;
  let p: GraphicsProfile;
  switch (preset) {
    case 'potato':
      p = { pixelRatio: Math.min(dpr, 1) * 0.65, shadows: false, shadowMapSize: 512, fogNear: 30, fogFar: 170, bloom: false, postFx: true };
      break;
    case 'normal':
      p = { pixelRatio: Math.min(dpr, 1.25), shadows: true, shadowMapSize: 1024, fogNear: 50, fogFar: 300, bloom: true, postFx: true };
      break;
    case 'ultra':
      p = { pixelRatio: Math.min(dpr, 2), shadows: true, shadowMapSize: 2048, fogNear: 80, fogFar: 450, bloom: true, postFx: true };
      break;
  }
  if (retro) {
    // Early-2000s console vibe: chunky pixels and the city melting into smog.
    p.pixelRatio = 0.45;
    p.fogNear = 20;
    p.fogFar = Math.min(p.fogFar, 220);
    p.shadowMapSize = Math.min(p.shadowMapSize, 1024);
  }
  return p;
}

/** Apply a preset at runtime. Safe to call repeatedly. */
export function applyGraphics(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  sun: THREE.DirectionalLight,
  preset: GraphicsPreset,
  retro = false,
): GraphicsProfile {
  const p = profileFor(preset, retro);
  renderer.setPixelRatio(p.pixelRatio);
  renderer.domElement.style.imageRendering = retro ? 'pixelated' : 'auto';
  const shadowsChanged = renderer.shadowMap.enabled !== p.shadows;
  renderer.shadowMap.enabled = p.shadows;
  sun.castShadow = p.shadows;
  if (sun.shadow.mapSize.x !== p.shadowMapSize) {
    sun.shadow.mapSize.set(p.shadowMapSize, p.shadowMapSize);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.near = p.fogNear;
    scene.fog.far = p.fogFar;
  }
  if (shadowsChanged) {
    // Materials compile shadow support in; recompile after toggling.
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (Array.isArray(m)) m.forEach((x) => (x.needsUpdate = true));
      else if (m) m.needsUpdate = true;
    });
  }
  return p;
}
