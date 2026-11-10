import { Activity } from '../engine/activity.js';
import { CELL, isqrt, distSq3, turnToward } from '../engine/math.js';

// Come home: fly to the Forge's nearer launch bay, line up outside it, glide in, and go aboard
// (the ship leaves the map and is stored in the Forge's hangar until the next launch).
export class DockHangar extends Activity {
  constructor(forgeId) { super(); this.forgeId = forgeId; this.phase = 'go'; this.best = Infinity; this.stuck = 0; }
  get label() { return this.phase === 'in' ? 'Going aboard' : 'Returning to the Forge'; }
  tick(self) {
    if (this.canceling) return true;
    const w = self.world, forge = w.actorById.get(this.forgeId), m = self.mobile;
    const hangar = forge && !forge.dead && forge.owner === self.owner ? forge.trait('Hangar') : null;
    const bay = forge && forge.trait('LaunchBay');
    if (!hangar || !bay) return true;
    // the nearer of the two bays
    const port = bay.pose(1), star = bay.pose(-1);
    const side = distSq3(self.x, self.y, self.z, port.x, port.y, port.z) <= distSq3(self.x, self.y, self.z, star.x, star.y, star.z) ? 1 : -1;
    const mouth = side > 0 ? port : star;
    // line-up point: straight out from the bay, a couple of cells off the hull
    const out = 2 * CELL + (self.health ? self.health.info.Radius : 0);
    const dx = mouth.x - forge.x, dy = mouth.y - forge.y, dl = isqrt(dx * dx + dy * dy) || 1;
    const lx = mouth.x + Math.trunc((dx * out) / dl), ly = mouth.y + Math.trunc((dy * out) / dl), lz = mouth.z;
    if (this.phase === 'go') {
      const arrived = m.flyToward(lx, ly, lz);
      const d2 = distSq3(self.x, self.y, self.z, lx, ly, lz);
      if (d2 < this.best) { this.best = d2; this.stuck = 0; } else if (m.shoved >= w.frame - 1) this.stuck++;
      if (arrived || (this.stuck > 40 && d2 < 9 * CELL * CELL)) this.phase = 'in';
      return false;
    }
    // glide into the bay mouth (a ghost: no crowding), turning to the Forge's heading
    m.ghost = true;
    const ex = mouth.x - self.x, ey = mouth.y - self.y, ez = mouth.z - self.z, d = isqrt(ex * ex + ey * ey + ez * ez);
    const step = Math.max(10, Math.min(50, Math.trunc(d / 8)));
    self.yaw = turnToward(self.yaw, forge.yaw, m.info.TurnSpeed);
    m.speed = Math.min(step, d); m.moving = true;
    if (d <= step) { hangar.stow(self); return true; }
    self.x += Math.trunc((ex * step) / d); self.y += Math.trunc((ey * step) / d); self.z += Math.trunc((ez * step) / d);
    return false;
  }
}
