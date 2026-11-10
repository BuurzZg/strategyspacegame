import { Activity } from '../engine/activity.js';
import { isqrt, distSq3, dirVec, clamp, sin as SIN } from '../engine/math.js';
import { FlyTo } from './fly.js';

// Unit vector (length 1024) from a to b, or along +x if they coincide.
function toward(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = isqrt(dx * dx + dy * dy + dz * dz);
  return d ? [Math.trunc((dx * 1024) / d), Math.trunc((dy * 1024) / d), Math.trunc((dz * 1024) / d)] : [1024, 0, 0];
}
function clampPoint(w, x, y, z) { const b = w.bounds; return [clamp(x, b.x0, b.x1), clamp(y, b.y0, b.y1), clamp(z, b.z0, b.z1)]; }

// Attack one target. The ship's Attacks trait does the shooting every tick (focus target
// first); this activity only flies the ship:
//   strafe   (fighters, bombers) run straight at the target, break away past it, come round again
//   standoff (corvettes and up)  close to a comfortable range, then hold station nose-on
// With a leash, the ship gives up and flies back if a chase drags it too far from where it started.
export class Attack extends Activity {
  static label = 'Attacking';
  constructor(target, opts = {}) { super(); this.target = target; this.leash = opts.leash || 0; this.phase = 'run'; this.t = 0; this.bp = null; }
  onFirstRun(self) { this.home = [self.x, self.y, self.z]; }
  tick(self) {
    if (this.canceling) return true;
    const t = this.target, at = self.attack, m = self.mobile, w = self.world;
    if (!at || !at.enabled || !at.canTarget(t)) return true;
    at.focus = t; at.focusFrame = w.frame;
    if (!m) return false;
    m.goal = null;
    m.engaging = t.id; // fly past it on attack runs rather than steering round it
    if (this.leash && distSq3(self.x, self.y, self.z, this.home[0], this.home[1], this.home[2]) > this.leash * this.leash) {
      const back = new FlyTo(this.home[0], this.home[1], this.home[2]);
      back.next = this.next;
      this.next = back;
      return true;
    }
    const d = w.edgeDist(self, t);
    if (at.info.Style === 'turret') return false;
    if (at.info.Style === 'strafe') this.strafe(self, t, d);
    else this.standoff(self, t, d);
    return false;
  }

  strafe(self, t, d) {
    const at = self.attack, m = self.mobile, w = self.world, info = at.info;
    if (this.phase === 'run') {
      // aim a little past the target so the run is flown at speed, weaving side to side (and a
      // little up and down) to spoil the enemy's aim
      const u = toward(self, t), past = 1500;
      const wob = Math.trunc((SIN((w.frame * 23 + self.id * 131) & 1023) * info.Jink) / 1024);
      const bob = Math.trunc((SIN((w.frame * 17 + self.id * 77 + 256) & 1023) * info.Jink) / 2048);
      // sideways: horizontal, square to the line of attack
      const hl = isqrt(u[0] * u[0] + u[1] * u[1]) || 1;
      const sx = Math.trunc((-u[1] * wob) / hl), sy = Math.trunc((u[0] * wob) / hl);
      const [x, y, z] = clampPoint(w, t.x + Math.trunc((u[0] * past) / 1024) + sx, t.y + Math.trunc((u[1] * past) / 1024) + sy, t.z + Math.trunc((u[2] * past) / 1024) + bob);
      m.flyToward(x, y, z);
      if (d < info.BreakRange) {
        // break away along the nose, alternating high and low by ship
        const f = dirVec(self.yaw, self.pitch), out = info.BreakDistance, up = (self.id & 1 ? 1 : -1) * Math.trunc(out / 3);
        this.bp = clampPoint(w, self.x + Math.trunc((f[0] * out) / 1024), self.y + Math.trunc((f[1] * out) / 1024), self.z + Math.trunc((f[2] * out) / 1024) + up);
        this.phase = 'break'; this.t = 0;
      }
    } else {
      const [x, y, z] = this.bp;
      if (m.flyToward(x, y, z) || ++this.t > 75 || distSq3(self.x, self.y, self.z, x, y, z) < 600 * 600) this.phase = 'run';
    }
  }

  standoff(self, t, d) {
    const at = self.attack, m = self.mobile, w = self.world;
    const range = at.range, want = Math.trunc((range * at.info.StandoffPct) / 100);
    const u = toward(self, t);
    if (d > Math.trunc((range * 92) / 100)) {
      // close in to the standoff distance from the target's hull
      const D = isqrt(distSq3(self.x, self.y, self.z, t.x, t.y, t.z));
      const back = want + (D - d); // the wanted gap, plus the target's own reach toward us
      const [x, y, z] = clampPoint(w, t.x - Math.trunc((u[0] * back) / 1024), t.y - Math.trunc((u[1] * back) / 1024), t.z - Math.trunc((u[2] * back) / 1024));
      m.flyToward(x, y, z);
    } else if (d < Math.trunc(want / 3)) {
      const [x, y, z] = clampPoint(w, self.x - Math.trunc((u[0] * 3) / 2), self.y - Math.trunc((u[1] * 3) / 2), self.z - Math.trunc((u[2] * 3) / 2));
      m.flyToward(x, y, z);
    } else m.hold(t.x, t.y, t.z);
  }
}

// Fly to a point, fighting anything hostile met on the way, then carry on.
export class AttackMove extends Activity {
  constructor(x, y, z) { super(); this.x = x | 0; this.y = y | 0; this.z = z | 0; this.fight = null; this.scan = 0; }
  get label() { return this.fight ? 'Attacking' : 'Advancing'; }
  tick(self) {
    if (this.canceling) { if (this.fight) this.fight.cancel(self); return true; }
    if (this.fight) {
      if (!this.fight.run(self)) return false;
      this.fight = null;
    }
    if (--this.scan <= 0) {
      this.scan = 8;
      const auto = self.trait('AutoTarget');
      const t = auto ? auto.acquire(auto.info.ScanRange) : null;
      if (t) { this.fight = new Attack(t); return false; }
    }
    self.mobile.goal = { x: this.x, y: this.y, z: this.z };
    if (self.mobile.flyToward(this.x, this.y, this.z)) { self.mobile.goal = null; return true; }
    return false;
  }
}
