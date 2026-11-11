// Named crew, no browser needed:  npm test
// Officers fill the Forge's posts and every armed ship has a named lead; their traits (YAML)
// change the voyage and their ships through the condition system; losses pick who dies, fairly;
// leads die with their ships on maps (unless their luck holds once), and new ships' leads join;
// events name people, kill them and change them; head counts and names always agree; saves from
// before named crew still load.
import { rules as loadCore, makeWorld } from './headless.js';
import { makeOrder } from '../src/engine/order.js';
import * as V from '../src/galaxy/voyage.js';
import * as K from '../src/galaxy/crew.js';
import * as C from '../src/galaxy/comms.js';
import { captain } from './captain.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const rules = await loadCore();
const CR = rules.content.crew;
const sound = (s) => K.checkRoster(rules, s.crew, s.fleet);
const officer = (s, post) => K.officerOf(s.crew, post);

// 1. A new voyage's crew
{
  const s = V.newVoyage(rules, { seed: 11 });
  const posts = Object.keys(CR.posts), filled = posts.filter((p) => officer(s, p));
  check(posts.length === 8 && filled.length === 8, `8 posts, all filled: ${filled.map((p) => `${CR.posts[p].Name} ${officer(s, p).name} (${K.traitOf(rules, officer(s, p)).Name})`).join(', ')}`);
  const armed = s.fleet.filter((e) => K.leadRole(rules, e.type)), led = armed.filter((e) => e.lead);
  check(armed.length === 3 && led.length === 3 && s.fleet.filter((e) => !K.leadRole(rules, e.type)).every((e) => !e.lead), `every armed ship has a named lead (${led.map((e) => `${K.fullName(rules, K.personById(s.crew, e.lead))} of the ${e.type}`).join(', ')}); the miners have none`);
  check(!sound(s).length && K.count(s.crew) === 150, `head counts and names agree (${sound(s).join('; ') || '150 aboard, 11 named'})`);
  const again = V.newVoyage(rules, { seed: 11 }), other = V.newVoyage(rules, { seed: 12 });
  const names = (x) => x.crew.people.map((p) => `${p.name}/${p.trait}`).join(',');
  check(names(again) === names(s) && names(other) !== names(s), 'the same seed gives the same people; another seed, others');
  check(s.crew.people.every((p) => (p.post ? ['officer', 'both'] : ['lead', 'both']).includes(CR.traits[p.trait].For)), 'officers get officer traits and leads get lead traits');
}

// 2. Traits change the voyage, through conditions
{
  const s = V.newVoyage(rules, { seed: 11 });
  s.queue = []; s.systems.life = 50; s.stores.ore = s.stores.salvage = 9999;
  const eng = officer(s, 'engineer');
  eng.trait = 'gifted'; const gifted = V.repairPlan(rules, s, 'life').points;
  eng.trait = 'green'; const green = V.repairPlan(rules, s, 'life').points;
  eng.trait = 'beloved'; const plain = V.repairPlan(rules, s, 'life').points;
  check(gifted > plain && plain > green && V.projectBonus(rules, s, 'RepairPct') === 100, `a day of repairs: ${gifted}% with a gifted chief engineer, ${plain}% with one whose trait does not touch the work, ${green}% with a green one`);
  const gr = officer(s, 'grower');
  gr.trait = 'fairweather'; s.morale = 70; const good = V.projectBonus(rules, s, 'FoodPct');
  s.morale = 50; const bad = V.projectBonus(rules, s, 'FoodPct');
  check(good === 120 && bad === 100, `a fair-weather grower: food ${good}% at morale 70, ${bad}% at morale 50 (When: morale >= 60)`);
  gr.trait = 'homesick'; s.day = 100; const early = V.projectBonus(rules, s, 'FoodPct'); s.day = 260; const late = V.projectBonus(rules, s, 'FoodPct');
  check(early === 100 && late === 85, `a homesick grower: food ${early}% on day 100, ${late}% on day 260`);
  s.day = 50; s.morale = 70;
  const g = V.galaxyOf(rules, s), len = g.lanes[g.adj[s.at][0]].len, nav = officer(s, 'navigator');
  nav.trait = 'beloved'; const g0 = V.stitchCost(rules, s, len);
  nav.trait = 'gifted'; const g1 = V.stitchCost(rules, s, len);
  check(g1 < g0, `a gifted navigator burns less Glim a stitch (${g1} for ${g0})`);
  // the quartermaster's haggling
  const t = V.newVoyage(rules, { seed: 11 }), tg = V.galaxyOf(rules, t);
  const seat = tg.points.find((p) => p.seat && p.owner === 'rivet');
  const qm = officer(t, 'quartermaster'), buy = { ore: 300 };
  qm.trait = 'beloved'; const q0 = C.quote(rules, t, 'rivet', seat.id, buy, {}).cost;
  qm.trait = 'gifted'; const q1 = C.quote(rules, t, 'rivet', seat.id, buy, {}).cost;
  check(q1 < q0, `a gifted quartermaster: 300 ore for ${q1} instead of ${q0}`);
  // morale: who is aboard pulls the crew's mood
  const m = (trait) => { const u = V.newVoyage(rules, { seed: 11 }); u.queue = []; for (const p of u.crew.people) p.trait = trait; u.morale = 70; for (let i = 0; i < 6; i++) V.dayTick(rules, u); return u.morale; };
  const up = m('beloved'), down = m('grim');
  check(up > 70 && down < 70, `eleven beloved officers and leads lift morale (70 → ${up}); eleven grim ones wear it down (70 → ${down})`);
  // growing: a green officer settles in
  const w = V.newVoyage(rules, { seed: 11 }); w.queue = [];
  Object.assign(w.stores, { ice: 1e6, food: 1e6, spores: 1e5, glim: 1e5 });
  const o = officer(w, 'watch'); o.trait = 'green'; o.traitDay = w.day;
  V.passDays(rules, w, +CR.traits.green.After - 1);
  const still = o.trait;
  V.passDays(rules, w, 1);
  check(still === 'green' && o.trait === 'steady' && w.log.some((l) => /green no longer: now steady/.test(l.text)), `a green watch officer is steady once ${CR.traits.green.After} days have passed`);
}

// 3. Losses pick who dies, fairly
{
  let named = 0, died = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const s = V.newVoyage(rules, { seed });
    const hands = K.named(s.crew, 'hands').filter((p) => p.post).length;
    const before = s.crew.fallen.length;
    K.lose(s.crew, 'hands', Math.trunc(K.free(s.crew, 'hands') / 2), { day: s.day, how: 'test' }, s.fleet);
    named += hands; died += s.crew.fallen.length - before;
  }
  const rate = (died * 100) / named;
  check(rate > 40 && rate < 60, `lose half the free hands, 200 times: ${rate.toFixed(1)}% of the named officers among them die (each is as likely as anyone)`);
  const s = V.newVoyage(rules, { seed: 3 });
  s.queue = [];
  let ok = true;
  for (let d = 0; d < 40; d++) { s.stores.food = 0; s.stores.spores = 0; V.dayTick(rules, s); if (sound(s).length) ok = false; }
  check(ok && s.crew.fallen.length > 0 && s.log.some((l) => /Among them:/.test(l.text)) && Object.keys(CR.posts).every((p) => officer(s, p)), `forty days of hunger: ${150 - K.count(s.crew)} die, ${s.crew.fallen.length} of them named (the log says who), every post refilled by promotion, and the counts agree every day`);
  // with nobody free in a role, ships lose theirs too: the leads among them
  const u = V.newVoyage(rules, { seed: 3 });
  const pilots0 = K.named(u.crew, 'pilots').length;
  K.lose(u.crew, 'pilots', u.crew.roles.pilots, { day: 1, how: 'test' }, u.fleet);
  K.assignFleet(u.crew, rules, u.fleet, { day: 1 });
  check(K.named(u.crew, 'pilots').length === 0 && pilots0 > 0 && u.fleet.every((e) => !e.lead || K.leadRole(rules, e.type) !== 'pilots') && !sound(u).length, 'every pilot lost: the named pilots and navigator are among the dead, the Darts have no leads, and the roster is still sound');
}

// 4. On a map: leads die with their ships, luck holds once, new ships get new leads
async function visit(prep) {
  const s = V.newVoyage(rules, { seed: 7 }), g = V.galaxyOf(rules, s);
  s.queue = [];
  s.at = g.points.find((p) => p.type === 'StillWater' && p.id !== g.start).id;
  if (prep) prep(s);
  const settings = V.visitSettings(rules, s);
  settings.fog = false;
  const w = await makeWorld(settings), me = w.players[0];
  const fauna = w.players.find((p) => p.faction === 'fauna');
  const forge = w.actors.find((a) => a.owner === me && a.has('Hangar'));
  const notes = [];
  const tick = (n) => { for (let i = 0; i < n; i++) { w.tick(); for (const e of w.fxEvents) if (e.t === 'notify') notes.push(e.text); w.fxEvents.length = 0; } };
  const order = (n, sub, t, x) => w.resolveOrder(makeOrder(n, sub, t, x), me);
  const leave = () => { order('Recall', w.actors.filter((a) => a.owner === me && a.mobile && a !== forge && !a.dead)); tick(25 * 90); order('SpoolSkein', [forge]); for (let i = 0; i < forge.skein.time + 2 && !w.report; i++) tick(1); return w.report; };
  return { s, w, me, fauna, forge, tick, order, notes, leave };
}
{
  const m = await visit((s) => {
    const darts = s.fleet.filter((e) => e.type === 'dart');
    K.personById(s.crew, darts[0].lead).trait = 'ace';
    K.personById(s.crew, darts[1].lead).trait = 'lucky';
  });
  m.tick(25 * 8);
  const darts = m.w.actors.filter((a) => a.owner === m.me && a.type === 'dart');
  const ace = darts.find((a) => m.me.crew.lead(a.lead).trait === 'ace'), lucky = darts.find((a) => m.me.crew.lead(a.lead).trait === 'lucky');
  const aceName = m.me.crew.lead(ace.lead).name, luckyName = m.me.crew.lead(lucky.lead).name;
  // the ace hits harder
  const wh = m.w.rules.weapons.get('PulseBattery').warheads[0];
  const t1 = m.w.createActor('halberd', m.fauna, { x: ace.x + 30000, y: ace.y, z: ace.z }), t2 = m.w.createActor('halberd', m.fauna, { x: ace.x - 30000, y: ace.y, z: ace.z });
  const hit = (firer, target) => { const h = target.health.hp; wh.W.apply({ world: m.w, owner: m.me, firer }, wh, target.x, target.y, target.z, target); return h - target.health.hp; };
  const base = hit(lucky, t1), aced = hit(ace, t2);
  check(aced === Math.trunc((base * 120) / 100), `on a map, an ace's Dart does ${aced} where another does ${base} (+20%)`);
  t1.health.kill(null, m.fauna); t2.health.kill(null, m.fauna);
  // a new Dart gets a new named pilot
  m.order('StartProduction', [m.forge], null, 'dart');
  m.tick(25 * 40);
  const built = m.w.actors.find((a) => a.owner === m.me && a.type === 'dart' && a !== ace && a !== lucky);
  const recruit = built && m.me.crew.lead(built.lead);
  check(!!recruit && recruit.fresh, `a Dart built there launches with a new pilot: ${recruit ? `${recruit.title} ${recruit.name} (${recruit.traitName})` : 'none'}`);
  // both old Darts are destroyed: the ace dies, the lucky one gets out
  ace.health.kill(null, m.fauna); lucky.health.kill(null, m.fauna);
  m.tick(5);
  check(m.notes.some((t) => t.includes(`${aceName} was lost with the Dart`)) && m.notes.some((t) => t.includes(`${luckyName} got out of the Dart in a pod`)), 'the map says who was lost, and who got out');
  const report = m.leave();
  check(report.crew.leadsLost.some((l) => l.id === ace.lead) && report.crew.leadsSaved.some((l) => l.id === lucky.lead) && report.crew.recruited.some((l) => l.id === recruit.id), 'the report names the lead lost, the lead saved and the lead who joined');
  const s = m.s, f0 = s.crew.fallen.length;
  V.returnFromMap(rules, s, report);
  const dead = s.crew.fallen.find((f) => f.name === aceName), saved = s.crew.people.find((p) => p.name === luckyName), joined = s.crew.people.find((p) => p.name === recruit.name);
  check(dead && /killed at .*, flying the Dart/.test(dead.how) && s.crew.fallen.length >= f0 + 1, `back on the chart: ${dead && `${aceName} ${dead.how}`}`);
  check(saved && saved.trait === 'shaken' && !s.fleet.some((e) => e.lead === saved.id), `${luckyName} is aboard, shaken now, with no ship (standing by)`);
  check(joined && s.fleet.some((e) => e.lead === joined.id && e.type === 'dart'), `${recruit.name} came home leading the new Dart`);
  check(!sound(s).length, `the counts and the names still agree (${sound(s).join('; ') || 'sound'})`);
  // the one standing by takes the next armed ship
  s.fleet.push({ type: 'dart', hp: rules.actor('dart').traitInfo('Health').HP });
  K.assignFleet(s.crew, rules, s.fleet, { day: s.day });
  check(s.fleet[s.fleet.length - 1].lead === saved.id, `a new Dart aboard goes to ${luckyName}, standing by, before anyone new`);
}
{
  // careful pilots' hulls, quick studies' experience
  const m = await visit((s) => { const d = s.fleet.filter((e) => e.type === 'dart'); K.personById(s.crew, d[0].lead).trait = 'careful'; K.personById(s.crew, d[1].lead).trait = 'quick'; officer(s, 'wing').trait = 'beloved'; });
  m.tick(25 * 8);
  const darts = m.w.actors.filter((a) => a.owner === m.me && a.type === 'dart');
  const careful = darts.find((a) => m.me.crew.lead(a.lead).trait === 'careful'), quick = darts.find((a) => m.me.crew.lead(a.lead).trait === 'quick');
  const HP = rules.actor('dart').traitInfo('Health').HP;
  check(careful.health.maxHp === Math.trunc((HP * 120) / 100) && quick.health.maxHp === HP, `a careful pilot's Dart has ${careful.health.maxHp} hull, another ${quick.health.maxHp}`);
  for (const a of [careful, quick]) { const g = m.w.createActor('picket', m.fauna, { x: a.x + 2500, y: a.y, z: a.z }); g.health.kill(a, m.me); }
  check(quick.xp > careful.xp, `the same kill: ${quick.xp} xp for a quick study, ${careful.xp} for another`);
}

// 5. Events name people, and change them
{
  const s = V.newVoyage(rules, { seed: 11 }), g = V.galaxyOf(rules, s);
  s.queue = []; s.day = 40;
  const ev = rules.content.events.Fever, ctx = V.eventContext(rules, s, g, ev);
  const sur = officer(s, 'surgeon');
  const v = C.nodeView(ctx, 'fever');
  check(v.choices[0].text.startsWith(`${sur.name} wants`), `{surgeon} becomes a name: "${v.choices[0].text}"`);
  s.queue = ['Fever'];
  const worse = C.nodeView(ctx, 'worse').choices[0];
  const r = V.eventChoice(rules, s, worse.effects);
  const gone = s.crew.fallen.find((f) => f.id === sur.id), next = officer(s, 'surgeon');
  check(gone && gone.how === 'lost: Fever on the lower decks' && next && next.id !== sur.id && next.trait === 'green' && r.notes.some((n) => n.includes(`Surgeon ${sur.name} is dead`)) && r.notes.some((n) => n.includes('steps up as surgeon')), `kill surgeon: ${sur.name} dies (${gone && gone.how}), and ${next && next.name} steps up, green`);
  check(!sound(s).length, 'and the roster is sound');
  const eng = officer(s, 'engineer');
  V.eventChoice(rules, s, C.nodeView(V.eventContext(rules, s, g, rules.content.events.EngineersIdea), 'bad').choices[0].effects);
  check(eng.trait === 'shaken', `mark engineer shaken: ${eng.name} is shaken`);
  const m = V.eventContext(rules, s, g, rules.content.events.Memorial);
  check(!C.conditionsHold(m, [C.parseCond('fallen >= 3')]) && s.crew.fallen.length === 1, 'the memorial waits until three of the named are gone');
  const pilot = C.whoIs(s, 'pilot'), letter = C.nodeView(V.eventContext(rules, s, g, rules.content.events.LetterHome), 'ask').say;
  check(pilot && letter.startsWith(`${pilot.name}, who flies the `), `{pilot} and {pilotship}: "${letter.slice(0, 60)}…"`);
  let bad = '';
  try { const r2 = await loadCore(); r2.content.events.Fever['Node@fever'].Say = 'Hello {nobody}'; C.lintDialog(r2, r2.content.events.Fever).forEach((e) => { bad += e; }); } catch (e) { bad = e.message; }
  check(/unknown placeholder \{nobody\}/.test(bad), 'an unknown {placeholder} is a content error');
}

// 6. Old saves still load
{
  const s = V.newVoyage(rules, { seed: 6 });
  // what a Milestone 12 save looked like: a head count, no names
  const old = JSON.parse(V.saveVoyage(s));
  old.version = 3;
  old.crew = { roles: { ...s.crew.roles }, assigned: { ...s.crew.assigned } };
  for (const e of old.fleet) delete e.lead;
  const t = V.loadVoyage(rules, JSON.stringify(old));
  check(t.version === V.SAVE_VERSION && t.crew.people.length === 11 && !sound(t).length && K.count(t.crew) === K.count(s.crew), `a save from before named crew loads: version ${t.version}, ${t.crew.people.length} people named, counts unchanged (${K.count(t.crew)})`);
  for (const e of t.fleet) if (e.lead) K.personById(t.crew, e.lead).trait = 'ace';
  const named = Object.values(V.mapCrew(rules, t).leads);
  check(named.length === 3 && named.every((l) => !l.damage && !l.hull && !l.learn && !l.escape), 'a map visit in progress in that save replays without the new traits, as it was played');
  t.visits++;
  check(Object.values(V.mapCrew(rules, t).leads).every((l) => l.damage === 20), 'the next visit has them (three aces: +20% damage)');
  const u = V.loadVoyage(rules, V.saveVoyage(t));
  check(V.voyageHash(u) === V.voyageHash(t), 'and saving and loading it again gives the identical voyage');
}

// 7. Whole voyages: the counts and the names agree at the end of every one
{
  const rows = [];
  let ok = true;
  for (const seed of [1, 2, 3, 4]) {
    const { s } = captain(rules, seed, { events: true });
    const errs = sound(s);
    if (errs.length) { ok = false; console.log(errs); }
    rows.push(`seed ${seed}: ${s.crew.people.length} named, ${s.crew.fallen.length} fallen`);
  }
  check(ok, `scripted voyages end with a sound roster (${rows.join('; ')})`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll crew checks passed');
process.exitCode = failures ? 1 : 0;
