import { buildAutoRickshaw } from './models/autoRickshaw';
import { buildBike, buildBullockCart, buildBus, buildInnova, buildMaruti, buildTaxi, buildTempo, buildThar } from './models/cars';
import { buildNewsVan, buildPoliceBike, buildPoliceJeep } from './models/police';
import type { VehicleConfig } from './types';

const SUSP = { restLength: 0.32, stiffness: 30, compression: 2.3, relaxation: 2.6, travel: 0.25 };

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
  suspension: SUSP,
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

const fourWheels = (x: number, zf: number, zr: number, y: number, r: number) => [
  { pos: [-x, y, zf] as [number, number, number], radius: r, steer: true, drive: false },
  { pos: [x, y, zf] as [number, number, number], radius: r, steer: true, drive: false },
  { pos: [-x, y, zr] as [number, number, number], radius: r, steer: false, drive: true },
  { pos: [x, y, zr] as [number, number, number], radius: r, steer: false, drive: true },
];

export const MARUTI: VehicleConfig = {
  ...AUTO_RICKSHAW,
  id: 'maruti',
  name: 'Maaruti 8OO',
  mass: 650,
  halfExtents: [0.7, 0.3, 1.65],
  centerOfMass: [0, -0.15, 0],
  wheels: fourWheels(0.62, 1.05, -1.05, -0.2, 0.27),
  engineForce: 2600,
  brakeForce: 30,
  reverseForce: 900,
  maxSpeed: 26,
  maxSteer: 0.55,
  antiRoll: 0.8,
  horn: 'car',
  engineSound: 'petrol',
  cameraDistance: 6.5,
  seat: [0.32, -0.35, 0.05],
  passengerSeats: [[-0.32, -0.35, 0.05], [-0.3, -0.35, -0.8], [0.3, -0.35, -0.8]],
  hasMeter: false,
  buildModel: () => buildMaruti(),
};

export const TAXI: VehicleConfig = { ...MARUTI, id: 'taxi', name: 'Kaali-Peeli Taxi', halfExtents: [0.8, 0.33, 2.0], wheels: fourWheels(0.7, 1.3, -1.3, -0.22, 0.3), hasMeter: true, buildModel: buildTaxi };

export const INNOVA: VehicleConfig = {
  ...MARUTI,
  id: 'innova',
  name: 'Innocent-a (VIP)',
  mass: 1700,
  halfExtents: [0.9, 0.42, 2.3],
  wheels: fourWheels(0.8, 1.45, -1.45, -0.3, 0.34),
  engineForce: 6500,
  brakeForce: 60,
  reverseForce: 2400,
  maxSpeed: 32,
  horn: 'car',
  cameraDistance: 7.5,
  seat: [0.38, -0.35, 0.35],
  buildModel: () => buildInnova(),
};

export const THAR: VehicleConfig = {
  ...INNOVA,
  id: 'thar',
  name: 'Thaar (with Loud Boy)',
  mass: 1500,
  halfExtents: [0.88, 0.45, 1.95],
  wheels: fourWheels(0.82, 1.3, -1.25, -0.35, 0.4),
  centerOfMass: [0, -0.05, 0],
  engineForce: 6000,
  maxSpeed: 30,
  antiRoll: 0.65,
  engineSound: 'diesel',
  seat: [0.38, -0.25, 0.2],
  passengerSeats: [[-0.38, -0.25, 0.2]],
  buildModel: () => buildThar(),
};

export const TEMPO: VehicleConfig = {
  ...INNOVA,
  id: 'tempo',
  name: 'Tempo',
  mass: 2200,
  halfExtents: [0.9, 0.55, 2.35],
  centerOfMass: [0, 0.1, 0.3],
  wheels: fourWheels(0.78, 1.5, -1.4, -0.35, 0.36),
  engineForce: 6000,
  maxSpeed: 22,
  antiRoll: 0.6,
  horn: 'truck',
  engineSound: 'diesel',
  cameraDistance: 8.5,
  seat: [0.35, -0.05, 1.5],
  buildModel: () => buildTempo(),
};

export const BUS: VehicleConfig = {
  ...INNOVA,
  id: 'bus',
  name: 'Route 420 Bus',
  mass: 8000,
  halfExtents: [1.25, 1.1, 5.0],
  centerOfMass: [0, -0.3, 0],
  wheels: fourWheels(1.05, 3.4, -3.2, -0.6, 0.5),
  engineForce: 26000,
  brakeForce: 260,
  reverseForce: 9000,
  maxSpeed: 20,
  maxSteer: 0.5,
  antiRoll: 0.8,
  horn: 'bus',
  engineSound: 'diesel',
  cameraDistance: 13,
  seat: [0.7, -0.3, 4.0],
  passengerSeats: [],
  buildModel: buildBus,
};

export const BIKE: VehicleConfig = {
  ...AUTO_RICKSHAW,
  id: 'bike',
  name: 'Splendour (seats 4 + cylinder)',
  mass: 160,
  halfExtents: [0.25, 0.3, 0.95],
  centerOfMass: [0, -0.35, 0],
  // Four wheels in a narrow line: arcade bike that can't fall over (much).
  wheels: [
    { pos: [-0.12, -0.15, 0.75], radius: 0.3, steer: true, drive: false },
    { pos: [0.12, -0.15, 0.75], radius: 0.3, steer: true, drive: false },
    { pos: [-0.12, -0.15, -0.7], radius: 0.3, steer: false, drive: true },
    { pos: [0.12, -0.15, -0.7], radius: 0.3, steer: false, drive: true },
  ],
  engineForce: 1100,
  brakeForce: 10,
  reverseForce: 250,
  maxSpeed: 25,
  maxSteer: 0.5,
  antiRoll: 1,
  horn: 'bike',
  engineSound: 'twoStroke',
  cameraDistance: 5,
  seat: [0, -0.15, -0.3],
  passengerSeats: [[0, -0.1, -0.6], [0, -0.05, -0.85], [0, 0.4, -0.15]],
  hasMeter: false,
  buildModel: () => buildBike(),
};

export const BULLOCK_CART: VehicleConfig = {
  ...AUTO_RICKSHAW,
  id: 'cart',
  name: 'Bullock Cart (secret)',
  mass: 900,
  halfExtents: [0.75, 0.4, 2.0],
  centerOfMass: [0, -0.2, 0.4],
  wheels: [
    { pos: [-0.85, -0.1, -0.6], radius: 0.5, steer: false, drive: true },
    { pos: [0.85, -0.1, -0.6], radius: 0.5, steer: false, drive: true },
    { pos: [0, -0.3, 2.0], radius: 0.3, steer: true, drive: true }, // the bulls, basically
  ],
  engineForce: 2600,
  maxSpeed: 13, // nobody overtakes it in Jugaadpur; the game makes sure of that
  maxSteer: 0.7,
  antiRoll: 0.9,
  horn: 'cart',
  engineSound: 'diesel',
  seat: [0, 0.1, 0.2],
  passengerSeats: [[-0.4, 0.1, -0.8], [0.4, 0.1, -0.8]],
  hasMeter: false,
  buildModel: buildBullockCart,
};

export const POLICE_JEEP: VehicleConfig = { ...THAR, id: 'policeJeep', name: 'Poleece Jeep', engineForce: 6800, maxSpeed: 27, buildModel: buildPoliceJeep };
export const POLICE_BIKE: VehicleConfig = { ...BIKE, id: 'policeBike', name: 'Poleece Bike', maxSpeed: 23, buildModel: buildPoliceBike };
export const NEWS_VAN: VehicleConfig = { ...TEMPO, id: 'newsVan', name: 'Cheekh TV Van', engineForce: 7000, maxSpeed: 24, buildModel: buildNewsVan };

export const VEHICLES: Record<string, VehicleConfig> = {
  auto: AUTO_RICKSHAW,
  maruti: MARUTI,
  taxi: TAXI,
  innova: INNOVA,
  thar: THAR,
  tempo: TEMPO,
  bus: BUS,
  bike: BIKE,
  cart: BULLOCK_CART,
  policeJeep: POLICE_JEEP,
  policeBike: POLICE_BIKE,
  newsVan: NEWS_VAN,
};
