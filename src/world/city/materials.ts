import * as THREE from 'three';

/**
 * Shared uniforms: DayNight writes these once per frame, every city material reads them.
 * uNight: 0 = noon, 1 = deep night. uTime: seconds, for flicker.
 */
export const cityUniforms = {
  uNight: { value: 0 },
  uTime: { value: 0 },
};

export interface FacadeOptions {
  /** Window grid size in metres (horizontal, vertical = floor height). */
  cellW: number;
  floorH: number;
  /** Fraction of a cell that is glass (0..1, x and y). */
  winW: number;
  winH: number;
  /** Ground-floor shop shutters (Jugaadpur style). */
  shopBand: boolean;
  /** Fraction of windows lit at night. */
  litRatio: number;
  glassColor: string;
  roughness: number;
  metalness: number;
}

const DEFAULTS: FacadeOptions = {
  cellW: 3.2,
  floorH: 3.2,
  winW: 0.45,
  winH: 0.5,
  shopBand: false,
  litRatio: 0.45,
  glassColor: '#1c2430',
  roughness: 0.85,
  metalness: 0,
};

/**
 * Building facade material: windows are drawn procedurally from world position, so any
 * instanced box of any size gets correctly sized windows with zero textures.
 */
export function facadeMaterial(opts: Partial<FacadeOptions> = {}): THREE.MeshStandardMaterial {
  const o = { ...DEFAULTS, ...opts };
  const mat = new THREE.MeshStandardMaterial({ roughness: o.roughness, metalness: o.metalness });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = cityUniforms.uNight;
    shader.uniforms.uTime = cityUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 wpos = vec4(transformed, 1.0);
        vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wpos = instanceMatrix * wpos;
          wn = mat3(instanceMatrix) * wn;
        #endif
        vWPos = (modelMatrix * wpos).xyz;
        vWNrm = normalize(mat3(modelMatrix) * wn);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNrm;
        uniform float uNight;
        uniform float uTime;
        float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float isWall = 1.0 - step(0.5, abs(vWNrm.y));
        float along = abs(vWNrm.x) > 0.5 ? vWPos.z : vWPos.x;
        vec2 cellPos = vec2(along / ${o.cellW.toFixed(2)}, (vWPos.y - 0.4) / ${o.floorH.toFixed(2)});
        vec2 f = fract(cellPos);
        vec2 id = floor(cellPos);
        float hw = ${(o.winW / 2).toFixed(3)};
        float win = step(0.5 - hw, f.x) * step(f.x, 0.5 + hw) * step(0.5 - ${(o.winH / 2).toFixed(3)}, f.y) * step(f.y, 0.5 + ${(o.winH / 2).toFixed(3)});
        win *= isWall;
        float shop = ${o.shopBand ? '1.0' : '0.0'} * isWall * (1.0 - step(3.0, vWPos.y));
        win *= 1.0 - shop;
        win *= step(1.0, vWPos.y);
        float rnd = hash12(id + floor(vWPos.xz * 0.05) * 17.0);
        // Grime toward the ground, a little per-floor variation.
        diffuseColor.rgb *= 0.82 + 0.18 * smoothstep(0.0, 8.0, vWPos.y) + (rnd - 0.5) * 0.06 * isWall;
        // Rolling shutters with horizontal ribs.
        float ribs = 0.85 + 0.15 * step(0.5, fract(vWPos.y * 5.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.44, 0.46) * ribs, shop * 0.9);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${new THREE.Color(o.glassColor).toArray().map((v) => v.toFixed(3)).join(',')}), win * 0.92);
        float lit = win * step(1.0 - ${o.litRatio.toFixed(2)}, rnd);
        // Tubelight flicker on a few windows.
        float flicker = step(0.97, rnd) * step(0.5, fract(sin(uTime * 23.0 + rnd * 91.0) * 43758.5));
        vec3 warm = mix(vec3(1.0, 0.78, 0.45), vec3(0.75, 0.9, 1.0), step(0.6, fract(rnd * 7.3)));`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += lit * (1.0 - flicker) * uNight * warm * 0.75;
        totalEmissiveRadiance += shop * uNight * step(0.7, rnd) * step(0.8, fract(vWPos.y * 5.0)) * vec3(1.0, 0.85, 0.6) * 0.25;`,
      );
  };
  // Separate program per option set (otherwise Three caches one shader for all facades).
  mat.customProgramCacheKey = () => JSON.stringify(o);
  return mat;
}

/** Plain lit material for props; neon variant glows at night. */
export function neonMaterial(color: string, intensity = 2.5): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, roughness: 0.4 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = cityUniforms.uNight;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance = diffuseColor.rgb * (0.1 + uNight * ${(intensity * 0.5).toFixed(2)});`);
  };
  mat.customProgramCacheKey = () => `neon${intensity}`;
  return mat;
}

/** Textured material (hoardings, signs) that also lights up at night. */
export function signMaterial(map: THREE.Texture, glow = 1.2): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 0.15, roughness: 0.7 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = cityUniforms.uNight;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance *= 0.1 + uNight * ${glow.toFixed(2)} * 0.9;`);
  };
  mat.customProgramCacheKey = () => `sign${glow}`;
  return mat;
}

export function plain(color: string, roughness = 0.85, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
