import * as THREE from 'three';
import type { GraphicsPreset } from './store';

export interface GraphicsProfile {
  pixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  fogFar: number;
}

export function profileFor(preset: GraphicsPreset): GraphicsProfile {
  const dpr = window.devicePixelRatio || 1;
  switch (preset) {
    case 'potato':
      return { pixelRatio: Math.min(dpr, 1) * 0.65, shadows: false, shadowMapSize: 512, fogFar: 140 };
    case 'normal':
      return { pixelRatio: Math.min(dpr, 1.5), shadows: true, shadowMapSize: 1024, fogFar: 260 };
    case 'ultra':
      return { pixelRatio: Math.min(dpr, 2), shadows: true, shadowMapSize: 2048, fogFar: 400 };
  }
}

/** Apply a preset at runtime. Safe to call repeatedly. */
export function applyGraphics(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  sun: THREE.DirectionalLight,
  preset: GraphicsPreset,
): void {
  const p = profileFor(preset);
  renderer.setPixelRatio(p.pixelRatio);
  const shadowsChanged = renderer.shadowMap.enabled !== p.shadows;
  renderer.shadowMap.enabled = p.shadows;
  sun.castShadow = p.shadows;
  if (sun.shadow.mapSize.x !== p.shadowMapSize) {
    sun.shadow.mapSize.set(p.shadowMapSize, p.shadowMapSize);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }
  if (scene.fog instanceof THREE.Fog) scene.fog.far = p.fogFar;
  if (shadowsChanged) {
    // Materials compile shadow support in; recompile after toggling.
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (Array.isArray(m)) m.forEach((x) => (x.needsUpdate = true));
      else if (m) m.needsUpdate = true;
    });
  }
}
