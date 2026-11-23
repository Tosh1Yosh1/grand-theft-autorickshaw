import * as THREE from 'three';
import { BOX_TAGLINES } from '../../content/boxLabels';

/** Procedural "FRAGILE — Pandey Logistics" cardboard texture. No external assets. */
function drawLabel(tagline: string, seed: number): HTMLCanvasElement {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);

  // Cardboard base with fibre speckle.
  g.fillStyle = '#c4904f';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(90,55,20,0.12)' : 'rgba(255,230,180,0.10)';
    g.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 3, 1);
  }
  // Packing tape strip.
  g.fillStyle = 'rgba(225,190,120,0.75)';
  g.fillRect(0, size * 0.44, size, size * 0.12);
  // Dark edge so stacked boxes read as separate.
  g.strokeStyle = 'rgba(70,40,15,0.6)';
  g.lineWidth = 10;
  g.strokeRect(5, 5, size - 10, size - 10);

  // Stamped FRAGILE, slightly crooked like it was done in a hurry.
  g.save();
  g.translate(size / 2, size * 0.27);
  g.rotate((rnd() - 0.5) * 0.18);
  g.strokeStyle = '#b3261e';
  g.lineWidth = 8;
  g.strokeRect(-200, -52, 400, 104);
  g.fillStyle = '#b3261e';
  g.font = 'bold 96px Impact, "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('FRAGILE', 0, 4);
  g.restore();

  g.fillStyle = '#3b2410';
  g.textAlign = 'center';
  g.font = 'bold 40px "Arial Black", Arial, sans-serif';
  g.fillText('— Pandey Logistics —', size / 2, size * 0.68);
  g.font = 'italic 30px Georgia, serif';
  g.fillText(tagline, size / 2, size * 0.8);
  // Up arrows.
  g.font = 'bold 44px Arial, sans-serif';
  g.fillText('↑↑', size * 0.12, size * 0.92);
  return c;
}

let materials: THREE.MeshStandardMaterial[] | null = null;

/** Shared materials, one per tagline. Created lazily, reused by every box. */
export function cardboardMaterials(): THREE.MeshStandardMaterial[] {
  if (materials) return materials;
  materials = BOX_TAGLINES.map((line, i) => {
    const tex = new THREE.CanvasTexture(drawLabel(line, 1234 + i * 977));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 });
  });
  return materials;
}

export const BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
