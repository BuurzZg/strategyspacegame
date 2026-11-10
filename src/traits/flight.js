import { defineTrait, Trait } from '../engine/traits.js';
import { angleOf, angleDiff, turnToward, approach, pitchOf, dirVec, isqrt, clamp, distSq3 } from '../engine/math.js';
import { planRoute } from '../engine/avoid.js';
import { FlyTo } from '../activities/fly.js';

// 3D flight. Ships fly along their nose: they turn (yaw and pitch at limited rates),
// accelerate toward a cruise speed and brake so they stop on the target.
//
//   MaxSpeed, Acceleration, Deceleration   world units per tick (per tick^2)
//   TurnSpeed, PitchSpeed                  angle units per tick (1024 = full turn)
//   MaxPitch                               steepest climb/dive (256 = vertical)
//   TurnInPlace                            big hulls slow right down to turn; small craft keep MinSpeed% forward
//   Slip                                   share of thrust (of 1024) aimed straight at the target, so a ship
//                                          always converges even when the target is nearly vertical
//
// Ships steer around asteroids and much bigger hulls (see engine/avoid.js): they aim at a
// detour point while the straight line is blocked, and brake for the real target.
defineTrait('Flight', class Flight extends Trait {
  created() {
    this.self.mobile = this;
    this.speed = 0; this.pspeed = 0;
    this.moving = false;
    this.ghost = false;     // set each tick by Launch and Dock: no crowding while threading a hull
    this.shoved = -1;       // last frame crowding pushed this ship
    this.scraped = -1;      // last frame it was pushed off a rock or a much bigger hull (should be rare)
    this.goal = null; // last commanded destination, for UI
    this.route = null; // cached steering plan: { tx, ty, tz, x, y, z, frame, direct }
    this.engaging = 0; // id of the ship being attacked this tick: not steered round (set by Attack)
  }
  savePrev() { this.pspeed = this.speed; this.moving = false; this.ghost = false; this.engaging = 0; }

  // Where to steer this tick on the way to (tx, ty, tz): the target, or a detour point round
  // whatever is in the way. Re-planned every 8 ticks, on reaching a detour point, or when the
  // target has moved more than about 50 m (attack runs chase a moving point).
  aimFor(tx, ty, tz) {
    const p = this.route, w = this.world, self = this.self;
    if (p && Math.abs(p.tx - tx) + Math.abs(p.ty - ty) + Math.abs(p.tz - tz) < 512 && w.frame - p.frame < 8) {
      if (p.direct) return [tx, ty, tz];
      const near = 3 * this.speed + 4 * this.info.ArriveRadius;
      if (distSq3(self.x, self.y, self.z, p.x, p.y, p.z) > near * near) return [p.x, p.y, p.z];
    }
    const [x, y, z] = planRoute(w, self, tx, ty, tz, 200 + 3 * this.info.MaxSpeed, this.engaging);
    const direct = x === tx && y === ty && z === tz;
    this.route = { tx, ty, tz, x, y, z, frame: w.frame, direct };
    return [x, y, z];
  }

  // Advance one tick toward (tx, ty, tz). Returns true when the ship has arrived and stopped.
  flyToward(tx, ty, tz) {
    const self = this.self, info = this.info, w = this.world;
    const ex = tx - self.x, ey = ty - self.y, ez = tz - self.z;
    const d = isqrt(ex * ex + ey * ey + ez * ez);
    if (d <= Math.max(info.ArriveRadius, this.speed)) {
      self.x = tx; self.y = ty; self.z = tz;
      this.speed = 0;
      this.moving = true;
      return true;
    }
    // steer for the target, or for a detour point while the way is blocked
    const aim = this.aimFor(tx, ty, tz);
    let dx = aim[0] - self.x, dy = aim[1] - self.y, dz = aim[2] - self.z;
    let h2 = dx * dx + dy * dy, sd = isqrt(h2 + dz * dz);
    if (sd === 0) { dx = ex; dy = ey; dz = ez; h2 = dx * dx + dy * dy; sd = d; }
    // turn toward it
    const h = isqrt(h2);
    const wantYaw = angleOf(dx, dy);
    const wantPitch = clamp(pitchOf(h, dz), -info.MaxPitch, info.MaxPitch);
    if (h > info.ArriveRadius) self.yaw = turnToward(self.yaw, wantYaw, info.TurnSpeed);
    self.pitch = approach(self.pitch, wantPitch, info.PitchSpeed);

    // how well the nose points where we're steering (1024 = dead ahead)
    const f = dirVec(self.yaw, self.pitch);
    const align = Math.trunc((f[0] * dx + f[1] * dy + f[2] * dz) / sd);
    // speed: cruise, brake for arrival, slow down to turn. Small craft keep MinSpeed% while
    // cruising (they swing round in wide turns) but may slow right down to arrive.
    const brake = isqrt(2 * info.Deceleration * d);
    let want = Math.min(info.MaxSpeed, brake);
    const minPct = info.TurnInPlace || brake < info.MaxSpeed ? 8 : info.MinSpeed;
    const alignPct = align <= 0 ? minPct : Math.max(minPct, Math.trunc((align * align * 100) / (1024 * 1024)));
    want = Math.max(4, Math.trunc((want * alignPct) / 100));
    this.speed = this.speed < want ? Math.min(want, this.speed + info.Acceleration) : Math.max(want, this.speed - info.Deceleration);

    // move: mostly along the nose, partly straight at the target; on final approach the
    // manoeuvring thrusters take over and the ship glides straight onto the point
    const s = d < 4 * info.ArriveRadius + 3 * this.speed ? 1024 : info.Slip;
    const vx = f[0] * (1024 - s) + Math.trunc((dx * 1024) / sd) * s;
    const vy = f[1] * (1024 - s) + Math.trunc((dy * 1024) / sd) * s;
    const vz = f[2] * (1024 - s) + Math.trunc((dz * 1024) / sd) * s;
    self.x += Math.trunc((vx * this.speed) / 1048576);
    self.y += Math.trunc((vy * this.speed) / 1048576);
    self.z += Math.trunc((vz * this.speed) / 1048576);
    w.clampToBounds(self);
    this.moving = true;
    return false;
  }

  // Stay on station and point the nose at (tx, ty, tz): brake to a stop, turning on the spot.
  hold(tx, ty, tz) {
    const self = this.self, info = this.info;
    const dx = tx - self.x, dy = ty - self.y, dz = tz - self.z, h = isqrt(dx * dx + dy * dy);
    if (h > 0) self.yaw = turnToward(self.yaw, angleOf(dx, dy), info.TurnSpeed);
    self.pitch = approach(self.pitch, clamp(pitchOf(h, dz), -info.MaxPitch, info.MaxPitch), info.PitchSpeed);
    if (this.speed > 0) {
      this.speed = Math.max(0, this.speed - info.Deceleration);
      const f = dirVec(self.yaw, self.pitch);
      self.x += Math.trunc((f[0] * this.speed) / 1024);
      self.y += Math.trunc((f[1] * this.speed) / 1024);
      self.z += Math.trunc((f[2] * this.speed) / 1024);
      this.world.clampToBounds(self);
      this.moving = true;
    }
  }

  // No orders: coast to a stop along the nose and level out slowly.
  idle() {
    const self = this.self, info = this.info;
    if (this.speed > 0) {
      this.speed = Math.max(0, this.speed - info.Deceleration);
      const f = dirVec(self.yaw, self.pitch);
      self.x += Math.trunc((f[0] * this.speed) / 1024);
      self.y += Math.trunc((f[1] * this.speed) / 1024);
      self.z += Math.trunc((f[2] * this.speed) / 1024);
      this.world.clampToBounds(self);
      this.moving = this.speed > 0;
    }
    if (self.pitch !== 0) self.pitch = approach(self.pitch, 0, info.PitchSpeed >> 1);
  }

  orderFor(target) { return target.actor ? null : { order: 'Move', priority: 1 }; }
  resolveOrder(o) {
    const self = this.self;
    if ((o.name === 'Move' || (o.name === 'AttackMove' && !self.attack)) && o.target) {
      this.goal = { x: o.target.x, y: o.target.y, z: o.target.z };
      self.queueActivity(new FlyTo(o.target.x, o.target.y, o.target.z), o.queued);
    } else if (o.name === 'Stop') { self.cancelActivity(); this.goal = null; }
  }
}, { MaxSpeed: 60, Acceleration: 2, Deceleration: 3, TurnSpeed: 6, PitchSpeed: 5, MaxPitch: 230, TurnInPlace: false, MinSpeed: 35, Slip: 160, ArriveRadius: 48, Bank: 30 });

// Used by the renderer only: yaw change per tick, to bank into turns.
export function yawRate(a) { return angleDiff(a.pyaw, a.yaw); }
