// Traders and crew, no browser needed:  npm test
// Four regional traders, one in each region, traded with from the chart: their own dialog and
// stock, prices by standing with their faction, nothing for the Hostile; unique goods one per
// life (room plans, echoes, clues, a chart, Sabre plans); found once, on the chart for good,
// with their stock back each life. Wayhouses, where drifters come aboard (sometimes with a
// name); crew limited by the berths.
import { rules as loadCore } from './headless.js';
import * as V from '../src/galaxy/voyage.js';
import * as K from '../src/galaxy/crew.js';
import * as CM from '../src/galaxy/comms.js';
import * as B from '../src/galaxy/base.js';
import { generateGalaxy, reach, tiers } from '../src/galaxy/galaxy.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const rules = await loadCore();
const T = rules.content.traders;
const clone = (x) => JSON.parse(JSON.stringify(x));
function at(seed, id, standing = 30) {
  const s = V.newVoyage(rules, { seed }), g = V.galaxyOf(rules, s);
  s.queue = [];
  Object.assign(s.stores, { ore: 9000, salvage: 9000, ice: 9000, glim: 9000, spores: 900, food: 9000, cogmarks: 3000 });
  s.at = g.traders[id]; V.reveal(rules, s);
  const fid = T[id].Faction;
  s.standing[fid] = standing; s.met[fid] = true;
  return { s, g, fid };
}
const buyPrice = (s, id, good) => CM.quote(rules, s, T[id].Faction, s.at, { [good]: 1 }, {}, id).cost;

// 1. Four traders, one per region, where the drive can reach them
{
  let ok = true, rows = [];
  const Tt = tiers(rules);
  for (const short of [false, true]) for (let seed = 1; seed <= 10; seed++) {
    const g = generateGalaxy(rules, seed, { short });
    for (const [id, tr] of Object.entries(T)) {
      const p = g.points[g.traders[id]];
      const ri = g.regions.indexOf(tr.Region);
      if (!p || p.region !== tr.Region || p.type !== 'Trader' || p.pocket || p.relic || p.seat || !reach(g.points.length, g.lanes, g.start, Tt[Math.min(ri, Tt.length - 1)])[p.id]) ok = false;
    }
    if (g.points.filter((p) => p.wayhouse).length !== 2 * g.regions.length) ok = false;
    if (seed === 1 && !short) rows = Object.entries(T).map(([id, tr]) => `${tr.Name} (${tr.Region})`);
  }
  const regionsWith = new Set(Object.values(T).map((tr) => tr.Region));
  check(regionsWith.size === 4 && ok, `a trader in each region (and the Hollowkin holds in the Middens), never in a pocket or on a story place, and reachable at the region's drive level; two wayhouses a region: ${rows.join(', ')}`);
  const a = generateGalaxy(rules, 7), b = generateGalaxy(rules, 7);
  check(JSON.stringify(a.traders) === JSON.stringify(b.traders), 'the same seed puts them in the same places');
}

// 2. Trading from the chart: their own stock, their faction's standing
{
  const { s } = at(3, 'ledger');
  const go = V.canGoIn(rules, s);
  check(!go.ok && /trade from here/.test(go.why) && V.traderAt(rules, s) === 'ledger', `at the Lamp & Ledger there is no map: "${go.why}"`);
  const stock = CM.stockOf(rules, s, 'rivet', s.at, 'ledger').goods;
  check(stock['plan-workshop'] === 1 && stock.food > 0 && !stock.glim, `its own stock: food, salvage, spores, and one workshop plan (${Object.keys(stock).join(', ')})`);
  const friendly = buyPrice(s, 'ledger', 'food');
  s.standing.rivet = 0;
  const neutral = buyPrice(s, 'ledger', 'food');
  s.standing.rivet = -80;
  const hostile = CM.quote(rules, s, 'rivet', s.at, { food: 10 }, { ore: 500 }, 'ledger');
  check(friendly <= neutral && !hostile.ok && /will not trade/.test(hostile.why), `prices follow your standing with the Rivet Moot (food ${friendly} friendly, ${neutral} neutral), and they won't deal if you are Hostile`);
}

// 3. Unique goods, one each life: room plans, echoes, clues, a chart, Sabre plans
{
  const { s } = at(3, 'ledger');
  const before = V.installPlan(rules, s, 'workshop');
  const r = V.traderDeal(rules, s, { 'plan-workshop': 1, cogmarks: 0 }, { ore: 2000 });
  const again = CM.stockOf(rules, s, 'rivet', s.at, 'ledger').goods['plan-workshop'];
  check(!before.ok && /workshop plan, from The Lamp & Ledger/.test(before.why) && r.ok && V.installPlan(rules, s, 'workshop').ok && again === 0, `the workshop needs its plan ("${before.why}"); bought, it can be built, and there was only the one`);
  const t = V.newLife(rules, Object.assign(clone(s), { over: { reason: 'letgo', day: s.day, text: '' } }));
  t.at = s.at; t.stores.cogmarks = 3000; t.stores.ore = 9000; t.standing.rivet = 30;
  check(!V.installPlan(rules, t, 'workshop').ok && CM.stockOf(rules, t, 'rivet', t.at, 'ledger').goods['plan-workshop'] === 1 && t.known.includes(t.at), 'next life: the plan is gone with everything else, the trader has one again, and the chart still shows where they are');
  const m = at(4, 'murmur');
  V.remember(rules, m.s, 'radar', { quiet: true }); V.remember(rules, m.s, 'coils', { quiet: true }); V.remember(rules, m.s, 'lens', { quiet: true });
  const e0 = m.s.campaign.echoes | 0, c0 = (m.s.campaign.chart.clues || []).length;
  const r2 = V.traderDeal(rules, m.s, { echo: 2, clue: 1 }, { cogmarks: 2000 });
  check(r2.ok && m.s.campaign.echoes === e0 + 2 && m.s.campaign.chart.clues.length === c0 + 1 && m.s.campaign.chart.clues.some((c) => c.id === 'spindle'), 'the Murmur sells echoes for the Loom, and a clue: a circle round the Anchor Spindle');
  const l = at(5, 'laststop');
  const known0 = l.s.known.length, bp = l.s.blueprints.includes('sabre');
  const r3 = V.traderDeal(rules, l.s, { 'bp-sabre': 1, chart: 1 }, { cogmarks: 2500 });
  check(!bp && r3.ok && l.s.blueprints.includes('sabre') && V.remembers(l.s, 'hull-sabre') && l.s.known.length > known0, `the Last Stop sells Sabre plans (remembered for good) and a chart of the Shore (${l.s.known.length - known0} places)`);
}

// 4. Wayhouses and the berths
{
  const s = V.newVoyage(rules, { seed: 6 }), g = V.galaxyOf(rules, s);
  s.queue = [];
  const way = g.points.find((p) => p.wayhouse && p.ri === 0);
  s.at = way.id;
  const n0 = K.count(s.crew), p = V.driftersPlan(rules, s), day = s.day;
  const r = V.takeDrifters(rules, s);
  check(p.ok && r.ok && K.count(s.crew) === n0 + p.n + (p.named ? 1 : 0) && s.day === day + 1 && !V.driftersPlan(rules, s).ok, `at ${way.name}, ${p.n + (p.named ? 1 : 0)} drifters come aboard in a day, once a life`);
  // named newcomers: across many wayhouses, some come with a name, for an empty post or as a pilot
  let named = 0, posts = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const t = V.newVoyage(rules, { seed }), gt = V.galaxyOf(rules, t);
    t.queue = [];
    const vac = K.officerOf(t.crew, 'grower');
    if (seed % 2 && vac) { t.crew.people = t.crew.people.filter((q) => q !== vac); }
    t.at = gt.points.find((q) => q.wayhouse).id;
    if (!V.takeDrifters(rules, t).ok) continue;
    const said = t.log[t.log.length - 1].text;
    if (/Among them/.test(said)) { named++; if (/takes the empty post/.test(said)) posts++; }
  }
  check(named >= 5 && named <= 20 && posts > 0, `some drifters have names (${named} wayhouses of 30): someone for an empty post (${posts} times), or a pilot looking for a ship`);
  // the berths: no more than there is room for
  const f = V.newVoyage(rules, { seed: 6 });
  f.queue = []; f.at = way.id; f.crew.roles.hands += B.berths(rules, f) - K.count(f.crew);
  const full = V.driftersPlan(rules, f);
  check(!full.ok && /no berths/.test(full.why), `with every berth taken, the drifters have to stay ("${full.why}")`);
  const h = at(3, 'ledger');
  h.s.crew.roles.hands += B.berths(rules, h.s) - K.count(h.s.crew) - 3;
  const q = CM.quote(rules, h.s, 'rivet', h.s.at, { hands: 6 }, { ore: 3000 }, 'ledger');
  check(!q.ok && /berths for 3 more/.test(q.why), `hiring stops at the berths ("${q.why}")`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll trader checks passed');
process.exitCode = failures ? 1 : 0;
