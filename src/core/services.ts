import type { Pedestrians } from '../ai/peds/Pedestrians';
import type { Traffic } from '../ai/traffic/Traffic';
import type { Animals } from '../ai/animals/Animals';
import type { StreetEvents } from '../ai/events/StreetEvents';
import type { Player } from '../player/Player';
import type { ThirdPersonCamera } from '../player/ThirdPersonCamera';
import type { VehicleManager } from '../vehicles/VehicleManager';
import type { City } from '../world/City';
import type { DayNight } from '../world/DayNight';
import type { Potholes } from '../world/Potholes';

/**
 * Cross-system handles, filled in as systems init. Optional because init order matters:
 * read them in update(), not in init(), unless you added the provider first.
 */
export interface Services {
  player?: Player;
  camera?: ThirdPersonCamera;
  vehicles?: VehicleManager;
  potholes?: Potholes;
  city?: City;
  dayNight?: DayNight;
  peds?: Pedestrians;
  traffic?: Traffic;
  animals?: Animals;
  events?: StreetEvents;
}
