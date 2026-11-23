import type * as THREE from 'three';
import type { HornKind } from '../audio/AudioManager';

export interface WheelSpec {
  /** Chassis-local connection point (x right, y up, z forward). */
  pos: [number, number, number];
  radius: number;
  steer: boolean;
  drive: boolean;
}

/** Everything that makes one vehicle type feel different. Add new vehicles as configs. */
export interface VehicleConfig {
  id: string;
  name: string;
  mass: number;
  /** Chassis collider half extents. */
  halfExtents: [number, number, number];
  /** Centre of mass offset (local). Higher = tippier. */
  centerOfMass: [number, number, number];
  wheels: WheelSpec[];
  engineForce: number;
  brakeForce: number;
  reverseForce: number;
  maxSpeed: number; // m/s
  maxSteer: number; // radians at standstill
  steerSpeed: number; // rad/s
  /** 0..1, how much steering is reduced at top speed. */
  steerFalloff: number;
  suspension: { restLength: number; stiffness: number; compression: number; relaxation: number; travel: number };
  frictionSlip: number;
  sideFriction: number;
  /** 0 = rolls freely like a real auto on a sharp turn, 1 = glued flat. */
  antiRoll: number;
  maxHealth: number;
  horn: HornKind;
  engineSound: 'twoStroke' | 'petrol' | 'diesel';
  cameraDistance: number;
  /** Where the driver sits (local), and which pose. */
  seat: [number, number, number];
  /** Passenger seats, for missions/hustles. */
  passengerSeats: [number, number, number][];
  hasMeter?: boolean;
  /** Builds the visual. Wheels are created separately from `wheels`. */
  buildModel(): THREE.Group;
  /** Optional custom wheel mesh. */
  buildWheel?(radius: number): THREE.Object3D;
}
