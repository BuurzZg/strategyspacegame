import { defineTrait, Trait } from '../engine/traits.js';
import { CELL, sin as SIN, cos as COS, clamp } from '../engine/math.js';
import { Launch } from '../activities/launch.js';
import { FlyTo } from '../activities/fly.js';

// ---------------------------------------------------------------- info-only traits
// Queue: which production queues can build it. BuildDuration: ticks (25 per second).
defineTrait('Buildable', class extends Trait {}, { Queue: [], BuildDuration: 250, Prerequisites: [], BuildPaletteOrder: 0 });
defineTrait('ConsumesCapacity', class extends Trait {}, { Amount: 1 });
defineTrait('ProvidesCapacity', class extends Trait {}, { Amount: 30 });
defineTrait('ProvidesPrerequisite', class extends Trait {
  get name() { return this.info.Prerequisite || this.self.type; }
}, { Prerequisite: '' });

// ---------------------------------------------------------------- launch bays
// A pair of bays, one on each flank, in the ship's own frame (world units):
//   Forward  along the nose     Side  out to port (+) and starboard (-)     Up  along z
//   ExitYaw  how far the launch heading turns away from the nose (256 = straight out sideways)
//   LaunchSpeed  speed a new ship leaves the bay at    Clearance  gap to open before it steers
defineTrait('LaunchBay', class extends Trait {
  // World position and heading of a bay mouth. side: 1 = port, -1 = starboard.
  pose(side) {
    const s = this.self, i = this.info;
    const c = COS(s.yaw), sn = SIN(s.yaw), f = i.Forward, l = i.Side * side;
    return {
      x: s.x + Math.trunc((c * f - sn * l) / 1024),
      y: s.y + Math.trunc((sn * f + c * l) / 1024),
      z: s.z + i.Up,
      yaw: (s.yaw + side * i.ExitYaw) & 1023,
    };
  }
}, { Forward: 0, Side: 2048, Up: 0, ExitYaw: 200, LaunchSpeed: 20, Clearance: 1536 });

// ---------------------------------------------------------------- rally point
// Where new ships fly after launch. Without one they muster beside the bay they left.
defineTrait('RallyPoint', class extends Trait {
  created() { this.point = null; }
  resolveOrder(o) {
    if (o.name === 'SetRallyPoint' && o.target && !o.target.actor) {
      const b = this.world.bounds;
      this.point = { x: clamp(o.target.x, b.x0, b.x1), y: clamp(o.target.y, b.y0, b.y1), z: clamp(o.target.z, b.z0, b.z1) };
    } else if (o.name === 'ClearRallyPoint') this.point = null;
  }
}, {});

// ---------------------------------------------------------------- production
// One queue, built in order. The cost is paid when an item is queued and refunded in full
// if it is cancelled (or if the ship building it is destroyed).
//
// Orders (subject: the ship with the queue):
//   StartProduction  extra: actor type      CancelProduction  extra: index in the queue
defineTrait('ProductionQueue', class ProductionQueue extends Trait {
  created() {
    this.queue = []; this.progress = 0; this.launches = 0;
    // the foundry's condition on the voyage: percent of normal speed (0: nothing is built)
    const slot = this.self.owner.slot || {};
    this.speed = slot.buildSpeed ?? 100; this.acc = 0;
  }
  crewOf(type) { const c = this.rules.actor(type).traitInfo('Crew'); return c && c.Count ? c : null; }
  get rules() { return this.world.rules; }
  buildables() { return this.rules.buildablesFor(this.info.Type); }
  duration(type) { return this.rules.actor(type).traitInfo('Buildable').BuildDuration; }

  // null if `type` can be queued now, otherwise the reason shown to the player.
  canQueue(type) {
    const info = this.rules.actors.get(type);
    const b = info && info.traitInfo('Buildable');
    if (!b || !b.Queue.includes(this.info.Type)) return 'The Forge cannot build that';
    const known = (this.self.owner.slot || {}).blueprints;
    if (known && !known.includes(type)) return 'No blueprint for it yet';
    const p = this.self.owner;
    const miss = p.tech ? p.tech.missing(b.Prerequisites) : null;
    if (miss) return `Requires ${miss}`;
    if (this.queue.length >= this.info.MaxQueue) return 'Build queue is full';
    const need = info.traitInfo('ConsumesCapacity')?.Amount || 0;
    if (p.capacity && p.capacity.used() + need > p.capacity.cap()) return 'Fleet capacity reached';
    if (p.resources.cash < info.traitInfo('Valued').Cost) return 'Not enough ore';
    const crew = this.crewOf(type);
    if (crew && p.crew && !p.crew.has(crew.Role, crew.Count)) return `Not enough ${crew.Role}: it needs ${crew.Count}`;
    if (this.speed <= 0) return 'The foundry is wrecked';
    return null;
  }

  resolveOrder(o) {
    const p = this.self.owner;
    if (o.name === 'StartProduction') {
      const type = String(o.extra);
      const err = this.canQueue(type);
      if (err) { this.world.notify(p, err, 'bad'); return; }
      p.resources.take(this.rules.actor(type).traitInfo('Valued').Cost, 'spent');
      const crew = this.crewOf(type);
      if (crew && p.crew) p.crew.take(crew.Role, crew.Count);
      this.queue.push(type);
    } else if (o.name === 'CancelProduction') {
      const i = o.extra | 0;
      if (i < 0 || i >= this.queue.length) return;
      const type = this.queue.splice(i, 1)[0];
      this.refund(type);
      if (i === 0) this.progress = 0;
    }
  }

  refund(type) {
    const p = this.self.owner, crew = this.crewOf(type);
    p.resources.give(this.rules.actor(type).traitInfo('Valued').Cost, 'refunded');
    if (crew && p.crew) p.crew.give(crew.Role, crew.Count);
  }
  // everything still queued is cancelled (the Forge is destroyed, or leaves)
  refundAll() {
    for (const type of this.queue) this.refund(type);
    this.queue.length = 0;
    this.progress = 0;
  }
  killed() { this.refundAll(); }

  tick() {
    if (!this.queue.length) return;
    // speed in percent: below 100 some ticks do nothing, above it some count twice
    this.acc += this.speed;
    let steps = 0;
    while (this.acc >= 100) { this.acc -= 100; steps++; }
    this.progress += steps;
    if (this.progress < this.duration(this.queue[0])) return;
    const type = this.queue.shift();
    this.progress = 0;
    this.launch(type);
  }

  // Build complete: the ship appears in a bay mouth, flies clear, then heads for the
  // rally point (or a muster slot beside the bay). Bays alternate port and starboard.
  // `from`: a hangar entry ({ hp, cargo, kind }) when an existing ship launches, not a new build.
  launch(type, from = null) {
    const self = this.self, w = this.world;
    const bay = self.trait('LaunchBay');
    const n = this.launches++;
    const side = n % 2 ? -1 : 1;
    const pose = bay ? bay.pose(side) : { x: self.x, y: self.y, z: self.z, yaw: self.yaw };
    const unit = w.createActor(type, self.owner, pose);
    if (from) {
      if (from.xp && w.ranks) w.ranks.set(unit, from.xp);
      if (unit.health && from.hp) unit.health.hp = Math.max(1, Math.min(unit.health.maxHp, from.hp));
      if (unit.collector && from.cargo) { unit.collector.cargo = from.cargo; unit.collector.kind = from.kind; }
      w.fx({ t: 'ready', actor: unit.id, type, owner: self.owner.index, x: pose.x, y: pose.y, z: pose.z, hangar: true });
    } else {
      w.fx({ t: 'ready', actor: unit.id, type, owner: self.owner.index, x: pose.x, y: pose.y, z: pose.z });
      w.emit('produced', unit, self);
    }
    if (!unit.mobile) return unit;
    unit.mobile.speed = Math.min(unit.mobile.info.MaxSpeed, bay ? bay.info.LaunchSpeed : 0);
    unit.mobile.ghost = true; // no crowding on the spawn tick either
    unit.queueActivity(new Launch(self.id, bay ? bay.info.Clearance : CELL));
    if (unit.collector) return unit; // it starts mining as soon as it is clear
    const dest = this.destination(n, side);
    unit.mobile.goal = dest;
    unit.queueActivity(new FlyTo(dest.x, dest.y, dest.z));
    return unit;
  }

  // Slot n around the rally point, or beside the bay on `side` when there is none.
  // Slots form a 5-wide grid with 2-cell spacing so new ships don't pile onto one point.
  destination(n, side) {
    const self = this.self, b = this.world.bounds;
    const k = (n >> 1) % 20, col = (k % 5) - 2, row = Math.trunc(k / 5);
    const rally = self.trait('RallyPoint')?.point;
    let x, y, z;
    if (rally) {
      x = rally.x + col * 2 * CELL; y = rally.y + (row - 1) * 2 * CELL; z = rally.z + (side > 0 ? 0 : CELL);
    } else {
      // forward along the hull by column, outward from the flank by row
      const c = COS(self.yaw), sn = SIN(self.yaw);
      const f = col * 2 * CELL, l = side * ((self.health ? self.health.info.Radius : 0) + 3 * CELL + row * 2 * CELL);
      x = self.x + Math.trunc((c * f - sn * l) / 1024);
      y = self.y + Math.trunc((sn * f + c * l) / 1024);
      z = self.z;
    }
    return { x: clamp(x, b.x0, b.x1), y: clamp(y, b.y0, b.y1), z: clamp(z, b.z0, b.z1) };
  }
}, { Type: '', MaxQueue: 10 });
