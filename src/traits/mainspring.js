import { defineTrait, Trait } from '../engine/traits.js';
import { distSq3, sin as SIN, cos as COS } from '../engine/math.js';

// The Mainspring (Milestone 22; PLAN.md §3): the demon lord, a living mothership waiting in its
// lair at the Shore. Its organs (two hearts and the coil) ward its core: while any lives, the
// core takes no harm. It regrows from the battle's dead, and its hearts mend it. As the battle
// goes on, the Twain in Jacob's coat answers it: everything of the Wound near the Forge is held
// still for a few seconds. When the core dies, the Wound unwinds.
const parts = (v) => String(v || '').split(',').map((x) => x.trim().split(/\s+/)).filter((p) => p[0]).map(([type, f, s]) => ({ type, f: +f | 0, s: +s | 0 }));

// An organ of the Mainspring: immobile, grown at its flank. (Info only: Organs grows them.)
defineTrait('Organ', class extends Trait {}, {});

defineTrait('Organs', class extends Trait {
  created() {
    const self = this.self;
    this.ids = [];
    self.ward = () => this.alive().length > 0;
    self.world.addFrameEndTask(() => this.grow());
  }
  grow() {
    const self = this.self, w = this.world;
    if (self.dead || this.ids.length) return;
    const c = COS(self.yaw), s = SIN(self.yaw);
    for (const p of parts(this.info.Parts)) {
      if (!w.rules.actors.has(p.type)) continue;
      const x = self.x + Math.trunc((p.f * c - p.s * s) / 1024), y = self.y + Math.trunc((p.f * s + p.s * c) / 1024);
      const a = w.createActor(p.type, self.owner, { x, y, z: self.z, yaw: self.yaw });
      a.organOf = self.id;
      this.ids.push(a.id);
    }
    w.on('killed', (victim) => {
      if (victim.organOf !== self.id || self.dead) return;
      const left = this.alive().length;
      w.fx({ t: 'organ-dies', actor: victim.id, type: victim.type, left, x: victim.x, y: victim.y, z: victim.z });
      w.notify(w.players[0], left ? `The ${victim.info.traitInfo('Tooltip').Name.toLowerCase()} is broken. ${left} more ward the core.` : 'The last organ is broken. The core is open: strike it now.', 'good');
    });
  }
  alive() { const w = this.world; return this.ids.filter((id) => { const a = w.actorById.get(id); return a && !a.dead; }); }
  hearts() { const w = this.world; return this.alive().filter((id) => w.actorById.get(id).type === 'heart').length; }
}, { Parts: '' });

// It regrows from the dead: every ship that dies near it (anyone's) mends it; its hearts mend it
// a little every second.
defineTrait('Regrows', class extends Trait {
  created() {
    const self = this.self, w = this.world;
    this.fed = 0;
    w.on('killed', (victim) => {
      if (self.dead || victim === self || !victim.mobile || !victim.health) return;
      const r = this.info.Range;
      if (distSq3(victim.x, victim.y, victim.z, self.x, self.y, self.z) > r * r) return;
      const worth = +victim.info.traitInfo('Valued')?.Cost || 0, n = Math.trunc((worth * this.info.Pct * this.info.HealPer) / 100);
      if (n <= 0) return;
      self.health.heal(n); this.fed += n;
      w.fx({ t: 'regrow', actor: self.id, from: victim.id, x: victim.x, y: victim.y, z: victim.z });
    });
  }
  tick() {
    const self = this.self, w = this.world;
    if ((w.frame + self.id) % 25) return;
    const o = self.trait('Organs'), beats = o ? o.hearts() : 0;
    if (beats) self.health.heal(this.info.Regen * beats);
  }
}, { Range: 20000, Pct: 40, HealPer: 30, Regen: 900 });

// World trait: the lair battle. The Twain answers the Mainspring every Every seconds (holding the
// Wound still near the Forge for Still seconds), and when the core dies, the Wound unwinds.
defineTrait('LairBattle', class extends Trait {
  worldLoaded() {
    const w = this.world;
    this.core = null; this.dead = false; this.songs = 0; this.next = this.info.First * 25;
    w.lair = this;
    w.on('killed', (victim) => {
      if (victim.type !== 'mainspring' || this.dead) return;
      this.dead = true; this.unwindAt = w.frame + 25;
      w.fx({ t: 'mainspring-dies', actor: victim.id, x: victim.x, y: victim.y, z: victim.z });
      w.notify(w.players[0], 'The Mainspring is dead. Everything it wound is coming undone.', 'good');
    });
  }
  find() { if (!this.core || this.core.dead) this.core = this.world.actors.find((a) => a.type === 'mainspring' && !a.dead) || this.core; return this.core; }
  // a short voyage's Mainspring is less of itself (slot.lairPct): its core and organs
  scale() {
    const w = this.world, p = this.core && this.core.owner, pct = (p && p.slot && p.slot.lairPct) || 100;
    this.scaled = true;
    if (pct === 100) return;
    for (const a of w.actors) {
      if (a.dead || !a.health || (a !== this.core && a.organOf !== this.core.id)) continue;
      a.health.maxHp = Math.max(1, Math.trunc((a.health.maxHp * pct) / 100)); a.health.hp = Math.min(a.health.hp, a.health.maxHp);
    }
  }
  tick() {
    const w = this.world;
    // (only where the Mainspring is: looked for now and then, for the Proving Grounds)
    if (!this.core && (w.frame % 50 || !this.find())) return;
    if (!this.scaled && w.frame > 2) this.scale();
    if (this.dead) {
      // the Wound unwinds: a few of its ships come apart every second
      if (w.frame >= this.unwindAt && !(w.frame % 10)) {
        const left = w.actors.filter((a) => a.owner.faction === 'wound' && !a.dead && a.health);
        for (const a of left.slice(0, 3)) a.health.kill(null, null);
      }
      return;
    }
    if (w.frame < this.next || !this.find() || this.core.dead) return;
    this.next = w.frame + this.info.Every * 25;
    const me = w.players[0], forge = w.actors.find((a) => a.owner === me && a.has('Hangar') && !a.dead);
    if (!forge) return;
    const r = this.info.Range, until = w.frame + this.info.Still * 25;
    let held = 0;
    for (const a of w.actors) {
      if (a.dead || a.owner.faction !== 'wound' || !a.health) continue;
      if (distSq3(a.x, a.y, a.z, forge.x, forge.y, forge.z) > r * r) continue;
      a.stillUntil = until; held++;
    }
    this.songs++;
    w.fx({ t: 'twain', n: held, x: forge.x, y: forge.y, z: forge.z, radius: r });
    w.notify(me, `The Twain sings. Everything of the Wound near the Forge is held still for ${this.info.Still} seconds.`, 'good');
  }
  report() { const c = this.find(); return { core: c ? Math.trunc((c.health.hp * 100) / c.health.maxHp) : 0, dead: this.dead, songs: this.songs, organs: c && c.trait('Organs') ? c.trait('Organs').alive().length : 0 }; }
}, { First: 45, Every: 60, Still: 8, Range: 16000 });
