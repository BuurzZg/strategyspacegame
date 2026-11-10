import { Activity } from '../engine/activity.js';

// Fly to a point in 3D space and stop there. Open space needs no pathfinding; obstacle
// avoidance arrives with asteroids (milestone 3).
export class FlyTo extends Activity {
  static label = 'Moving';
  constructor(x, y, z) { super(); this.x = x | 0; this.y = y | 0; this.z = z | 0; }
  tick(self) {
    if (this.canceling) return true;
    if (self.mobile.flyToward(this.x, this.y, this.z)) { self.mobile.goal = null; return true; }
    return false;
  }
}
