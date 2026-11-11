import { defineTrait, Trait } from '../engine/traits.js';

// Levels (Milestone 19; they replace experience from kills). A ship gains a level for each map
// it launched on, survived and came home from: LevelPoints when it docks, once a map (sped by
// the wing commander's work and drills, slot.xpPct, and its lead's Learn), and a level for
// every LevelPoints. Levels run from 1 to Levels; each above the first adds RankBonus percent
// damage and hull. A ship's named lead (crew.yaml traits) adds their own Damage and Hull.
// At the levels in PerkLevels its pilot picks a perk (crew.yaml Perks), which changes how it
// fights. Levels ride in the Forge's hangar from place to place; lose the ship and they are gone.
// (Kills still count for the lead's record.)
const list = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
defineTrait('Ranks', class extends Trait {
  worldLoaded() {
    const w = this.world, V = w.rules.content.voyage || {};
    w.ranks = this;
    this.max = +V.Levels || 5;
    this.points = +V.LevelPoints || 100;
    this.bonus = V.RankBonus === undefined ? 5 : +V.RankBonus;
    w.on('killed', (victim, attacker) => {
      if (!attacker || attacker.dead || !attacker.mobile || !victim.health || !attacker.owner.isEnemy(victim.owner)) return;
      attacker.kills = (attacker.kills | 0) + 1;
    });
  }
  // rank: levels above the first (0 to max - 1)
  rankOf(xp) { return Math.max(0, Math.min(this.max - 1, Math.trunc((xp | 0) / this.points))); }
  nameOf(r) { return `Level ${(r | 0) + 1}`; }
  // percent: damage and hull at this rank
  pct(r) { return 100 + this.bonus * (r | 0); }
  // a ship's damage and hull in percent: its level, and its lead's touch; damage also follows
  // the crew's strain and All hands (slot.shipPct, Milestone 17)
  damagePct(a) { const sp = (a.owner.slot && a.owner.slot.shipPct) || 100; return Math.max(10, Math.trunc(((this.pct(a.rank) + (a.leadDamage | 0)) * sp) / 100)); }
  hullPct(a) { return Math.max(10, this.pct(a.rank) + (a.leadHull | 0)); }
  fit(a) {
    if (!a.health) return;
    const max = Math.trunc((a.health.info.HP * this.hullPct(a)) / 100);
    a.health.hp = Math.max(1, Math.min(max, a.health.hp + (max - a.health.maxHp)));
    a.health.maxHp = max;
  }
  // A ship leaves the bay: its level points, its lead (null: none named), its perks, and
  // whether it has already come home once on this map.
  equip(a, xp, lead, { perks = [], homed = false } = {}) {
    if (lead) { a.lead = lead.id; a.leadDamage = lead.damage | 0; a.leadHull = lead.hull | 0; a.leadLearn = lead.learn | 0; }
    a.xp = xp | 0; a.rank = this.rankOf(a.xp);
    a.perks = [...perks]; a.homed = !!homed;
    if (a.rank || a.leadHull) this.fit(a);
    // Holds formation: launches holding back, returning fire from where it is
    if (a.perks.includes('steady') && a.stance) a.stance.mode = 'defensive';
  }
  // Set a ship's level points; returns true if that raised its level.
  set(a, xp) {
    const old = a.rank | 0, r = this.rankOf(xp);
    a.xp = xp; a.rank = r;
    if (r !== old) this.fit(a);
    return r > old;
  }
  // A ship docks: the first time on this map, it has launched, survived and come home.
  // Returns its new level points.
  home(a) {
    if (a.homed) return a.xp | 0;
    a.homed = true;
    const xpPct = (a.owner.slot && a.owner.slot.xpPct) || 100;
    // a full level at least: a good wing commander, drills and a quick study only make it sooner
    const n = Math.max(this.points, Math.trunc((this.points * xpPct * (100 + (a.leadLearn | 0))) / 10000));
    const before = a.rank | 0, xp = (a.xp | 0) + n, r = this.rankOf(xp);
    if (r > before) {
      const w = this.world, name = a.info.traitInfo('Tooltip')?.Name || a.type;
      const l = a.lead && a.owner.crew ? a.owner.crew.lead(a.lead) : null;
      w.fx({ t: 'rankup', actor: a.id, rank: r, owner: a.owner.index, x: a.x, y: a.y, z: a.z });
      w.notify(a.owner, `${l ? `${l.title} ${l.name}'s ${name}` : name}: ${this.nameOf(r)}.`, 'good');
    }
    return xp;
  }
  // the levels at which a pilot picks a perk
  perkLevels() { return list(this.world.rules.content.voyage.PerkLevels || '3, 5').map(Number); }
}, {});
