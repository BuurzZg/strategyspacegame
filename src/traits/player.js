import { defineTrait, Trait } from '../engine/traits.js';
import { mapKinds } from '../engine/content.js';

// Traits on each player's Player actor. They register themselves on the Player as
// fast references (player.resources, player.capacity, player.tech).

// The player's stores: one amount per resource kind in the content (ore, ice, salvage, Glim,
// spores). Ore is the building currency, so `cash`, take() and give() work on ore. A slot
// may set the starting ore (`cash`) or every store (`stores`). Every change is tallied by
// reason (gathered, spent, refunded, gift...) so a visit's report can account for it all.
defineTrait('PlayerResources', class extends Trait {
  created() {
    const slot = this.self.owner.slot || {};
    const kinds = mapKinds(this.world.rules);
    this.amounts = Object.fromEntries(kinds.map((k) => [k, 0]));
    this.amounts.ore = slot.cash !== undefined ? slot.cash : this.info.Cash;
    if (slot.stores) for (const k of kinds) if (slot.stores[k] !== undefined) this.amounts[k] = slot.stores[k] | 0;
    this.start = { ...this.amounts };
    this.tally = {}; // reason -> kind -> amount
    this.self.owner.resources = this;
  }
  get cash() { return this.amounts.ore; }
  set cash(v) { this.amounts.ore = v; }
  amount(k) { return this.amounts[k] || 0; }
  note(reason, k, n) { const t = (this.tally[reason] ||= {}); t[k] = (t[k] || 0) + n; }
  take(n, reason = 'spent') { return this.takeKind('ore', n, reason); }
  give(n, reason = 'refunded') { this.giveKind('ore', n, reason); }
  takeKind(k, n, reason = 'spent') { if ((this.amounts[k] || 0) < n) return false; this.amounts[k] -= n; this.note(reason, k, -n); return true; }
  giveKind(k, n, reason = 'gift') { if (!(k in this.amounts)) return; this.amounts[k] += n; this.note(reason, k, n); }
}, { Cash: 1000 });

// Free crew on a map, by role (engineers, pilots, miners, hands), from the voyage. A new ship
// takes its crew from here when it is queued; cancelling gives them back. Without a roster in
// the slot (the Proving Grounds, a single place) crew are not limited.
// Named leads (crew.js): `leads` the people leading the ships aboard, by id; `recruits` by role,
// who will lead each new ship built here, in order (decided by the voyage).
defineTrait('CrewRoster', class extends Trait {
  created() {
    const slot = this.self.owner.slot || {};
    this.free = slot.crew ? { ...slot.crew } : null;
    this.leads = {};
    for (const [id, l] of Object.entries(slot.leads || {})) this.leads[id] = { ...l };
    this.recruits = Object.fromEntries(Object.entries(slot.recruits || {}).map(([r, list]) => [r, list.map((l) => ({ ...l }))]));
    this.recruited = [];
    this.self.owner.crew = this;
  }
  lead(id) { return id ? this.leads[id] || null : null; }
  // the lead for a new ship crewed by `role` (null: nobody is named for it)
  recruit(role) {
    const list = this.recruits[role];
    if (!list || !list.length) return null;
    const l = list.shift();
    this.leads[l.id] = l;
    this.recruited.push({ ...l });
    return l;
  }
  has(role, n) { return !this.free || (this.free[role] | 0) >= n; }
  take(role, n) { if (this.free) this.free[role] = (this.free[role] | 0) - n; }
  give(role, n) { if (this.free) this.free[role] = (this.free[role] | 0) + n; }
}, {});

// Fleet capacity: ships consume it (ConsumesCapacity), the Forge provides it (ProvidesCapacity).
// Ships waiting in a build queue count as already built, so a queue can't overshoot the cap.
defineTrait('FleetCapacity', class extends Trait {
  created() { this.self.owner.capacity = this; }
  cap() {
    let c = 0;
    for (const t of this.world.enabledTraits('ProvidesCapacity', this.self.owner)) c += t.info.Amount;
    // an expanded hangar (engineering, from the voyage)
    c += (this.self.owner.slot && this.self.owner.slot.capacityBonus) | 0;
    return Math.min(this.info.Max, c);
  }
  used() {
    const p = this.self.owner, w = this.world;
    let u = 0;
    for (const t of w.traitsOfType('ConsumesCapacity')) if (t.self.owner === p && !t.self.dead) u += t.info.Amount;
    for (const q of w.traitsOfType('ProductionQueue')) {
      if (q.self.owner !== p || q.self.dead) continue;
      for (const type of q.queue) u += w.rules.actor(type).traitInfo('ConsumesCapacity')?.Amount || 0;
    }
    return u;
  }
}, { Max: 200 });

// Prerequisites: granted by ProvidesPrerequisite traits on the player's actors
// (research adds more in milestone 7). A name starting with "~" is ignored by the UI check.
defineTrait('TechTree', class extends Trait {
  created() { this.self.owner.tech = this; }
  has(prereq) {
    for (const t of this.world.enabledTraits('ProvidesPrerequisite', this.self.owner)) if (t.name === prereq) return true;
    return false;
  }
  // Display name of the first unmet prerequisite, or null.
  missing(prereqs) {
    for (const p of prereqs) {
      if (p.startsWith('~')) continue;
      if (!this.has(p)) return this.world.rules.actors.get(p)?.traitInfo('Tooltip')?.Name || p;
    }
    return null;
  }
}, {});
