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
    this.buildPlayground();
    // A pothole slalom on the "road" south of spawn.
    const holes = ctx.services.potholes;
    if (holes) for (let i = 0; i < 14; i++) holes.add(-2 + Math.sin(i * 1.7) * 3, -20 - i * 6, 0.6 + (i % 3) * 0.25);
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
    ramp.position.set(14, 1.2, -6);
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

  /** Static box helper: visual + collider in one go. */
  private solid(w: number, h: number, d: number, x: number, y: number, z: number, color: string, rotY = 0): THREE.Mesh {
    const { scene, physics } = this.ctx;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    const q = m.quaternion;
    physics.world.createCollider(
      physics.rapier.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
    );
    return m;
  }

  /** Stairs, a wall, a ledge and a chai tapri to test the controller against. */
  private buildPlayground(): void {
    for (let i = 0; i < 8; i++) this.solid(3, 0.25 * (i + 1), 0.6, -6, 0.125 * (i + 1), 8 - i * 0.6, '#9c8f80');
    this.solid(3, 2, 3, -6, 1, 2.2, '#9c8f80'); // landing at the top of the stairs
    this.solid(12, 3, 0.4, 0, 1.5, -14, '#d9c7a1'); // wall
    this.solid(2, 1.1, 2, 4, 0.55, 8, '#7a6a58'); // jumpable ledge
    this.solid(2, 1.9, 2, 7, 0.95, 8, '#7a6a58'); // too-high ledge
    // Chai tapri: counter, roof, and a sign.
    const tapri = new THREE.Group();
    this.solid(2.4, 1, 1.2, 10, 0.5, 2, '#2f7d4f');
    this.solid(3, 0.1, 2, 10, 2.5, 2.2, '#c0392b');
    for (const [px, pz] of [[-1.3, -0.8], [1.3, -0.8], [-1.3, 0.8], [1.3, 0.8]] as const) {
      this.solid(0.08, 2.5, 0.08, 10 + px, 1.25, 2.2 + pz, '#5a4632');
    }
    const sign = document.createElement('canvas');
    sign.width = 512; sign.height = 128;
    const g = sign.getContext('2d')!;
    g.fillStyle = '#ffd23f'; g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#7a1f12'; g.font = 'bold 56px "Arial Black", sans-serif'; g.textAlign = 'center';
    g.fillText('PAPPU CHAI CENTRE', 256, 70);
    g.font = 'italic 26px Georgia, serif'; g.fillText('Udhaar kal milega', 256, 108);
    const tex = new THREE.CanvasTexture(sign);
    tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.7), new THREE.MeshBasicMaterial({ map: tex }));
    board.position.set(10, 2.95, 3.21);
    tapri.add(board);
    this.ctx.scene.add(tapri);
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
          .setTranslation(-8 + (Math.random() - 0.5) * 8, 6 + Math.random() * 14, -6 + (Math.random() - 0.5) * 8)
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
