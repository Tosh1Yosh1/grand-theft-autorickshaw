import type { Player } from '../player/Player';
import type { ThirdPersonCamera } from '../player/ThirdPersonCamera';

/**
 * Cross-system handles, filled in as systems init. Optional because init order matters:
 * read them in update(), not in init(), unless you added the provider first.
 */
export interface Services {
  player?: Player;
  camera?: ThirdPersonCamera;
}
