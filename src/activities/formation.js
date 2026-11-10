import { Activity } from '../engine/activity.js';
import { distSq3, angleDiff, turnToward } from '../engine/math.js';
import { Attack } from './attack.js';

// Fly in formation: keep station on this ship's slot round the group's anchor until the
// group has arrived and the ship is settled on its slot, facing the group's heading.
// In an advancing group (attack-move), aggressive ships break off to fight what they meet,
// and the whole group holds while anyone is fighting.
export class FormationMove extends Activity {
  constructor(groupId) { super(); this.gid = groupId; this.fight = null; this.scan = 0; }
  get label() { return this.fight ? 'Attacking' : this.settling ? 'Forming up' : 'In formation'; }
  tick(self) {
    if (this.canceling) { if (this.fight) this.fight.cancel(self); return true; }
    const w = self.world, F = w.formations, g = F && F.get(this.gid);
    if (!g || self.formation !== g.id) return true;
    if (this.fight) {
      g.engaged = w.frame;
      if (!this.fight.run(self)) return false;
      this.fight = null;
    }
    if (g.attack && self.attack && (!self.stance || self.stance.mode === 'aggressive') && --this.scan <= 0) {
      this.scan = 8;
      const auto = self.trait('AutoTarget');
      const t = auto ? auto.acquire(auto.info.ScanRange) : null;
      if (t) { this.fight = new Attack(t); g.engaged = w.frame; return false; }
    }
    const p = F.slotPos(g, self.id);
    const m = self.mobile;
    const d2 = distSq3(self.x, self.y, self.z, p[0], p[1], p[2]);
    this.settling = d2 > 900 * 900;
    if (!g.dest && d2 <= 160 * 160 && m.speed <= 6) {
      // settled: turn to the group's heading, then stop
      self.yaw = turnToward(self.yaw, g.yaw, m.info.TurnSpeed);
      if (self.pitch !== 0) self.pitch += self.pitch > 0 ? -Math.min(self.pitch, m.info.PitchSpeed) : Math.min(-self.pitch, m.info.PitchSpeed);
      m.speed = 0;
      if (Math.abs(angleDiff(self.yaw, g.yaw)) <= m.info.TurnSpeed && self.pitch === 0) { m.goal = null; return true; }
      return false;
    }
    m.keepStation(p[0], p[1], p[2], g.vx, g.vy, g.vz, g.yaw);
    return false;
  }
}
