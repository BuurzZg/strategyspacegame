import { Activity, Wait } from '../engine/activity.js';
import { CELL, distSq3, isqrt, approach, angleDiff, turnToward } from '../engine/math.js';

// The collector's loop: pick an asteroid, fly to it and mine until the hold is full,
// deliver to the nearest dropoff, repeat. Ends when there is no ore left anywhere and the
// hold is empty.
export class Harvest extends Activity {
  static label = 'Mining';
  constructor(prefer = 0) { super(); this.prefer = prefer; }
  tick(self) {
    if (this.canceling) return true;
    const c = self.collector, w = self.world;
    if (c.cargo >= c.info.Capacity) { this.queueChild(new DeliverOre(0)); return false; }
    let ast = this.prefer ? w.actorById.get(this.prefer) : null;
    this.prefer = 0;
    if (!c.canWork(ast) || (c.cargo > 0 && ast.deposit.kind !== c.kind)) ast = c.findAsteroid();
    if (!ast) {
      if (c.cargo > 0) { this.queueChild(new DeliverOre(0)); return false; }
      return true;
    }
    c.target = ast.id;
    c.lastField = ast.deposit.field ?? -1;
    this.queueChild(new MineAsteroid(ast.id));
    return false;
  }
  onLastRun(self) { self.collector.target = 0; }
}

// Fly to a station point beside the asteroid, then hold there nose-on and mine until the hold
// is full or the rock is gone. Gives up (and skips that rock once) if other hulls keep it
// from getting there.
export class MineAsteroid extends Activity {
  constructor(id) { super(); this.id = id; this.t = 0; this.point = null; this.best = Infinity; this.stuck = 0; this.mining = false; }
  get label() { return this.mining ? 'Mining' : 'Heading out'; }
  tick(self) {
    if (this.canceling) return true;
    const w = self.world, c = self.collector, m = self.mobile;
    const ast = w.actorById.get(this.id);
    if (!ast || ast.dead || !ast.deposit || c.cargo >= c.info.Capacity) return true;
    if (c.cargo > 0 && ast.deposit.kind !== c.kind) return true; // one kind per load
    const range = c.info.MineRange;
    const edge = w.edgeDist(self, ast);
    if (!this.mining && edge > range + 150) {
      this.point ||= c.minePoint(ast);
      const p = this.point;
      if (m.flyToward(p.x, p.y, p.z)) { this.point = null; this.mining = w.edgeDist(self, ast) <= range + 600; return false; }
      const d2 = distSq3(self.x, self.y, self.z, p.x, p.y, p.z);
      if (d2 < this.best) { this.best = d2; this.stuck = 0; }
      else if (m.shoved >= w.frame - 1 && ++this.stuck > 60) { c.avoid = ast.id; return true; }
      return false;
    }
    if (edge > range + 600) { this.mining = false; this.point = null; this.best = Infinity; return false; } // knocked away
    this.mining = true;
    m.hold(ast.x, ast.y, ast.z);
    c.target = ast.id;
    c.miningFrame = w.frame;
    if (++this.t >= c.info.MineInterval) {
      this.t = 0;
      c.kind = ast.deposit.kind;
      c.cargo += ast.deposit.take(Math.min(c.info.MineAmount, c.info.Capacity - c.cargo), self);
    }
    return c.cargo >= c.info.Capacity || ast.dead;
  }
}

// Take the hold to a dropoff: fly to the line-up point of a free dock slot, glide in,
// unload, glide back out. dockId 0 means the nearest dropoff. While gliding and docked the
// collector is a ghost (no crowding) and rides along if its dock moves.
const PHASE_LABEL = { go: 'Returning', wait: 'Waiting to dock', in: 'Docking', unload: 'Unloading', out: 'Undocking' };
export class DeliverOre extends Activity {
  constructor(dockId = 0) { super(); this.dockId = dockId; this.phase = 'go'; this.slot = -1; this.best = Infinity; this.stuck = 0; this.delivered = 0; }
  get label() { return this.child ? this.child.label : PHASE_LABEL[this.phase]; }
  release(self) {
    const d = self.world.actorById.get(this.dockId);
    const t = d && d.trait('OreDropoff');
    if (t) t.release(self);
    if (self.collector.dock === this.dockId) self.collector.dock = 0;
    this.slot = -1;
  }
  tick(self) {
    const w = self.world, c = self.collector, m = self.mobile;
    if (this.canceling) { this.release(self); return true; }
    let dock = this.dockId ? w.actorById.get(this.dockId) : null;
    let dt = dock && !dock.dead && dock.owner === self.owner ? dock.enabledTrait('OreDropoff') : null;
    if (!dt) {
      // dock lost (or none chosen yet): pick the nearest one
      this.release(self);
      if (c.cargo <= 0) return true;
      dt = c.nearestDropoff(self.x, self.y, self.z);
      if (!dt) { this.queueChild(new Wait(50)); return false; }
      dock = dt.self; this.dockId = dock.id; this.phase = 'go';
    }
    if (this.phase === 'go' || this.phase === 'wait') {
      if (c.cargo <= 0) { this.release(self); return true; }
      const i = dt.reserve(self);
      if (i < 0) {
        // every slot busy: hold above the line-up point until one frees up
        this.phase = 'wait';
        const p = dt.approachPose(0);
        m.flyToward(p.x, p.y, p.z + 1600);
        return false;
      }
      this.phase = 'go'; this.slot = i; c.dock = dock.id;
      const p = dt.approachPose(i);
      const arrived = m.flyToward(p.x, p.y, p.z);
      const d2 = distSq3(self.x, self.y, self.z, p.x, p.y, p.z);
      if (d2 < this.best) { this.best = d2; this.stuck = 0; } else if (m.shoved >= w.frame - 1) this.stuck++;
      if (arrived || (this.stuck > 40 && d2 < 9 * CELL * CELL)) { this.phase = 'in'; m.speed = Math.min(m.speed, 20); }
      return false;
    }
    m.ghost = true;
    if (this.phase === 'in') {
      if (glide(self, dt.slotPose(this.slot), dock)) this.phase = 'unload';
      return false;
    }
    if (this.phase === 'unload') {
      const p = dt.slotPose(this.slot);
      self.x = p.x; self.y = p.y; self.z = p.z; self.yaw = dock.yaw; self.pitch = dock.pitch; m.speed = 0;
      const n = Math.min(c.cargo, c.info.UnloadAmount);
      c.cargo -= n; this.delivered += n;
      self.owner.resources.giveKind(c.kind, n, 'gathered');
      c.unloadFrame = w.frame;
      if (c.cargo <= 0) {
        w.fx({ t: 'deposit', actor: self.id, dock: dock.id, owner: self.owner.index, amount: this.delivered, kind: c.kind, x: self.x, y: self.y, z: self.z });
        this.phase = 'out';
      }
      return false;
    }
    // out: glide back to the line-up point, then let go of the slot
    if (glide(self, dt.approachPose(this.slot), null)) { this.release(self); return true; }
    return false;
  }
  onLastRun(self) { this.release(self); }
}

// Manoeuvring-thruster glide straight to a point, slowing as it closes; with `align`, turn
// to match that ship's heading on the way. Returns true on arrival.
function glide(self, p, align) {
  const m = self.mobile;
  const dx = p.x - self.x, dy = p.y - self.y, dz = p.z - self.z;
  const d = isqrt(dx * dx + dy * dy + dz * dz);
  if (align) {
    self.yaw = turnToward(self.yaw, align.yaw, m.info.TurnSpeed);
    self.pitch = approach(self.pitch, align.pitch, m.info.PitchSpeed);
  }
  const step = Math.max(12, Math.min(60, Math.trunc(d / 10)));
  m.speed = Math.min(step, d);
  m.moving = true;
  if (d <= step) { self.x = p.x; self.y = p.y; self.z = p.z; return !align || Math.abs(angleDiff(self.yaw, align.yaw)) <= m.info.TurnSpeed; }
  self.x += Math.trunc((dx * step) / d); self.y += Math.trunc((dy * step) / d); self.z += Math.trunc((dz * step) / d);
  return false;
}
