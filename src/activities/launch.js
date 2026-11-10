import { Activity } from '../engine/activity.js';
import { dirVec } from '../engine/math.js';

// Fly straight out of a launch bay along the nose, speeding up, until the ship is clear of
// the hull that built it. A ship can't be turned back mid-launch: orders given now run
// once it is clear. While launching it is a ghost (exempt from crowding), so it isn't shoved
// sideways out of the hull.
export class Launch extends Activity {
  static label = 'Launching';
  constructor(fromId, clearance) { super(); this.from = fromId; this.clearance = clearance; this.t = 0; }
  tick(self) {
    const m = self.mobile, w = self.world;
    const mother = w.actorById.get(this.from);
    const r = self.health ? self.health.info.Radius : 0;
    if (!mother || mother.dead || w.edgeDist(self, mother) - r >= this.clearance || ++this.t > 500) return true;
    m.ghost = true;
    m.speed = Math.min(m.info.MaxSpeed, m.speed + m.info.Acceleration);
    const f = dirVec(self.yaw, self.pitch);
    self.x += Math.trunc((f[0] * m.speed) / 1024);
    self.y += Math.trunc((f[1] * m.speed) / 1024);
    self.z += Math.trunc((f[2] * m.speed) / 1024);
    w.clampToBounds(self);
    m.moving = true;
    return false;
  }
}
