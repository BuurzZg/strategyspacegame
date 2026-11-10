import { Random } from './random.js';
import { CELL, hashMix, sin as SIN, cos as COS } from './math.js';
import { nodesToObject } from './content.js';

// Point-of-interest maps. generatePoi() turns a template from poi-types.yaml and a seed into
// the settings a World is built from: the map's size, where the Forge arrives, asteroid
// fields, derelicts, gas clouds, crystal formations, nebulae and hostile encounters. It is
// pure and deterministic: the same place (galaxy seed, place id, visit) always comes out
// the same, in the browser and in Node.

export const poiSeed = (galaxySeed, placeId, visit = 0) => hashMix(hashMix(hashMix(2166136261, galaxySeed | 0), placeId | 0), visit | 0) >>> 0;

const range = (v, dflt = [0, 0]) => {
  if (v === undefined || v === '') return dflt;
  const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(String(v));
  if (!m) throw new Error(`Bad range "${v}"`);
  return [+m[1], m[2] !== undefined ? +m[2] : +m[1]];
};
const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
const FIELD_NAMES = ['Tessel Shoal', 'Marrow Bank', 'Halvard Reach', 'Ostrel Deep', 'Grey Lanes', 'Pellucid Drift', 'Vane Scatter', 'Oxbow Field', 'Cold Choir', 'Lantern Scree', 'Thimble Reach', 'Saltglass Bank'];

// Options from the galaxy: danger (1-4: more and bigger encounters), richness (percent of the
// usual amounts: places yield less each time they are visited again), name and ship (what the
// star chart calls it), relic (a drive component hidden in the hulk).
export function generatePoi(rules, { seed, type, visit = 0, danger = 1, richness = 100, name = '', ship = '', relic = '' }) {
  const T = rules.content.poiTypes[type];
  if (!T) throw new Error(`Unknown point-of-interest type "${type}"`);
  const rng = new Random(hashMix(seed | 0, visit | 0) || 1);
  const roll = (r) => r[0] + rng.int(r[1] - r[0] + 1);
  const rich = (n) => Math.max(1, Math.trunc((n * richness) / 100));
  const [W, D, H] = list(T.Size).map(Number);
  const halfH = H >> 1;
  const entry = [Math.trunc((W * 16) / 100), D >> 1, 0];

  // keep-out circles (cells), so things don't land on top of each other or on the Forge
  const taken = [{ x: entry[0], y: entry[1], z: 0, r: 18 }];
  const fits = (x, y, z, r) => taken.every((t) => (x - t.x) * (x - t.x) + (y - t.y) * (y - t.y) + (z - t.z) * (z - t.z) >= (r + t.r) * (r + t.r));
  const place = (r, { farFromEntry = 0, keep = true } = {}) => {
    const m = Math.min(r + 6, (Math.min(W, D) >> 1) - 1);
    for (let tries = 0; tries < 60; tries++) {
      const x = m + rng.int(Math.max(1, W - 2 * m)), y = m + rng.int(Math.max(1, D - 2 * m));
      const z = rng.int(Math.max(1, 2 * (halfH - 6))) - (halfH - 6);
      if (farFromEntry && (x - entry[0]) * (x - entry[0]) + (y - entry[1]) * (y - entry[1]) < farFromEntry * farFromEntry) continue;
      if (fits(x, y, z, r) || tries === 59) { if (keep) taken.push({ x, y, z, r }); return [x, y, z]; }
    }
    return [W >> 1, D >> 1, 0];
  };
  const toWorld = (p) => p.map((v) => v * CELL);
  const reachOf = (t) => { const h = rules.actor(t).traitInfo('Health'); return h.Radius + (h.HalfLength >> 1); };

  const fields = [];
  const layout = { wrecks: [], hulk: null, clouds: [], rocks: [], nebulae: [], encounters: [] };
  let named = '';
  for (const node of T.nodes) {
    const [kind] = node.key.split('@');
    const v = nodesToObject(node.nodes);
    if (kind === 'Deposit') {
      const n = roll(range(v.Fields, [1, 1]));
      let prev = null, dir = rng.int(1024);
      for (let i = 0; i < n; i++) {
        const spread = roll(range(v.Spread, [5, 5]));
        let at;
        if (v.Shape === 'tail' && prev) {
          // strung out in a line, like a comet's debris trail
          const step = spread * 2 + 2;
          at = [prev[0] + Math.trunc((COS(dir) * step) / 1024), prev[1] + Math.trunc((SIN(dir) * step) / 1024), prev[2] + rng.int(5) - 2];
          if (at[0] < spread + 4 || at[0] > W - spread - 4 || at[1] < spread + 4 || at[1] > D - spread - 4) { dir = (dir + 512) & 1023; at = place(spread + 2); }
          else taken.push({ x: at[0], y: at[1], z: at[2], r: spread + 2 });
        } else at = place(spread + 2);
        prev = at;
        fields.push({ name: FIELD_NAMES[(fields.length + rng.int(FIELD_NAMES.length)) % FIELD_NAMES.length], kind: v.Kind, at, count: roll(range(v.Rocks, [6, 6])), spread, ore: range(v.Amount, [500, 1000]).map(rich) });
      }
    } else if (kind === 'Wrecks') {
      const of = list(v.Of), clusters = Math.max(1, roll(range(v.Clusters, [1, 1])));
      const centres = Array.from({ length: clusters }, () => place(8));
      const count = roll(range(v.Count));
      for (let i = 0; i < count; i++) {
        const c = centres[i % clusters], t = of[rng.int(of.length)];
        const p = [c[0] + rng.int(13) - 6, c[1] + rng.int(13) - 6, c[2] + rng.int(7) - 3];
        layout.wrecks.push({ at: toWorld(p), of: t, salvage: rich(roll(range(v.Salvage, [100, 300]))), yaw: rng.int(1024), pitch: rng.int(161) - 80, radius: reachOf(t) });
      }
    } else if (kind === 'Hulk') {
      const size = +v.Size || 2600, names = list(T.Names);
      named = names.length ? names[rng.int(names.length)] : '';
      if (ship) named = ship;
      const at = place(Math.trunc(size / CELL) + 6);
      layout.hulk = { at: toWorld(at), of: v.Of, salvage: rich(roll(range(v.Salvage, [2000, 3000]))), yaw: rng.int(1024), pitch: rng.int(121) - 60, radius: size, name: named };
      // a drive component sealed somewhere in it: cutters find it once they are this far in
      if (relic) { layout.hulk.salvage = Math.max(layout.hulk.salvage, 1500); layout.hulk.relic = relic; layout.hulk.relicAt = Math.min(320, Math.trunc(layout.hulk.salvage / 4)); }
    } else if (kind === 'Clouds') {
      const count = roll(range(v.Count));
      for (let i = 0; i < count; i++) {
        const radius = roll(range(v.Size, [3000, 3000]));
        layout.clouds.push({ at: toWorld(place(Math.trunc(radius / CELL) + 2)), kind: v.Kind, amount: rich(roll(range(v.Amount, [400, 600]))), radius });
      }
    } else if (kind === 'Formation') {
      const count = roll(range(v.Count));
      for (let i = 0; i < count; i++) {
        const size = roll(range(v.Size, [8, 8]));
        const c = place(size + 2);
        layout.rocks.push(...formationRocks(rng, v.Shape, c, size).map((r) => ({ ...r, at: toWorld(r.at).map((x, k) => x + r.off[k]), shape: v.Shape })));
      }
    } else if (kind === 'Nebula') {
      const count = roll(range(v.Count));
      for (let i = 0; i < count; i++) {
        const size = roll(range(v.Size, [30, 30]));
        layout.nebulae.push({ at: toWorld(place(size >> 2, { keep: false })), radius: size * CELL, color: v.Color || 'ffffff' });
      }
    } else if (kind === 'Encounter') {
      // danger: likelier, and from danger 3 one more group; each group bigger by a third per level
      const count = roll(range(v.Count, [1, 1])) + (danger >= 3 ? 1 : 0);
      const chance = Math.min(100, (v.Chance === undefined ? 100 : +v.Chance) + (danger - 1) * 15);
      if (rng.int(100) >= chance) continue;
      const base = list(v.Ships), ships = [];
      for (let k = 0; k < Math.trunc((base.length * (2 + danger)) / 3); k++) ships.push(base[k % base.length]);
      for (let i = 0; i < count; i++) {
        layout.encounters.push({
          side: v.Side, ships, at: toWorld(place(6, { farFromEntry: 45 })),
          behaviour: v.Behaviour || 'lurk', delay: roll(range(v.Delay, [0, 0])) * 25,
        });
      }
    }
  }
  return {
    seed: rng.next() & 0x7fffffff,
    mode: 'poi',
    poi: { type, name: name || (layout.hulk ? `Wreck of the ${named}` : T.Name), description: T.Description, sky: T.Sky || '', visit, danger },
    space: { w: W, d: D, h: H },
    spawns: [entry],
    fields,
    layout,
  };
}

// Crystal formations as rings of rock pieces (cells for the centre, world units for each
// piece's offset and radius).
function formationRocks(rng, shape, c, size) {
  const out = [], yaw = rng.int(1024);
  const piece = (dx, dy, dz, r) => {
    // rotate the shape's local x/y round the vertical by yaw
    const x = Math.trunc((COS(yaw) * dx - SIN(yaw) * dy) / 1024), y = Math.trunc((SIN(yaw) * dx + COS(yaw) * dy) / 1024);
    out.push({ at: c, off: [x, y, dz], radius: r });
  };
  const R = size * CELL;
  if (shape === 'arch') {
    // a half circle standing upright, thick at the feet
    const n = 9 + rng.int(5);
    for (let i = 0; i <= n; i++) {
      const a = Math.trunc((i * 512) / n);
      piece(Math.trunc((COS(a) * R) / 1024), 0, Math.trunc((SIN(a) * R) / 1024) - (R >> 1), 700 + Math.trunc((Math.abs(COS(a)) * 600) / 1024) + rng.int(200));
    }
  } else if (shape === 'ring') {
    // a full circle, tilted
    const n = 14 + rng.int(6), tilt = 200 + rng.int(200);
    for (let i = 0; i < n; i++) {
      const a = Math.trunc((i * 1024) / n), rx = Math.trunc((COS(a) * R) / 1024), ry = Math.trunc((SIN(a) * R) / 1024);
      piece(rx, Math.trunc((ry * COS(tilt)) / 1024), Math.trunc((ry * SIN(tilt)) / 1024), 600 + rng.int(300));
    }
  } else {
    // a spire: a leaning stack of shards, narrowing toward the top
    const n = 6 + rng.int(4), lean = rng.int(300) - 150;
    for (let i = 0; i < n; i++) {
      const h = Math.trunc((i * R * 2) / n) - R;
      piece(Math.trunc((lean * i * 80) / 1024), 0, h, Math.max(350, 1300 - i * 120) + rng.int(150));
    }
  }
  return out;
}
