import { hashMix } from '../engine/math.js';

// Lives. A campaign is one galaxy played over many lives (PLAN.md §2): the layout and the story
// locations are fixed by the seed, but what is on each map, which events fire and how the dice
// fall differ from life to life. lifeMix() folds the life number into a seed. The first life
// keeps the seed as it is, so a campaign's first life plays exactly as a voyage did before.
export const lifeOf = (s) => ((s && s.campaign && s.campaign.life) | 0) || 1;
export function lifeMix(s, seed) {
  const L = lifeOf(s);
  return L > 1 ? hashMix(seed | 0, 0x11fe0000 + L) >>> 0 : seed;
}

// ---------------------------------------------------------------- memories (PLAN.md §4)
// What the campaign remembers, kept in s.campaign.memories { id: { life, day } }. These helpers
// only read and mark; voyage.js remember() also applies what a memory gives.
export const remembers = (s, id) => !!(s && s.campaign && s.campaign.memories && s.campaign.memories[id]);
export function markMemory(s, id) {
  if (!s.campaign) return false;
  s.campaign.memories ||= {};
  if (s.campaign.memories[id]) return false;
  s.campaign.memories[id] = { life: lifeOf(s), day: s.day | 0 };
  return true;
}
// The memory a blueprint item brings back, if any (a hull's memory).
export const memoryOfBlueprint = (rules, bp) => Object.values(rules.content.memories || {}).find((m) => m.Blueprint === bp) || null;
// What a memory gives: [['drive', 'coils'], ['radar'], ...]
export const givesOf = (m) => String((m && m.Gives) || '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => x.split(/\s+/));
// The hulls the foundry can build: the start list and every remembered hull.
export function buildable(rules, s) {
  const out = [...(rules.content.blueprintStart || [])];
  for (const m of Object.values(rules.content.memories || {})) for (const [op, arg] of givesOf(m)) if (op === 'hull' && remembers(s, m.id) && !out.includes(arg)) out.push(arg);
  return out;
}
