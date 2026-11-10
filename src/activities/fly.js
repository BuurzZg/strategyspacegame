import { Activity } from '../engine/activity.js';
import { CELL, distSq3 } from '../engine/math.js';

// Fly to a point in 3D space and stop there. Open space needs no pathfinding; obstacle
// avoidance arrives with asteroids (milestone 3).
//
// If other hulls keep shoving the ship off its point (the point is inside the Forge's hull,
// or a crowd already holds it) and it stops getting closer, it calls that arrival instead
// of pushing forever. A ship that is only turning is never shoved, so it isn't cut short.
export class FlyTo extends Activity {
  constructor(x, y, z, label = '') { super(); this.x = x | 0; this.y = y | 0; this.z = z | 0; this.best = Infinity; this.stuck = 0; this.text = label; }
  get label() { return this.text || 'Moving'; }
  tick(self) {
    if (this.canceling) return true;
    const m = self.mobile;
    if (m.flyToward(this.x, this.y, this.z)) { m.goal = null; return true; }
    const d2 = distSq3(self.x, self.y, self.z, this.x, this.y, this.z);
    if (d2 < this.best) { this.best = d2; this.stuck = 0; }
    else if (m.shoved >= self.world.frame - 1 && ++this.stuck > 40 && d2 < 64 * CELL * CELL) { m.goal = null; return true; }
    return false;
  }
}
