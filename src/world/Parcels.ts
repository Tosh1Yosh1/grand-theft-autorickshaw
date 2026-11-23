import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { GameContext, GameSystem } from '../core/System';
import { BOX_GEOMETRY, cardboardMaterials } from './props/cardboardBox';

const MAX_BOXES = 250;
const BOX_SIZES: [number, number, number][] = [
  [1, 1, 1],
  [1.4, 0.8, 1],
  [0.7, 0.7, 0.7],
  [1.8, 1.2, 1.2],
];

interface Box {
  mesh: THREE.Mesh;
  body: RAPIER.RigidBody;
}

/** A pile of very fragile Pandey Logistics parcels to kick around. B drops more, R resets. */
export class Parcels implements GameSystem {
  readonly name = 'parcels';

  constructor(private readonly center = new THREE.Vector3()) {}
  private ctx!: GameContext;
  private boxes: Box[] = [];
  private spawnCount = 0;

  init(ctx: GameContext): void {
    this.ctx = ctx;
    this.spawnBoxes(20);
    ctx.events.on('debug:spawnBoxes', ({ count }) => this.spawnBoxes(count));
    ctx.events.on('debug:resetLevel', () => this.reset());
  }

  update(): void {
    const { input, events } = this.ctx;
    if (input.wasPressed('debugSpawnBoxes')) events.emit('debug:spawnBoxes', { count: 10 });
    if (input.wasPressed('debugReset')) events.emit('debug:resetLevel');
  }

  spawnBoxes(count: number): void {
    const { scene, physics } = this.ctx;
    const R = physics.rapier;
    const mats = cardboardMaterials();
    for (let i = 0; i < count; i++) {
      if (this.boxes.length >= MAX_BOXES) this.removeBox(this.boxes[0]!);
      const n = this.spawnCount++;
      const [sx, sy, sz] = BOX_SIZES[n % BOX_SIZES.length]!;
      const mesh = new THREE.Mesh(BOX_GEOMETRY, mats[n % mats.length]);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);

      const body = physics.world.createRigidBody(
        R.RigidBodyDesc.dynamic()
          .setTranslation(this.center.x + (Math.random() - 0.5) * 5, 3 + Math.random() * 10, this.center.z + (Math.random() - 0.5) * 5)
          .setRotation(randomQuat())
          .setAngvel({ x: Math.random() * 2, y: Math.random() * 2, z: Math.random() * 2 }),
      );
      physics.world.createCollider(
        R.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2).setDensity(0.4).setFriction(0.8).setRestitution(0.15),
        body,
      );
      physics.attach(mesh, body);
      this.boxes.push({ mesh, body });
    }
  }

  private removeBox(box: Box): void {
    this.ctx.scene.remove(box.mesh);
    this.ctx.physics.detach(box.body);
    this.boxes = this.boxes.filter((b) => b !== box);
  }

  private reset(): void {
    for (const b of [...this.boxes]) this.removeBox(b);
    this.spawnBoxes(20);
  }
}

function randomQuat(): RAPIER.Rotation {
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
  );
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}
