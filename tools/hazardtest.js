// Hazards: routes closed until remembered, no browser needed:  npm test
// The generator carves hazard pockets (hazards.yaml) off to the side of each region: every lane
// in from outside carries the hazard, and nothing gets in without the memory that opens it.
// Turned away, the officer at the hazard's post says why (or whoever is acting in it), and the
// memory can be recalled on the Loom from then on. Each pocket keeps a cache of echoes, opened
// once in a campaign, and its places yield more. Everything outside the pockets stays reachable,
// so the captain gets home in a single life on every seed.
import { rules as loadCore } from './headless.js';
import * as V from '../src/galaxy/voyage.js';
import * as K from '../src/galaxy/crew.js';
import { generateGalaxy, reach, tiers, anyDrive } from '../src/galaxy/galaxy.js';
import { captain } from './captain.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const rules = await loadCore();
const H = rules.content.hazards, M = rules.content.memories, posts = rules.content.crew.posts;
const clone = (x) => JSON.parse(JSON.stringify(x));
const DRIVE = ['coils', 'lens', 'spindle', 'heartstone'];
const visit = (s, found) => V.returnFromMap(rules, s, { stores: {}, forge: { hp: s.forge.hp }, ships: { aboard: s.fleet, destroyed: {}, leftBehind: {}, built: {} }, ticks: 100, found, crew: { lost: {} } });
const other = (l, i) => (l.a === i ? l.b : l.a);
// a voyage with the whole drive remembered, sitting just outside a pocket of this hazard
function outside(seed, hazard) {
  const s = V.newVoyage(rules, { seed }), g = V.galaxyOf(rules, s);
  for (const id of DRIVE) V.remember(rules, s, id, { quiet: true });
  s.queue = [];
  const k = g.pockets.find((x) => x.hazard === hazard);
  if (!k) return null;
  const li = g.lanes.findIndex((l) => l.hazard === hazard && (k.places.includes(l.a) !== k.places.includes(l.b)));
  const l = g.lanes[li], inside = k.places.includes(l.a) ? l.a : l.b;
  s.at = other(l, inside); s.stores.glim = 5000;
  return { s, g, k, inside };
}

// 1. Four hazards, each opened by a memory and reported by a post
{
  const ok = Object.values(H).every((h) => M[h.Opens] && M[h.Opens].Seen === h.id && String(M[h.Opens].Gives).includes(`open ${h.id}`) && posts[h.Report] && h.Say);
  check(Object.keys(H).length === 4 && ok, `four hazards: ${Object.values(H).map((h) => `${h.Name} (${M[h.Opens].Name}, the ${posts[h.Report].Name.toLowerCase()})`).join(', ')}`);
}

// 2. Pockets in every galaxy, off to the side, closed
{
  const T = tiers(rules), all = anyDrive(rules).hazards;
  let every = true, shape = true, sealed = true, closed = true, opens = true, safe = true, counts = [];
  for (const short of [false, true]) for (let seed = 1; seed <= 12; seed++) {
    const g = generateGalaxy(rules, seed, { short }), n = g.points.length;
    if (!g.pockets.length) every = false;
    counts.push(g.pockets.length);
    const where = new Map();
    for (const k of g.pockets) for (const i of k.places) where.set(i, k);
    for (const k of g.pockets) {
      const region = g.points[k.places[0]].region, ri = g.points[k.places[0]].ri;
      // in one region; never the wake-up point, a drive part, an anchor or a station; the cache inside
      if (k.places.some((i) => g.points[i].region !== region || i === g.start || g.points[i].seat || (g.points[i].relic && i !== k.cache)) || g.points[k.cache].relic !== k.id || g.points[k.cache].pocket !== k.hazard) shape = false;
      // every lane out of the pocket carries its hazard, and no lane joins two pockets
      for (const i of k.places) for (const li of g.adj[i]) { const l = g.lanes[li], j = other(l, i); if (where.get(j) === k ? l.hazard : l.hazard !== k.hazard || where.has(j)) sealed = false; }
      const tier = T[Math.min(ri, T.length - 1)];
      // shut to the whole drive; open with this pocket's memory alone, at the region's own tier
      if (k.places.some((i) => reach(n, g.lanes, g.start, { ...T[3], hazards: all.filter((h) => h !== k.hazard) })[i])) closed = false;
      if (!k.places.every((i) => reach(n, g.lanes, g.start, { ...tier, hazards: [k.hazard] })[i])) opens = false;
    }
    // every drive part and anchor stays outside the pockets
    if (Object.values(g.components).some((i) => g.points[i].pocket && !/^cache-/.test(g.points[i].relic))) safe = false;
  }
  check(every, `every galaxy has hazard pockets (${counts.join(', ')} in 12 full and 12 short galaxies)`);
  check(shape, 'each pocket is a few places in one region, never the wake-up point, a drive part, an anchor or a station, with a cache wreck inside');
  check(sealed, 'every lane in from outside carries the pocket\'s hazard, and no lane joins two pockets');
  check(closed && opens, 'no drive gets in without the memory; with it, the pocket opens at its region\'s own drive level');
  check(safe, 'drive parts and anchors are never in a pocket');
  const a = generateGalaxy(rules, 21), b = generateGalaxy(rules, 21);
  check(JSON.stringify(a.pockets) === JSON.stringify(b.pockets) && JSON.stringify(a.lanes) === JSON.stringify(b.lanes), 'the same seed carves the same pockets');
}

// 3. Turned away: the officer at the hazard's post says why
{
  const rows = [];
  let right = true;
  for (const h of Object.values(H)) {
    let o = null;
    for (let seed = 1; !o && seed < 40; seed++) o = outside(seed, h.id);
    const { s, inside } = o, p = V.plan(rules, s, inside), officer = K.officerOf(s.crew, h.Report);
    if (p.ok || p.hazard !== h.id || !p.why.startsWith(`${posts[h.Report].Name} ${officer.name}: "${h.Say}"`) || !p.why.endsWith(`Closed until you remember ${M[h.Opens].Name}.`)) right = false;
    rows.push(p.why.split(':')[0]);
  }
  check(right, `the right officer reports each hazard: ${rows.join('; ')}`);
  const { s, inside } = outside(1, 'shoals');
  const chief = K.officerOf(s.crew, 'engineer');
  K.kill(s.crew, chief.id, { day: s.day, how: 'a test' });
  const nobody = V.plan(rules, s, inside).why;
  const stand = K.newPerson(rules, s.crew, s.crew.next++, 'engineers', { taken: K.namesInUse(s.crew) });
  s.crew.people.push(stand); s.crew.roles.engineers++;
  const acting = V.plan(rules, s, inside).why;
  check(acting.startsWith(`Acting chief engineer ${stand.name}: "`) && nobody.startsWith('The engineers: "'), `with the post vacant, whoever is acting speaks ("${acting.split(':')[0]}"), or failing that the crew ("${nobody.split(':')[0]}")`);
  const t = V.newVoyage(rules, { seed: 3 }), g = V.galaxyOf(rules, t), hush = g.points.find((q) => q.region === 'Hush' && !q.pocket);
  t.queue = [];
  const nav = K.officerOf(t.crew, 'navigator'), veil = V.plan(rules, t, hush.id).why;
  check(veil.startsWith(`Navigator ${nav.name}: "`) && /reach/.test(veil), `the navigator reports the drive's reach and the Veil ("${veil}")`);
}

// 4. The memory: recalled only once turned away, for echoes; then the way is open, in every life
{
  const { s, g, k, inside } = outside(2, 'shoals');
  s.campaign.echoes = 5;
  const before = V.recallPlan(rules, s, 'shields');
  check(!before.ok && /turn the Forge away/.test(before.why), `Shields can't be recalled before the shoals turn the Forge away ("${before.why}")`);
  const day = s.day, at = s.at, r = V.stitch(rules, s, inside);
  check(!r.ok && s.at === at && s.day === day && s.campaign.hazards.includes('shoals') && s.log.some((l) => /^Turned away by the asteroid shoals\./.test(l.text)), 'trying for the pocket: the Forge is turned away (no days, no Glim), and the campaign remembers it');
  check(V.turnedAway(rules, s, inside) === 'shoals' && s.campaign.hazards.length === 1, 'turned away again: nothing new');
  const poor = clone(s); poor.campaign.echoes = 1;
  check(!V.recallPlan(rules, poor, 'shields').ok && V.recallPlan(rules, s, 'shields').ok && V.recallPlan(rules, s, 'shields').cost === 2, 'now Shields can be recalled, for two echoes');
  V.recall(rules, s, 'shields');
  check(s.campaign.echoes === 3 && V.drive(rules, s).hazards.includes('shoals') && V.stitch(rules, s, inside).ok && s.at === inside, `recalled: the shoals open, and the Forge goes in, to ${g.points[inside].name}`);
  const t = V.newLife(rules, Object.assign(clone(s), { over: { reason: 'air', day: s.day, text: '' } }));
  check(V.remembers(t, 'shields') && V.drive(rules, t).hazards.includes('shoals') && t.campaign.hazards.includes('shoals'), 'in the next life, the shoals stay open');
  check(!V.drive(rules, t).hazards.includes('glare') && k.places.length >= 3, 'the others stay closed');
}

// 5. The cache: a strongbox of echoes, once in a campaign; richer places in the pockets
{
  const { s, g, k } = outside(4, 'shoals');
  V.remember(rules, s, 'shields', { quiet: true });
  s.at = k.cache;
  const st = V.visitSettings(rules, s);
  check(st.layout.hulk && st.layout.hulk.relic === k.id && st.layout.hulk.relicName === 'a strongbox with your own mark on it', `the cache waits in a wreck, ${g.points[k.cache].name}`);
  const e0 = s.campaign.echoes | 0;
  visit(s, [k.id]);
  check(s.campaign.echoes === e0 + 2 && V.anchorDone(rules, s, k.id) && s.log.some((l) => /letters in your own hand/.test(l.text)), 'cut open: two echoes, once');
  visit(s, [k.id]);
  const t = V.newLife(rules, Object.assign(clone(s), { over: { reason: 'air', day: s.day, text: '' } }));
  t.at = k.cache;
  check(s.campaign.echoes === e0 + 2 && V.anchorDone(rules, t, k.id) && !V.visitSettings(rules, t).layout.hulk.relic, 'not twice, and not again in a later life');
  // richness: the same place, in a pocket and not
  const q = g.points.find((x) => x.pocket && x.id !== k.cache && (x.type === 'OreReef' || x.type === 'IceTail' || x.type === 'LanternMist' || x.type === 'ScrapShoal'));
  const total = (o) => (o && typeof o === 'object' ? Object.entries(o).reduce((n, [key, v]) => n + (['amount', 'salvage'].includes(key) && typeof v === 'number' ? v : total(v)), 0) : 0);
  s.at = q.id;
  const rich = total(V.visitSettings(rules, s).layout), pocket = q.pocket;
  delete q.pocket;
  const plain = total(V.visitSettings(rules, s).layout);
  q.pocket = pocket;
  check(rich * 100 >= plain * 145 && rich * 100 <= plain * 155, `places in a pocket yield half again as much (${q.name}: ${rich} against ${plain})`);
}

// 6. Drifting, and a save from inside a pocket
{
  const { s, inside } = outside(5, 'glare');
  const d = V.driftPlan(rules, s, inside);
  check(!d.ok && /^Surgeon .*Closed until you remember Lead-lined decks\.$/.test(d.why), `no drifting in either ("${d.why.slice(0, 60)}...")`);
  const t = V.newVoyage(rules, { seed: 5 }), g = V.galaxyOf(rules, t);
  t.queue = [];
  for (const id of DRIVE) V.remember(rules, t, id, { quiet: true });
  t.at = g.pockets[0].places[0];
  check(V.drive(rules, t).hazards.includes(g.pockets[0].hazard) && V.plan(rules, t, g.start).route, 'a voyage saved inside a pocket (before pockets) can get out');
}

// 7. A single life gets home on every seed
{
  const bad = [];
  let days = [];
  for (const length of ['full', 'short']) for (let seed = 1; seed <= 50; seed++) {
    const r = captain(rules, seed, { length });
    if (!r.s.won) bad.push(`${length} ${seed}: ${r.s.over ? r.s.over.reason : 'stuck'} on day ${r.s.day}`);
    else if (length === 'full') days.push(r.s.day);
  }
  days.sort((a, b) => a - b);
  check(!bad.length, `the captain gets home in a single life on 50 full and 50 short seeds, round every pocket${bad.length ? `; not: ${bad.join(', ')}` : ` (full voyages: median day ${days[days.length >> 1]})`}`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll hazard checks passed');
process.exitCode = failures ? 1 : 0;
