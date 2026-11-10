import { weights } from '../engine/content.js';

// Reputation: your standing with each faction, from -100 to 100, in five tiers (Hostile, Wary,
// Neutral, Friendly, Allied). A faction you have not met yet starts from your standing with its
// race: the average over that race's factions you have met, or the faction's own starting
// standing (or the race's) if you have met none. Meeting a faction fixes its standing; from
// then on only what you do changes it.
//
// The voyage keeps  standing { faction: n }  and  met { faction: true }.

export const TIERS = ['Hostile', 'Wary', 'Neutral', 'Friendly', 'Allied'];

export function thresholds(rules) {
  const t = Object.fromEntries(weights(rules.content.reputation?.Tiers || 'Hostile -100, Wary -50, Neutral -10, Friendly 25, Allied 60'));
  return TIERS.map((k) => t[k]);
}
// 0 Hostile .. 4 Allied
export function tierIndex(rules, n) {
  const th = thresholds(rules);
  let i = 0;
  for (let k = 0; k < th.length; k++) if (n >= th[k]) i = k;
  return i;
}
export const tierName = (rules, n) => TIERS[tierIndex(rules, n)];
export const tierOfName = (name) => Math.max(0, TIERS.indexOf(name));

export function raceStanding(rules, s, race) {
  const met = Object.values(rules.content.factions).filter((f) => f.Race === race && s.met && s.met[f.id]);
  if (met.length) return Math.trunc(met.reduce((t, f) => t + (s.standing[f.id] | 0), 0) / met.length);
  return +(rules.content.races[race]?.Standing ?? 0) | 0;
}

export function standingOf(rules, s, fid) {
  if (s.met && s.met[fid]) return s.standing[fid] | 0;
  const f = rules.content.factions[fid];
  if (!f) return 0;
  const sameRaceMet = Object.values(rules.content.factions).some((g) => g.Race === f.Race && s.met && s.met[g.id]);
  if (sameRaceMet) return raceStanding(rules, s, f.Race);
  return f.Standing !== undefined ? +f.Standing | 0 : raceStanding(rules, s, f.Race);
}

export function meet(rules, s, fid) {
  if (!rules.content.factions[fid] || (s.met && s.met[fid])) return false;
  s.standing[fid] = standingOf(rules, s, fid);
  s.met[fid] = true;
  return true;
}

// Change a faction's standing (meeting it if need be). Returns the tier change, if any.
export function change(rules, s, fid, delta) {
  if (!rules.content.factions[fid]) return null;
  meet(rules, s, fid);
  const before = s.standing[fid] | 0, after = Math.max(-100, Math.min(100, before + (delta | 0)));
  s.standing[fid] = after;
  const t0 = tierIndex(rules, before), t1 = tierIndex(rules, after);
  return t0 === t1 ? null : { from: TIERS[t0], to: TIERS[t1] };
}

// Do they let you mine and salvage in their territory?
export function hasLeave(rules, s, fid) {
  const f = rules.content.factions[fid];
  return tierIndex(rules, standingOf(rules, s, fid)) >= tierOfName(f?.Leave || 'Friendly');
}

// Factions that fight each other on sight (either side naming the other).
export function factionsAtWar(rules, a, b) {
  const F = rules.content.factions, list = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
  return !!(F[a] && list(F[a].Enemies).includes(b)) || !!(F[b] && list(F[b].Enemies).includes(a));
}
