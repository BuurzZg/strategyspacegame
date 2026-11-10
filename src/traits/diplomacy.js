import { defineTrait, Trait } from '../engine/traits.js';
import { CELL, distSq3 } from '../engine/math.js';

// A faction's station: it never moves, and destroying it costs a great deal of standing.
defineTrait('Station', class extends Trait {
  created() { this.self.station = this; }
}, {});

// ---------------------------------------------------------------- diplomacy on a map
// World trait. Factions on a point-of-interest map behave by your standing with them (their
// slot's tier, from the voyage), and what you do there changes it:
//   Hostile   attacks on sight (the relation starts as enemy)
//   Wary      warns you off when you come near, and opens fire if you linger close
//   Neutral   ignores you, until you fire on it
//   Friendly  turns on whoever attacks your ships near it
//   Allied    fights at your side (the relation starts as ally)
// Firing on a faction's ship makes it (and that faction) your enemy for the rest of the visit.
// Theft: collecting in a faction's territory without its leave, where its ships or station can
// see it, costs standing per load (the first is a warning). All of it is logged for the report.
const TIER = { hostile: 0, wary: 1, neutral: 2, friendly: 3, allied: 4 };

defineTrait('Diplomacy', class extends Trait {
  worldLoaded() {
    const w = this.world;
    w.diplomacy = this;
    this.R = w.rules.content.reputation || {};
    this.me = w.players[0];
    this.log = {};           // faction -> { delta, reasons: { why: delta } }
    this.attacked = new Set();
    this.help = {};
    this.wary = {};          // faction -> { warned, close }
    this.theftWarned = false;
    w.on('damaged', (victim, attacker, amount, by) => this.onDamaged(victim, by));
    w.on('killed', (victim, attacker, by) => this.onKilled(victim, by));
    w.on('took', (c, deposit, fresh) => this.onTook(c, fresh));
  }
  num(k, d = 0) { return this.R[k] === undefined ? d : +this.R[k]; }
  // factions on this map that have a standing with you (not monsters, not you)
  factions() { return this.world.players.filter((p) => p !== this.me && p.slot && p.slot.tier !== undefined); }
  tier(p) { return p.slot ? p.slot.tier : undefined; }
  note(fid, why, delta) {
    if (!delta) return;
    const l = (this.log[fid] ||= { delta: 0, reasons: {} });
    l.delta += delta;
    l.reasons[why] = (l.reasons[why] || 0) + delta;
  }
  // Does p have a ship or station that can see actor a?
  sees(p, a) {
    const r = this.num('SightRange', 22) * CELL, r2 = r * r;
    return this.world.actors.some((b) => b.owner === p && !b.dead && b.health && distSq3(a.x, a.y, a.z, b.x, b.y, b.z) <= r2 + (b.health.info.Radius * b.health.info.Radius));
  }
  provoke(p, why, by = this.me) {
    const w = this.world;
    if (by !== this.me || this.me.isEnemy(p)) return;
    w.setRelation(this.me, p, 'enemy');
    w.notify(this.me, `${p.name}: ${why}`, 'bad');
    w.fx({ t: 'provoked', player: p.index });
  }

  onDamaged(victim, by) {
    const w = this.world, p = victim.owner;
    if (by === this.me && p !== this.me && this.tier(p) !== undefined) {
      if (!this.attacked.has(victim.id)) { this.attacked.add(victim.id); this.note(p.faction, 'fired on', this.num('Attack', -10)); }
      this.provoke(p, victim.station ? 'You fired on our station. We will not forget it.' : 'You fired on us. Now we answer.');
    }
    // friends near your ships turn on whoever attacks them
    if (p === this.me && by && by !== this.me && !by.isNeutral) {
      for (const f of this.factions()) {
        if (this.tier(f) < TIER.friendly || f === by || f.isEnemy(by) || !this.sees(f, victim)) continue;
        w.setRelation(f, by, 'enemy');
        w.notify(this.me, `${f.name} turn on ${by.name}.`, 'good');
      }
    }
  }

  onKilled(victim, by) {
    if (by !== this.me || !victim.health) return;
    const p = victim.owner;
    if (p !== this.me && this.tier(p) !== undefined) this.note(p.faction, victim.station ? 'destroyed their station' : 'destroyed', this.num(victim.station ? 'StationKill' : 'Kill', -25));
    // killing a faction's enemies where it can see it
    for (const f of this.factions()) {
      if (f === p || !f.isEnemy(p) || this.me.isEnemy(f) || !this.sees(f, victim)) continue;
      const max = this.num('HelpMax', 15), got = this.help[f.faction] || 0;
      const n = Math.min(this.num('HelpKill', 2), max - got);
      if (n > 0) { this.help[f.faction] = got + n; this.note(f.faction, 'fought their enemies', n); }
    }
  }

  onTook(c, fresh) {
    const w = this.world, poi = w.settings.poi;
    if (c.owner !== this.me || !poi || !poi.owner || poi.leave) return;
    if (fresh) c.collector.stolen = false;
    if (c.collector.stolen) return;
    const p = w.players.find((x) => x.faction === poi.owner && x !== this.me);
    if (!p || this.me.isEnemy(p) || !this.sees(p, c)) return; // unseen, or already at war
    c.collector.stolen = true;
    if (!this.theftWarned) {
      this.theftWarned = true;
      w.notify(this.me, `${p.name}: This is our claim. Take another load and we will remember it.`, 'bad');
      w.fx({ t: 'warn', player: p.index, actor: c.id, x: c.x, y: c.y, z: c.z });
      return;
    }
    this.note(poi.owner, 'took from their claim', this.num('Steal', -1));
    w.fx({ t: 'stolen', player: p.index, actor: c.id, x: c.x, y: c.y, z: c.z });
  }

  tick() {
    const w = this.world;
    if (w.frame % 25) return;
    const mine = w.actors.filter((a) => a.owner === this.me && !a.dead && a.health);
    for (const p of this.factions()) {
      if (this.tier(p) !== TIER.wary || this.me.isEnemy(p)) continue;
      const theirs = w.actors.filter((a) => a.owner === p && !a.dead && a.health);
      let near = Infinity;
      for (const a of mine) for (const b of theirs) { const d = distSq3(a.x, a.y, a.z, b.x, b.y, b.z); if (d < near) near = d; }
      const st = (this.wary[p.faction] ||= { warned: false, close: 0 });
      const warn = this.num('WarnRange', 16) * CELL, close = this.num('CloseRange', 9) * CELL;
      if (near <= warn * warn && !st.warned) {
        st.warned = true;
        w.notify(this.me, `${p.name}: Keep your distance.`, 'bad');
        w.fx({ t: 'warn', player: p.index });
      }
      st.close = near <= close * close ? st.close + 25 : Math.max(0, st.close - 25);
      if (st.close >= this.num('WarnTime', 20) * 25) this.provoke(p, 'We warned you.');
    }
  }

  // For the visit report: standing changes by faction, and who was met.
  report() {
    const out = {};
    for (const [fid, l] of Object.entries(this.log)) out[fid] = { delta: l.delta, reasons: { ...l.reasons } };
    return { changes: out, met: this.factions().map((p) => p.faction) };
  }
}, {});
