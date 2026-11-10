import { defineTrait, Trait } from '../engine/traits.js';
import { CELL, isqrt, distSq3, clamp, sin as SIN, cos as COS } from '../engine/math.js';
import { Harvest, DeliverOre } from '../activities/harvest.js';

// ---------------------------------------------------------------- deposits
// Everything collectors gather is a deposit: it has a resource `kind`, an `amount` left, a
// `radius()`, `take(n)`, and is either `solid` (rocks, wrecks: collectors hold off its
// surface) or not (gas clouds: skimmers fly into it). Actors also get `self.body` for
// anything with a size, and `self.deposit` for anything that can be gathered.
//
// An asteroid: ore or ice. It shrinks as it is mined (to 60% of its size when nearly empty)
// and breaks up when the last of it is taken. Owned by the neutral player; not selectable
// for orders, but you can click it to see what is left.
defineTrait('Asteroid', class Asteroid extends Trait {
  created() {
    const init = this.self.init;
    this.kind = init.kind || this.info.Kind;
    this.maxOre = init.amount || init.ore || this.info.Ore;
    this.ore = this.maxOre;
    this.size = init.radius || this.info.Radius;
    this.field = init.field ?? -1;
    this.self.asteroid = this; this.self.deposit = this; this.self.body = this;
  }
  get amount() { return this.ore; }
  get maxAmount() { return this.maxOre; }
  get solid() { return true; }
  radius() { return Math.trunc((this.size * (60 + Math.trunc((40 * this.ore) / this.maxOre))) / 100); }
  // Remove up to n ore; returns how much was taken.
  take(n) {
    const t = Math.min(n, this.ore);
    this.ore -= t;
    if (this.ore <= 0 && !this.self.dead) {
      const self = this.self, w = this.world;
      self.dead = true;
      w.fx({ t: 'depleted', actor: self.id, x: self.x, y: self.y, z: self.z, radius: this.size });
      w.addFrameEndTask((ww) => ww.removeActor(self));
    }
    return t;
  }
}, { Ore: 1000, Radius: 900, Kind: 'ore' });

// A gas cloud: Glim or spores, drifting in a loose ball. Not solid: skimmers fly into it.
// It thins as it is skimmed and disperses when empty.
defineTrait('Cloud', class Cloud extends Trait {
  created() {
    const i = this.self.init;
    this.kind = i.kind || this.info.Kind;
    this.maxAmount = i.amount || this.info.Amount;
    this.amount = this.maxAmount;
    this.size = i.radius || this.info.Radius;
    this.field = -1;
    this.self.cloud = this; this.self.deposit = this; this.self.body = this;
  }
  get solid() { return false; }
  radius() { return Math.trunc((this.size * (50 + Math.trunc((50 * this.amount) / this.maxAmount))) / 100); }
  take(n) {
    const t = Math.min(n, this.amount);
    this.amount -= t;
    if (this.amount <= 0 && !this.self.dead) {
      const self = this.self, w = this.world;
      self.dead = true;
      w.fx({ t: 'dispersed', actor: self.id, kind: this.kind, x: self.x, y: self.y, z: self.z, radius: this.size });
      w.addFrameEndTask((ww) => ww.removeActor(self));
    }
    return t;
  }
}, { Kind: 'glim', Amount: 600, Radius: 3000 });

// Inert, solid rock: the pieces of arches, rings and spires. Nothing to mine; ships steer round it.
defineTrait('Rock', class Rock extends Trait {
  created() { const i = this.self.init; this.size = i.radius || this.info.Radius; this.shape = i.shape || ''; this.self.rock = this; this.self.body = this; }
  radius() { return this.size; }
}, { Radius: 1200 });

// World trait: places the asteroid fields listed in settings.fields, using the seeded RNG.
//   { name, at: [x, y, z] (cells), count, spread (cells), ore: [min, max] per asteroid }
// Rocks are scattered in a flattened ball around `at`, never overlapping.
const FIELD_NAMES = ['Tessel Shoal', 'Marrow Bank', 'Halvard Reach', 'Ostrel Deep', 'Grey Lanes', 'Pellucid Drift', 'Vane Scatter', 'Oxbow Field'];
defineTrait('AsteroidFields', class extends Trait {
  worldLoaded() {
    const w = this.world;
    this.fields = [];
    w.fields = this.fields;
    (w.settings.fields || []).forEach((f, i) => this.spawnField(i, f));
  }
  spawnField(i, f) {
    const w = this.world, rng = w.rng;
    const [cx, cy, cz] = f.at.map((v) => v * CELL);
    const spread = (f.spread || 5) * CELL;
    const [lo, hi] = f.ore || [600, 1400];
    const field = { index: i, name: f.name || FIELD_NAMES[i % FIELD_NAMES.length], kind: f.kind || 'ore', x: cx, y: cy, z: cz, spread, asteroids: [] };
    const placed = [];
    for (let n = 0; n < (f.count || 8); n++) {
      const ore = rng.range(lo, hi + 1);
      const radius = 250 + isqrt(ore * 600);
      for (let tries = 0; tries < 16; tries++) {
        const x = cx + rng.range(-spread, spread + 1), y = cy + rng.range(-spread, spread + 1), z = cz + Math.trunc(rng.range(-spread, spread + 1) / 3);
        if (distSq3(x, y, z, cx, cy, cz) > spread * spread || !w.inBounds(x, y, z)) continue;
        if (placed.some((p) => distSq3(x, y, z, p.x, p.y, p.z) < (p.r + radius + 500) * (p.r + radius + 500))) continue;
        const a = w.createActor('asteroid', w.neutral, { x, y, z, yaw: rng.int(1024), ore, radius, field: i, kind: field.kind });
        placed.push({ x, y, z, r: radius });
        field.asteroids.push(a);
        break;
      }
    }
    this.fields.push(field);
  }
}, {});

export function fieldOre(field) { let n = 0; for (const a of field.asteroids) if (!a.dead) n += a.asteroid.ore; return n; }

// ---------------------------------------------------------------- dropoffs
// Where collectors unload: the Forge's furnace maw, a Smelter's flanks. Each dock slot holds
// one collector. Positions are in the ship's own frame (forward, port, up; world units).
//   Slot i: Forward, Up, and across the hull at Side + (i - centre) * Spacing.
//   Mirror: slots alternate port and starboard instead (Side out from the axis), stepping
//           back along the hull by Spacing every pair.
//   ApproachForward / ApproachOut / ApproachUp: where a collector lines up before gliding in.
defineTrait('OreDropoff', class extends Trait {
  created() { this.slots = new Array(this.info.Slots).fill(0); }
  local(i) {
    const n = this.info;
    if (n.Mirror) return [n.Forward - (i >> 1) * n.Spacing, (i % 2 ? -1 : 1) * n.Side, n.Up];
    return [n.Forward, n.Side + Math.trunc(((2 * i - (n.Slots - 1)) * n.Spacing) / 2), n.Up];
  }
  toWorld(f, l, u) {
    const s = this.self, c = COS(s.yaw), sn = SIN(s.yaw);
    return { x: s.x + Math.trunc((c * f - sn * l) / 1024), y: s.y + Math.trunc((sn * f + c * l) / 1024), z: s.z + u };
  }
  slotPose(i) { const [f, l, u] = this.local(i); return this.toWorld(f, l, u); }
  approachPose(i) {
    const n = this.info, [f, l, u] = this.local(i);
    return this.toWorld(f + n.ApproachForward, l + Math.sign(l) * n.ApproachOut, u + n.ApproachUp);
  }
  // A free slot for collector `a` (its own if it already holds one), or -1 if all are busy.
  // Slots whose holder died or stopped delivering here are freed first.
  reserve(a) {
    for (let i = 0; i < this.slots.length; i++) {
      const id = this.slots[i];
      if (id === a.id) return i;
      if (id) { const h = this.world.actorById.get(id); if (!h || h.dead || !h.collector || h.collector.dock !== this.self.id) this.slots[i] = 0; }
    }
    const i = this.slots.indexOf(0);
    if (i >= 0) this.slots[i] = a.id;
    return i;
  }
  release(a) { const i = this.slots.indexOf(a.id); if (i >= 0) this.slots[i] = 0; }
}, { Slots: 3, Forward: 0, Side: 0, Up: 600, Spacing: 400, Mirror: false, ApproachForward: 0, ApproachOut: 0, ApproachUp: 1200 });

// ---------------------------------------------------------------- collectors
// Mines asteroids and brings the ore to the nearest dropoff. A collector works on its own
// (auto) from the moment it is built, until the player sends it somewhere else; a Harvest
// or Dock order puts it back to work.
//   Kinds: what it gathers (Gleaner: ore and ice; Shearer: salvage; Skimmer: Glim and spores)
//   Capacity: hold size   MineAmount every MineInterval ticks   MineRange: gap to a solid deposit
//   UnloadAmount: per tick while docked
// A load is one kind at a time: with something in the hold it only goes for more of the same.
//
// Orders: Harvest (target: an asteroid, or none for "nearest"), Dock (target: a dropoff:
// deliver now, then carry on mining).
defineTrait('Collector', class Collector extends Trait {
  created() {
    this.self.collector = this;
    this.kinds = this.info.Kinds.length ? this.info.Kinds : ['ore'];
    this.cargo = 0; this.kind = this.kinds[0];
    this.auto = true;
    this.target = 0;      // asteroid being worked (id)
    this.dock = 0;        // dropoff whose slot it holds (id)
    this.lastField = -1;
    this.avoid = 0;       // asteroid to skip once (couldn't reach it)
    this.retry = 0;
    this.miningFrame = -10; this.unloadFrame = -10; // for the renderer: last tick spent mining / unloading
  }
  dropoffs() { return this.world.enabledTraits('OreDropoff', this.self.owner); }
  nearestDropoff(x, y, z) {
    let best = null, bd = Infinity;
    for (const d of this.dropoffs()) { const dd = distSq3(d.self.x, d.self.y, d.self.z, x, y, z); if (dd < bd) { bd = dd; best = d; } }
    return best;
  }
  // Deposits this collector could work right now.
  deposits() {
    const w = this.world, out = [];
    for (const type of ['Asteroid', 'Wreck', 'Cloud']) for (const t of w.traitsOfType(type)) {
      if (t.self.dead || t.amount <= 0 || !this.kinds.includes(t.kind) || (this.cargo > 0 && t.kind !== this.kind)) continue;
      out.push(t);
    }
    return out;
  }
  anyOre() { return this.deposits().length > 0; }
  canWork(a) { return !!a && !!a.deposit && !a.dead && this.kinds.includes(a.deposit.kind); }

  // Best deposit to work: near us, near a dropoff, in the field we were working, not crowded
  // by our other collectors, and with plenty left.
  findAsteroid() {
    const self = this.self, w = this.world;
    const claims = new Map();
    for (const c of w.traitsOfType('Collector')) if (c !== this && c.self.owner === self.owner && !c.self.dead && c.target) claims.set(c.target, (claims.get(c.target) || 0) + 1);
    const drops = this.dropoffs();
    let best = null, bs = Infinity;
    for (const t of this.deposits()) {
      const a = t.self;
      let dd = Infinity;
      for (const d of drops) dd = Math.min(dd, isqrt(distSq3(d.self.x, d.self.y, d.self.z, a.x, a.y, a.z)));
      if (dd === Infinity) dd = 0;
      const s = isqrt(distSq3(self.x, self.y, self.z, a.x, a.y, a.z)) + Math.trunc((dd * 6) / 10)
        + (claims.get(a.id) || 0) * 6 * CELL - Math.min(t.amount, 2000)
        - (t.field >= 0 && t.field === this.lastField ? 8 * CELL : 0) + (a.id === this.avoid ? 60 * CELL : 0);
      if (s < bs) { bs = s; best = a; }
    }
    this.avoid = 0;
    return best;
  }
  // Station point beside a deposit: on the line from its centre toward us, MineRange off its
  // surface; for a gas cloud, halfway into it.
  minePoint(ast) {
    const self = this.self, dep = ast.deposit;
    const r = dep.solid ? dep.radius() + this.info.MineRange : Math.trunc(dep.radius() / 2);
    let dx = self.x - ast.x, dy = self.y - ast.y, dz = self.z - ast.z;
    let d = isqrt(dx * dx + dy * dy + dz * dz);
    if (d === 0) { dx = 1; dy = 0; dz = 0; d = 1; }
    const b = this.world.bounds;
    return {
      x: clamp(ast.x + Math.trunc((dx * r) / d), b.x0, b.x1),
      y: clamp(ast.y + Math.trunc((dy * r) / d), b.y0, b.y1),
      z: clamp(ast.z + Math.trunc((dz * r) / d), b.z0, b.z1),
    };
  }

  idle() {
    if (!this.auto || --this.retry > 0) return;
    this.retry = 75;
    if (this.cargo > 0 || this.anyOre()) this.self.queueActivity(new Harvest());
  }
  resolveOrder(o) {
    const self = this.self, t = o.target && o.target.actor;
    if (o.name === 'Move' || o.name === 'Stop') { this.auto = false; this.retry = 0; return; }
    if (o.name === 'Harvest') {
      this.auto = true;
      this.self.mobile.goal = null;
      self.queueActivity(new Harvest(this.canWork(t) ? t.id : 0), o.queued);
    } else if (o.name === 'Dock' && t && t.owner === self.owner && t.enabledTrait('OreDropoff')) {
      this.auto = true;
      this.self.mobile.goal = null;
      self.queueActivity(new DeliverOre(t.id), o.queued);
      self.queueActivity(new Harvest(), true);
    }
  }
}, { Kinds: [], Capacity: 100, MineAmount: 2, MineInterval: 5, MineRange: 420, UnloadAmount: 5 });
