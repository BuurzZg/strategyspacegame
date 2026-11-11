// Campaigns and lives, no browser needed:  npm test
// A campaign is one galaxy played over many lives. A death (or letting go) starts the next life:
// the same galaxy and the same crew, back at the moment of waking. The chart, the memorial, the
// hints and the Choir's standing carry over; everything physical resets. The layout stays fixed
// while what is on each map differs from life to life, and the first life plays exactly as a
// voyage did before. Saves from before campaigns load as a campaign's first life.
import { rules as loadCore, makeWorld } from './headless.js';
import * as V from '../src/galaxy/voyage.js';
import * as K from '../src/galaxy/crew.js';
import { lifeMix } from '../src/galaxy/life.js';
import { meet, change, standingOf } from '../src/galaxy/standing.js';
import { trigger } from '../src/galaxy/events.js';
import { campaign } from './captain.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const rules = await loadCore();
const clone = (x) => JSON.parse(JSON.stringify(x));

// 1. A new campaign
{
  const s = V.newVoyage(rules, { seed: 7 });
  check(s.version === V.SAVE_VERSION && V.SAVE_VERSION >= 5 && s.saves === 'campaign' && s.campaign.life === 1 && s.campaign.lives.length === 0, 'a new campaign starts on life 1, with one campaign save');
  check(s.seen.includes('Prologue') && !s.seen.includes('Waking'), 'the first life opens with the prologue');
}

// 2. A life ends, and the next begins
{
  const s = V.newVoyage(rules, { seed: 7, guided: true });
  const g = V.galaxyOf(rules, s);
  s.queue = []; s.hints = ['chart', 'map'];
  // a life with some history: travel, a visit, losses, standing, damage, stores spent
  const hop = g.adj[s.at].map((li) => { const l = g.lanes[li]; return l.a === s.at ? l.b : l.a; }).find((id) => V.plan(rules, s, id).ok);
  V.stitch(rules, s, hop);
  s.visited[s.at] = 1; s.visits = 1;
  const lost = K.officerOf(s.crew, 'surgeon');
  K.kill(s.crew, lost.id, { day: s.day, how: 'lost: a test' });
  meet(rules, s, 'rivet'); change(rules, s, 'rivet', -40);
  meet(rules, s, 'choir'); change(rules, s, 'choir', 35);
  s.systems.drive = 40; s.forge.hp = 1000; s.stores.glim = 3; s.fleet.pop(); s.items.coils = 'found';
  const knownBefore = s.known.length, day = s.day, officers = s.crew.people.filter((p) => p.post && p.id !== lost.id).map((p) => `${p.name}/${p.trait}`).sort().join();
  check(V.letGo(rules, s).ok && s.over.reason === 'letgo' && V.lifeOver(s), 'letting go ends the life, and counts as a death');
  const t = V.newLife(rules, s), fresh = V.newVoyage(rules, { seed: 7 });
  check(t.campaign.life === 2 && t.seed === s.seed && V.galaxyOf(rules, t) === g && t.day === 1 && t.at === g.start, 'the next life: life 2, the same galaxy, day 1, back at the wake-up point');
  check(JSON.stringify(t.stores) === JSON.stringify(fresh.stores) && JSON.stringify(t.systems) === JSON.stringify(fresh.systems) && t.forge.hp === fresh.forge.hp && t.fleet.length === fresh.fleet.length && !t.items.coils && t.over === null, 'stores, systems, hull, fleet and drive parts are back as they were at waking');
  const officers2 = t.crew.people.filter((p) => p.post).map((p) => `${p.name}/${p.trait}`);
  check(officers2.length === 8 && officers.split(',').every((o) => officers2.includes(o)) && t.crew.people.some((p) => p.name === lost.name) && K.count(t.crew) === K.count(fresh.crew), `the same crew wake, alive: ${lost.name}, the surgeon who died, is back`);
  check(t.known.length >= knownBefore && s.known.every((id) => t.known.includes(id)) && t.known.length > fresh.known.length, `the chart remembers: ${t.known.length} places known at waking (a fresh campaign knows ${fresh.known.length})`);
  check(V.visitedBefore(t, hop) && !t.visited[hop], 'the place visited in life 1 is marked as visited in an earlier life');
  check(t.campaign.memorial.some((f) => f.name === lost.name && f.life === 1), 'the memorial keeps the surgeon, lost in life 1');
  check(standingOf(rules, t, 'choir') === standingOf(rules, s, 'choir') && t.met.choir && standingOf(rules, t, 'rivet') === standingOf(rules, fresh, 'rivet') && !t.met.rivet, `the Choir remember you (standing ${standingOf(rules, t, 'choir')}); the Rivet Moot have never met you (${standingOf(rules, t, 'rivet')})`);
  check(t.hints.includes('chart') && t.guided, 'hint cards already seen stay seen');
  check(t.campaign.lives.length === 1 && t.campaign.lives[0].reason === 'letgo' && t.campaign.lives[0].days === day, 'the campaign records how life 1 ended');
  check(t.seen.includes('Waking') && !t.seen.includes('Prologue') && t.log.some((l) => /^Life 2\./.test(l.text)), 'life 2 opens with waking, not the prologue');
  const u = V.newLife(rules, Object.assign(clone(t), { over: { reason: 'air', day: 9, text: 'x' } }));
  check(u.campaign.life === 3 && u.campaign.lives.length === 2 && u.campaign.memorial.length === 1, 'and so on: life 3 remembers both lives before it');
}

// 3. The layout is fixed; what is on the maps differs from life to life
{
  const a = V.newVoyage(rules, { seed: 9 });
  const b = V.newLife(rules, Object.assign(clone(a), { over: { reason: 'crew', day: 2, text: '' } }));
  const g = V.galaxyOf(rules, a);
  const place = g.points.find((p) => p.type === 'ScrapShoal' || p.type === 'OreReef');
  a.at = place.id; b.at = place.id;
  const sa = V.visitSettings(rules, a), sb = V.visitSettings(rules, b), sb2 = V.visitSettings(rules, b);
  const layout = (x) => JSON.stringify(x.layout || x.fields);
  check(sa.poi.name === sb.poi.name && sa.poi.type === sb.poi.type && sa.space.w === sb.space.w, `the same place in both lives: ${sa.poi.name}, a ${sa.poi.type}`);
  check(sa.seed !== sb.seed && layout(sa) !== layout(sb) && layout(sb) === layout(sb2), 'what is on it differs in life 2, and is the same each time life 2 looks');
  check(lifeMix(a, 1234) === 1234 && lifeMix(b, 1234) !== 1234, 'the first life keeps the seeds it always had; later lives mix in the life number');
  const w1 = await makeWorld(sb), w2 = await makeWorld(V.visitSettings(rules, b));
  for (let i = 0; i < 25 * 20; i++) { w1.tick(); w2.tick(); }
  check(w1.syncHash() === w2.syncHash(), `a map in life 2 is deterministic (hash ${(w1.syncHash() >>> 0).toString(16)} both runs)`);
  // events: the same arrivals, day by day, fire different chance events in life 2
  const fired = (s) => { const out = []; for (let d = 1; d < 60; d++) for (const p of g.points.slice(0, 40)) { const x = { ...s, day: d, at: p.id, seen: [], queue: [] }; out.push(...trigger(rules, x, g, 'arrive')); } return out.join(); };
  check(fired(a) !== fired(b), 'random events fall differently in life 2');
}

// 4. Saves
{
  const s = V.newVoyage(rules, { seed: 5 });
  const t = V.newLife(rules, Object.assign(clone(s), { over: { reason: 'forge', day: 30, text: '' } }));
  const u = V.loadVoyage(rules, V.saveVoyage(t));
  check(V.voyageHash(u) === V.voyageHash(t), 'a later life saves and loads as the identical voyage');
  const old = clone(s);
  delete old.campaign; old.version = 4; old.saves = 'free';
  const m = V.loadVoyage(rules, JSON.stringify(old));
  check(m.version === V.SAVE_VERSION && m.campaign.life === 1 && m.saves === 'campaign' && m.campaign.chart.known.length === s.known.length, 'a voyage saved before campaigns (permanent death or free saves) loads as the first life of a campaign');
  const v3 = clone(old); v3.version = 3; v3.crew = { roles: { ...s.crew.roles }, assigned: { ...s.crew.assigned } }; for (const e of v3.fleet) delete e.lead;
  const m3 = V.loadVoyage(rules, JSON.stringify(v3));
  check(m3.version === V.SAVE_VERSION && m3.crew.people.length === 11 && m3.campaign.life === 1, 'so does a save from before named crew');
  const after = V.newLife(rules, Object.assign(m, { over: { reason: 'air', day: 4, text: '' } }));
  check(after.campaign.life === 2, 'and its next life is life 2');
}

// 5. Whole campaigns: the captain lets its first life go, wakes, and gets home
{
  const rows = [];
  let ok = true;
  for (const seed of [1, 2, 3]) {
    const r = campaign(rules, seed, { events: true, giveUps: [25] });
    const first = r.lives[0].s, second = r.lives[1] && r.lives[1].s;
    const wakeKnown = second ? second.campaign.chart.known.length : 0;
    if (!(r.s.won && r.lives.length === 2 && second.campaign.life === 2 && wakeKnown >= first.known.length)) ok = false;
    rows.push(`seed ${seed}: life 1 let go on day ${first.over && first.over.day}, life 2 ${r.s.won ? `home on day ${r.s.day}` : r.s.over ? r.s.over.reason : 'stuck'}, waking with ${wakeKnown} places known`);
  }
  check(ok, `campaigns of two lives: ${rows.join('; ')}`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll campaign checks passed');
process.exitCode = failures ? 1 : 0;
