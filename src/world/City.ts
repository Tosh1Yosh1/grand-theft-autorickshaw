import * as THREE from 'three';
import { DISTRICT_INFO } from '../content/hoardings';
import type { GameContext, GameSystem } from '../core/System';
import { profileFor } from '../core/graphics';
import { showDistrictBanner } from '../ui/districtBanner';
import { CityBuilder, type Chunk } from './city/CityBuilder';
import { buildFilmistan, buildJugaadpur, buildKachra, buildSarkari, buildStartup, containerStack, tree, type Landmarks } from './city/districts';
import { BLOCK, GRID, HALF, LANDMARK_PLOTS, SEA_Z, blocks, districtAt, roadCoord, type DistrictId } from './city/layout';
import { cityUniforms } from './city/materials';
import { makeRng, range } from './city/rng';
import { buildFlyover, buildPolesAndWires, buildRoads, buildStalls, buildTrucks } from './city/roads';

/** Mumbhai: generates the whole city once, then culls chunks by distance every frame. */
export class City implements GameSystem {
  readonly name = 'city';
  landmarks!: Landmarks;
  currentDistrict: DistrictId | null = null;
  private ctx!: GameContext;
  private chunks: Chunk[] = [];
  private water!: THREE.Mesh;

  init(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.services.city = this;
    const r = makeRng(0xb4a7);
    const b = new CityBuilder(ctx.physics);
    const blockList = blocks();
    const lm: Partial<Landmarks> = {};
    for (const [x, z, w, d] of Object.values(LANDMARK_PLOTS)) b.reserved.push([x - w / 2 - 2, z - d / 2 - 4, x + w / 2 + 2, z + d / 2 + 2]);

    for (const blk of blockList) {
      switch (blk.district) {
        case 'jugaadpur': buildJugaadpur(b, r, blk); buildStalls(b, r, blk, 3, false); break;
        case 'sarkari': buildSarkari(b, r, blk, lm); buildStalls(b, r, blk, 1, false); break;
        case 'startup': buildStartup(b, r, blk, lm); buildStalls(b, r, blk, 1, true); break;
        case 'filmistan': buildFilmistan(b, r, blk, lm); buildStalls(b, r, blk, 1, false); break;
        case 'kachra': buildKachra(b, r, blk, lm); break;
      }
    }
    for (const m of buildRoads(b, r, blockList, ctx.services.potholes)) b.root.add(m);
    buildPolesAndWires(b, r);
    buildTrucks(b, r, 18);
    buildFlyover(b);
    this.buildDocks(b, r);

    // Landmark doors are on the pavement in front of each plot.
    const door = ([x, z, , d]: readonly number[]) => new THREE.Vector3(x!, 0, z! - d! / 2 - 3);
    lm.safehouse = door(LANDMARK_PLOTS.safehouse);
    lm.dentingPainting = door(LANDMARK_PLOTS.dentingPainting);
    lm.netaOffice = door(LANDMARK_PLOTS.netaOffice);
    lm.sarkariDaftar ??= new THREE.Vector3(roadCoord(7) + 30, 0, roadCoord(6) - 6);
    lm.studio7 ??= new THREE.Vector3(roadCoord(2) + 20, 0, roadCoord(3) - 6);
    lm.botalwalaGodown ??= new THREE.Vector3(roadCoord(4) + 15, 0, roadCoord(9) - 6);
    lm.disruptxTower ??= new THREE.Vector3(roadCoord(7) + 30, 0, roadCoord(2) - 6);
    this.landmarks = lm as Landmarks;
    this.landmarkSigns(b);

    // Ground beyond the city + the sea at Kachra Ghat.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: '#b98a5e', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ctx.scene.add(ground);
    ctx.physics.world.createCollider(ctx.physics.rapier.ColliderDesc.cuboid(2000, 0.1, 2000).setTranslation(0, -0.1, 0));

    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 1600, 1, 1),
      new THREE.MeshStandardMaterial({ color: '#2f6d80', roughness: 0.25, metalness: 0.3 }),
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(0, 0.06, SEA_Z + 800);
    ctx.scene.add(this.water);

    b.finish(ctx.scene);
    this.chunks = [...b.chunks.values()];
  }

  private buildDocks(b: CityBuilder, r: () => number) {
    // Concrete apron between the last road and the sea, with containers and cranes.
    const z0 = HALF + 6;
    b.put('concrete', 0, 0, (z0 + SEA_Z) / 2, GRID * BLOCK, 0.3, SEA_Z - z0, 0, '#9e9a8f');
    b.solid(0, 0.15, (z0 + SEA_Z) / 2, (GRID * BLOCK) / 2, 0.15, (SEA_Z - z0) / 2);
    for (let k = 0; k < 40; k++) containerStack(b, r, range(r, -HALF + 10, HALF - 10), range(r, z0 + 6, SEA_Z - 10));
    for (let x = -HALF + 40; x < HALF; x += 120) {
      // Gantry crane: two legs and a beam, painted that specific crane orange.
      for (const s of [-1, 1]) b.block('container', x + s * 6, SEA_Z - 6, 1, 22, 1, '#f77f00');
      b.put('container', x, 22, SEA_Z - 6, 14, 1.5, 1.5, 0, '#f77f00');
      b.put('container', x, 22, SEA_Z + 6, 1.5, 1.5, 26, 0, '#f77f00');
    }
    for (let k = 0; k < 10; k++) tree(b, r, range(r, -HALF, HALF), z0 + 2);
  }

  private landmarkSigns(b: CityBuilder) {
    const plot = (p: readonly number[], kind: 'jugaad' | 'plain', h: number, color: string, key: string, title: string, sub: string, bg: string, fg: string) => {
      const [x, z, w, d] = p as [number, number, number, number];
      b.block(kind, x, z, w, h, d, color);
      const slot = b.atlas.slot(key, { title, sub, bg, fg });
      b.atlas.place(slot, x, Math.min(h - 1, 4.6), z - d / 2 - 0.06, w * 0.8, w * 0.25, Math.PI);
    };
    plot(LANDMARK_PLOTS.safehouse, 'jugaad', 6.4, '#ffb4a2', 'safehouse', 'PANDEY NIWAS', 'Room 4. Rent pending since 2021.', '#fff1e6', '#6d2e46');
    plot(LANDMARK_PLOTS.dentingPainting, 'plain', 5, '#adb5bd', 'denting', 'DENTING-PAINTING', 'Naya colour, naya identity. ₹2000', '#023e8a', '#ffd60a');
    plot(LANDMARK_PLOTS.netaOffice, 'plain', 5.5, '#fefae0', 'neta', 'NETAJI JANSAMPARK', 'Har kaam hoga. Rate card andar.', '#ffffff', '#ff6d00');
  }

  update(): void {
    const { camera, store } = this.ctx;
    const { graphics, retro } = store.getState().settings;
    const far = profileFor(graphics, retro).fogFar + 90;
    const detailFar = graphics === 'potato' ? 70 : graphics === 'ultra' ? 220 : 140;
    for (const c of this.chunks) {
      const d = Math.hypot(c.center.x - camera.position.x, c.center.z - camera.position.z);
      c.group.visible = d < far;
      c.details.visible = d < detailFar + 60;
    }
    const water = this.water.material as THREE.MeshStandardMaterial;
    water.color.setHSL(0.53, 0.45, 0.32 - cityUniforms.uNight.value * 0.22);

    // District entry banner.
    const p = this.ctx.services.player?.position ?? camera.position;
    const d = districtAt(p.x, p.z);
    if (d !== this.currentDistrict) {
      const first = this.currentDistrict === null;
      this.currentDistrict = d;
      const info = DISTRICT_INFO[d]!;
      void first;
      showDistrictBanner(info.name, info.tagline, info.color);
      this.ctx.events.emit('district:enter', { id: d });
    }
  }
}
