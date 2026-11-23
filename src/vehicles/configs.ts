import { buildAutoRickshaw } from './models/autoRickshaw';
import type { VehicleConfig } from './types';

export const AUTO_RICKSHAW: VehicleConfig = {
  id: 'auto',
  name: 'Auto-rickshaw',
  mass: 380,
  halfExtents: [0.62, 0.45, 1.15],
  centerOfMass: [0, 0.05, 0.05], // a bit high: autos lean dramatically on turns
  wheels: [
    { pos: [0, -0.1, 1.05], radius: 0.24, steer: true, drive: false },
    { pos: [-0.58, -0.1, -0.75], radius: 0.24, steer: false, drive: true },
    { pos: [0.58, -0.1, -0.75], radius: 0.24, steer: false, drive: true },
  ],
  engineForce: 1400,
  brakeForce: 18,
  reverseForce: 500,
  maxSpeed: 17, // ~60 km/h, on a good day, downhill
  maxSteer: 0.65,
  steerSpeed: 3.5,
  steerFalloff: 0.55,
  suspension: { restLength: 0.32, stiffness: 28, compression: 2.3, relaxation: 2.6, travel: 0.25 },
  frictionSlip: 2.2,
  sideFriction: 1.1,
  antiRoll: 0.55,
  maxHealth: 100,
  horn: 'auto',
  engineSound: 'twoStroke',
  cameraDistance: 6,
  seat: [0, -0.22, 0.15],
  passengerSeats: [[-0.3, 0.42, -0.65], [0.3, 0.42, -0.65], [0, 0.42, -0.65]],
  hasMeter: true,
  buildModel: buildAutoRickshaw,
};

export const VEHICLES: Record<string, VehicleConfig> = { auto: AUTO_RICKSHAW };
