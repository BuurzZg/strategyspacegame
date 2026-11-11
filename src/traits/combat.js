import { defineTrait, Trait } from '../engine/traits.js';
import { isqrt, dirVec, cos as COS } from '../engine/math.js';
import { fireWeapon, muzzleOf } from '../engine/weapons.js';
import { reach } from '../engine/avoid.js';
import { Attack, AttackMove } from '../activities/attack.js';
import { DockHangar } from '../activities/hangar.js';
import { FlyTo } from '../activities/fly.js';
import { CELL, clamp } from '../engine/math.js';

// ---------------------------------------------------------------- Armament
// One weapon mount. Forward / Side / Up place the muzzle in the ship's frame; Alternate
// swaps port and starboard each shot (twin guns). Arc is the half-angle the mount can fire
// into around the nose (1024 = a full turn, so 512 is a turret that covers everything;
// fighters' fixed guns use a narrow arc and must point at what they shoot).
defineTrait('Armament', class Armament extends Trait {
  created() {
    this.weapon = this.world.rules.weapons.get(this.info.Weapon);
    if (!this.weapon) throw new Error(`${this.self.type}: unknown weapon ${this.info.Weapon}`);
    this.cooldown = (this.self.id * 7) % Math.max(1, this.weapon.ReloadDelay); // stagger volleys
    this.shot = 0;
    this.cosArc = COS(Math.min(512, this.info.Arc));
  }
  tick() { if (this.cooldown > 0) this.cooldown--; }
  inArc(t) {
    if (this.info.Arc >= 512) return true;
    const s = this.self, f = dirVec(s.yaw, s.pitch);
    const dx = t.x - s.x, dy = t.y - s.y, dz = t.z - s.z, d = isqrt(dx * dx + dy * dy + dz * dz);
    return d === 0 || Math.trunc((f[0] * dx + f[1] * dy + f[2] * dz) / d) >= this.cosArc;
  }
  // Range is measured from the muzzle, so the guns on a long hull reach as far as their own spot allows.
  canFireAt(t) {
    const [x, y, z] = muzzleOf(this.self, this.info, 1);
    const d = this.world.edgeDistPoint(x, y, z, t);
    return d <= this.weapon.Range && d >= this.weapon.MinRange && this.inArc(t);
  }
  fire(t) {
    if (this.cooldown > 0 || !this.canFireAt(t)) return false;
    fireWeapon(this.world, this.self, this, t, this.info.Alternate && this.shot % 2 ? -1 : 1);
    this.shot++;
    this.cooldown = this.weapon.Burst > 1 && this.shot % this.weapon.Burst !== 0 ? this.weapon.BurstDelay : this.weapon.ReloadDelay;
    return true;
  }
}, { Weapon: '', Forward: 0, Side: 0, Up: 0, Arc: 512, Alternate: false });

// ---------------------------------------------------------------- Attacks
// Fires the ship's armaments every tick: at its focus target first (set by the Attack
// activity), then at anything else hostile it can reach (opportunity fire, so turrets keep
// shooting while the ship flies). How the ship manoeuvres in a fight:
//   Style: strafe (attack runs; fighters), standoff (hold at StandoffPct of range), or
//          turret (never manoeuvres to fight: the Forge)
//   BreakRange / BreakDistance: when a strafing run breaks off, and how far it carries on
//   Jink: how far (world units) a strafing ship weaves side to side on its run, to spoil aim
defineTrait('Attacks', class Attacks extends Trait {
  created() {
    this.self.attack = this;
    this.focus = null; this.focusFrame = -10;
    this.near = []; this.scanT = this.self.id % 6;
    this._arms = null;
  }
  get arms() { return (this._arms ||= this.self.traitsOf('Armament')).filter((a) => a.enabled); }
  get range() { let r = 0; for (const a of this.arms) r = Math.max(r, a.weapon.Range); return r; }
  canTarget(t) {
    return !!t && !t.dead && !t.disposed && !!t.health && this.self.owner.isEnemy(t.owner) && this.world.canSee(this.self.owner, t);
  }
  // Enemies within weapon range, nearest first.
  scan() {
    const self = this.self, w = this.world, r = this.range;
    const out = [];
    const rs = reach(self);
    for (const a of w.unitsInSphere(self.x, self.y, self.z, r + rs + w.maxHalfLength + 1500, [])) {
      if (!this.canTarget(a) || (a.ward && a.ward())) continue; // (nothing to gain shooting at the warded)
      const d = w.edgeDist(self, a);
      if (d <= r + rs) out.push([d, a]); // each mount then checks its own range
    }
    out.sort((p, q) => p[0] - q[0] || p[1].id - q[1].id);
    return out.map((p) => p[1]);
  }
  tick() {
    // held still by the Twain (mainspring.js): no shots
    if (this.self.stillUntil > this.world.frame) return;
    if (this.self.burrowed) return; // buried monsters neither scan nor shoot
    const arms = this.arms;
    if (!arms.some((a) => a.cooldown === 0)) return;
    const w = this.world;
    const focus = this.focusFrame >= w.frame - 1 && this.canTarget(this.focus) ? this.focus : null;
    // passive ships only shoot when ordered to (their focus target)
    if (--this.scanT <= 0) { this.scanT = 6; this.near = this.info.HoldFire || (this.self.stance && this.self.stance.mode === 'passive') ? [] : this.scan(); }
    for (const a of arms) {
      if (a.cooldown > 0) continue;
      if (focus && a.fire(focus)) continue;
      for (const t of this.near) if (this.canTarget(t) && a.fire(t)) break;
    }
  }
  resolveOrder(o) {
    const self = this.self, t = o.target && o.target.actor;
    if (o.name === 'Attack' && t && this.canTarget(t)) self.queueActivity(new Attack(t), o.queued);
    else if (o.name === 'AttackMove' && o.target && !t && self.mobile) self.queueActivity(new AttackMove(o.target.x, o.target.y, o.target.z), o.queued);
  }
}, { Style: 'standoff', StandoffPct: 70, BreakRange: 700, BreakDistance: 3000, Jink: 0, HoldFire: false });

// ---------------------------------------------------------------- Stance
// How a ship behaves when enemies are about, unless you give it an order:
//   aggressive  go after enemies that come close (within a leash), fight back when shot
//   defensive   hold position: guns fire at whatever comes in range, but it never chases
//   passive     never fire, and fly away from whoever shoots at it (collectors, scouts)
// An explicit Attack order is always obeyed.
export const STANCES = ['aggressive', 'defensive', 'passive'];
defineTrait('Stance', class Stance extends Trait {
  created() { this.mode = this.info.Initial; this.self.stance = this; this.fled = -1000; }
  resolveOrder(o) {
    if (o.name !== 'SetStance' || !STANCES.includes(o.extra)) return;
    this.mode = o.extra;
    // a chase the ship started on its own ends when it is told to hold back
    const act = this.self.activity;
    if (this.mode !== 'aggressive' && act instanceof Attack && act.leash) this.self.cancelActivity();
  }
  damaged({ attacker }) {
    const self = this.self, w = this.world;
    if (this.mode !== 'passive' || !self.mobile || !attacker || attacker.dead || w.frame - this.fled < 75) return;
    this.fled = w.frame;
    // run straight away from the attacker, about 2.5 km
    const dx = self.x - attacker.x, dy = self.y - attacker.y, dz = self.z - attacker.z;
    const d = Math.max(1, isqrt(dx * dx + dy * dy + dz * dz));
    const k = 25 * CELL, b = w.bounds;
    const x = clamp(self.x + Math.trunc((dx * k) / d), b.x0, b.x1), y = clamp(self.y + Math.trunc((dy * k) / d), b.y0, b.y1), z = clamp(self.z + Math.trunc((dz * k) / d), b.z0, b.z1);
    if (w.formations) w.formations.leave([self]);
    self.mobile.goal = { x, y, z };
    self.queueActivity(new FlyTo(x, y, z, 'Fleeing'), false);
  }
}, { Initial: 'aggressive' });

// ---------------------------------------------------------------- AutoTarget
// An idle armed ship goes after enemies that come within ScanRange (and after anyone who
// shoots it), but gives up a chase that drags it more than Leash from where it started.
// Stances arrive with Milestone 5. A pilot's perks (crew.yaml Perks, Milestone 19) change it:
//   guardian  only goes after enemies within Guard of its own Forge, on a shorter leash
//   hunter    scans and chases further
//   finisher  goes for the most damaged enemy in range, not the nearest
//   survivor  turns for home (docks) when its hull falls under Retreat percent
// (steady, "holds formation", launches in the defensive stance: ranks.js)
const GUARD = 6144, RETREAT = 30;
defineTrait('AutoTarget', class AutoTarget extends Trait {
  created() { this.timer = (this.self.id * 3) % this.info.ScanInterval; }
  has(perk) { const p = this.self.perks; return !!p && p.includes(perk); }
  forge() { const self = this.self; return this.world.actors.find((a) => a.owner === self.owner && !a.dead && a.has('Hangar')) || null; }
  leash() { return this.has('guardian') ? this.info.Leash >> 1 : this.has('hunter') ? this.info.Leash * 2 : this.info.Leash; }
  tick() {
    if (this.self.burrowed) return; // buried monsters neither scan nor shoot
    const self = this.self;
    if (!self.attack || --this.timer > 0) return;
    this.timer = this.info.ScanInterval;
    // Gets them home: badly hurt, it turns for the Forge and goes aboard
    if (this.has('survivor') && !self.retreating && self.health && self.health.hp * 100 < self.health.maxHp * RETREAT) {
      const f = this.forge();
      if (f) { self.retreating = true; self.cancelActivity(); self.queueActivity(new DockHangar(f.id), false); return; }
    }
    if (self.retreating || !self.isIdle || (self.stance && self.stance.mode !== 'aggressive')) return;
    const t = this.acquire(this.has('hunter') ? Math.trunc((this.info.ScanRange * 3) / 2) : this.info.ScanRange);
    if (t) self.queueActivity(new Attack(t, { leash: this.leash() }), false);
  }
  damaged({ attacker }) {
    const self = this.self;
    if (!self.attack || !self.isIdle || self.retreating || !attacker || attacker.dead || !self.attack.canTarget(attacker)) return;
    if (self.stance && self.stance.mode !== 'aggressive') return; // defensive ships return fire from where they are
    self.queueActivity(new Attack(attacker, { leash: this.leash() }), false);
  }
  // The best enemy within range: armed ships before unarmed ones, then the nearest (or, for a
  // finisher, the most damaged; for a guardian, only those near its Forge).
  acquire(range) {
    const self = this.self, w = this.world, at = self.attack, guard = this.has('guardian') ? this.forge() : null, fin = this.has('finisher');
    let best = null, bs = Infinity;
    for (const a of w.unitsInSphere(self.x, self.y, self.z, range + w.maxHalfLength + 1500, [])) {
      if (!at.canTarget(a) || (a.ward && a.ward())) continue; // (the Mainspring's core, while its organs live)
      const d = w.edgeDist(self, a);
      if (d > range) continue;
      if (guard && w.edgeDist(guard, a) > GUARD) continue;
      const hurt = fin && a.health ? Math.trunc((a.health.hp * 4096) / Math.max(1, a.health.maxHp)) : 0;
      const s = (fin ? hurt : d) + (a.attack ? 0 : fin ? 8192 : 4096);
      if (s < bs) { bs = s; best = a; }
    }
    return best;
  }
}, { ScanRange: 6144, ScanInterval: 8, Leash: 12288 });

// ---------------------------------------------------------------- wrecks
// Bigger hulls leave a wreck when destroyed: a dark, slowly drifting shell worth some
// salvage (Pct of the ship's cost). Fighters just break up.
defineTrait('LeavesWreck', class extends Trait {
  killed() {
    const self = this.self, w = this.world, h = self.health.info;
    const cost = self.info.traitInfo('Valued')?.Cost || 0;
    const init = {
      x: self.x, y: self.y, z: self.z, yaw: self.yaw, pitch: self.pitch,
      model: self.info.traitInfo('WithModel')?.Model || self.type, of: self.type,
      radius: h.Radius, halfLength: h.HalfLength, salvage: Math.trunc((cost * this.info.Pct) / 100) + this.info.Bonus,
      vx: (self.x - self.px) * 4, vy: (self.y - self.py) * 4, vz: (self.z - self.pz) * 4,
    };
    w.addFrameEndTask((ww) => ww.createActor('wreck', ww.neutral, init));
  }
}, { Pct: 40, Bonus: 0 });

// A wreck drifts on with the momentum the ship died with (in 1/4 units per tick), slowing
// to a stop, and is solid: ships steer round it. Shearers cut salvage from it.
defineTrait('Wreck', class Wreck extends Trait {
  created() {
    const i = this.self.init;
    this.self.wreck = this; this.self.deposit = this; this.self.body = this;
    this.size = i.radius || this.info.Radius;
    this.halfLength = i.halfLength | 0; // long hulls stay capsules when they die
    this.salvage = i.salvage ?? this.info.Salvage;
    this.maxAmount = Math.max(1, this.salvage);
    this.kind = 'salvage'; this.field = -1;
    this.model = i.model || ''; this.of = i.of || '';
    this.vx = i.vx | 0; this.vy = i.vy | 0; this.vz = i.vz | 0;
    // a drive component sealed inside: found once cutters have taken relicAt salvage
    this.relic = i.relic || ''; this.relicName = i.relicName || ''; this.relicAt = i.relicAt | 0; this.taken = 0;
    // rust mites: an infested wreck hatches a swarm when it is first cut into
    this.infested = !!i.infested;
  }
  radius() { return this.size; }
  get amount() { return this.salvage; }
  get solid() { return true; }
  // Shearers cut salvage from it; when the last is taken the hulk breaks apart.
  take(n, by = null) {
    const t = Math.min(n, this.salvage);
    this.salvage -= t;
    this.taken += t;
    if (this.infested && this.taken >= 30 && by) this.hatch(by);
    if (by && !this.bpGiven && this.taken * 2 >= this.maxAmount) this.blueprint(by);
    if (this.relic && this.taken >= this.relicAt && by) {
      const w = this.world, id = this.relic, name = this.relicName || `the ${w.rules.content.items?.[id]?.Name || id}`;
      this.relic = '';
      if (w.point) w.point.logOf(by.owner).found.push(id);
      w.fx({ t: 'relic', id, name, owner: by.owner.index, actor: this.self.id, x: this.self.x, y: this.self.y, z: this.self.z });
      w.notify(by.owner, `The cutters found ${name}, sealed in a vault. It is aboard.`, 'good');
    }
    if (this.salvage <= 0 && !this.self.dead) {
      const self = this.self, w = this.world;
      self.dead = true;
      w.fx({ t: 'depleted', actor: self.id, x: self.x, y: self.y, z: self.z, radius: this.size, wreck: true });
      w.addFrameEndTask((ww) => ww.removeActor(self));
    }
    return t;
  }
  // A wreck of a hull its cutters' side cannot build yet gives up the blueprint, half-way cut.
  blueprint(by) {
    this.bpGiven = true;
    const w = this.world, known = (by.owner.slot || {}).blueprints;
    if (!known || known.includes(this.of)) return;
    const bp = Object.values(w.rules.content.items || {}).find((it) => it.Kind === 'blueprint' && it.Unlocks === this.of);
    if (!bp || !w.point) return;
    const found = w.point.logOf(by.owner).found;
    if (found.includes(bp.id)) return;
    found.push(bp.id);
    w.notify(by.owner, `The cutters found the plans of the ${w.rules.actor(this.of).traitInfo('Tooltip').Name} in the wreck: the ${bp.Name}.`, 'good');
    w.fx({ t: 'relic', id: bp.id, name: bp.Name, owner: by.owner.index, actor: this.self.id, x: this.self.x, y: this.self.y, z: this.self.z });
  }
  hatch(by) {
    const w = this.world, s = this.self;
    this.infested = false;
    const fauna = w.players.find((p) => p.faction === 'fauna');
    if (!fauna || !w.rules.actors.has('mites')) return;
    for (let i = 0; i < 4; i++) w.createActor('mites', fauna, { x: s.x + (i - 2) * 500, y: s.y + ((i & 1) ? 600 : -600), z: s.z + 300, yaw: (i * 256) & 1023 });
    w.fx({ t: 'hatch', actor: s.id, x: s.x, y: s.y, z: s.z });
    w.notify(by.owner, 'Rust mites pour out of the wreck!', 'bad');
  }
  tick() {
    if (!this.vx && !this.vy && !this.vz) return;
    const s = this.self;
    s.x += this.vx >> 2; s.y += this.vy >> 2; s.z += this.vz >> 2;
    this.world.clampToBounds(s);
    this.vx -= Math.trunc(this.vx / 32) || Math.sign(this.vx);
    this.vy -= Math.trunc(this.vy / 32) || Math.sign(this.vy);
    this.vz -= Math.trunc(this.vz / 32) || Math.sign(this.vz);
  }
}, { Radius: 800, Salvage: 0 });

