import { BLOCK, GRID, HALF, ROAD_W, SEA_Z, blocks, roadCoord } from '../world/city/layout';

const DISTRICT_COLORS: Record<string, string> = {
  jugaadpur: '#c98b5a',
  startup: '#6b8fa8',
  filmistan: '#a46a8a',
  sarkari: '#b5a77a',
  kachra: '#7b8b6a',
};

/** Paper-map style render of Mumbhai. 1 px per metre * scale; origin at the map's top-left. */
export function renderCityMap(scale: number): HTMLCanvasElement {
  const size = (HALF * 2 + 200) * scale;
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(size);
  const g = c.getContext('2d')!;
  const tx = (x: number) => (x + HALF + 100) * scale;
  g.fillStyle = '#c4a57a';
  g.fillRect(0, 0, size, size);
  // Sea.
  g.fillStyle = '#3b6f86';
  g.fillRect(0, tx(SEA_Z), size, size);
  for (const b of blocks()) {
    g.fillStyle = DISTRICT_COLORS[b.district]!;
    g.fillRect(tx(b.x0 - 3), tx(b.z0 - 3), (b.x1 - b.x0 + 6) * scale, (b.z1 - b.z0 + 6) * scale);
  }
  g.fillStyle = '#3a3734';
  for (let i = 0; i <= GRID; i++) {
    const r = roadCoord(i);
    g.fillRect(tx(r - ROAD_W / 2), tx(-HALF - 6), ROAD_W * scale, (GRID * BLOCK + 12) * scale);
    g.fillRect(tx(-HALF - 6), tx(r - ROAD_W / 2), (GRID * BLOCK + 12) * scale, ROAD_W * scale);
  }
  // The flyover.
  g.strokeStyle = '#d9d2c3';
  g.lineWidth = 4 * scale;
  g.beginPath();
  g.moveTo(tx(roadCoord(1) - 45), tx(roadCoord(4)));
  g.lineTo(tx(roadCoord(6) - 18), tx(roadCoord(4)));
  g.stroke();
  return c;
}

export const mapToCanvas = (v: number, scale: number) => (v + HALF + 100) * scale;
