// Whole runs, no browser needed:  npm test
// The AI captain (tools/captain.js) plays whole campaigns, full and short, answering every event:
// it dies, wakes and goes further, to the true ending, in the targeted lives and hours; a first
// life can be escaped, rarely. Saving in the middle of a map and continuing gives exactly the
// same game as playing straight on.
import { rules as loadCore, makeWorld } from './headless.js';
import { makeOrder } from '../src/engine/order.js';
import { OrderManager, LocalConnection } from '../src/engine/ordermanager.js';
import { CELL } from '../src/engine/math.js';
import { replayInto } from '../src/engine/replay.js';
import * as V from '../src/galaxy/voyage.js';
import { captain, campaign, playMinutes } from './captain.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const rules = await loadCore();
const SEEDS = (process.env.SEEDS || '1,2,3,4,5,6,7,8').split(',').map(Number);

// 1. Whole campaigns, the real loop (Milestone 24; the one-life run length is gone). The captain
// plays mortal campaigns in story mode, events answered: it dies when the Wound gets the Forge,
// wakes with its memories, spends its echoes on the Loom, and goes further each life, to the
// true ending. Targets (decided with the designer): a full galaxy in 5 to 8 lives and 9 to 13
// hours, a small one in 3 to 5 lives and 5 to 9 hours, a life typically 60 to 130 minutes.
// (Before Milestone 24 the targets were 5-8 lives, 40-90 minutes and 6-10 hours: out of reach of
// the story's own length; see PLAN.md section 12.)
const median = (a) => { const b = [...a].sort((x, y) => x - y); return (b[(b.length - 1) >> 1] + b[b.length >> 1]) / 2; };
for (const [length, livesLo, livesHi, hLo, hHi] of [['full', 5, 8, 9, 13], ['short', 3, 5, 5, 9]]) {
  const rows = [], lives = [], mins = [], hours = [];
  let done = 0;
  for (const seed of SEEDS) {
    const c = campaign(rules, seed, { events: true, story: true, mortal: true, length });
    const h = c.lives.reduce((t, r) => t + playMinutes(r), 0) / 60;
    if (c.s.won && c.s.over.ending === 'true') done++;
    lives.push(c.lives.length); hours.push(h);
    for (const r of c.lives) mins.push(playMinutes(r));
    rows.push(`${seed}:${c.lives.length}/${h.toFixed(1)}h${c.s.won ? '' : `(${c.s.over ? c.s.over.reason : 'stuck'})`}`);
  }
  check(done === SEEDS.length, `${length} campaigns: the captain reaches the true ending on all ${SEEDS.length} seeds, dying and waking on the way (lives/hours: ${rows.join(' ')})`);
  check(median(lives) >= livesLo && median(lives) <= livesHi, `${length} campaigns: typically ${livesLo} to ${livesHi} lives (median ${median(lives)})`);
  check(median(mins) >= 60 && median(mins) <= 130, `${length} campaigns: a life typically lasts 60 to 130 minutes of play (median ${Math.round(median(mins))}, ${Math.round(Math.min(...mins))} to ${Math.round(Math.max(...mins))})`);
  check(median(hours) >= hLo && median(hours) <= hHi, `${length} campaigns: typically ${hLo} to ${hHi} hours to the true ending (median ${median(hours).toFixed(1)})`);
}
// A strong player can still escape in the first life: rare and hard, but possible. The strong
// captain (arms early, fights the Hands it can beat, mends sooner) escapes on some seeds, a decent
// one on hardly any, on both sizes of galaxy (every Hand alive comes home to defend the lair).
for (const length of ['full', 'short']) {
  const runs = (strong) => SEEDS.map((seed) => captain(rules, seed, { events: true, mortal: true, strong, length }));
  const strong = runs(true), decent = runs(false), esc = (list) => list.filter((r) => r.s.won).length;
  const row = (list) => list.map((r) => (r.s.won ? `escaped d${r.s.day}` : `d${r.s.day}`)).join(' ');
  check(esc(strong) >= 1 && esc(decent) <= 2, `a first-life escape from a ${length === 'full' ? 'full' : 'small'} galaxy is possible but rare: a strong captain ${esc(strong)} of ${SEEDS.length} (${row(strong)}), a decent one ${esc(decent)} of ${SEEDS.length}`);
}

// 2. Save in the middle of a map, continue: the same game
async function liveMap() {
  const s = V.newVoyage(rules, { seed: 4 });
  s.queue = [];
  const g = V.galaxyOf(rules, s);
  s.at = g.points.find((p) => p.type === 'ScrapShoal').id;
  const settings = V.visitSettings(rules, s);
  const w = await makeWorld(settings);
  const om = new OrderManager(w, new LocalConnection(), { localClient: 0, clients: [0], latency: 1 });
  return { s, w, om, me: w.players[0] };
}
const script = (m, f) => {
  const forge = m.w.actors.find((a) => a.owner === m.me && a.has('Hangar'));
  const darts = m.w.actors.filter((a) => a.owner === m.me && a.type === 'dart');
  if (f === 100) m.om.issue(makeOrder('StartProduction', [forge], null, 'dart'));
  if (f === 300) m.om.issue(makeOrder('Move', darts, { x: forge.x + 30 * CELL, y: forge.y + 10 * CELL, z: 0 }));
  if (f === 900) m.om.issue(makeOrder('SetFormation', darts, null, 'wedge'));
  if (f === 1300) m.om.issue(makeOrder('AttackMove', darts, { x: forge.x + 70 * CELL, y: forge.y, z: 0 }));
  if (f === 2000) m.om.issue(makeOrder('Recall', m.w.actors.filter((a) => a.owner === m.me && a.mobile && a !== forge)));
};
{
  const SAVE_AT = 1100, END = 2600;
  // straight through
  const a = await liveMap();
  while (a.w.frame < END) { script(a, a.w.frame); a.om.tryTick(); }
  // played to SAVE_AT, saved, rebuilt from the voyage, replayed, and played on
  const b = await liveMap();
  while (b.w.frame < SAVE_AT) { script(b, b.w.frame); b.om.tryTick(); }
  const saved = JSON.parse(JSON.stringify({ voyage: b.s, map: { frames: b.om.replay.frames, frame: b.w.frame } }));
  const v = V.loadVoyage(rules, JSON.stringify(saved.voyage));
  const w2 = await makeWorld(V.visitSettings(rules, v));
  replayInto(w2, saved.map.frames, saved.map.frame);
  const sameAtSave = w2.syncHash() === b.w.syncHash();
  const om2 = new OrderManager(w2, new LocalConnection(), { localClient: 0, clients: [0], latency: 1 });
  om2.replay.frames = saved.map.frames.slice(); om2.sentUpTo = saved.map.frame; om2.store(saved.map.frame, 0, []);
  const c = { s: v, w: w2, om: om2, me: w2.players[0] };
  while (c.w.frame < END) { script(c, c.w.frame); c.om.tryTick(); }
  check(sameAtSave && c.w.syncHash() === a.w.syncHash(), `saved on frame ${SAVE_AT} of a map, loaded and played on to frame ${END}: the same game as playing straight through (hash ${a.w.syncHash().toString(16)})`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll run checks passed');
process.exitCode = failures ? 1 : 0;
