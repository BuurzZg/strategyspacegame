import { Actor } from './actor.js';
import { Random } from './random.js';
import { Player } from './player.js';
import { resolveOrder } from './order.js';
import { CELL, isqrt, distSq3, hashMix, clamp, dirVec } from './math.js';

// The simulation. Everything here must be deterministic: integer state, seeded RNG,
// iteration in actor-id order. Rendering and UI only read from it, and only change it
// by sending Orders through the OrderManager.
//
// Space is a bounded box. `settings.space` gives its size in cells: { w, d, h } where
// w and d span the horizontal x-y plane and h is the height (z), centred on z = 0.
export class World {
  constructor(rules, settings) {
    this.rules = rules;
    this.settings = settings;
    const sp = settings.space || { w: 192, d: 192, h: 64 };
    this.bounds = { x0: 0, y0: 0, z0: -(sp.h * CELL) / 2, x1: sp.w * CELL, y1: sp.d * CELL, z1: (sp.h * CELL) / 2 };
    this.frame = 0;
    this.rng = new Random(settings.seed * 2654435761);
    this.nextActorId = 1;
    this.actors = [];
    this.actorById = new Map();
    this.traitIndex = new Map();
    this.effects = [];
    this.nextEffectId = 1;
    this.fxEvents = [];
    this.frameEndTasks = [];
    this.listeners = new Map();
    this.named = new Map();
    this.hashSize = 8 * CELL;
    this.unitHash = new Map();
    this.hashStamp = -1;
    this.gameOver = false;
    this.fields = []; // asteroid fields, filled by the AsteroidFields world trait
    this.maxHalfLength = 0;

    this.neutral = new Player(this, -1, { name: 'Neutral', faction: 'neutral', team: -1 });
    this.neutral.isNeutral = true;
    this.worldActor = new Actor(this, rules.actor('World'), this.neutral);
    this.factions = new Map(this.worldActor.traitsOf('Faction').map((f) => [f.info.InternalName, f.info]));

    this.players = settings.players.map((slot, i) => new Player(this, i, slot));
    for (const p of this.players) p.actor = new Actor(this, rules.actor('Player'), p);

    for (const t of this.worldActor.traits) if (t.enabled && t.worldLoaded) t.worldLoaded();
    for (const p of this.players) for (const t of p.actor.traits) if (t.enabled && t.worldLoaded) t.worldLoaded();
    this.runFrameEndTasks();
  }

  // ------------------------------------------------------------ actors
  createActor(type, owner, init = {}) {
    const a = new Actor(this, this.rules.actor(type), owner, init);
    this.addActor(a);
    return a;
  }
  addActor(a) {
    this.actors.push(a);
    this.actorById.set(a.id, a);
    for (const t of a.traits) {
      const type = t.info.type;
      if (!this.traitIndex.has(type)) this.traitIndex.set(type, []);
      this.traitIndex.get(type).push(t);
    }
    a.inWorld = true;
    for (const t of a.traits) if (t.addedToWorld) t.addedToWorld();
    if (a.mobile) this.hashStamp = -1;
  }
  removeActor(a) {
    if (a.disposed) return;
    a.inWorld = false;
    for (const t of a.traits) if (t.removedFromWorld) t.removedFromWorld();
    a.disposed = true;
    const i = this.actors.indexOf(a);
    if (i >= 0) this.actors.splice(i, 1);
    this.actorById.delete(a.id);
    for (const t of a.traits) {
      const list = this.traitIndex.get(t.info.type);
      const j = list.indexOf(t);
      if (j >= 0) list.splice(j, 1);
    }
  }
  traitsOfType(type) { return this.traitIndex.get(type) || []; }
  enabledTraits(type, owner) {
    const out = [];
    for (const t of this.traitsOfType(type)) if (t.enabled && !t.self.dead && (!owner || t.self.owner === owner)) out.push(t);
    return out;
  }
  addFrameEndTask(fn) { this.frameEndTasks.push(fn); }
  runFrameEndTasks() { while (this.frameEndTasks.length) { const list = this.frameEndTasks; this.frameEndTasks = []; for (const fn of list) fn(this); } }

  // Simulation events (deterministic): 'killed', 'produced', ...
  on(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(fn); }
  emit(name, ...args) { const l = this.listeners.get(name); if (l) for (const fn of l.slice()) fn(...args); }
  playerById(id) { return this.players.find((p) => p.id === id) || (id === 'neutral' ? this.neutral : null); }

  // Render-only event (explosions, beams, sounds, notifications). Never read by the simulation.
  fx(ev) { ev.frame = this.frame; this.fxEvents.push(ev); }
  notify(player, text, kind = 'info') { this.fx({ t: 'notify', player: player.index, text, kind }); }

  // ------------------------------------------------------------ space
  clampToBounds(a) {
    const b = this.bounds;
    a.x = clamp(a.x, b.x0, b.x1); a.y = clamp(a.y, b.y0, b.y1); a.z = clamp(a.z, b.z0, b.z1);
  }
  inBounds(x, y, z) { const b = this.bounds; return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1; }

  // ------------------------------------------------------------ spatial queries (3D hash)
  key(bx, by, bz) { return (bx * 1024 + by) * 1024 + bz; }
  rebuildUnitHash() {
    this.hashStamp = this.frame;
    this.unitHash.clear();
    this.maxHalfLength = 0;
    const s = this.hashSize;
    for (const a of this.actors) {
      if (!a.mobile || a.dead) continue;
      if (a.health && a.health.info.HalfLength > this.maxHalfLength) this.maxHalfLength = a.health.info.HalfLength;
      const k = this.key(Math.floor(a.x / s), Math.floor(a.y / s), Math.floor(a.z / s) + 512);
      let b = this.unitHash.get(k);
      if (!b) this.unitHash.set(k, (b = []));
      b.push(a);
    }
  }
  unitsInSphere(x, y, z, r, out = []) {
    if (this.hashStamp !== this.frame) this.rebuildUnitHash();
    out.length = 0;
    const s = this.hashSize, r2 = r * r;
    const x0 = Math.floor((x - r) / s), x1 = Math.floor((x + r) / s);
    const y0 = Math.floor((y - r) / s), y1 = Math.floor((y + r) / s);
    const z0 = Math.floor((z - r) / s) + 512, z1 = Math.floor((z + r) / s) + 512;
    for (let bx = x0; bx <= x1; bx++) for (let by = y0; by <= y1; by++) for (let bz = z0; bz <= z1; bz++) {
      const b = this.unitHash.get(this.key(bx, by, bz));
      if (b) for (const a of b) if (!a.dead && distSq3(x, y, z, a.x, a.y, a.z) <= r2) out.push(a);
    }
    out.sort((a, b) => a.id - b.id);
    return out;
  }

  // Closest point to (x, y, z) on an actor's hull axis. Most hulls are spheres, so that is
  // their centre; a capsule hull (Health.HalfLength) has a line along its nose.
  hullAxisPoint(t, x, y, z) {
    const hl = t.health ? t.health.info.HalfLength : 0;
    if (!hl) return [t.x, t.y, t.z];
    const f = dirVec(t.yaw, t.pitch);
    const s = clamp(Math.trunc(((x - t.x) * f[0] + (y - t.y) * f[1] + (z - t.z) * f[2]) / 1024), -hl, hl);
    return [t.x + Math.trunc((f[0] * s) / 1024), t.y + Math.trunc((f[1] * s) / 1024), t.z + Math.trunc((f[2] * s) / 1024)];
  }
  // Distance from a point to the surface of an actor's hull, asteroid or wreck (0 inside it).
  edgeDistPoint(x, y, z, t) {
    const [cx, cy, cz] = this.hullAxisPoint(t, x, y, z);
    const r = t.health ? t.health.info.Radius : t.asteroid ? t.asteroid.radius() : t.wreck ? t.wreck.radius() : 0;
    const d = isqrt(distSq3(x, y, z, cx, cy, cz)) - r;
    return d < 0 ? 0 : d;
  }
  edgeDist(a, t) { return this.edgeDistPoint(a.x, a.y, a.z, t); }

  // Fog of war arrives with sensors (milestone 7); until then everything is visible.
  canSee() { return true; }

  // Group move without formations: every ship keeps its offset from the group centre,
  // pulled in a little so a scattered group tightens up.
  groupOffsets(units, target) {
    let cx = 0, cy = 0, cz = 0;
    for (const u of units) { cx += u.x; cy += u.y; cz += u.z; }
    cx = Math.trunc(cx / units.length); cy = Math.trunc(cy / units.length); cz = Math.trunc(cz / units.length);
    return units.map((u) => {
      const p = { x: target.x + Math.trunc(((u.x - cx) * 3) / 4), y: target.y + Math.trunc(((u.y - cy) * 3) / 4), z: target.z + Math.trunc(((u.z - cz) * 3) / 4) };
      const b = this.bounds;
      return { x: clamp(p.x, b.x0, b.x1), y: clamp(p.y, b.y0, b.y1), z: clamp(p.z, b.z0, b.z1) };
    });
  }

  // ------------------------------------------------------------ tick
  resolveOrder(order, player) { resolveOrder(this, player, order); }

  tick() {
    if (this.gameOver) { this.frame++; return; }
    for (const a of this.actors) {
      a.px = a.x; a.py = a.y; a.pz = a.z; a.pyaw = a.yaw; a.ppitch = a.pitch;
      if (a.mobile) a.mobile.savePrev();
    }
    this.rebuildUnitHash();
    for (const t of this.worldActor.tickers) if (t.enabled) t.tick();
    for (const p of this.players) p.actor.tick();
    const list = this.actors.slice();
    for (const a of list) if (a.inWorld && !a.dead) a.tick();
    this.resolveCrowding();
    for (let i = 0; i < this.effects.length; i++) {
      const e = this.effects[i];
      if (e.tick(this)) { this.effects.splice(i, 1); i--; }
    }
    this.runFrameEndTasks();
    this.frame++;
  }

  // Push overlapping ships apart (3D). Ships that are flying push idle ships of their own side.
  // Capsule hulls touch at the closest point on their axis. Ghosts (launching, docking) are skipped.
  resolveCrowding() {
    const tmp = [];
    for (const a of this.actors) {
      if (!a.mobile || a.dead || a.mobile.ghost) continue;
      const ra = a.health.info.Radius, ha = a.health.info.HalfLength;
      this.unitsInSphere(a.x, a.y, a.z, ra + ha + this.maxHalfLength + 4 * CELL, tmp);
      for (const b of tmp) {
        if (b.id <= a.id || !b.mobile || b.dead || b.mobile.ghost) continue;
        const rb = b.health.info.Radius, hb = b.health.info.HalfLength;
        const [ax, ay, az] = ha ? this.hullAxisPoint(a, b.x, b.y, b.z) : [a.x, a.y, a.z];
        const [bx, by, bz] = hb ? this.hullAxisPoint(b, ax, ay, az) : [b.x, b.y, b.z];
        const min = ((ra + rb) * 90) / 100;
        const d2 = distSq3(ax, ay, az, bx, by, bz);
        if (d2 >= min * min) continue;
        let ux = bx - ax, uy = by - ay, uz = bz - az, d = isqrt(d2);
        if (d === 0) { ux = ((a.id * 37) % 7) - 3 || 1; uy = ((b.id * 53) % 7) - 3; uz = ((a.id + b.id) % 5) - 2; d = isqrt(ux * ux + uy * uy + uz * uz); }
        const push = (min - (d2 === 0 ? 0 : d)) >> 1;
        let wa = 50, wb = 50;
        if (a.owner === b.owner) {
          const am = a.mobile.moving, bm = b.mobile.moving;
          if (am && !bm) { wa = 15; wb = 85; } else if (bm && !am) { wa = 85; wb = 15; }
        }
        // A huge hull (the Forge) is never shoved by the small ships around it.
        const sa = ra + ha, sb = rb + hb;
        if (sa > 4 * sb) { wa = 0; wb = 100; } else if (sb > 4 * sa) { wa = 100; wb = 0; }
        if (wa) a.mobile.shoved = this.frame;
        if (wb) b.mobile.shoved = this.frame;
        if (wa === 100) a.mobile.scraped = this.frame;
        if (wb === 100) b.mobile.scraped = this.frame;
        a.x -= Math.trunc((ux * push * wa) / (d * 50)); a.y -= Math.trunc((uy * push * wa) / (d * 50)); a.z -= Math.trunc((uz * push * wa) / (d * 50));
        b.x += Math.trunc((ux * push * wb) / (d * 50)); b.y += Math.trunc((uy * push * wb) / (d * 50)); b.z += Math.trunc((uz * push * wb) / (d * 50));
        this.clampToBounds(a); this.clampToBounds(b);
      }
    }
    // Asteroids and wrecks are solid: ships that drift into one are pushed back out to its surface.
    for (const t of this.solids()) {
      const s = t.self;
      if (s.dead) continue;
      const r = t.radius();
      this.unitsInSphere(s.x, s.y, s.z, r + this.maxHalfLength + 4 * CELL, tmp);
      for (const b of tmp) {
        if (b.dead || b.mobile.ghost) continue;
        const rb = b.health.info.Radius, hb = b.health.info.HalfLength;
        const [bx, by, bz] = hb ? this.hullAxisPoint(b, s.x, s.y, s.z) : [b.x, b.y, b.z];
        const min = r + Math.trunc((rb * 80) / 100);
        const d2 = distSq3(s.x, s.y, s.z, bx, by, bz);
        if (d2 >= min * min) continue;
        let ux = bx - s.x, uy = by - s.y, uz = bz - s.z, d = isqrt(d2);
        if (d === 0) { ux = 0; uy = 0; uz = 1; d = 1; }
        const push = min - (d2 === 0 ? 0 : d);
        b.x += Math.trunc((ux * push) / d); b.y += Math.trunc((uy * push) / d); b.z += Math.trunc((uz * push) / d);
        b.mobile.shoved = this.frame;
        b.mobile.scraped = this.frame;
        this.clampToBounds(b);
      }
    }
  }

  // Solid bodies that ships steer round and are pushed off: asteroids and wrecks.
  solids() { return [...this.traitsOfType('Asteroid'), ...this.traitsOfType('Wreck')]; }

  // Hash of the simulation state; compared between clients (and save/load) to detect divergence.
  syncHash() {
    let h = hashMix(2166136261, this.frame);
    h = hashMix(h, this.rng.state);
    for (const a of this.actors) {
      h = hashMix(h, a.id); h = hashMix(h, a.x); h = hashMix(h, a.y); h = hashMix(h, a.z);
      h = hashMix(h, a.yaw); h = hashMix(h, a.pitch);
      if (a.mobile) h = hashMix(h, a.mobile.speed);
      if (a.health) h = hashMix(h, a.health.hp);
      if (a.asteroid) h = hashMix(h, a.asteroid.ore);
      if (a.collector) h = hashMix(h, a.collector.cargo);
    }
    for (const p of this.players) h = hashMix(h, p.resources ? p.resources.cash : 0);
    for (const q of this.traitsOfType('ProductionQueue')) { h = hashMix(h, q.progress); h = hashMix(h, q.queue.length); }
    h = hashMix(h, this.effects.length);
    for (const e of this.effects) { h = hashMix(h, e.x); h = hashMix(h, e.y); h = hashMix(h, e.z); }
    return h >>> 0;
  }
}
