// Comms and trade, no browser needed:  npm test
// Every dialog validates, every node and every choice can be reached; prices follow standing,
// stock and wants exactly; deals, hiring crew and ships; treaties are enforced on maps (truces
// keep guns cold, firing breaks them, leave stops theft, they run out); ceasefires and threats
// over comms on a map; information reveals places.
import { rules as loadCore, makeWorld } from './headless.js';
import { makeOrder, makeWorldOrder } from '../src/engine/order.js';
import * as V from '../src/galaxy/voyage.js';
import * as C from '../src/galaxy/comms.js';
import { meet, standingOf } from '../src/galaxy/standing.js';
import { count } from '../src/galaxy/crew.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const rules = await loadCore();
const F = rules.content.factions;

// 1. Dialogs: valid, and every node and choice reachable in some situation
{
  const errs = Object.values(rules.content.dialogs).flatMap((d) => C.lintDialog(rules, d));
  check(!errs.length, `all ${Object.keys(rules.content.dialogs).length} dialogs validate${errs.length ? `: ${errs.join('; ')}` : ''}`);
  const flags = new Set(); for (const d of Object.values(rules.content.dialogs)) for (const [k, n] of Object.entries(d)) if (k.startsWith('Node@')) for (const [ck, c] of Object.entries(n)) if (ck.startsWith('Choice@')) for (const x of String(c.If || '').split(',')) { const p = C.parseCond(x); if (p.op === 'flag') flags.add(p.flag); }
  const contexts = [];
  for (let tier = 0; tier < 5; tier++) for (const station of [true, false]) for (const where of ['chart', 'map']) for (const atWar of [false, true]) for (const treaties of [[], C.TREATIES]) for (const fl of [new Set(), flags])
    contexts.push({ rules, tier, station, where, atWar, treaties, flags: fl, stores: Object.fromEntries(Object.keys(rules.content.resources).map((k) => [k, 99999])), place: 'Here', region: 'There' });
  let unreached = [];
  let total = 0;
  for (const fid of Object.keys(F)) {
    const d = C.dialogOf(rules, fid);
    // walk every node reachable from Start in any context; record every choice seen
    const seen = new Set([d.Start]), queue = [d.Start], choices = new Set();
    while (queue.length) {
      const id = queue.shift();
      for (const ctx of contexts) {
        const v = C.nodeView({ ...ctx, fid }, id);
        for (const c of v.choices) { choices.add(`${id}.${c.id}`); if (c.goto && !seen.has(c.goto)) { seen.add(c.goto); queue.push(c.goto); } }
      }
    }
    for (const [k, n] of Object.entries(d)) {
      if (!k.startsWith('Node@')) continue;
      const id = k.slice(5);
      if (!seen.has(id)) unreached.push(`${fid}: node ${id}`);
      for (const ck of Object.keys(n)) if (ck.startsWith('Choice@')) { total++; if (!choices.has(`${id}.${ck.slice(7)}`)) unreached.push(`${fid}: ${id}.${ck.slice(7)}`); }
    }
  }
  check(!unreached.length, `every node and every one of the ${total} choices can be reached${unreached.length ? `; not: ${unreached.join(', ')}` : ''}`);
  // conditions really gate
  const ctx = { rules, fid: 'rivet', tier: 3, station: false, where: 'chart', atWar: false, treaties: [], flags: new Set(), stores: { salvage: 50 } };
  const v = C.nodeView(ctx, 'hello'), ids = v.choices.map((c) => c.id);
  check(!ids.includes('trade') && ids.includes('info') && !ids.includes('peace') && !ids.includes('ceasefire'), `away from their station, Friendly: no trading, no peace talk, no ceasefire (${ids.join(', ')})`);
  const info = C.nodeView(ctx, 'info').choices.find((c) => c.id === 'buy');
  check(info && !info.ok && /50 salvage/.test(info.why), `a choice you cannot pay for is shown but refused ("${info && info.why}")`);
}

// 2. Prices
{
  const val = (g) => C.valueOf(rules, g);
  const buy = (tier, g, stock, max) => C.buyPrice(rules, tier, g, stock, max) / 100;
  const r2 = (x) => Math.round(x * 100) / 100;
  check(buy(3, 'glim', 100, 100) === val('glim') && buy(4, 'glim', 100, 100) === r2(val('glim') * 0.7) && buy(1, 'glim', 100, 100) === r2(val('glim') * 1.3),
    `buying Glim (value ${val('glim')}): Friendly ${buy(3, 'glim', 100, 100)}, Allied ${buy(4, 'glim', 100, 100)} (−30%), Wary ${buy(1, 'glim', 100, 100)} (+30%)`);
  check(buy(3, 'glim', 0, 100) === val('glim') * 1.5 && buy(3, 'glim', 50, 100) === val('glim') * 1.25, `scarcity: with half their stock gone ${buy(3, 'glim', 50, 100)}, with none left ${buy(3, 'glim', 0, 100)}`);
  const sell = (tier, fid, g) => C.sellPrice(rules, tier, fid, g) / 100;
  check(sell(2, 'synod', 'salvage') === r2(val('salvage') * 0.7 * 0.9) && sell(2, 'synod', 'ore') === r2(val('ore') * 0.3 * 0.9), `selling to the Synod (Neutral): salvage they want ${sell(2, 'synod', 'salvage')}, ore they do not ${sell(2, 'synod', 'ore')}`);
}

// 3. Deals, crew and ships
{
  const s = V.newVoyage(rules, { seed: 21 });
  const g = V.galaxyOf(rules, s);
  const ref = g.points.find((p) => p.seat && p.owner === 'synod');
  s.at = ref.id; meet(rules, s, 'synod');
  s.stores.salvage = 2000;
  const q = C.quote(rules, s, 'synod', ref.id, { glim: 300 }, { salvage: 900 });
  const glim0 = s.stores.glim, st0 = standingOf(rules, s, 'synod');
  const unfair = C.quote(rules, s, 'synod', ref.id, { glim: 300 }, { salvage: 100 });
  check(!unfair.ok && /Not a fair deal/.test(unfair.why), `an unfair deal is refused (${unfair.why})`);
  const r = C.deal(rules, s, 'synod', ref.id, { glim: 300 }, { salvage: 900 });
  check(q.ok && r.ok && s.stores.glim === glim0 + 300 && s.stores.salvage === 1100 && standingOf(rules, s, 'synod') === st0 + 1, `300 Glim from the Synod for 900 salvage (they ask ${q.cost}, you give ${q.pay}); trading warms them (+1)`);
  const stock = C.stockOf(rules, s, 'synod', ref.id).goods.glim;
  V.passDays(rules, s, 4);
  const later = C.stockOf(rules, s, 'synod', ref.id).goods.glim;
  check(stock === 1200 && later === 1500, `their stock runs down (1500 → ${stock}) and builds back up over days (${later})`);
  // hiring at a Cinder hold: pilots, and a Halberd with its crew
  const hold = g.points.find((p) => p.seat && p.owner === 'cinder');
  s.at = hold.id; meet(rules, s, 'cinder'); s.standing.cinder = 10;
  s.stores.salvage = 5000; s.stores.ore = 5000;
  const crew0 = count(s.crew), hands0 = s.crew.roles.hands, fleet0 = s.fleet.length;
  const h = C.deal(rules, s, 'cinder', hold.id, { pilots: 4, 'ship:halberd': 1 }, { salvage: 2500 });
  check(h.ok && s.crew.roles.pilots >= 4 && s.fleet.length === fleet0 + 1 && s.crew.roles.hands === hands0 + 14 && s.crew.assigned.hands >= 28 && count(s.crew) === crew0 + 4 + 14, `hiring 4 pilots and a Halberd, which comes with its 14 hands (${h.ok ? `cost ${h.cost}` : h.why})`);
  s.fleet.push(...Array.from({ length: 12 }, () => ({ type: 'halberd', hp: 1 })));
  const full = C.quote(rules, s, 'cinder', hold.id, { 'ship:spindle': 1 }, { salvage: 2000 });
  check(!full.ok && /hangar/.test(full.why), `no room in the hangar, no new hull (${full.why})`);
}

// 4. Treaties on the chart and on maps
async function visit(s, at) {
  s.at = at;
  const w = await makeWorld(V.visitSettings(rules, s));
  const me = w.players[0];
  const tick = (n) => { for (let i = 0; i < n; i++) w.tick(); };
  const order = (name, subjects, target, extra) => w.resolveOrder(makeOrder(name, subjects, target, extra), me);
  return { w, me, tick, order, forge: w.actors.find((a) => a.owner === me && a.has('Hangar')) };
}
{
  const s = V.newVoyage(rules, { seed: 23 });
  const g = V.galaxyOf(rules, s);
  const den = g.points.find((p) => p.seat && p.owner === 'gaunt');
  s.at = den.id;
  s.stores.glim = 2000;
  // pay tribute over comms from the chart
  const ctx = C.chartContext(rules, s, g, 'gaunt');
  const choice = C.nodeView(ctx, 'tribute').choices.find((c) => c.id === 'glim');
  const out = C.applyOnChart(rules, s, g, 'gaunt', choice.effects);
  check(out.close && C.activeTreaties(s, 'gaunt').includes('Tribute') && s.stores.glim === 1600, `tribute to the Ashen Gaunt: 400 Glim for ${rules.content.treaties.Tribute} days of peace (${out.notes.join(' ')})`);
  const v1 = await visit(s, den.id);
  const gp = v1.w.players.find((p) => p.faction === 'gaunt');
  v1.tick(25 * 10);
  check(!v1.me.isEnemy(gp), 'while the tribute holds, the Gaunt hold their fire at their own den');
  // fire on them: the treaty breaks
  const hal = v1.w.actors.find((a) => a.owner === v1.me && a.type === 'halberd'), target = v1.w.actors.find((a) => a.owner === gp && a.mobile);
  v1.order('Attack', [hal], { actor: target });
  v1.tick(3);
  v1.forge.health.hp = v1.forge.health.maxHp;
  v1.order('Recall', v1.w.actors.filter((a) => a.owner === v1.me && a.mobile && a !== v1.forge));
  v1.order('SpoolSkein', [v1.forge]);
  for (let i = 0; i < v1.forge.skein.time + 2 && !v1.w.report; i++) v1.w.tick();
  const rep = v1.w.report.standing;
  const st0 = standingOf(rules, s, 'gaunt');
  V.returnFromMap(rules, s, v1.w.report);
  check(v1.me.isEnemy(gp) && rep.broken.includes('gaunt') && !C.activeTreaties(s, 'gaunt').length && s.standing.gaunt <= st0 - 40, `firing on them breaks it: war on the map, and ${rep.changes.gaunt.reasons['broke a treaty']} standing (${st0} → ${s.standing.gaunt})`);
  // a leave treaty stops theft costing anything; and treaties run out
  const t = V.newVoyage(rules, { seed: 23 });
  meet(rules, t, 'synod');
  C.addTreaty(rules, t, 'synod', 'Leave');
  const ref = g.points.find((p) => p.seat && p.owner === 'synod');
  t.at = ref.id;
  check(V.visitSettings(rules, t).poi.leave === true, 'a Leave treaty gives leave to work their claims');
  V.passDays(rules, t, +rules.content.treaties.Leave + 1);
  check(!C.activeTreaties(t, 'synod').length && V.visitSettings(rules, t).poi.leave === false, `after ${rules.content.treaties.Leave} days it runs out`);
}

// 5. Comms on a map: a ceasefire mid-fight, and threats
{
  const s = V.newVoyage(rules, { seed: 29 });
  const g = V.galaxyOf(rules, s);
  const town = g.points.find((p) => p.seat && p.owner === 'rivet');
  meet(rules, s, 'rivet'); s.standing.rivet = 0;
  const v = await visit(s, town.id);
  const rp = v.w.players.find((p) => p.faction === 'rivet');
  v.tick(25 * 6);
  const hal = v.w.actors.find((a) => a.owner === v.me && a.type === 'halberd'), picket = v.w.actors.find((a) => a.owner === rp && a.type === 'picket');
  v.order('Attack', [hal], { actor: picket });
  v.tick(25 * 2);
  const atWar = v.me.isEnemy(rp);
  // hail them: the dialog runs in the UI; its effects go to the simulation as a world order
  const ctx = { rules, fid: 'rivet', tier: 2, station: false, where: 'map', atWar: true, treaties: [], flags: new Set(), stores: {} };
  const cf = C.nodeView(ctx, 'hello').choices.find((c) => c.id === 'ceasefire');
  const agree = C.nodeView(ctx, cf.goto).choices.find((c) => c.id === 'agree');
  v.w.resolveOrder(makeWorldOrder('Comms', { faction: 'rivet', effects: agree.effects }), v.me);
  check(atWar && !v.me.isEnemy(rp) && v.w.diplomacy.report().treaties.some((t) => t.kind === 'Ceasefire'), 'mid-fight, a ceasefire over comms: the Rivet Moot stand down, and the treaty goes home with you');
  // threats: a big fleet frightens a small patrol; a lone Forge does not
  const t1 = V.newVoyage(rules, { seed: 29 });
  t1.fleet = Array.from({ length: 6 }, () => ({ type: 'sabre', hp: 1 }));
  t1.at = g.points.find((p) => p.owner === 'synod' && !p.seat).id;
  meet(rules, t1, 'synod');
  const n1 = C.applyOnChart(rules, t1, g, 'synod', [{ op: 'threaten' }]).notes[0];
  const t2 = V.newVoyage(rules, { seed: 29 });
  t2.fleet = [];
  t2.at = t1.at; meet(rules, t2, 'synod');
  const n2 = C.applyOnChart(rules, t2, g, 'synod', [{ op: 'threaten' }]).notes[0];
  check(/hand over/.test(n1) && t1.standing.synod === -10 && /laugh/.test(n2) && t2.standing.synod === -15, `threats: six Sabres get goods ("${n1}"); no fleet gets laughed at`);
}

// 6. Information
{
  const s = V.newVoyage(rules, { seed: 31 });
  const g = V.galaxyOf(rules, s);
  const k0 = s.known.length;
  const a = C.reveal(rules, s, g, 'survey'), k1 = s.known.length;
  const b = C.reveal(rules, s, g, 'chart'), k2 = s.known.length;
  const inRegion = g.points.filter((p) => p.region === g.points[s.at].region).every((p) => s.known.includes(p.id));
  check(k1 > k0 && k2 > k1 && inRegion, `buying a survey (${a}) and a chart (${b})`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll comms checks passed');
process.exitCode = failures ? 1 : 0;
