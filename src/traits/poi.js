import { defineTrait, Trait } from '../engine/traits.js';
import { CELL, angleOf, sin as SIN, cos as COS } from '../engine/math.js';
import { AttackMove } from '../activities/attack.js';

// ---------------------------------------------------------------- the place
// World trait: builds a point-of-interest map from settings.layout (made by generatePoi):
// derelicts and the giant hulk, gas clouds, crystal formations, nebulae, and hostile
// encounters. Lurking hostiles wait where they are and pounce on anything that comes close;
// hunters come for the Forge after their delay. It also keeps the visit's log for the report.
defineTrait('PointLayout', class extends Trait {
  worldLoaded() {
    const w = this.world, L = w.settings.layout;
    w.point = this;
    this.log = new Map(); // player index -> { built: {}, destroyed: {}, arrived: [] }
    this.encounters = [];
    w.nebulae = L ? L.nebulae : [];
    w.on('produced', (u) => { const l = this.logOf(u.owner); l.built[u.type] = (l.built[u.type] || 0) + 1; });
    w.on('killed', (a) => { if (!a.health || a.mobile === null) return; const l = this.logOf(a.owner); l.destroyed[a.type] = (l.destroyed[a.type] || 0) + 1; });
    if (!L) return;
    const shape = (type) => { const h = w.rules.actor(type).traitInfo('Health'); return { radius: h.Radius, halfLength: h.HalfLength, model: w.rules.actor(type).traitInfo('WithModel')?.Model || type }; };
    const at = (p) => ({ x: p[0], y: p[1], z: p[2] });
    for (const k of L.wrecks) w.createActor('wreck', w.neutral, { ...at(k.at), yaw: k.yaw, pitch: k.pitch, of: k.of, salvage: k.salvage, ...shape(k.of) });
    if (L.hulk) w.createActor('wreck', w.neutral, { ...at(L.hulk.at), yaw: L.hulk.yaw, pitch: L.hulk.pitch, of: L.hulk.of, salvage: L.hulk.salvage, name: L.hulk.name, ...shape(L.hulk.of) });
    for (const c of L.clouds) w.createActor('cloud', w.neutral, { ...at(c.at), kind: c.kind, amount: c.amount, radius: c.radius });
    for (const r of L.rocks) w.createActor('spire', w.neutral, { ...at(r.at), yaw: w.rng.int(1024), radius: r.radius, shape: r.shape });
    for (const e of L.encounters) {
      const side = w.players.find((p) => p.faction === e.side);
      if (!side) continue;
      const ids = e.ships.map((type, i) => {
        // a loose knot of ships, facing the map's centre
        const a = (i * 1024) / Math.max(1, e.ships.length) | 0, r = i ? 2 * CELL : 0;
        const x = e.at[0] + Math.trunc((COS(a) * r) / 1024), y = e.at[1] + Math.trunc((SIN(a) * r) / 1024);
        const yaw = angleOf(((w.bounds.x0 + w.bounds.x1) >> 1) - x, ((w.bounds.y0 + w.bounds.y1) >> 1) - y);
        return w.createActor(type, side, { x, y, z: e.at[2], yaw }).id;
      });
      this.encounters.push({ ...e, ids, done: e.behaviour !== 'hunt' });
    }
  }
  logOf(p) { if (!this.log.has(p.index)) this.log.set(p.index, { built: {}, destroyed: {}, arrived: [] }); return this.log.get(p.index); }
  tick() {
    const w = this.world;
    for (const e of this.encounters) {
      if (e.done || w.frame < e.delay) continue;
      e.done = true;
      const forge = w.actors.find((a) => a.owner === w.players[0] && a.has('Hangar') && !a.dead);
      if (!forge) continue;
      for (const id of e.ids) { const a = w.actorById.get(id); if (a && !a.dead && a.attack) a.queueActivity(new AttackMove(forge.x, forge.y, forge.z), false); }
      w.fx({ t: 'encounter', side: e.side, x: e.at[0], y: e.at[1], z: e.at[2] });
    }
  }
}, {});

// ---------------------------------------------------------------- the hangar
// The Forge carries its fleet between places. Ships aboard launch from the bays when it
// arrives (one every LaunchInterval ticks, alternating sides); a Recall order brings ships
// home and aboard. Each entry keeps the ship's hull and cargo.
defineTrait('Hangar', class Hangar extends Trait {
  created() {
    const slot = this.self.owner.slot || {};
    this.aboard = []; // { type, hp, cargo, kind }
    this.queue = (slot.hangar || []).map((e) => (typeof e === 'string' ? { type: e } : { ...e }));
    this.timer = 1;
    if (slot.forgeHp && this.self.health) this.self.health.hp = Math.max(1, Math.min(this.self.health.maxHp, slot.forgeHp | 0));
  }
  tick() {
    if (!this.queue.length || --this.timer > 0) return;
    this.timer = this.info.LaunchInterval;
    const e = this.queue.shift();
    const q = this.self.trait('ProductionQueue');
    if (!q || !this.world.rules.actors.has(e.type)) return;
    q.launch(e.type, e);
    if (this.world.point) this.world.point.logOf(this.self.owner).arrived.push(e.type);
  }
  stow(ship) {
    const w = this.world, c = ship.collector;
    // a collector coming aboard unloads its hold into the stores on the way in
    if (c && c.cargo > 0 && this.self.has('OreDropoff') && ship.owner.resources) {
      ship.owner.resources.giveKind(c.kind, c.cargo, 'gathered');
      w.fx({ t: 'deposit', owner: ship.owner.index, kind: c.kind, amount: c.cargo, x: ship.x, y: ship.y, z: ship.z });
      c.cargo = 0;
    }
    this.aboard.push({ type: ship.type, hp: ship.health ? ship.health.hp : 0, cargo: c ? c.cargo : 0, kind: c ? c.kind : '' });
    w.fx({ t: 'aboard', actor: ship.id, type: ship.type, owner: ship.owner.index, x: ship.x, y: ship.y, z: ship.z });
    if (w.formations) w.formations.leave([ship]);
    ship.dead = true; // not destroyed: it is aboard (its DockHangar activity ends this tick)
    w.addFrameEndTask((ww) => ww.removeActor(ship));
  }
  // LaunchAll (subject: the Forge): everything aboard launches again.
  // (Recall, which sends ships home, is handled in engine/order.js: its subjects are the ships.)
  resolveOrder(o) {
    if (o.name !== 'LaunchAll' || !this.aboard.length) return;
    this.queue.push(...this.aboard.splice(0));
    this.timer = 1;
  }
}, { LaunchInterval: 12 });

// ---------------------------------------------------------------- the Skein Drive
// SpoolSkein starts the drive spooling; after SpoolTime ticks the Forge stitches away and the
// visit ends. Ships still outside are left behind. CancelSpool stops it. (Enemies that can
// interrupt a spool-up arrive with the Ashen Gaunt's interdictors in Milestone 8.)
defineTrait('Skein', class Skein extends Trait {
  created() { this.spool = -1; this.self.skein = this; }
  get spooling() { return this.spool >= 0; }
  resolveOrder(o) {
    const w = this.world;
    if (o.name === 'SpoolSkein' && this.spool < 0 && !w.departed) { this.spool = 0; w.fx({ t: 'spool', owner: this.self.owner.index, x: this.self.x, y: this.self.y, z: this.self.z }); }
    else if (o.name === 'CancelSpool' && this.spool >= 0) { this.spool = -1; w.notify(this.self.owner, 'Skein spool-up cancelled', 'info'); }
  }
  tick() {
    if (this.spool < 0) return;
    if (++this.spool < this.info.SpoolTime) return;
    const w = this.world, self = this.self;
    this.spool = -1;
    w.departed = { player: self.owner.index, frame: w.frame };
    w.report = visitReport(w, self.owner);
    w.fx({ t: 'departed', owner: self.owner.index, x: self.x, y: self.y, z: self.z });
    w.gameOver = true; // the visit is over: the map stops
  }
}, { SpoolTime: 1500 });


// ---------------------------------------------------------------- the report
// What the visit gained and cost. Stores: start, end, and every change by reason, so that
// end = start + the sum of the changes, kind by kind. Ships: launched on arrival, built,
// destroyed, left behind (outside the Forge when it left) and aboard (the fleet that goes on).
export function visitReport(w, player) {
  const res = player.resources, log = w.point ? w.point.logOf(player) : { built: {}, destroyed: {}, arrived: [] };
  const forge = w.actors.find((a) => a.owner === player && a.has('Hangar') && !a.dead);
  const hangar = forge ? forge.trait('Hangar') : null;
  const kinds = Object.keys(res.amounts);
  const stores = {};
  for (const k of kinds) {
    const changes = {};
    for (const [reason, t] of Object.entries(res.tally)) if (t[k]) changes[reason] = t[k];
    stores[k] = { start: res.start[k] | 0, end: res.amounts[k] | 0, changes };
  }
  const outside = w.actors.filter((a) => a.owner === player && a.mobile && !a.dead && a !== forge);
  const count = (list) => list.reduce((m, t) => { m[t] = (m[t] || 0) + 1; return m; }, {});
  return {
    place: w.settings.poi || null,
    seconds: Math.trunc(w.frame / 25),
    stores,
    forge: forge ? { hp: forge.health.hp, maxHp: forge.health.maxHp } : null,
    ships: {
      arrived: count(log.arrived), built: { ...log.built }, destroyed: { ...log.destroyed },
      leftBehind: count(outside.map((a) => a.type)),
      aboard: hangar ? hangar.aboard.map((e) => ({ ...e })) : [],
    },
  };
}

