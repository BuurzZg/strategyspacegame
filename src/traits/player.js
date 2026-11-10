import { defineTrait, Trait } from '../engine/traits.js';

// Traits on each player's Player actor. They register themselves on the Player as
// fast references (player.resources, player.capacity, player.tech).

// Ore in the bank. A lobby slot may override the starting amount.
defineTrait('PlayerResources', class extends Trait {
  created() {
    const slot = this.self.owner.slot;
    this.cash = slot && slot.cash !== undefined ? slot.cash : this.info.Cash;
    this.self.owner.resources = this;
  }
  take(n) { if (this.cash < n) return false; this.cash -= n; return true; }
  give(n) { this.cash += n; }
}, { Cash: 1000 });

// Fleet capacity: ships consume it (ConsumesCapacity), the Forge provides it (ProvidesCapacity).
// Ships waiting in a build queue count as already built, so a queue can't overshoot the cap.
defineTrait('FleetCapacity', class extends Trait {
  created() { this.self.owner.capacity = this; }
  cap() {
    let c = 0;
    for (const t of this.world.enabledTraits('ProvidesCapacity', this.self.owner)) c += t.info.Amount;
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
