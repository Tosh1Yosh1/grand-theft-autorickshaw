import * as THREE from 'three';

/**
 * Procedural placeholder Pappu: handlebar moustache, proud paunch, khaki shirt, chappals,
 * a gold chain for Bhaukaal. Swap for a CC0 rigged GLB later (see TODO_ASSETS.md).
 *
 * Origin is at the feet. Limbs are pivot groups so PappuAnimator can swing them.
 */
export interface PappuRig {
  root: THREE.Group;
  /** Everything above the feet; bobs and leans. */
  body: THREE.Group;
  belly: THREE.Mesh;
  head: THREE.Group;
  moustache: THREE.Mesh;
  hipL: THREE.Group;
  hipR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
}

const mat = (color: string, roughness = 0.8, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

let M: Record<'skin' | 'shirt' | 'pants' | 'hair' | 'chappal' | 'strap' | 'gold' | 'eye' | 'button', THREE.Material> | null =
  null;
function materials() {
  return (M ??= {
    skin: mat('#b97a50', 0.7),
    shirt: mat('#b8a06a', 0.9),
    pants: mat('#4b3f36', 0.9),
    hair: mat('#17110c', 0.6),
    chappal: mat('#6b3d1f', 0.8),
    strap: mat('#2f6fb5', 0.6),
    gold: mat('#e6b422', 0.3, 0.9),
    eye: mat('#0d0d0d', 0.3),
    button: mat('#efe6d0', 0.5),
  });
}

function mesh(geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function pivot(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/** Big curly handlebar moustache: one tube along a symmetric curve. */
function moustacheGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * 2 - 1; // -1..1 across the face
    const a = Math.abs(t);
    const x = t * 0.17;
    // Droops at the middle, swoops up and curls at the tips.
    const y = -0.015 + a * a * 0.05 + Math.max(0, a - 0.75) * 0.25;
    const z = -a * a * 0.06;
    pts.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 32, 0.022, 6, false);
  // Thicker in the middle, thin at the tips.
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const scale = 1.35 - Math.min(1, Math.abs(x) / 0.17) * 0.7;
    const c = curve.getPoint(THREE.MathUtils.clamp((x / 0.17 + 1) / 2, 0, 1));
    pos.setY(i, c.y + (pos.getY(i) - c.y) * scale);
    pos.setZ(i, c.z + (pos.getZ(i) - c.z) * scale);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildPappu(): PappuRig {
  const m = materials();
  const root = new THREE.Group();
  root.name = 'Pappu';
  const body = pivot(root, 0, 0, 0);

  // Legs: hip pivot at 0.92, knee at 0.48.
  const leg = (side: 1 | -1) => {
    const hip = pivot(body, 0.12 * side, 0.92, 0);
    hip.add(mesh(new THREE.CapsuleGeometry(0.085, 0.3, 4, 8), m.pants, 0, -0.22, 0));
    const knee = pivot(hip, 0, -0.44, 0);
    knee.add(mesh(new THREE.CapsuleGeometry(0.075, 0.3, 4, 8), m.pants, 0, -0.2, 0));
    knee.add(mesh(new THREE.BoxGeometry(0.11, 0.05, 0.12), m.skin, 0, -0.41, 0.03)); // foot
    knee.add(mesh(new THREE.BoxGeometry(0.13, 0.025, 0.27), m.chappal, 0, -0.445, 0.05)); // chappal sole
    knee.add(mesh(new THREE.BoxGeometry(0.135, 0.02, 0.03), m.strap, 0, -0.415, 0.07)); // strap
    return { hip, knee };
  };
  const L = leg(1);
  const R = leg(-1);

  // Torso: khaki shirt + the paunch.
  body.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.25, 12), m.pants, 0, 0.98, 0)); // waist
  body.add(mesh(new THREE.CylinderGeometry(0.21, 0.22, 0.5, 12), m.shirt, 0, 1.3, 0));
  const belly = mesh(new THREE.SphereGeometry(0.24, 16, 12), m.shirt, 0, 1.12, 0.07);
  belly.scale.set(1, 0.95, 1.05);
  body.add(belly);
  for (let i = 0; i < 4; i++) body.add(mesh(new THREE.SphereGeometry(0.014, 6, 4), m.button, 0, 1.47 - i * 0.12, 0.22 + (i > 1 ? 0.07 : 0.01)));
  body.add(mesh(new THREE.BoxGeometry(0.09, 0.08, 0.02), m.shirt, 0.11, 1.42, 0.205)); // pocket
  // Collar.
  const collar = mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12), m.shirt, 0, 1.56, 0);
  collar.rotation.x = Math.PI / 2;
  body.add(collar);
  // Gold chain, because Bhaukaal.
  const chain = mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 16), m.gold, 0, 1.5, 0.05);
  chain.rotation.x = Math.PI / 2 - 0.35;
  body.add(chain);

  // Arms: shoulder at 1.5, elbow 0.28 below.
  const arm = (side: 1 | -1) => {
    const shoulder = pivot(body, 0.27 * side, 1.5, 0);
    shoulder.add(mesh(new THREE.CapsuleGeometry(0.07, 0.14, 4, 8), m.shirt, 0, -0.1, 0)); // half sleeve
    const elbow = pivot(shoulder, 0, -0.28, 0);
    elbow.add(mesh(new THREE.CapsuleGeometry(0.055, 0.2, 4, 8), m.skin, 0, -0.12, 0));
    elbow.add(mesh(new THREE.SphereGeometry(0.065, 8, 6), m.skin, 0, -0.27, 0)); // fist
    return { shoulder, elbow };
  };
  const AL = arm(1);
  const AR = arm(-1);

  // Head.
  const head = pivot(body, 0, 1.6, 0);
  head.add(mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), m.skin, 0, 0.0, 0)); // neck
  const skull = mesh(new THREE.SphereGeometry(0.15, 16, 12), m.skin, 0, 0.17, 0);
  skull.scale.set(1, 1.1, 1);
  head.add(skull);
  const hair = mesh(new THREE.SphereGeometry(0.155, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), m.hair, 0, 0.2, -0.01);
  hair.scale.set(1.02, 0.9, 1.05);
  head.add(hair);
  head.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), m.skin, 0, 0.15, 0.15)); // nose
  for (const s of [-1, 1]) {
    head.add(mesh(new THREE.SphereGeometry(0.018, 8, 6), m.eye, 0.055 * s, 0.21, 0.135));
    const brow = mesh(new THREE.BoxGeometry(0.06, 0.016, 0.02), m.hair, 0.055 * s, 0.25, 0.135);
    brow.rotation.z = 0.2 * s; // permanently unimpressed
    head.add(brow);
    head.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), m.skin, 0.15 * s, 0.17, 0)); // ears
  }
  const moustache = mesh(moustacheGeometry(), m.hair, 0, 0.11, 0.145);
  head.add(moustache);

  return {
    root,
    body,
    belly,
    head,
    moustache,
    hipL: L.hip,
    hipR: R.hip,
    kneeL: L.knee,
    kneeR: R.knee,
    shoulderL: AL.shoulder,
    shoulderR: AR.shoulder,
    elbowL: AL.elbow,
    elbowR: AR.elbow,
  };
}
