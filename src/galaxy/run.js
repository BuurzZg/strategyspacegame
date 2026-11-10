import { generatePoi, poiSeed } from '../engine/poi.js';

// The run: everything that carries from one place to the next. It is plain data (it saves as
// JSON). In Milestone 7 the galaxy map, the day clock, the crew and the Forge's systems join it.
//   stores  every resource kind      fleet  ships aboard the Forge (type, hull, cargo)
//   forge   the Forge's hull         visits how many places so far, and a short log of each
export const START_FLEET = ['halberd', 'dart', 'dart', 'gleaner', 'gleaner', 'shearer', 'skimmer'];

export function newRun(rules, { seed = 1 } = {}) {
  const stores = Object.fromEntries(Object.keys(rules.content.resources).map((k) => [k, 0]));
  stores.ore = 1500;
  return {
    version: 1, seed: seed | 0, visits: 0,
    stores,
    fleet: START_FLEET.map((type) => ({ type, hp: rules.actor(type).traitInfo('Health').HP })),
    forge: { hp: rules.actor('forge').traitInfo('Health').HP },
    log: [],
  };
}

// World settings for visiting a place of `type`, with the run's stores and fleet aboard.
// `place` is a number identifying the place within the run (the galaxy will supply it).
export function visitSettings(rules, run, { type, place = run.visits + 1, seed }) {
  const s = generatePoi(rules, { seed: seed ?? poiSeed(run.seed, place), type });
  return {
    ...s,
    latency: 1,
    players: [
      { name: 'You', faction: 'meridian', client: 0, ships: ['forge'], stores: { ...run.stores }, hangar: run.fleet.map((e) => ({ ...e })), forgeHp: run.forge.hp },
      { name: 'Ashen Gaunt', faction: 'gaunt', team: 1, ships: [] },
      { name: 'Drift fauna', faction: 'fauna', team: 2, ships: [] },
    ],
  };
}

// The run after a visit: stores and hull as they ended, and only the ships that were aboard.
export function applyReport(run, report) {
  const stores = {};
  for (const [k, s] of Object.entries(report.stores)) stores[k] = s.end;
  const lost = Object.values(report.ships.destroyed).reduce((a, b) => a + b, 0) + Object.values(report.ships.leftBehind).reduce((a, b) => a + b, 0);
  return {
    ...run,
    visits: run.visits + 1,
    stores,
    fleet: report.ships.aboard.map((e) => ({ ...e })),
    forge: { hp: report.forge ? report.forge.hp : run.forge.hp },
    log: [...run.log, { place: report.place && report.place.name, seconds: report.seconds, lost }],
  };
}
