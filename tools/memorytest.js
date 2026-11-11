// Memories and the Loom, no browser needed:  npm test
// Thirty-one memories in five branches; the first life's opening (a dark chart, a signal, the
// Anchorage, the radar); clue circles that always contain their place and shrink with another
// clue; drive parts and hulls as memories; echoes, recalled on the Loom, and the echo waiting
// where an earlier life ended; everything remembered stays in every later life; old saves.
import { rules as loadCore } from './headless.js';
import * as V from '../src/galaxy/voyage.js';
import * as C from '../src/galaxy/comms.js';
import { resolveEvents } from './captain.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const rules = await loadCore();
const M = rules.content.memories;
const clone = (x) => JSON.parse(JSON.stringify(x));
const visit = (s, found) => V.returnFromMap(rules, s, { stores: {}, forge: { hp: s.forge.hp }, ships: { aboard: s.fleet, destroyed: {}, leftBehind: {}, built: {} }, ticks: 100, found, crew: { lost: {} } });
const hops = (g, from) => { const d = g.points.map(() => -1), q = [from]; d[from] = 0; while (q.length) { const i = q.shift(); for (const li of g.adj[i]) { const l = g.lanes[li], j = l.a === i ? l.b : l.a; if (d[j] < 0) { d[j] = d[i] + 1; q.push(j); } } } return d; };

// 1. The tree
{
  const by = {};
  for (const m of Object.values(M)) (by[m.Branch] ||= []).push(m.id);
  check(Object.keys(M).length === 31 && Object.keys(by).length === 5, `31 memories in five branches: ${Object.entries(by).map(([b, l]) => `${b} ${l.length}`).join(', ')}`);
  // every memory ready now can be had: found at a placed anchor, from a blueprint, or recalled along a chain
  const s = V.newVoyage(rules, { seed: 2 }), g = V.galaxyOf(rules, s);
  // (or given by a story event or a dialog: some choice does "item <it> found")
  const given = new Set();
  for (const d of [...Object.values(rules.content.events), ...Object.values(rules.content.dialogs)]) for (const n of d.nodes || []) for (const c of n.nodes || []) for (const x of c.nodes || []) if (x.key === 'Do') for (const e of String(x.value).split(',')) { const w = e.trim().split(/\s+/); if (w[0] === 'item' && w[2] === 'found') given.add(w[1]); }
  const orphans = Object.values(M).filter((m) => m.Ready !== 'false').filter((m) => !(m.Found && g.components[m.Found] !== undefined) && !(m.Blueprint && rules.content.items[m.Blueprint]) && m.Cost === undefined && !(m.By === 'event' && given.has(m.id)));
  check(!orphans.length, `every memory in this build can be had${orphans.length ? `; not: ${orphans.map((m) => m.id).join(', ')}` : ''}`);
  check(!Object.keys(s.campaign.memories).length && (s.campaign.echoes | 0) === 0, 'a new campaign remembers nothing, and has no echoes');
}

// 2. The first life's opening: a dark chart, a signal, the Anchorage
{
  const s = V.newVoyage(rules, { seed: 6 }), g = V.galaxyOf(rules, s);
  const near = new Set([s.at, ...g.adj[s.at].map((li) => (g.lanes[li].a === s.at ? g.lanes[li].b : g.lanes[li].a))]);
  check(s.known.length === near.size && s.known.every((id) => near.has(id)), `the chart is dark: only the ${near.size - 1} places one lane away are known`);
  check(!V.scanPlan(rules, s).ok && s.queue[0] === 'Prologue', 'no deep scan without the radar; the first life opens with waking');
  resolveEvents(rules, s);
  const c = s.campaign.chart.clues.find((x) => x.id === 'anchorage'), at = g.components.anchorage;
  check(c && V.inClue(g, c, at) && (c.x !== g.points[at].x || c.y !== g.points[at].y), `the signal draws a circle (${c && c.r} spans) round the Anchorage, not centred on it`);
  const h = hops(g, g.start)[at];
  check(g.points[at].type === 'Anchorage' && g.points[at].region === 'Drift' && h >= 3 && h <= 5, `the Anchorage: in the Drift, ${h} stitches from waking`);
  // the hulk holds the station's core until it is cut open
  s.at = at;
  const set = V.visitSettings(rules, s);
  check(set.layout.hulk && set.layout.hulk.relic === 'anchorage' && /core/.test(set.layout.hulk.relicName), `its hulk holds ${set.layout.hulk && set.layout.hulk.relicName}`);
  const known0 = s.known.length;
  s.queue = [];
  visit(s, ['anchorage']);
  check(V.remembers(s, 'emblem') && V.remembers(s, 'radar') && s.campaign.echoes === 1 && s.queue.includes('EmblemFound'), 'cutting into its core brings back the emblem and the radar (+1 echo), and the story of it');
  check(s.known.length > known0 + 5 && V.scanPlan(rules, s).ok, `the chart lights up: ${known0} → ${s.known.length} places known, and deep scans work`);
  const cc = s.campaign.chart.clues.find((x) => x.id === 'coils');
  check(cc && V.inClue(g, cc, g.components.coils) && s.log.some((l) => /fix on the Threadwound Coils: somewhere/.test(l.text)), 'with the radar working, the engineers get a fix on the Coils: a circle, not the place');
  check(!V.visitSettings(rules, s).layout.hulk?.relic, 'the Anchorage is done: its hulk holds nothing more');
}

// 3. Clue circles on many seeds
{
  let ok = true, shrunk = true, n = 0;
  for (let seed = 1; seed <= 30; seed++) {
    for (const length of ['full', 'short']) {
      const s = V.newVoyage(rules, { seed, length }), g = V.galaxyOf(rules, s);
      for (const a of ['anchorage', 'coils', 'lens', 'spindle', 'heartstone']) {
        const c = V.addClue(rules, s, a);
        if (!c || !V.inClue(g, c, g.components[a])) ok = false;
        const r0 = c.r, c2 = V.addClue(rules, s, a);
        if (!(c2.r < r0) || !V.inClue(g, c2, g.components[a])) shrunk = false;
        n++;
      }
    }
  }
  check(ok, `${n} clue circles on 30 seeds of both sizes: every one contains its place`);
  check(shrunk, 'a second clue to the same place shrinks the circle, and it still contains the place');
  const s = V.newVoyage(rules, { seed: 3 }), g = V.galaxyOf(rules, s);
  V.remember(rules, s, 'radar', { quiet: true });
  resolveEvents(rules, s);
  const c = s.campaign.chart.clues.find((x) => x.id === 'anchorage');
  const hop = g.adj[g.components.anchorage].map((li) => (g.lanes[li].a === g.components.anchorage ? g.lanes[li].b : g.lanes[li].a))[0];
  s.at = hop; V.drift(rules, s, g.components.anchorage);
  check(c.exact && s.log.some((l) => /pinpoints it/.test(l.text)), 'coming close, the watch officer pinpoints it: the circle becomes the place');
}

// 4. Everything remembered stays in every life
{
  const s = V.newVoyage(rules, { seed: 8 });
  s.queue = [];
  visit(s, ['anchorage']);
  V.remember(rules, s, 'coils');
  const echoes = s.campaign.echoes;
  V.letGo(rules, s);
  const t = V.newLife(rules, s);
  const g = V.galaxyOf(rules, t), here = g.points[t.at], r = V.sensorRange(rules, t);
  const inRange = g.points.filter((p) => (p.x - here.x) ** 2 + (p.y - here.y) ** 2 <= r * r).length;
  check(V.remembers(t, 'radar') && V.remembers(t, 'emblem') && V.remembers(t, 'coils') && t.campaign.echoes === echoes, 'life 2 remembers the radar, the emblem and the Coils, and keeps its echoes');
  check(t.known.length >= inRange && V.scanPlan(rules, t).ok && V.drive(rules, t).range === 150, `waking in life 2, the chart is lit (${t.known.length} places known), deep scans work, and the drive reaches 150 spans`);
  check(!V.visitSettings(rules, Object.assign(clone(t), { at: g.components.anchorage })).layout.hulk?.relic, 'and nobody needs to go back to the Anchorage');
}

// 5. Echoes and the Loom
{
  const s = V.newVoyage(rules, { seed: 4 });
  s.queue = [];
  const p0 = V.recallPlan(rules, s, 'hull-wisp');
  check(!p0.ok && /radar/i.test(p0.why), `the Wisp can't be recalled before the radar ("${p0.why}")`);
  V.remember(rules, s, 'radar', { quiet: true });
  const p1 = V.recallPlan(rules, s, 'hull-wisp');
  check(!p1.ok && /echo/.test(p1.why), `nor without an echo ("${p1.why}")`);
  s.campaign.echoes = 2;
  const r = V.recall(rules, s, 'hull-wisp');
  check(r.ok && V.remembers(s, 'hull-wisp') && s.campaign.echoes === 1 && s.blueprints.includes('wisp'), 'with the radar and an echo, it is remembered: one echo spent, and the foundry can build Wisps');
  check(!V.recallPlan(rules, s, 'shields').ok && !V.recallPlan(rules, s, 'coils').ok, 'what comes later, and what must be found, cannot be recalled');
  // the echo where a life ended
  const died = s.at;
  V.letGo(rules, s);
  const t = V.newLife(rules, s), e0 = t.campaign.echoes;
  check(t.campaign.echoAt.some((e) => e.place === died && e.life === 1), 'where life 1 ended, an echo waits');
  const g = V.galaxyOf(rules, t), nb = g.adj[t.at].map((li) => (g.lanes[li].a === t.at ? g.lanes[li].b : g.lanes[li].a)).find((id) => V.driftPlan(rules, t, id).ok);
  V.drift(rules, t, nb);
  t.stores.glim = 5000;
  V.drift(rules, t, died);
  check(t.at === died && t.campaign.echoes > e0 && !t.campaign.echoAt.length && t.log.some((l) => /You died here/.test(l.text)), `going back there in life 2 recovers it (${e0} → ${t.campaign.echoes} echoes)`);
}

// 6. Hulls: a blueprint brings the memory back for good
{
  const s = V.newVoyage(rules, { seed: 5 });
  s.queue = [];
  V.learn(rules, s, 'bp-talon');
  V.letGo(rules, s);
  const t = V.newLife(rules, s);
  check(V.remembers(t, 'hull-talon') && t.blueprints.includes('talon') && !t.blueprints.includes('sabre'), 'a Talon blueprint found in life 1: life 2 can build Talons, but not Sabres');
}

// 7. Events and dialogs speak memories
{
  check(C.parseCond('remembers radar').op === 'remembers' && C.parseEffect('clue anchorage').op === 'clue' && C.parseEffect('echoes 2').op === 'echoes', 'conditions and effects: remembers X, clue <anchor>, echoes n');
  const bad = C.lintDialog(rules, { id: 'x', Start: 'a', 'Node@a': { Say: 'hi', 'Choice@b': { Text: 'go', Do: 'clue nowhere, close' } } });
  check(bad.some((e) => /unknown anchor "nowhere"/.test(e)), 'a clue to an unknown place is a content error');
  const s = V.newVoyage(rules, { seed: 7 });
  s.queue = ['OldVoice'];
  const ev = rules.content.events.OldVoice;
  const r = V.eventChoice(rules, s, C.nodeView(V.eventContext(rules, s, V.galaxyOf(rules, s), ev), 'voice').choices[0].effects);
  check(s.campaign.echoes === 1 && r.notes.some((n) => /echo/.test(n)), 'a voice on an old band, your own: +1 echo');
}

// 8. Old saves
{
  const s = V.newVoyage(rules, { seed: 9 });
  const old = clone(s);
  delete old.campaign.memories; delete old.campaign.echoes; delete old.campaign.echoAt; delete old.campaign.chart.clues;
  old.version = 5; old.items = { coils: 'installed', lens: 'found', racks: 'installed' }; old.blueprints = [...rules.content.blueprintStart, 'wisp', 'talon'];
  const t = V.loadVoyage(rules, JSON.stringify(old));
  check(t.version === V.SAVE_VERSION && V.remembers(t, 'radar') && V.remembers(t, 'emblem') && V.remembers(t, 'coils') && V.remembers(t, 'lens') && V.remembers(t, 'hull-wisp') && V.remembers(t, 'hull-talon'), 'a save from before memories keeps its sensors, its drive parts (fitted or found) and its hulls, as memories');
  check(t.items.racks === 'installed' && !t.items.coils && V.drive(rules, t).veil && t.blueprints.includes('talon'), 'its engineering projects stay; the drive reaches through the Veil; it still builds Talons');
  const u = V.loadVoyage(rules, V.saveVoyage(t));
  check(V.voyageHash(u) === V.voyageHash(t), 'and it saves and loads again identically');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll memory checks passed');
process.exitCode = failures ? 1 : 0;
