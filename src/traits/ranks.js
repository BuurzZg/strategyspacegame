import { defineTrait, Trait } from '../engine/traits.js';
import { weights } from '../engine/content.js';

// Veterancy. A ship earns experience for every enemy it destroys (more for bigger ones), and a
// point for coming home from a visit where it fought. Ranks (voyage.yaml) raise its damage and
// hull by RankBonus percent each. Experience rides in the Forge's hangar from place to place;
// lose the ship and it is gone. A ship's named lead (crew.yaml traits) adds their own Damage,
// Hull and Learn (faster experience); the wing commander's work (slot.xpPct) speeds it for all.
defineTrait('Ranks', class extends Trait {
  worldLoaded() {
    const w = this.world, V = w.rules.content.voyage || {};
    w.ranks = this;
    this.steps = weights(V.Ranks || 'Seasoned 4, Veteran 10, Elite 20');
    this.bonus = V.RankBonus === undefined ? 10 : +V.RankBonus;
    w.on('killed', (victim, attacker) => {
      if (!attacker || attacker.dead || !attacker.mobile || !victim.health || !attacker.owner.isEnemy(victim.owner)) return;
      attacker.kills = (attacker.kills | 0) + 1;
      this.gain(attacker, Math.max(1, Math.trunc((+victim.info.traitInfo('Valued')?.Cost || 60) / 60)));
    });
  }
  rankOf(xp) { let r = 0; this.steps.forEach(([, n], i) => { if (xp >= n) r = i + 1; }); return r; }
  nameOf(r) { return r > 0 ? this.steps[r - 1][0] : ''; }
  // percent: damage and hull at this rank
  pct(r) { return 100 + this.bonus * (r | 0); }
  // a ship's damage and hull in percent: its rank, and its lead's touch
  damagePct(a) { return Math.max(10, this.pct(a.rank) + (a.leadDamage | 0)); }
  hullPct(a) { return Math.max(10, this.pct(a.rank) + (a.leadHull | 0)); }
  fit(a) {
    if (!a.health) return;
    const max = Math.trunc((a.health.info.HP * this.hullPct(a)) / 100);
    a.health.hp = Math.max(1, Math.min(max, a.health.hp + (max - a.health.maxHp)));
    a.health.maxHp = max;
  }
  // A ship leaves the bay: its experience, and its lead (null: none named).
  equip(a, xp, lead) {
    if (lead) { a.lead = lead.id; a.leadDamage = lead.damage | 0; a.leadHull = lead.hull | 0; a.leadLearn = lead.learn | 0; }
    a.xp = xp | 0; a.rank = this.rankOf(a.xp);
    if (a.rank || a.leadHull) this.fit(a);
  }
  // Set a ship's experience; returns true if that raised its rank.
  set(a, xp) {
    const old = a.rank | 0, r = this.rankOf(xp);
    a.xp = xp; a.rank = r;
    if (r !== old) this.fit(a);
    return r > old;
  }
  gain(a, n) {
    const xpPct = (a.owner.slot && a.owner.slot.xpPct) || 100;
    n = Math.max(1, Math.trunc((n * xpPct * (100 + (a.leadLearn | 0))) / 10000));
    if (!this.set(a, (a.xp | 0) + n)) return;
    const w = this.world, name = a.info.traitInfo('Tooltip')?.Name || a.type;
    const l = a.lead && a.owner.crew ? a.owner.crew.lead(a.lead) : null;
    w.fx({ t: 'rankup', actor: a.id, rank: a.rank, owner: a.owner.index, x: a.x, y: a.y, z: a.z });
    w.notify(a.owner, `${l ? `${l.title} ${l.name}'s ${name}` : name}: ${this.nameOf(a.rank)}.`, 'good');
  }
}, {});
