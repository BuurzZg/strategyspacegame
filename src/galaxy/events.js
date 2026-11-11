import { Random } from '../engine/random.js';
import { hashMix } from '../engine/math.js';
import { parseCond, conditionsHold } from './comms.js';
import { lifeMix } from './life.js';

// Story and galaxy events (content/core/events). The voyage calls trigger() at moments that
// matter (a new voyage, arriving somewhere, a stitch, a day of rest, finding or fitting a drive
// part, the final jump). Matching events go into the voyage's queue (s.queue), and the star
// chart shows them one at a time, as small dialogs whose effects change the voyage.
// A trigger fires every story event that matches (Chance 100) and at most one chance event.
// Which ones fire is decided by the voyage's seed, the day and the place, so it is deterministic.

// (hazard: the Forge turned away by a hazard for the first time; Item is the hazard)
// (back: returning from a map)
export const WHEN = ['start', 'arrive', 'travel', 'day', 'found', 'install', 'home', 'hazard', 'back'];
// Which events fire, and which choices roll which way, differ from life to life (lifeMix).
const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

export function eventContext(rules, s, galaxy, ev) {
  const p = galaxy.points[s.at];
  return {
    rules, s, point: p, dialog: ev, fid: null, tier: 2, station: false, where: 'chart', atWar: false,
    treaties: [], flags: new Set(s.flags || []), stores: s.stores, place: p.name, region: rules.content.regions[p.region].Name,
  };
}

export function trigger(rules, s, galaxy, when, { item = '' } = {}) {
  s.queue ||= []; s.seen ||= [];
  const evs = Object.values(rules.content.events || {}).filter((e) => e.When === when);
  const rng = new Random(hashMix(hashMix(hashMix(hashMix(lifeMix(s, s.seed | 0), s.day | 0), s.at + 1), WHEN.indexOf(when) + 7), s.seen.length) || 1);
  let chanced = false;
  const fired = [];
  for (const e of evs) {
    const once = e.Once !== 'false';
    if (once && s.seen.includes(e.id)) continue;
    if (e.Item && e.Item !== item) continue;
    const chance = e.Chance === undefined ? 100 : +e.Chance;
    if (chance < 100 && chanced) continue;
    if (!conditionsHold(eventContext(rules, s, galaxy, e), list(e.If).map(parseCond))) continue;
    if (chance < 100 && rng.int(100) >= chance) continue;
    if (chance < 100) chanced = true;
    s.queue.push(e.id);
    if (!s.seen.includes(e.id)) s.seen.push(e.id);
    fired.push(e.id);
  }
  return fired;
}
