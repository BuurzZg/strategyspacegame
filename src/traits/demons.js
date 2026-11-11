import { defineTrait, Trait } from '../engine/traits.js';
import { CELL, distSq3, angleOf, sin as sinOf, cos as cosOf } from '../engine/math.js';
import { AttackMove } from '../activities/attack.js';
import { FlyTo } from '../activities/fly.js';

// The Wound (PLAN.md §3, Milestone 21): the tech demons. Grown, not built. Their currency is
// ichor, kept on their player (player.ichor): Feeders strip it from wrecks, every ship that dies
// near a demon gives some up, and Nurseries trickle it. An Hour's pods spend it to gestate the
// pack. The WoundAI world trait plays them as an RTS opponent.

const list = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
const isWound = (p) => p && p.faction === 'wound';
const costOf = (info) => +info.traitInfo('Valued')?.Cost || 0;
const near = (a, b, r) => distSq3(a.x, a.y, a.z, b.x, b.y, b.z) <= r * r;
const mend = (a, n) => { if (a.health && n > 0) a.health.hp = Math.min(a.health.maxHp, a.health.hp + n); };
export const ichorOf = (p) => (p && p.ichor) | 0;
// the lair battle's state, for the report (mainspring.js)
const w0 = (w) => (w.lair && w.lair.core ? w.lair.report() : null);

// What a demon costs to grow, and how long it spends in the pod (ticks).
defineTrait('Gestation', class extends Trait {}, { Ichor: 50, Time: 200 });

// ---------------------------------------------------------------- Feeds
// Strips wrecks for ichor (Rate salvage a second while within reach of one, IchorPct of it
// ichor; Shearers cutting the same wrecks starve it). A Feeder (unarmed) goes
// looking for wrecks on its own whenever it is idle, nearest first, and drifts back to its Hour
// when there are none. A Gnawer (armed) only feeds when there is nothing to fight, and every
// ichor it eats mends Heal of its hull.
defineTrait('Feeds', class extends Trait {
  created() { this.timer = this.self.id % 10; this.meal = null; this.eaten = 0; }
  tick() {
    if (--this.timer > 0) return;
    this.timer = 10;
    const self = this.self, w = this.world, p = self.owner;
    const m = this.meal && !this.meal.dead && this.meal.wreck && this.meal.wreck.salvage > 0 ? this.meal : null;
    if (m && w.edgeDist(self, m) <= 700) {
      const t = m.wreck.take(Math.max(1, Math.trunc((this.info.Rate * 10) / 25)));
      if (t > 0) {
        // salvage cut out becomes ichor at IchorPct (the rest is just metal)
        this.carry = (this.carry | 0) + t * this.info.IchorPct;
        const n = Math.trunc(this.carry / 100);
        this.carry -= n * 100;
        p.ichor = ichorOf(p) + n; this.eaten += t;
        if (p.ichorLog) p.ichorLog.fed += n;
        mend(self, t * this.info.Heal);
        if (!(w.frame % 50)) w.fx({ t: 'feed', actor: self.id, wreck: m.id, x: m.x, y: m.y, z: m.z });
      }
      return;
    }
    this.meal = m;
    if (!self.isIdle) return;
    // armed: only when nothing is in reach to fight
    if (self.attack && self.trait('AutoTarget')?.acquire(self.trait('AutoTarget').info.ScanRange)) return;
    const range = self.attack ? 14000 : 60000;
    let best = null, bd = range * range;
    for (const t of w.traitsOfType('Wreck')) {
      const a = t.self;
      if (a.dead || t.salvage <= 0) continue;
      const d = distSq3(a.x, a.y, a.z, self.x, self.y, self.z);
      if (d < bd) { bd = d; best = a; }
    }
    if (best) {
      this.meal = best;
      // stop at its edge, on our side of it
      const r = best.wreck.radius() + 400, dx = self.x - best.x, dy = self.y - best.y;
      const ax = Math.abs(dx) + Math.abs(dy) || 1;
      self.queueActivity(new FlyTo(best.x + Math.trunc((dx * r) / ax), best.y + Math.trunc((dy * r) / ax), best.z, 'Feeding'), false);
      return;
    }
    const hour = p.wound && p.wound.hour();
    if (hour && !self.attack && !near(self, hour, 6000)) self.queueActivity(new FlyTo(hour.x + 3000, hour.y + 3000, hour.z, 'Returning'), false);
  }
}, { Rate: 40, IchorPct: 20, Heal: 0 });

// ---------------------------------------------------------------- Gestates
// An Hour's pods: up to Pods demons growing at once, of the Types it knows. grow() starts one if
// the ichor is there; when its Time is up it is born at the Hour's flank.
defineTrait('Gestates', class extends Trait {
  created() { this.pods = []; this.born = 0; this.side = 1; }
  get types() { return list(this.info.Types); }
  free() { return this.pods.length < this.info.Pods; }
  can(type) {
    const g = this.world.rules.actors.has(type) && this.world.rules.actor(type).traitInfo('Gestation');
    return !!g && this.free() && this.types.includes(type) && ichorOf(this.self.owner) >= +g.Ichor;
  }
  grow(type) {
    if (!this.can(type)) return false;
    const g = this.world.rules.actor(type).traitInfo('Gestation'), p = this.self.owner;
    p.ichor -= +g.Ichor;
    if (p.ichorLog) p.ichorLog.spent += +g.Ichor;
    this.pods.push({ type, left: Math.max(1, Math.trunc((+g.Time * ((p.slot && p.slot.growPct) || 100)) / 100)) });
    return true;
  }
  growing(type) { return this.pods.filter((x) => x.type === type).length; }
  tick() {
    if (!this.pods.length) return;
    const self = this.self, w = this.world;
    for (const pod of this.pods) pod.left--;
    while (this.pods.length && this.pods[0].left <= 0) {
      const pod = this.pods.shift();
      // born at a flank, alternating sides, facing the way the Hour faces
      const h = self.health.info, off = (h.Radius | 0) + 700, yaw = (self.yaw + (this.side > 0 ? 256 : 768)) & 1023;
      this.side = -this.side;
      const v = [Math.trunc((off * cosOf(yaw)) / 1024), Math.trunc((off * sinOf(yaw)) / 1024)];
      const a = w.createActor(pod.type, self.owner, { x: self.x + v[0], y: self.y + v[1], z: self.z, yaw: self.yaw });
      this.born++;
      w.fx({ t: 'birth', actor: a.id, type: pod.type, from: self.id, x: a.x, y: a.y, z: a.z });
      w.emit('gestated', a, self);
    }
  }
}, { Pods: 2, Types: '' });

// ---------------------------------------------------------------- Buds
// A Nursery: buds a Tick or a Feeder every Interval ticks, up to Cap of its brood alive; trickles
// ichor (Trickle a second) into the Wound's pool; and its creep mends demons within Creep (Heal a
// second). It does not move. It burns.
defineTrait('Buds', class extends Trait {
  created() { this.timer = this.info.Interval; this.brood = []; this.second = (this.self.id * 5) % 25; }
  tick() {
    const self = this.self, w = this.world, p = self.owner;
    if (--this.second <= 0) {
      this.second = 25;
      p.ichor = ichorOf(p) + this.info.Trickle;
      if (p.ichorLog) p.ichorLog.trickle += this.info.Trickle;
      for (const a of w.unitsInSphere(self.x, self.y, self.z, this.info.Creep, [])) if (a.owner === p && a !== self && a.mobile) mend(a, this.info.Heal);
    }
    if (--this.timer > 0) return;
    this.timer = this.info.Interval;
    this.brood = this.brood.filter((id) => { const a = w.actorById.get(id); return a && !a.dead; });
    if (this.brood.length >= this.info.Cap) return;
    const feeders = this.brood.filter((id) => w.actorById.get(id).type === 'feeder').length;
    const type = feeders < 2 ? 'feeder' : 'tick';
    if (!w.rules.actors.has(type)) return;
    const r = self.health.info.Radius + 600, yaw = (this.brood.length * 160 + self.id * 37) & 1023;
    const a = w.createActor(type, p, { x: self.x + Math.trunc((r * cosOf(yaw)) / 1024), y: self.y + Math.trunc((r * sinOf(yaw)) / 1024), z: self.z, yaw });
    this.brood.push(a.id);
    w.fx({ t: 'birth', actor: a.id, type, from: self.id, x: a.x, y: a.y, z: a.z });
  }
}, { Interval: 900, Cap: 6, Trickle: 3, Creep: 6000, Heal: 400 });

// ---------------------------------------------------------------- Drags
// Near an Hour, time drags: enemy ships within Range fly at Pct of their speed (flight.js reads
// dragPct while dragUntil lasts).
defineTrait('Drags', class extends Trait {
  tick() {
    const self = this.self, w = this.world;
    if ((w.frame + self.id) % 10) return;
    for (const a of w.unitsInSphere(self.x, self.y, self.z, this.info.Range, [])) {
      if (!a.mobile || a.dead || !self.owner.isEnemy(a.owner)) continue;
      a.dragPct = this.info.Pct; a.dragUntil = w.frame + 12;
    }
  }
}, { Range: 9000, Pct: 80 });

// ---------------------------------------------------------------- Flees
// Badly hurt (under FleePct of its hull), it runs for the far side of the map from its enemies
// and regrows (Regen a second) until it has ReturnPct again.
defineTrait('Flees', class extends Trait {
  created() { this.self.fleeing = false; this.flights = 0; }
  tick() {
    const self = this.self, w = this.world, h = self.health;
    if (!h || (w.frame + self.id) % 25) return;
    if (self.fleeing) {
      mend(self, this.info.Regen);
      if (h.hp * 100 >= h.maxHp * this.info.ReturnPct) { self.fleeing = false; w.fx({ t: 'hour-returns', actor: self.id, x: self.x, y: self.y, z: self.z }); }
      else if (self.isIdle) this.run();
      return;
    }
    if (h.hp * 100 < h.maxHp * this.info.FleePct) {
      self.fleeing = true; this.flights++;
      this.run();
      w.fx({ t: 'hour-flees', actor: self.id, x: self.x, y: self.y, z: self.z });
      w.notify(w.players[0], 'The Hour is running, to regrow. Finish it, or let it go.', 'good');
    }
  }
  run() {
    const self = this.self, w = this.world, b = w.bounds;
    // away from the nearest enemy hull: the far corner from it
    let foe = null, fd = Infinity;
    for (const a of w.actors) {
      if (a.dead || !a.health || !a.mobile || !self.owner.isEnemy(a.owner)) continue;
      const d = distSq3(a.x, a.y, a.z, self.x, self.y, self.z);
      if (d < fd) { fd = d; foe = a; }
    }
    const m = 8 * CELL, x = foe && foe.x > self.x ? b.x0 + m : b.x1 - m, y = foe && foe.y > self.y ? b.y0 + m : b.y1 - m;
    self.cancelActivity();
    self.queueActivity(new FlyTo(x, y, 0, 'Fleeing'), false);
  }
}, { FleePct: 35, ReturnPct: 70, Regen: 1200 });

// ---------------------------------------------------------------- the Wound's mind
// World trait: plays the Wound's player, once a second.
//   economy      keep Feeders out (FeederBase, plus one a Nursery, up to FeederMax)
//   counter      Chimes when you field fighters (one per ChimePer of them), Stingers when you
//                field big hulls (one per big hull), up to CounterMax of each; otherwise the
//                pack's mix (Mix)
//   waves        when the pack's worth reaches WavePct of your fleet's (and at least WaveMin),
//                it goes for the Forge
//   retreat      when a wave falls under RetreatPct of what it set out with, it falls back to
//                the Hour to regrow (while it holds JoinPct, what is newly grown joins it)
//   expand       the Hour plants a Nursery on a rock or wreck near it (NurseryIchor, up to
//                Nurseries, every PlantEvery seconds at most)
// The slot (voyage.js) sets the Hand: ichor to start with, how it behaves (hunt: the Hour comes
// for the Forge after Delay; lair: it holds where it is), which types it may grow, and its caps.
defineTrait('WoundAI', class extends Trait {
  worldLoaded() {
    const w = this.world;
    this.p = w.players.find(isWound) || null;
    if (!this.p) return;
    const slot = this.p.slot || {};
    this.p.wound = this;
    this.p.ichor = slot.ichor | 0;
    this.p.ichorLog = { start: this.p.ichor, fed: 0, dead: 0, trickle: 0, spent: 0 };
    this.mode = slot.hand || 'lair';
    this.delay = slot.delay | 0;
    this.wave = null; this.waves = 0; this.retreats = 0; this.planted = 0; this.nextPlant = 0; this.mixAt = 0;
    this.grown = {}; this.log = [];
    this.cap = { nurseries: slot.nurseries ?? this.info.Nurseries, feeders: this.info.FeederMax };
    this.types = slot.grow ? list(slot.grow) : null;
    w.wound = this;
    this.hours = 0; this.burned = 0; this.killed = 0;
    w.on('killed', (victim) => {
      if (victim.owner !== this.p || !victim.health) return;
      this.killed++;
      if (victim.has('Gestates')) { this.hours++; w.fx({ t: 'hour-dies', actor: victim.id, x: victim.x, y: victim.y, z: victim.z }); w.notify(w.players[0], 'The Hour is dead. Its pack falters.', 'good'); }
      if (victim.has('Buds')) { this.burned++; w.notify(w.players[0], `A Nursery burns.${this.nurseries().length ? '' : ' That was the last of them: the place is clean.'}`, 'good'); }
    });
    // an infested place: its Nurseries grow on rocks and wrecks out of the Forge's way
    for (let k = 0; k < (slot.plant | 0); k++) this.plantAt(this.siteFor(null), true);
    // the dead feed it: a ship lost within reach of a demon gives up DeadPct of its worth
    w.on('killed', (victim) => {
      const p = this.p;
      if (!victim.mobile || !victim.health || victim.owner === p) return;
      const worth = costOf(victim.info);
      if (!worth) return;
      for (const t of [...w.traitsOfType('Feeds'), ...w.traitsOfType('Gestates')]) {
        const a = t.self;
        if (a.dead || a.owner !== p || !near(a, victim, this.info.DeadRange)) continue;
        const n = Math.trunc((worth * this.info.DeadPct) / 100);
        p.ichor += n; p.ichorLog.dead += n;
        w.fx({ t: 'feed', actor: a.id, x: victim.x, y: victim.y, z: victim.z, dead: true });
        break;
      }
    });
  }
  nurseries() { return this.mine().filter((a) => a.has('Buds')); }
  // what the voyage needs to know (wound.js afterMap)
  report() {
    const h = this.hour();
    return { lair: w0(this.world), hand: this.mode === 'hunt' ? 1 : 0, hours: this.hours, hourPct: h ? Math.trunc((h.health.hp * 100) / Math.max(1, h.health.maxHp)) : 0, burned: this.burned, nurseries: this.nurseries().length, planted: this.planted, killed: this.killed, waves: this.waves, retreats: this.retreats, grown: { ...this.grown }, ichor: { ...this.p.ichorLog, now: this.p.ichor } };
  }
  hour() { const w = this.world, p = this.p; for (const t of w.traitsOfType('Gestates')) if (!t.self.dead && t.self.owner === p) return t.self; return null; }
  mine() { const p = this.p; return this.world.actors.filter((a) => a.owner === p && !a.dead && a.health); }
  foe() { return this.world.players[0]; }
  forge() { const me = this.foe(); return this.world.actors.find((a) => a.owner === me && !a.dead && a.has('Hangar')) || null; }
  // your fleet as the Wound sees it: fighters, big hulls, and what it is all worth
  enemyFleet() {
    const out = { fighters: 0, big: 0, worth: 0 };
    for (const a of this.world.actors) {
      if (a.dead || !a.mobile || !a.attack || !this.p.isEnemy(a.owner) || a.owner !== this.foe()) continue;
      const armor = a.info.traitInfo('Armor')?.Type || 'light';
      if (armor === 'light') out.fighters++;
      else if ((armor === 'heavy' || armor === 'capital') && !a.has('Hangar')) out.big++;
      out.worth += costOf(a.info);
    }
    return out;
  }
  can(type) { return !this.types || this.types.includes(type); }
  // what the pods should grow next
  choose(g, mine, foe) {
    const count = (t) => mine.filter((a) => a.type === t).length + g.growing(t);
    const nurseries = count('nursery');
    if (count('feeder') < Math.min(this.cap.feeders, this.info.FeederBase + nurseries) && this.can('feeder')) return 'feeder';
    const per = Math.max(1, this.info.ChimePer);
    if (foe.fighters >= per && count('chime') < Math.min(this.info.CounterMax, Math.trunc((foe.fighters + per - 1) / per)) && this.can('chime')) return 'chime';
    if (foe.big > 0 && count('stinger') < Math.min(this.info.CounterMax, foe.big) && this.can('stinger')) return 'stinger';
    const mix = list(this.info.Mix).filter((t) => this.can(t) && g.types.includes(t));
    if (!mix.length) return '';
    return mix[this.mixAt % mix.length];
  }
  tick() {
    const w = this.world, p = this.p;
    if (!p || (w.frame % 25) !== 12) return;
    const mine = this.mine(), hour = this.hour(), forge = this.forge(), foe = this.enemyFleet();
    // grow
    const g = hour && !hour.fleeing ? hour.trait('Gestates') : null;
    if (g) {
      for (let k = 0; k < 2 && g.free(); k++) {
        const type = this.choose(g, mine, foe);
        if (!type || !g.grow(type)) break;
        this.grown[type] = (this.grown[type] | 0) + 1;
        if (list(this.info.Mix).includes(type)) this.mixAt++;
      }
    }
    // expand
    if (hour && !hour.fleeing && w.frame >= this.nextPlant && mine.filter((a) => a.type === 'nursery').length < this.cap.nurseries && p.ichor >= this.info.NurseryIchor) this.plant(hour);
    // the pack: armed demons that are not the Hour or a Nursery
    const army = mine.filter((a) => a.mobile && a.attack && !a.has('Gestates'));
    const worth = (ids) => ids.reduce((t, id) => { const a = w.actorById.get(id); return a && !a.dead && a.health ? t + Math.trunc((costOf(a.info) * a.health.hp) / Math.max(1, a.health.maxHp)) : t; }, 0);
    if (this.wave) {
      const now = worth(this.wave.ids);
      if (now * 100 < this.wave.worth * this.info.RetreatPct) {
        // the wave broke: what is left falls back to regrow
        this.retreats++;
        const home = hour || null;
        for (const id of this.wave.ids) {
          const a = w.actorById.get(id);
          if (!a || a.dead) continue;
          a.cancelActivity();
          if (home) a.queueActivity(new FlyTo(home.x + 4000, home.y - 4000, home.z, 'Falling back'), false);
        }
        this.say(`retreat ${now}/${this.wave.worth}`);
        w.fx({ t: 'wound-retreat', x: hour ? hour.x : 0, y: hour ? hour.y : 0, z: 0 });
        this.wave = null;
      } else if (forge) {
        // keep the wave on the Forge; while it is going well, what is newly grown joins it
        for (const id of this.wave.ids) { const a = w.actorById.get(id); if (a && !a.dead && a.isIdle) a.queueActivity(new AttackMove(forge.x, forge.y, forge.z), false); }
        if (now * 100 >= this.wave.worth * this.info.JoinPct) {
          for (const a of army) {
            if (!a.isIdle || this.wave.ids.includes(a.id)) continue;
            this.wave.ids.push(a.id); this.wave.worth += costOf(a.info);
            a.queueActivity(new AttackMove(forge.x, forge.y, forge.z), false);
          }
        }
      }
    } else if (forge && (this.mode === 'hunt' ? w.frame >= this.delay : true)) {
      const free = army.filter((a) => a.isIdle || a.activity instanceof FlyTo);
      const have = free.reduce((t, a) => t + costOf(a.info), 0);
      const need = Math.max(this.info.WaveMin, Math.trunc((foe.worth * this.info.WavePct) / 100));
      if (free.length && have >= need) {
        this.waves++;
        this.wave = { ids: free.map((a) => a.id), worth: have };
        for (const a of free) { a.cancelActivity(); a.queueActivity(new AttackMove(forge.x, forge.y, forge.z), false); }
        this.say(`wave ${this.waves}: ${free.length} worth ${have} (need ${need})`);
        w.fx({ t: 'wound-wave', n: free.length, x: free[0].x, y: free[0].y, z: free[0].z });
      }
    }
    // the Hour: a hunting Hour closes on the Forge behind its pack, and stops at its guns' reach
    if (hour && !hour.fleeing && forge && this.mode === 'hunt' && w.frame >= this.delay) {
      const d2 = distSq3(hour.x, hour.y, hour.z, forge.x, forge.y, forge.z), hold = this.info.HourHold;
      if (d2 > (hold + 4000) * (hold + 4000) && (hour.isIdle || !(w.frame % 250))) {
        const dx = hour.x - forge.x, dy = hour.y - forge.y, ax = Math.abs(dx) + Math.abs(dy) || 1;
        hour.cancelActivity();
        hour.queueActivity(new FlyTo(forge.x + Math.trunc((dx * hold) / ax), forge.y + Math.trunc((dy * hold) / ax), forge.z, 'Hunting'), false);
      }
    }
  }
  // where a Nursery would grow: the nearest rock or wreck to `from` (the Hour; null: the far
  // side of the map from where the Forge comes in) within PlantRange, with none near it yet
  siteFor(from) {
    const w = this.world, b = w.bounds, R = from ? this.info.PlantRange : 1e9;
    const at = from || { x: b.x0 + Math.trunc(((b.x1 - b.x0) * 75) / 100), y: (b.y0 + b.y1) >> 1, z: 0 };
    const taken = this.nurseries();
    let best = null, bd = R * R;
    for (const t of [...w.traitsOfType('Rock'), ...w.traitsOfType('Asteroid'), ...w.traitsOfType('Wreck')]) {
      const a = t.self;
      if (a.dead || taken.some((n) => near(n, a, 9000))) continue;
      if (!from && a.x < b.x0 + Math.trunc(((b.x1 - b.x0) * 40) / 100)) continue; // not in the Forge's lap
      const d = distSq3(a.x, a.y, a.z, at.x, at.y, at.z);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }
  plantAt(site, free = false, from = null) {
    if (!site) return null;
    const w = this.world, p = this.p;
    const r = (site.body ? site.body.radius() : 1000) + 700, yaw = from ? angleOf(from.x - site.x, from.y - site.y) : (site.id * 97) & 1023;
    if (!free) { p.ichor -= this.info.NurseryIchor; p.ichorLog.spent += this.info.NurseryIchor; }
    const n = w.createActor('nursery', p, { x: site.x + Math.trunc((r * cosOf(yaw)) / 1024), y: site.y + Math.trunc((r * sinOf(yaw)) / 1024), z: site.z, yaw });
    this.planted++;
    this.say(`${free ? 'found' : 'planted'} a nursery at ${n.x >> 10},${n.y >> 10}`);
    if (!free) w.fx({ t: 'planted', actor: n.id, x: n.x, y: n.y, z: n.z });
    return n;
  }
  // the Hour plants a Nursery on the nearest rock or wreck to it that has none
  plant(hour) {
    this.nextPlant = this.world.frame + this.info.PlantEvery * 25;
    this.plantAt(this.siteFor(hour), false, hour);
  }
  say(text) { this.log.push(`${this.world.frame}: ${text}`); if (this.log.length > 60) this.log.shift(); }
}, {
  FeederBase: 2, FeederMax: 4, ChimePer: 4, CounterMax: 6, Mix: 'hound, tick, tick, hound, gnawer, tick', WavePct: 60, WaveMin: 900,
  RetreatPct: 40, JoinPct: 60, NurseryIchor: 300, Nurseries: 3, PlantEvery: 60, PlantRange: 24000, HourHold: 14000,
  DeadPct: 25, DeadRange: 12000,
});
