import * as THREE from 'three';
import { box, cyl, decal, paint, textTexture } from './parts';

/** Procedural auto-rickshaw. Local +Z is forward, origin at chassis centre. */
export function buildAutoRickshaw(): THREE.Group {
  const g = new THREE.Group();
  const green = paint('#1f8a4c', 0.5, 0.2);
  const yellow = paint('#f2c12e', 0.5, 0.2);
  const black = paint('#151515', 0.8);
  const steel = paint('#a7a7a7', 0.35, 0.8);
  const seat = paint('#5b2a1c', 0.9);

  box(g, 1.2, 0.18, 2.3, 0, -0.18, -0.05, black); // floor pan
  // Rear tub (passenger bay), green lower body.
  box(g, 1.3, 0.55, 1.15, 0, 0.1, -0.55, green);
  // Front cowl: yellow nose with a rounded front.
  box(g, 0.75, 0.85, 0.5, 0, 0.25, 0.75, yellow);
  const nose = cyl(g, 0.38, 0.38, 0.85, 0, 0.25, 1.0, yellow, 12);
  nose.scale.z = 0.5;
  box(g, 0.2, 0.25, 0.55, 0, -0.05, 1.2, black); // mudguard over front wheel

  // Seats.
  box(g, 0.45, 0.12, 0.4, 0, 0.12, 0.2, seat); // driver
  box(g, 1.15, 0.15, 0.45, 0, 0.42, -0.65, seat); // rear bench
  box(g, 1.15, 0.5, 0.1, 0, 0.72, -0.92, seat); // backrest

  // Canopy: black half-tube roof + struts.
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 1.95, 16, 1, true, -Math.PI / 2, Math.PI), black);
  roof.material = paint('#151515', 0.8);
  (roof.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  roof.rotation.x = -Math.PI / 2; // half-tube axis along Z, open side down
  roof.scale.set(1, 1, 0.6);
  roof.position.set(0, 1.05, -0.15);
  roof.castShadow = true;
  g.add(roof);
  for (const [x, z] of [[-0.62, 0.8], [0.62, 0.8], [-0.64, -1.1], [0.64, -1.1]] as const) cyl(g, 0.025, 0.025, 1.1, x, 0.62, z, steel, 6);
  box(g, 1.3, 0.3, 0.05, 0, 1.12, -1.1, black); // rear canopy flap

  // Windshield + headlight + handlebar.
  const glass = new THREE.MeshStandardMaterial({ color: '#bfe3ff', transparent: true, opacity: 0.35, roughness: 0.1 });
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), glass);
  ws.position.set(0, 0.98, 0.82);
  ws.rotation.x = -0.15;
  g.add(ws);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), paint('#fff6d0', 0.2, 0, '#ffe9a8'));
  lamp.position.set(0, 0.55, 1.2);
  lamp.name = 'headlight';
  g.add(lamp);
  box(g, 0.6, 0.04, 0.04, 0, 0.62, 0.55, steel); // handlebar

  // Fare meter on the left of the driver.
  const meter = box(g, 0.16, 0.2, 0.12, -0.42, 0.62, 0.55, black);
  meter.name = 'meter';
  const meterFace = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), paint('#ff3b30', 0.3, 0, '#ff3b30'));
  meterFace.position.set(-0.42, 0.65, 0.615);
  g.add(meterFace);

  // Rear panel art, a sacred tradition.
  const back = textTexture(512, 256, '#f2c12e', [
    ['Dekho magar', 'bold 64px "Arial Black", sans-serif', '#b3261e'],
    ['PYAAR SE', 'bold 72px Impact, "Arial Black", sans-serif', '#1f4fb3'],
    ['MH-0X-BC-420', 'bold 34px monospace', '#151515'],
  ]);
  decal(g, back, 1.1, 0.5, 0, 0.12, -1.135, Math.PI);
  // Side stripe.
  for (const s of [-1, 1]) {
    const side = textTexture(512, 64, '#f2c12e', [['PANDEY TRAVELS • NO UDHAAR', 'bold 36px Arial, sans-serif', '#151515']]);
    decal(g, side, 1.1, 0.14, 0.652 * s, 0.32, -0.55, (s * Math.PI) / 2);
  }
  return g;
}
