import { UniversalCamera, Vector3 } from '@babylonjs/core';

export const WALK_EYE_HEIGHT = 1.6;
export const WALK_RADIUS = 0.2;

export class WalkCamera extends UniversalCamera {
  override _updatePosition() {
    // Looking up/down changes the view, never the direction of walking.
    this.cameraDirection.y = 0;
    super._updatePosition();
  }
  configure() {
    this.ellipsoid = new Vector3(WALK_RADIUS, WALK_EYE_HEIGHT / 2, WALK_RADIUS);
    // FreeCamera already lowers the collision center by ellipsoid.y.
    // A second negative offset raises the resting eye height above 2m.
    this.ellipsoidOffset.setAll(0);
    this.inertia = 0.2;
    this.fov = 1.05;
    this.speed = 0.28;
  }
}
