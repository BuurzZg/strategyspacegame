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
