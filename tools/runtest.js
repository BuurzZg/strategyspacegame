// Whole runs, no browser needed:  npm test
// The AI captain (tools/captain.js) plays many seeded voyages, full and short, answering every
// event, and gets home; the estimated play time is inside the target for each length. Saving in
// the middle of a map and continuing gives exactly the same game as playing straight on.
import { rules as loadCore, makeWorld } from './headless.js';
import { makeOrder } from '../src/engine/order.js';
import { OrderManager, LocalConnection } from '../src/engine/ordermanager.js';
import { CELL } from '../src/engine/math.js';
import { replayInto } from '../src/engine/replay.js';
import * as V from '../src/galaxy/voyage.js';
import { captain, playMinutes } from './captain.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const rules = await loadCore();
const SEEDS = (process.env.SEEDS || '1,2,3,4,5,6,7,8').split(',').map(Number);

// 1. Many runs, both lengths
for (const [length, lo, hi] of [['full', 240, 360], ['short', 60, 120]]) {
  const rows = [];
  let home = 0, inside = 0;
  for (const seed of SEEDS) {
    const r = captain(rules, seed, { events: true, length });
    const min = playMinutes(r);
    if (r.s.won) home++;
    if (r.s.won && min >= lo && min <= hi) inside++;
    rows.push(`${seed}:${r.s.won ? '' : `(${r.s.over ? r.s.over.reason : 'stuck'}) `}${Math.round(min)}m/${r.s.day}d`);
  }
  check(home === SEEDS.length, `${length} voyages: the AI captain gets home on all ${SEEDS.length} seeds (${rows.join(' ')})`);
  check(inside >= Math.ceil(SEEDS.length * 0.75), `${length} voyages: ${inside} of ${SEEDS.length} take ${lo / 60 >= 1 ? `${lo / 60} to ${hi / 60} hours` : `${lo} to ${hi} minutes`} of estimated play`);
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
