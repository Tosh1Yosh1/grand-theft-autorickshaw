import * as THREE from 'three';
import { buildBike, buildThar, buildTempo } from './cars';
import { box, cyl, decal, paint, textTexture } from './parts';

/** "MUMBHAI POLEECE" jeep: Thaar body, khaki-white livery, red/blue light bar. */
export function buildPoliceJeep(): THREE.Group {
  const g = buildThar('#e9e4d4');
  const red = paint('#ff2a2a', 0.3, 0, '#ff2a2a').clone();
  red.name = 'sirenRed';
  const blue = paint('#2a5cff', 0.3, 0, '#2a5cff').clone();
  blue.name = 'sirenBlue';
  box(g, 0.5, 0.14, 0.25, -0.3, 1.33, 0.1, red);
  box(g, 0.5, 0.14, 0.25, 0.3, 1.33, 0.1, blue);
  for (const s of [-1, 1]) {
    const t = textTexture(512, 96, '#e9e4d4', [['MUMBHAI POLEECE', 'bold 56px Impact, sans-serif', '#1d3557']]);
    decal(g, t, 2.2, 0.4, s * 0.885, 0.2, 0, (s * Math.PI) / 2);
  }
  return g;
}

export function buildPoliceBike(): THREE.Group {
  const g = buildBike('#1d3557');
  const light = paint('#2a5cff', 0.3, 0, '#2a5cff').clone();
  light.name = 'sirenBlue';
  cyl(g, 0.05, 0.05, 0.12, 0, 0.75, -0.6, light, 8);
  g.getObjectByName('cylinder')?.removeFromParent(); // police don't carry the family gas cylinder (officially)
  return g;
}

/** CHEEKH TV news van with a satellite dish and a very loud anchor. */
export function buildNewsVan(): THREE.Group {
  const g = buildTempo('#ffffff');
  box(g, 1.8, 1.5, 3.3, 0, 0.9, -0.7, paint('#ffffff', 0.5));
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3), paint('#dddddd', 0.3, 0.6));
  dish.position.set(0, 1.9, -1.2);
  dish.rotation.x = -0.8;
  g.add(dish);
  for (const s of [-1, 1]) {
    const t = textTexture(512, 192, '#ffffff', [['CHEEKH TV', 'bold 80px Impact, sans-serif', '#d00000'], ['BREAKING 24x7', 'bold 40px Arial, sans-serif', '#111']]);
    decal(g, t, 2.8, 1.05, s * 0.91, 0.95, -0.7, (s * Math.PI) / 2);
  }
  return g;
}

/** Surveillance drone with four rotors (named for spinning). */
export function buildDrone(): THREE.Group {
  const g = new THREE.Group();
  const dark = paint('#222222', 0.5, 0.4);
  box(g, 0.5, 0.15, 0.5, 0, 0, 0, dark);
  const eye = paint('#ff2a2a', 0.3, 0, '#ff2a2a');
  box(g, 0.12, 0.08, 0.05, 0, -0.06, 0.26, eye);
  for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]] as const) {
    box(g, 0.05, 0.05, 0.4, x / 2, 0, z / 2, dark).rotation.y = Math.atan2(x, z);
    const rotor = box(g, 0.45, 0.01, 0.06, x, 0.1, z, paint('#999999', 0.4));
    rotor.name = 'rotor';
  }
  return g;
}
