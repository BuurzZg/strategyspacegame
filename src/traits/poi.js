import { defineTrait, Trait } from '../engine/traits.js';
import { CELL, angleOf, distSq3, sin as SIN, cos as COS } from '../engine/math.js';
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
    this.log = new Map(); // player index -> { built, destroyed, arrived, found, crewLost, crewSaved, leadsLost, leadsSaved }
    this.encounters = [];
    w.nebulae = L ? L.nebulae : [];
    w.on('produced', (u) => { const l = this.logOf(u.owner); l.built[u.type] = (l.built[u.type] || 0) + 1; });
    w.on('killed', (a) => {
      if (!a.health) return;
      const l = this.logOf(a.owner);
      // the Forge itself: on the voyage, that is the end
      if (a.has('Hangar') && w.settings.mode === 'poi' && a.owner === w.players[0] && !w.report) {
        w.report = visitReport(w, a.owner, { forgeLost: true });
        w.fx({ t: 'forge-lost', owner: a.owner.index, x: a.x, y: a.y, z: a.z });
        w.gameOver = true;
        return;
      }
      if (!a.mobile) return;
      l.destroyed[a.type] = (l.destroyed[a.type] || 0) + 1;
      // half the crew (rounded down) get away in pods and come home; the rest are lost. Its
      // named lead goes down with it, unless their luck holds (Escape) one more time.
      const c = a.info.traitInfo('Crew'), lead = a.lead && a.owner.crew ? a.owner.crew.lead(a.lead) : null;
      if (lead) {
        const name = a.info.traitInfo('Tooltip')?.Name || a.type;
        if (lead.escape) { lead.escape = 0; l.leadsSaved.push({ id: lead.id, name: `${lead.title} ${lead.name}`, type: a.type, kills: a.kills | 0 }); w.notify(a.owner, `${lead.title} ${lead.name} got out of the ${name} in a pod.`, 'info'); }
        else { l.leadsLost.push({ id: lead.id, name: `${lead.title} ${lead.name}`, type: a.type, kills: a.kills | 0, how: 'killed' }); w.notify(a.owner, `${lead.title} ${lead.name} was lost with the ${name}.`, 'bad'); }
      }
      if (c && c.Count) {
        const saved = Math.max(c.Count >> 1, lead && l.leadsSaved.some((x) => x.id === lead.id) ? 1 : 0);
        l.crewLost[c.Role] = (l.crewLost[c.Role] || 0) + c.Count - saved;
        l.crewSaved[c.Role] = (l.crewSaved[c.Role] || 0) + saved;
        if (a.owner.crew) a.owner.crew.give(c.Role, saved);
      }
    });
    if (!L) return;
    const shape = (type) => { const h = w.rules.actor(type).traitInfo('Health'); return { radius: h.Radius, halfLength: h.HalfLength, model: w.rules.actor(type).traitInfo('WithModel')?.Model || type }; };
    const at = (p) => ({ x: p[0], y: p[1], z: p[2] });
    for (const k of L.wrecks) w.createActor('wreck', w.neutral, { ...at(k.at), yaw: k.yaw, pitch: k.pitch, of: k.of, salvage: k.salvage, infested: !!k.infested, ...shape(k.of) });
    if (L.hulk) w.createActor('wreck', w.neutral, { ...at(L.hulk.at), yaw: L.hulk.yaw, pitch: L.hulk.pitch, of: L.hulk.of, salvage: L.hulk.salvage, name: L.hulk.name, relic: L.hulk.relic || '', relicName: L.hulk.relicName || '', relicAt: L.hulk.relicAt | 0, ...shape(L.hulk.of) });
    if (L.station) {
      const owner = w.players.find((p) => p.faction === L.station.owner) || w.neutral;
      this.station = w.createActor(L.station.of, owner, { ...at(L.station.at), yaw: L.station.yaw }).id;
    }
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
      this.encounters.push({ ...e, ids, done: e.behaviour !== 'hunt' && e.behaviour !== 'escort' });
    }
  }
  logOf(p) { if (!this.log.has(p.index)) this.log.set(p.index, { built: {}, destroyed: {}, arrived: [], found: [], crewLost: {}, crewSaved: {}, leadsLost: [], leadsSaved: [] }); return this.log.get(p.index); }
  tick() {
    const w = this.world;
    for (const e of this.encounters) {
      if (e.done || w.frame < e.delay) continue;
      e.done = true;
      const me = w.players[0], side = w.players.find((p) => p.faction === e.side);
      const forge = w.actors.find((a) => a.owner === me && a.has('Hangar') && !a.dead);
      if (!forge || !side) continue;
      // hunters come for the Forge only if they are its enemies; allies come to guard it
      const ally = side.isAlly(me);
      if (!me.isEnemy(side) && !ally) continue;
      for (const id of e.ids) {
        const a = w.actorById.get(id);
        if (!a || a.dead || !a.attack) continue;
        if (ally) a.queueActivity(new AttackMove(forge.x + 6 * CELL, forge.y + 6 * CELL, forge.z), false);
        else a.queueActivity(new AttackMove(forge.x, forge.y, forge.z), false);
      }
      if (!ally) w.fx({ t: 'encounter', side: e.side, x: e.at[0], y: e.at[1], z: e.at[2] });
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
    // armoured plating (engineering, from the voyage) raises the Forge's hull
    if (slot.forgeHpPct && this.self.health) this.self.health.maxHp = Math.trunc((this.self.health.maxHp * slot.forgeHpPct) / 100);
    if (slot.forgeHp && this.self.health) this.self.health.hp = Math.max(1, Math.min(this.self.health.maxHp, slot.forgeHp | 0));
  }
  tick() {
    if (!this.queue.length || --this.timer > 0) return;
    // launch rails (engineering) halve the interval
    this.timer = Math.max(1, Math.trunc((this.info.LaunchInterval * ((this.self.owner.slot || {}).launchPct || 100)) / 100));
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
    const xp = (ship.xp | 0) + (ship.fought ? 1 : 0);
    this.aboard.push({ type: ship.type, hp: ship.health ? ship.health.hp : 0, cargo: c ? c.cargo : 0, kind: c ? c.kind : '', xp, ...(ship.lead ? { lead: ship.lead, kills: ship.kills | 0 } : {}) });
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
  created() {
    this.spool = -1; this.self.skein = this;
    // a damaged drive spools slower (spoolPct: percent of the usual time, from the voyage)
    this.time = Math.trunc((this.info.SpoolTime * ((this.self.owner.slot || {}).spoolPct || 100)) / 100);
  }
  get spooling() { return this.spool >= 0; }
  resolveOrder(o) {
    const w = this.world;
    if (o.name === 'SpoolSkein' && this.spool < 0 && !w.departed) { this.spool = 0; w.fx({ t: 'spool', owner: this.self.owner.index, x: this.self.x, y: this.self.y, z: this.self.z }); }
    else if (o.name === 'CancelSpool' && this.spool >= 0) { this.spool = -1; w.notify(this.self.owner, 'Skein spool-up cancelled', 'info'); }
  }
  tick() {
    if (this.spool < 0) return;
    // something that interdicts (the Hollowhorn's song) shakes a spooling Skein loose
    if (this.world.frame % 25 === 0 && this.spool > 0) {
      const w = this.world, self = this.self;
      const by = w.actors.find((a) => { const I = !a.dead && self.owner.isEnemy(a.owner) && a.info.traitInfo('Interdicts'); return I && distSq3(a.x, a.y, a.z, self.x, self.y, self.z) <= I.Range * I.Range; });
      if (by) { this.spool = 0; w.notify(self.owner, `${by.info.traitInfo('Tooltip').Name}'s song shakes the Skein loose. Spooling from the start.`, 'bad'); w.fx({ t: 'interdicted', actor: self.id, by: by.id, x: self.x, y: self.y, z: self.z }); }
    }
    if (++this.spool < this.time) return;
    const w = this.world, self = this.self;
    this.spool = -1;
    // anything still being built is cancelled and refunded: the Forge is leaving
    self.trait('ProductionQueue')?.refundAll();
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
export function visitReport(w, player, { forgeLost = false } = {}) {
  const res = player.resources, log = w.point ? w.point.logOf(player) : { built: {}, destroyed: {}, arrived: [], found: [], crewLost: {}, crewSaved: {}, leadsLost: [], leadsSaved: [] };
  const forge = forgeLost ? null : w.actors.find((a) => a.owner === player && a.has('Hangar') && !a.dead);
  const hangar = forge ? forge.trait('Hangar') : null;
  const kinds = Object.keys(res.amounts);
  const stores = {};
  for (const k of kinds) {
    const changes = {};
    for (const [reason, t] of Object.entries(res.tally)) if (t[k]) changes[reason] = t[k];
    stores[k] = { start: res.start[k] | 0, end: res.amounts[k] | 0, changes };
  }
  const outside = w.actors.filter((a) => a.owner === player && a.mobile && !a.dead && a !== forge && !a.has('Hangar'));
  const count = (list) => list.reduce((m, t) => { m[t] = (m[t] || 0) + 1; return m; }, {});
  // crew: lost with ships destroyed (half get away in pods) and with every ship left behind
  const lost = { ...log.crewLost };
  const leadsLost = [...log.leadsLost];
  for (const a of outside) {
    const c = a.info.traitInfo('Crew');
    if (c && c.Count) lost[c.Role] = (lost[c.Role] || 0) + c.Count;
    const l = a.lead && player.crew ? player.crew.lead(a.lead) : null;
    if (l) leadsLost.push({ id: l.id, name: `${l.title} ${l.name}`, type: a.type, kills: a.kills | 0, how: 'left' });
  }
  // hostiles destroyed
  let kills = 0;
  if (w.point) for (const p of w.players) if (player.isEnemy(p)) for (const n of Object.values(w.point.logOf(p).destroyed)) kills += n;
  return {
    place: w.settings.poi || null,
    seconds: Math.trunc(w.frame / 25),
    ticks: w.frame,
    forgeLost,
    kills,
    found: [...log.found],
    crew: { lost, saved: { ...log.crewSaved }, leadsLost, leadsSaved: [...log.leadsSaved], recruited: player.crew && player.crew.recruited ? player.crew.recruited.map((l) => ({ ...l })) : [] },
    standing: w.diplomacy && player === w.players[0] ? w.diplomacy.report() : { changes: {}, met: [] },
    stores,
    forge: forge ? { hp: forge.health.hp, maxHp: forge.health.maxHp } : null,
    ships: {
      arrived: count(log.arrived), built: { ...log.built }, destroyed: { ...log.destroyed },
      leftBehind: count(outside.map((a) => a.type)),
      // aboard, and any still waiting in the bays to launch
      aboard: hangar ? [...hangar.aboard, ...hangar.queue].map((e) => ({ ...e })) : [],
    },
  };
}

