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

/** Phase 0 test ground: dusty floor + a lot of very fragile parcels. */
export class TestLevel implements GameSystem {
  readonly name = 'testLevel';
  private ctx!: GameContext;
  private boxes: Box[] = [];
  private spawnCount = 0;

  init(ctx: GameContext): void {
    this.ctx = ctx;
    this.buildGround();
    this.spawnBoxes(40);
    ctx.events.on('debug:spawnBoxes', ({ count }) => this.spawnBoxes(count));
    ctx.events.on('debug:resetLevel', () => this.reset());
  }

  update(): void {
    const { input, events } = this.ctx;
    if (input.wasPressed('debugSpawnBoxes')) events.emit('debug:spawnBoxes', { count: 10 });
    if (input.wasPressed('debugReset')) events.emit('debug:resetLevel');
  }

  private buildGround(): void {
    const { scene, physics } = this.ctx;
    const R = physics.rapier;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: '#b98a5e', roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(200, 100, '#8f5f3a', '#a7774d');
    (grid.material as THREE.Material).opacity = 0.35;
    (grid.material as THREE.Material).transparent = true;
    grid.position.y = 0.01;
    scene.add(grid);
    physics.world.createCollider(R.ColliderDesc.cuboid(100, 0.1, 100).setTranslation(0, -0.1, 0));

    // A loading ramp so parcels have somewhere dramatic to tumble off.
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.4, 10),
      new THREE.MeshStandardMaterial({ color: '#8d8d8d', roughness: 0.9 }),
    );
    ramp.position.set(8, 1.2, 0);
    ramp.rotation.z = 0.3;
    ramp.castShadow = ramp.receiveShadow = true;
    scene.add(ramp);
    const q = ramp.quaternion;
    physics.world.createCollider(
      R.ColliderDesc.cuboid(3, 0.2, 5)
        .setTranslation(ramp.position.x, ramp.position.y, ramp.position.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
    );
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
          .setTranslation((Math.random() - 0.5) * 10, 6 + Math.random() * 14, (Math.random() - 0.5) * 10)
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
    this.spawnBoxes(40);
  }
}

function randomQuat(): RAPIER.Rotation {
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
  );
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}
