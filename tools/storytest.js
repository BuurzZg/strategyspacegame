// The story (Milestone 22), no browser needed:  npm test
// The story places act by act; every story memory can be had, in play; the new peoples; the
// Meridian date (UNKNOWN until the Horologe, then known for good); the Mainspring's lair and the
// final battle, which can be won; the escape ending and the true ending with its final choice;
// the ending narration (each scene only with its memories, gap lines otherwise, a unique id for
// every line); and the bot reaching the true ending.
import { rules as loadCore, makeWorld } from './headless.js';
import { makeOrder } from '../src/engine/order.js';
import * as V from '../src/galaxy/voyage.js';
import * as N from '../src/galaxy/narration.js';
import { parseEffect } from '../src/galaxy/comms.js';
import { generateGalaxy, tiers, reach } from '../src/galaxy/galaxy.js';
import { captain, campaign, resolveEvents } from './captain.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const rules = await loadCore();
const A = rules.content.anchors, M = rules.content.memories;
const STORY = ['emblem', 'help', 'owner', 'fray', 'oath', 'afraid', 'lists', 'otherhalf', 'waking', 'horologe', 'offering', 'enough', 'truth'];
const report = (s, extra = {}) => ({ stores: {}, forge: { hp: s.forge.hp }, ships: { aboard: s.fleet, destroyed: {}, leftBehind: {}, built: {} }, ticks: 100, found: [], crew: { lost: {} }, ...extra });

// ---------------------------------------------------------------- 1. the story's places
{
  let ok = true, bad = [];
  const T = tiers(rules);
  for (const short of [false, true]) for (let seed = 1; seed <= 10; seed++) {
    const g = generateGalaxy(rules, seed, { short });
    for (const [id, a] of Object.entries(A)) {
      const p = g.points[g.components[id]];
      const ri = g.regions.indexOf(a.Region);
      const fine = p && p.region === a.Region && p.type === a.Type && !p.pocket && !p.trader && !p.seat && p.id !== g.start && reach(g.points.length, g.lanes, g.start, T[Math.min(ri, T.length - 1)])[p.id] && (a.Edge !== 'true' || p.edge);
      if (!fine) { ok = false; bad.push(`${short ? 's' : 'f'}${seed}:${id}`); }
    }
    for (const id of ['waiting', 'unforgiving']) if (g.points[g.traders[id]]?.region !== 'Middens') { ok = false; bad.push(`${seed}:${id}`); }
  }
  check(ok, `every story place (${Object.keys(A).length}: ${Object.values(A).map((a) => `${a.Name} in ${a.Region === 'Drift' ? 'the Drift' : a.Region === 'Middens' ? 'the Middens' : a.Region === 'Hush' ? 'the Hush' : 'the Shore'}`).join(', ')}) is in its act's region, reachable at its drive level, never in a pocket or on a trader; the lair at the Shore's edge; the Hollowkin holds in the Middens (10 full and 10 short galaxies)${bad.length ? `; not: ${bad.join(' ')}` : ''}`);
}

// ---------------------------------------------------------------- 2. every story memory, in play
{
  const s = V.newVoyage(rules, { seed: 2 }), g = V.galaxyOf(rules, s);
  resolveEvents(rules, s);
  const got = [];
  const at = (id) => { s.at = g.components[id]; s.queue = []; };
  const cut = (id) => { at(id); V.returnFromMap(rules, s, report(s, { found: [id] })); resolveEvents(rules, s); };
  for (const id of ['coils', 'lens', 'spindle', 'heartstone']) V.remember(rules, s, id, { quiet: true });
  s.stores.glim = 99999; s.stores.ice = 99999; s.stores.food = 99999;
  cut('anchorage'); got.push(V.remembers(s, 'emblem') && V.remembers(s, 'radar') ? 'the Anchorage: emblem and radar' : 'FAIL anchorage');
  cut('steward'); got.push(V.remembers(s, 'help') ? 'the Steward: "We are here to help"' : 'FAIL steward');
  // the first fight with the Wardens of Ninefold
  V.returnFromMap(rules, s, report(s, { standing: { changes: {}, met: ['wardens'] } })); resolveEvents(rules, s);
  got.push(V.remembers(s, 'owner') ? 'after the Wardens: the old man\'s ship' : 'FAIL owner');
  cut('research'); cut('ledger'); cut('barge');
  got.push(['fray', 'afraid', 'lists'].every((m) => V.remembers(s, m)) ? 'the research hulk, the tally-barge, the prison barge' : 'FAIL middens');
  // the Deacon at the Tallow Bell
  const bell = rules.content.dialogs.bell;
  const said = bell['Node@oath']['Choice@ok'].Do;
  s.at = g.traders.bell; V.hailEffects(rules, s, 'synod', said.split(',').map((x) => parseEffect(x)));
  got.push(V.remembers(s, 'oath') ? 'the Deacon at the Tallow Bell: the oath' : 'FAIL oath');
  cut('reliquary'); cut('horologe');
  // the Choir come to the Forge in the Hush, once the other half is remembered
  const hush = g.points.find((p) => p.region === 'Hush' && !p.relic && !p.trader && !p.pocket && g.adj[p.id].some((li) => { const l = g.lanes[li], j = l.a === p.id ? l.b : l.a; return g.points[j].region === 'Hush' && !g.points[j].pocket; }));
  const nb = g.adj[hush.id].map((li) => { const l = g.lanes[li]; return l.a === hush.id ? l.b : l.a; }).find((j) => g.points[j].region === 'Hush' && !g.points[j].pocket);
  s.at = nb; s.queue = []; V.stitch(rules, s, hush.id); resolveEvents(rules, s);
  got.push(V.remembers(s, 'otherhalf') && V.remembers(s, 'horologe') && V.remembers(s, 'waking') ? 'the reliquary, the Horologe, and the Choir: the waking' : 'FAIL hush');
  cut('tithe'); cut('hall');
  got.push(V.remembers(s, 'offering') && V.remembers(s, 'enough') ? 'the Tithe Barge and the Founding Hall' : 'FAIL offering/enough');
  // Deck 9 opens at the Shore once everything else is remembered
  const shore = g.points.find((p) => p.region === 'Shore' && !p.relic && !p.trader && !p.pocket && g.adj[p.id].some((li) => { const l = g.lanes[li], j = l.a === p.id ? l.b : l.a; return g.points[j].region === 'Shore' && !g.points[j].pocket; }));
  const nb2 = g.adj[shore.id].map((li) => { const l = g.lanes[li]; return l.a === shore.id ? l.b : l.a; }).find((j) => g.points[j].region === 'Shore' && !g.points[j].pocket);
  s.at = nb2; s.queue = []; V.stitch(rules, s, shore.id); resolveEvents(rules, s);
  got.push(V.remembers(s, 'truth') ? 'Deck 9: the whole truth' : 'FAIL truth');
  check(STORY.every((m) => V.remembers(s, m)) && !got.some((x) => x.startsWith('FAIL')), `every story memory can be had in play, act by act: ${got.join('; ')}`);
  check(STORY.every((m) => M[m].Text && M[m].Ready !== 'false'), 'every story memory has its text, and none is a question mark for later');
}

// ---------------------------------------------------------------- 3. the Meridian date
{
  const s = V.newVoyage(rules, { seed: 4 }); s.queue = [];
  const d0 = V.dateOf(rules, s);
  V.remember(rules, s, 'emblem', { quiet: true });
  const d1 = V.dateOf(rules, s);
  V.remember(rules, s, 'horologe', { quiet: true });
  const d2 = V.dateOf(rules, s);
  V.passDays(rules, s, 20);
  const d3 = V.dateOf(rules, s);
  check(!d0.known && d0.today === 'UNKNOWN' && !d0.last, 'the date is UNKNOWN at waking, and there is no record of anything');
  check(!d1.known && d1.last === 'Year 4324, Month 3, Day 2', `after the emblem: the Anchorage's last record (${d1.last}), today still UNKNOWN`);
  check(d2.known && d2.today === 'Year 4471 · Month 6 · Day 17 · 06:42:19' && d2.gap === '147 years, 3 months and 15 days', `after the Horologe: ${d2.today}, ${d2.gap} since the last record`);
  check(d3.today.startsWith('Year 4471 · Month 7 · Day 7'), `and the clock runs with the voyage: 20 days on, ${d3.today}`);
  s.over = { reason: 'letgo', day: s.day, text: '' };
  const n = V.newLife(rules, s), d4 = V.dateOf(rules, n);
  check(d4.known && d4.today === d2.today, `a new life wakes at the same moment, and the date stays known (${d4.today})`);
}

// ---------------------------------------------------------------- 4. the narration
{
  const all = N.allLines(rules), ids = all.map((l) => l.id);
  check(ids.length === new Set(ids).size && ids.every((id) => /^narr\.[a-z]+(\.[a-z]+)?\.\d+$/.test(id)), `every one of the ${ids.length} narration lines has its own id (narr.i.1, narr.vi.gap.2, narr.x.pay.1, ...)`);
  const S = rules.content.narration.scenes;
  check(S.length === 10 && S.every((sc) => !sc.Needs || Object.keys(sc).some((k) => k.startsWith('Gap@'))), `ten scenes; every scene that needs memories has its gap lines (${S.map((sc) => sc.id.toUpperCase()).join(', ')})`);
  const s = V.newVoyage(rules, { seed: 1 });
  const none = N.narrationFor(rules, s);
  V.remember(rules, s, 'emblem', { quiet: true }); V.remember(rules, s, 'enough', { quiet: true });
  const some = N.narrationFor(rules, s);
  const shownOf = (list) => list.filter((x) => x.shown).map((x) => x.roman).join(',');
  check(shownOf(none) === 'X' && none.filter((x) => !x.shown).every((x) => x.lines.every((l) => l.id.includes('.gap.'))), 'knowing nothing, every scene but the last plays blacked out, with Jacob\'s gap lines');
  check(shownOf(some) === 'I,VII,X', `each scene appears only with its memories: with the emblem and "Enough", scenes ${shownOf(some)}`);
  const ending = (flags, truth) => { const t = JSON.parse(JSON.stringify(s)); t.over = { reason: 'home', ending: truth ? 'true' : 'escape' }; t.flags = flags; return N.narrationFor(rules, t).find((x) => x.id === 'x').lines[0].id; };
  check(ending([], false) === 'narr.x.escape.1' && ending(['ending-pay'], true) === 'narr.x.pay.1' && ending(['ending-part'], true) === 'narr.x.part.1' && ending(['ending-keep'], true) === 'narr.x.keep.1', 'the last scene follows the ending: the escape, or the true ending\'s choice (pay, part, keep)');
}

// ---------------------------------------------------------------- 5. the lair and the final battle
async function lair(fleet, secs = 900) {
  const s = V.newVoyage(rules, { seed: 4 }); s.queue = [];
  s.at = V.lairAt(rules, s);
  s.fleet = [...s.fleet.filter((e) => !rules.actor(e.type).traitInfo('Armament')), ...fleet.map((t) => ({ type: t, hp: rules.actor(t).traitInfo('Health').HP }))];
  const w = await makeWorld(V.visitSettings(rules, s));
  const me = w.players[0];
  const ward = { tried: false, held: false };
  for (let f = 0; f < secs * 25 && !w.gameOver && !(w.lair.dead && f > w.lair.unwindAt + 100); f++) {
    w.tick();
    if (f === 25 * 5) {
      // try to hurt the core while its organs live: nothing
      const c = w.lair.find(), hp = c.health.hp;
      c.health.damage(null, 50000, me); ward.tried = true; ward.held = c.health.hp === hp;
    }
    if (f % 625 === 0 && f > 25 * 40) {
      const army = w.actors.filter((a) => a.owner === me && a.attack && a.mobile && !a.has('Hangar') && !a.dead);
      const t = w.actors.find((a) => (a.type === 'heart' || a.type === 'coil') && !a.dead) || w.actors.find((a) => a.type === 'mainspring' && !a.dead);
      if (t && army.length) w.resolveOrder(w.canSee(me, t) ? makeOrder('Attack', army, { a: t.id }) : makeOrder('AttackMove', army, { x: t.x, y: t.y, z: t.z }), me);
    }
  }
  return { w, s, ward, report: w.wound.report() };
}
{
  const n = (t, k) => Array(k).fill(t);
  const a = await lair([...n('halberd', 5), ...n('sabre', 2), ...n('spindle', 4), ...n('picket', 6), ...n('talon', 8)]);
  const st = a.settings || null;
  check(a.ward.tried && a.ward.held, 'while its hearts and coil live, the Mainspring\'s core takes no harm');
  check(a.w.lair.songs >= 1, `the Twain answers it: ${a.w.lair.songs} time${a.w.lair.songs > 1 ? 's' : ''} the Wound near the Forge was held still`);
  check(a.report.lair && a.report.lair.dead, `the confrontation can be won: a fleet of frigates, destroyers, lances and escorts breaks its organs and kills it in ${Math.round(a.w.frame / 25)} s`);
  const b = await lair([...n('halberd', 5), ...n('sabre', 2), ...n('spindle', 4), ...n('picket', 6), ...n('talon', 8)], 90);
  const c = await lair([...n('halberd', 5), ...n('sabre', 2), ...n('spindle', 4), ...n('picket', 6), ...n('talon', 8)], 90);
  check(b.w.syncHash() === c.w.syncHash(), `the lair battle is deterministic (hash ${b.w.syncHash().toString(16)} both runs)`);
  // back on the chart
  const s = a.s;
  const before = V.canJumpHome(rules, s);
  for (const id of ['coils', 'lens', 'spindle', 'heartstone']) V.remember(rules, s, id, { quiet: true });
  const notYet = V.canJumpHome(rules, s);
  V.returnFromMap(rules, s, report(s, { wound: a.report }));
  const open = V.canJumpHome(rules, s);
  check(!before.ok && !notYet.ok && /Mainspring is in the way/.test(notYet.why) && open.ok, `the final jump: not without the Heartstone, not past the living Mainspring ("${notYet.why}"), and open once it is dead`);
  s.queue = [];
  V.jumpHome(rules, s);
  check(s.won && s.over.ending === 'escape' && s.queue.includes('Ending'), 'without the whole truth, it is the escape ending, with gaps in the story');
  const t = V.newVoyage(rules, { seed: 4 }); t.queue = [];
  for (const id of [...STORY, 'coils', 'lens', 'spindle', 'heartstone']) V.remember(rules, t, id, { quiet: true });
  t.at = V.lairAt(rules, t); t.flags = ['mainspring'];
  V.jumpHome(rules, t);
  const ev = rules.content.events[t.queue[0]];
  const choices = Object.keys(ev['Node@choice']).filter((k) => k.startsWith('Choice@'));
  check(t.over.ending === 'true' && ev.id === 'TrueEnding' && choices.length === 3, `with every memory, the true ending, and a final choice: ${choices.map((k) => k.slice(7)).join(', ')}`);
}

// ---------------------------------------------------------------- 6. the peoples
{
  const s = V.newVoyage(rules, { seed: 3 }); s.queue = [];
  const g = V.galaxyOf(rules, s);
  s.at = g.components.reliquary;
  const st = V.visitSettings(rules, s);
  const wi = st.players.findIndex((p) => p.faction === 'wardens');
  const rel = st.relations.find(([x, y]) => (x === 0 && y === wi) || (y === 0 && x === wi));
  check(wi > 0 && rel && rel[2] === 'enemy', 'the Wardens of Ninefold guard the Reliquary, and fire on the hammer-and-cog on sight');
  check(['wardens', 'ragged', 'reavers', 'hollowkin'].every((f) => rules.content.factions[f] && rules.content.dialogs[rules.content.factions[f].Dialog]), 'four new peoples, each with their own voice: the Wardens of Ninefold, the Ragged Clans, the Brass Reavers and the Hollowkin');
}

// ---------------------------------------------------------------- 7. the bot reaches the true ending
// (Milestone 24: by the real loop, over several lives: it dies, wakes with its memories and goes
// further; tools/runtest.js holds the numbers for lives and hours)
{
  const rows = [];
  let all = true;
  for (const seed of [1, 2, 3]) {
    const c = campaign(rules, seed, { events: true, story: true, mortal: true, length: 'short' }), s = c.s;
    const ok = s.won && s.over.ending === 'true' && STORY.every((m) => V.remembers(s, m)) && c.lives.length > 1;
    if (!ok) all = false;
    rows.push(`${seed}: ${ok ? `the true ending in life ${c.lives.length}, day ${s.day}` : s.over ? s.over.reason : 'stuck'}`);
  }
  check(all, `the test captain reaches the true ending on every seed tried, dying and waking on the way (short campaigns ${rows.join('; ')})`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll story checks passed');
process.exitCode = failures ? 1 : 0;
