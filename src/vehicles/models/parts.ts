import * as THREE from 'three';

/** Small helpers shared by procedural vehicle models. */
const cache = new Map<string, THREE.MeshStandardMaterial>();
export function paint(color: string, roughness = 0.6, metalness = 0.1, emissive?: string): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}|${metalness}|${emissive ?? ''}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    if (emissive) {
      m.emissive.set(emissive);
      m.emissiveIntensity = 1.5;
    }
    cache.set(key, m);
  }
  return m;
}

export function box(parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function cyl(parent: THREE.Object3D, rTop: number, rBot: number, h: number, x: number, y: number, z: number, mat: THREE.Material, seg = 10): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** Canvas texture with centred text lines: [text, font, color][] */
export function textTexture(w: number, h: number, bg: string, lines: [string, string, string][]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach(([text, font, color], i) => {
    g.fillStyle = color;
    g.font = font;
    g.fillText(text, w / 2, (h / (lines.length + 1)) * (i + 1));
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function decal(parent: THREE.Object3D, tex: THREE.Texture, w: number, h: number, x: number, y: number, z: number, rotY = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  parent.add(m);
  return m;
}

export function defaultWheel(radius: number, width = 0.14): THREE.Object3D {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 14), paint('#1b1b1b', 0.9));
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.5, radius * 0.5, width + 0.01, 8), paint('#9a9a9a', 0.4, 0.6));
  hub.rotation.z = Math.PI / 2;
  g.add(tyre, hub);
  return g;
}
