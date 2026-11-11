import { Random } from '../engine/random.js';
import { isqrt, hashMix, sin as SIN, cos as COS } from '../engine/math.js';
import { weights } from '../engine/content.js';

// The Wrack: a seeded galaxy of places in a flat disc round the dead star Orrin, in rings of
// regions from the Drift (inside) to the Shore (outside), joined by lanes the Skein Drive can
// stitch along. Pure and deterministic, integer maths only: the same seed always gives the
// same galaxy, so a save only needs the seed and what has happened since.
//
// Distances are in spans. Each region sits beyond the reach of the drive as it was before the
// component that opens it, so the drive's repair track gates the voyage:
//   tier 0  base drive (100)              the Drift
//   tier 1  + Threadwound Coils (150)     the Middens
//   tier 2  + Stillwater Lens (Veil)      the Hush, behind the Veil's nebula wall
//   tier 3  + Anchor Spindle (200)        the Shore
// The generator checks this: each region can be reached, all of it, at its own tier and not
// before, and each component lies where the drive that can fetch it can get to.
//
// Hazard pockets (hazards.yaml) are the exception: a few places in a region whose every lane
// in from outside carries a hazard, closed until the memory that gets the Forge through is
// remembered (a drive's `hazards`). Everything outside the pockets stays reachable without
// them, so a single life can always get home.

const nums = (v) => String(v).split(',').map((s) => +s.trim());
const LANES_PER_POINT = 4;
const GATES = 6; // guaranteed crossings per gap between regions
const POCKET_DETOUR = 1; // stitches a hazard pocket may add to the way to anywhere outside it

// The drive's reach for a set of installed components (ids).
export function driveOf(rules, installed = []) {
  const V = rules.content.voyage, items = rules.content.items;
  let range = +V.BaseRange || 100, veil = false, finalJump = false;
  for (const id of installed) {
    const it = items[id];
    if (!it) continue;
    if (it.Range) range = Math.trunc((range * +it.Range) / 100);
    if (it.Veil === 'true' || it.Veil === true) veil = true;
    if (it.FinalJump === 'true' || it.FinalJump === true) finalJump = true;
  }
  return { range, veil, finalJump, hazards: [] };
}

// Can a lane be stitched with this drive? (drive.hazards: the hazards it can go through)
export const laneOpen = (lane, drive) => lane.len <= drive.range && (!lane.veil || drive.veil) && (!lane.hazard || (!!drive.hazards && drive.hazards.includes(lane.hazard)));
// A drive that can go anywhere: for asking what is in the way
export const anyDrive = (rules) => ({ range: 1e9, veil: true, finalJump: true, hazards: Object.keys(rules.content.hazards || {}) });

// The drive levels in repair order: what you have after fitting each component in turn.
export function tiers(rules) {
  const order = Object.values(rules.content.items).filter((it) => it.Kind === 'drive').map((it) => it.id);
  return order.map((_, i) => driveOf(rules, order.slice(0, i)));
}

// short: a short voyage, about 120 places (each region's Short* values)
export function generateGalaxy(rules, seed, { short = false } = {}) {
  const C = rules.content;
  const regions = Object.values(C.regions).map((R) => (short ? { ...R, Ring: R.ShortRing || R.Ring, Points: R.ShortPoints || R.Points, Veil: R.ShortVeil || R.Veil, Edge: R.ShortEdge || R.Edge } : R));
  const rng = new Random(hashMix(0x2545f491, seed | 0) || 1);
  let veil = null;
  // no lane longer than the fully mended drive can stitch
  const MAX_LANE = tiers(rules).reduce((m, d) => Math.max(m, d.range), 0);
  for (const R of regions) if (R.Veil) veil = nums(R.Veil);

  // 1. Places. First the gates: pairs of places facing each other across each gap between
  // regions, so there is always a way out at the right drive level. Then the rest, by
  // dart-throwing in each ring, uniform over its area, never closer than Spacing.
  let points = [];
  const at = (R, ri, a, r) => {
    const x = Math.trunc((COS(a) * r) / 1024), y = Math.trunc((SIN(a) * r) / 1024), h = 4 + Math.trunc(r / 45);
    return { region: R.id, ri, x, y, z: rng.int(2 * h + 1) - h, r, edge: R.Edge ? r >= +R.Edge : false };
  };
  const clear = (x, y, sp) => points.every((p) => (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) >= sp * sp);
  for (let ri = 1; ri < regions.length; ri++) {
    const inner = regions[ri - 1], R = regions[ri], base = rng.int(1024);
    for (let g = 0; g < GATES; g++) {
      const a = (base + Math.trunc((g * 1024) / GATES) + rng.int(40)) & 1023;
      points.push(at(inner, ri - 1, a, nums(inner.Ring)[1] - 4), at(R, ri, a, nums(R.Ring)[0] + 4));
    }
  }
  regions.forEach((R, ri) => {
    const [r0, r1] = nums(R.Ring), sp = +R.Spacing;
    let made = points.filter((p) => p.ri === ri).length;
    for (let tries = 0; made < +R.Points && tries < +R.Points * 300; tries++) {
      const a = rng.int(1024), u = rng.int(65536);
      const p = at(R, ri, a, isqrt(r0 * r0 + Math.trunc(((r1 * r1 - r0 * r0) * u) / 65536)));
      if (!clear(p.x, p.y, sp)) continue;
      points.push(p);
      made++;
    }
  });

  // 2. Lanes: each place to its nearest few, and every place to the nearest place in the region
  // inside it (the gates). A lane that crosses the Veil is marked.
  const laneKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const buildLanes = () => {
    const seen = new Map();
    const add = (a, b) => {
      const k = laneKey(a, b);
      if (seen.has(k)) return;
      const p = points[a], q = points[b];
      const len = isqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));
      const crosses = !!veil && Math.min(p.r, q.r) < veil[0] && Math.max(p.r, q.r) > veil[1];
      seen.set(k, { a: Math.min(a, b), b: Math.max(a, b), len, veil: crosses });
    };
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const near = [];
      let inner = -1, innerD = Infinity;
      for (let j = 0; j < points.length; j++) {
        if (j === i) continue;
        const q = points[j], d2 = (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
        if (d2 <= MAX_LANE * MAX_LANE) near.push([d2, j]);
        if (q.ri === p.ri - 1 && d2 < innerD) { innerD = d2; inner = j; }
      }
      near.sort((m, n) => m[0] - n[0] || m[1] - n[1]);
      for (const [, j] of near.slice(0, LANES_PER_POINT)) add(i, j);
      if (inner >= 0 && innerD <= MAX_LANE * MAX_LANE) add(i, inner);
    }
    // and each region's shortest connections (a spanning tree), so no part of it is cut off
    // when it need not be
    for (let ri = 0; ri < regions.length; ri++) {
      const ids = points.map((p, i) => [p, i]).filter(([p]) => p.ri === ri).map(([, i]) => i);
      if (!ids.length) continue;
      const inTree = new Set([ids[0]]), best = new Map(ids.slice(1).map((i) => [i, [Infinity, -1]]));
      const relax = (k) => { for (const [j, b] of best) { const p = points[k], q = points[j], d2 = (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y); if (d2 < b[0]) { b[0] = d2; b[1] = k; } } };
      relax(ids[0]);
      while (best.size) {
        let pick = -1, pd = Infinity;
        for (const [j, b] of best) if (b[0] < pd || (b[0] === pd && j < pick)) { pd = b[0]; pick = j; }
        const from = best.get(pick)[1];
        best.delete(pick); inTree.add(pick);
        if (pd <= MAX_LANE * MAX_LANE) add(from, pick);
        relax(pick);
      }
    }
    return [...seen.values()].sort((m, n) => m.a - n.a || m.b - n.b);
  };

  // 3. The start: a place in the middle of the Drift.
  const startOf = () => {
    const cand = points.map((p, i) => [p, i]).filter(([p]) => p.ri === 0 && p.r >= 110 && p.r <= 230);
    return cand.length ? cand[rng.int(cand.length)][1] : 0;
  };

  // 4. Keep only what each region's own tier can reach, region by region.
  const T = tiers(rules);
  const tierFor = (ri) => T[Math.min(ri, T.length - 1)];
  let lanes, start;
  for (let ri = 0; ri < regions.length; ri++) {
    lanes = buildLanes();
    if (ri === 0) start = startOf();
    const seen = reach(points.length, lanes, start, tierFor(ri));
    const keep = points.map((p, i) => p.ri !== ri || seen[i]);
    if (keep.every(Boolean)) continue;
    const startPoint = points[start];
    points = points.filter((_, i) => keep[i]);
    start = points.indexOf(startPoint);
  }
  lanes = buildLanes();
  points.forEach((p, i) => { p.id = i; });

  // 5. What each place is, and its name.
  const used = new Set();
  const W = C.names.Wrecks || {}, first = String(W.First || 'Lost').split(',').map((s) => s.trim()), second = String(W.Second || 'Ship').split(',').map((s) => s.trim());
  const shipName = () => {
    for (let k = 0; k < 40; k++) { const n = `${rng.pick(first)} ${rng.pick(second)}`; if (!used.has(n)) { used.add(n); return n; } }
    const n = `${rng.pick(first)} ${rng.pick(second)} ${used.size}`; used.add(n); return n;
  };
  const nameFor = (p) => {
    if (p.type === 'Wreck') { p.ship = shipName(); return `Wreck of the ${p.ship}`; }
    const R = C.regions[p.region], words = String(R.Names || 'Nameless').split(',').map((s) => s.trim());
    const noun = C.poiTypes[p.type].Noun || C.poiTypes[p.type].Name;
    for (let k = 0; k < 40; k++) { const n = `${rng.pick(words)} ${noun}`; if (!used.has(n)) { used.add(n); return n; } }
    const n = `${rng.pick(words)} ${noun} ${used.size}`; used.add(n); return n;
  };
  for (const p of points) {
    const w = weights(C.regions[p.region].Types), total = w.reduce((s, [, n]) => s + n, 0);
    let roll = rng.int(total);
    p.type = w[0][0];
    for (const [t, n] of w) { if (roll < n) { p.type = t; break; } roll -= n; }
  }
  points[start].type = 'StillWater';

  // 6. The drive components, each in a derelict deep in its region.
  const adj = adjacency(points.length, lanes);
  const components = {};
  let from = start;
  for (const it of Object.values(C.items)) {
    if (!it.Region) continue;
    const cand = points.filter((p) => p.region === it.Region && p.id !== start && !p.relic);
    if (!cand.length) continue;
    // deep in its region: the outer third by distance from Orrin; of those, one a fair way
    // (by lanes) from the last part, but not the far side of the ring
    const hops = hopsFrom(points.length, lanes, from);
    cand.sort((m, n) => n.r - m.r || m.id - n.id);
    const deep = cand.slice(0, Math.max(1, Math.trunc(cand.length / 3)));
    deep.sort((m, n) => hops[m.id] - hops[n.id] || m.id - n.id);
    // (on a short voyage, the nearer third)
    const lo = short ? 0 : Math.trunc(deep.length / 3), hi = Math.max(lo + 1, Math.trunc((deep.length * (short ? 1 : 2)) / 3));
    const p = deep[lo + rng.int(hi - lo)];
    p.type = 'Wreck'; p.relic = it.id;
    components[it.id] = p.id;
    from = p.id;
  }
  // 7. Factions: their seats (stations) and the places round them they claim
  const seats = [];
  for (const F of Object.values(C.factions || {})) {
    for (const [region, n] of weights(F.Seats)) {
      // a short voyage's smaller galaxy has half the stations
      for (let k = 0; k < (short ? Math.ceil(n / 2) : n); k++) {
        const cand = points.filter((p) => p.region === region && p.id !== start && !p.relic && !p.seat && p.type !== 'StillWater');
        // spread out: as far (in lanes) from other seats as possible, then at random
        const farOf = new Map(cand.map((p) => [p.id, seats.reduce((m, q) => Math.min(m, hopsBetween(adj, lanes, p.id, q.id, 4)), 99)]));
        const best = cand.reduce((m, p) => Math.max(m, farOf.get(p.id)), -1);
        const top = cand.filter((p) => farOf.get(p.id) === best);
        if (!top.length) continue;
        const p = top[rng.int(top.length)];
        p.seat = true; p.owner = F.id; p.type = F.Station || p.type;
        seats.push(p);
      }
    }
  }
  // claims spread out from the seats, a lane at a time, nearer seats first (never the start)
  let frontier = seats.map((p) => ({ id: p.id, owner: p.owner, left: +C.factions[p.owner].Reach || 0 }));
  while (frontier.length) {
    const next = [];
    for (const f of frontier) {
      if (f.left <= 0) continue;
      for (const li of adj[f.id]) {
        const l = lanes[li], j = l.a === f.id ? l.b : l.a, q = points[j];
        if (q.owner || j === start) continue;
        q.owner = f.owner;
        next.push({ id: j, owner: f.owner, left: f.left - 1 });
      }
    }
    frontier = next;
  }
  for (const p of points) p.name = nameFor(p);
  // 8. Story anchors (memories.yaml): each in its region, a set number of stitches from the
  // wake-up point, turned into its own kind of place. Its own dice, so nothing else moves.
  const arng = new Random(hashMix(seed | 0, 0xa11c) || 1);
  for (const A of Object.values(C.anchors || {})) {
    const [lo, hi] = String(A.Hops || '3-5').split('-').map(Number), hops = hopsFrom(points.length, lanes, start);
    let cand = points.filter((p) => p.region === A.Region && p.id !== start && !p.relic && !p.seat && hops[p.id] >= lo && hops[p.id] <= (hi || lo));
    if (!cand.length) cand = points.filter((p) => p.region === A.Region && p.id !== start && !p.relic && !p.seat);
    if (!cand.length) continue;
    const p = cand[arng.int(cand.length)];
    p.type = A.Type; p.relic = A.id; p.name = A.Name ? A.Name[0].toUpperCase() + A.Name.slice(1) : p.name;
    components[A.id] = p.id;
  }
  const pockets = carvePockets(C, seed, { points, lanes, adj, start, regions, tierFor, short });
  // 10. Traders and wayhouses (Milestone 20): one trader in each region, and a few wayhouses,
  // in places that are nothing else (never the wake-up point, an anchor, a derelict, a station
  // or a pocket), reachable at the region's own tier. Their own dice, so nothing else moves.
  const traders = placeTraders(C, seed, { points, lanes, start, regions, tierFor });

  return { seed: seed | 0, short, points, lanes, adj, start, components, veil, pockets, traders, regions: regions.map((R) => R.id), rings: Object.fromEntries(regions.map((R) => [R.id, nums(R.Ring)])) };
}

// 9. Hazard pockets (hazards.yaml): a few places in a region, cut off by a hazard on every lane
// in from outside. Never the wake-up point, an anchor, a derelict, a station or a place next to
// another pocket; and everything outside the pockets can still be reached at its region's tier
// without any hazard opened, and no more than POCKET_DETOUR stitches further from the wake-up
// point than with no pockets at all: pockets sit off to the side, never across the way. Each pocket keeps one cache (relic `cache-N`) in a wreck. Its own
// dice, so nothing else moves. Returns [ { id: 'cache-N', hazard, places: [ids], cache: id } ].
function carvePockets(C, seed, { points, lanes, adj, start, regions, tierFor, short }) {
  const hrng = new Random(hashMix(seed | 0, 0x4a2d) || 1), pockets = [];
  const hops = hopsFrom(points.length, lanes, start);
  const other = (li, i) => { const l = lanes[li]; return l.a === i ? l.b : l.a; };
  const taken = (p) => p.id === start || !!p.relic || !!p.seat || p.type === 'StillWater' || !!p.pocket;
  const nearPocket = (i) => adj[i].some((li) => !!points[other(li, i)].pocket);
  const ok = (p, region) => p.region === region && !taken(p) && !nearPocket(p.id) && hops[p.id] >= 2;
  // stitches from the wake-up point at each region's tier, with the hazards as they are now
  const hopsAt = () => regions.map((R, ri) => hopsFrom(points.length, lanes, start, tierFor(ri)));
  const base = hopsAt();
  // everything outside the pockets (and outside `cell`) reachable at its own tier, the long way
  // round no longer than POCKET_DETOUR stitches?
  const outsideOk = (cell) => hopsAt().every((h, ri) => points.every((p) => p.ri !== ri || p.pocket || cell.has(p.id) || h[p.id] <= base[ri][p.id] + POCKET_DETOUR));
  const W = C.names.Wrecks || {}, first = String(W.First || 'Lost').split(',').map((s) => s.trim()), second = String(W.Second || 'Ship').split(',').map((s) => s.trim());
  const names = new Set(points.map((p) => p.name));
  for (const H of Object.values(C.hazards || {})) {
    const [smin, smax] = String(H.Size || '3-5').split('-').map(Number);
    for (const [region, n] of weights(H.Pockets)) {
      const ri = regions.findIndex((R) => R.id === region);
      if (ri < 0) continue;
      for (let k = 0; k < n; k++) {
        for (let tries = 0; tries < 12; tries++) {
          let cand = points.filter((p) => ok(p, region));
          // ember lanes: the region's inner edge, nearest the dead star
          if (H.Inner === 'true' || H.Inner === true) cand = cand.sort((a, b) => a.r - b.r || a.id - b.id).slice(0, Math.max(1, Math.trunc(cand.length / 3)));
          if (!cand.length) break;
          const size = short ? smin : smin + hrng.int(Math.max(1, (smax || smin) - smin + 1));
          const cell = [cand[hrng.int(cand.length)].id], inCell = new Set(cell);
          while (cell.length < size) {
            const front = new Set();
            for (const i of cell) for (const li of adj[i]) { const j = other(li, i); if (!inCell.has(j) && ok(points[j], region) && laneOpen(lanes[li], tierFor(ri))) front.add(j); }
            if (!front.size) break;
            const f = [...front].sort((a, b) => a - b), j = f[hrng.int(f.length)];
            cell.push(j); inCell.add(j);
          }
          if (cell.length < smin) continue;
          const border = [];
          lanes.forEach((l, li) => { if (inCell.has(l.a) !== inCell.has(l.b)) border.push(li); });
          for (const li of border) lanes[li].hazard = H.id;
          if (!outsideOk(inCell)) { for (const li of border) delete lanes[li].hazard; continue; }
          const id = `cache-${pockets.length + 1}`, at = cell[hrng.int(cell.length)], q = points[at];
          for (const i of cell) points[i].pocket = H.id;
          q.relic = id;
          if (q.type !== 'Wreck') {
            q.type = 'Wreck'; q.ship = '';
            for (let m = 0; m < 40 && (!q.ship || names.has(`Wreck of the ${q.ship}`)); m++) q.ship = `${hrng.pick(first)} ${hrng.pick(second)}`;
            q.name = `Wreck of the ${q.ship}`; names.add(q.name);
          }
          pockets.push({ id, hazard: H.id, places: cell.sort((a, b) => a - b), cache: at });
          break;
        }
      }
    }
  }
  return pockets;
}

function placeTraders(C, seed, { points, lanes, start, regions, tierFor }) {
  const trng = new Random(hashMix(seed | 0, 0x7a0e) || 1), out = {};
  const free = (p, ri) => p.ri === ri && p.id !== start && !p.relic && !p.seat && !p.pocket && !p.trader && !p.wayhouse && p.type !== 'StillWater';
  regions.forEach((R, ri) => {
    const seen = reach(points.length, lanes, start, tierFor(ri));
    const cand = () => points.filter((p) => free(p, ri) && seen[p.id]);
    for (const T of Object.values(C.traders || {})) {
      if (T.Region !== R.id) continue;
      const c = cand();
      if (!c.length) continue;
      const p = c[trng.int(c.length)];
      p.type = 'Trader'; p.trader = T.id; p.name = T.Name;
      out[T.id] = p.id;
    }
    for (let k = 0; k < (+C.voyage.Wayhouses || 0); k++) {
      const c = cand();
      if (!c.length) break;
      const p = c[trng.int(c.length)];
      const words = String(R.Names || 'Drifters').split(',').map((s) => s.trim());
      p.type = 'Wayhouse'; p.wayhouse = true; p.ship = ''; p.name = `${trng.pick(words)} Wayhouse`;
    }
  });
  return out;
}

// lanes per place: arrays of lane indices
export function adjacency(n, lanes) {
  const adj = Array.from({ length: n }, () => []);
  lanes.forEach((l, i) => { adj[l.a].push(i); adj[l.b].push(i); });
  return adj;
}

// Which places a drive can reach from `from` (an array of booleans).
export function reach(n, lanes, from, drive) {
  const adj = adjacency(n, lanes), seen = new Array(n).fill(false), queue = [from];
  seen[from] = true;
  while (queue.length) {
    const i = queue.shift();
    for (const li of adj[i]) {
      const l = lanes[li];
      if (!laneOpen(l, drive)) continue;
      const j = l.a === i ? l.b : l.a;
      if (!seen[j]) { seen[j] = true; queue.push(j); }
    }
  }
  return seen;
}

// lanes between two places, counting no further than `max`
function hopsBetween(adj, lanes, a, b, max) {
  if (a === b) return 0;
  let seen = new Set([a]), ring = [a];
  for (let d = 1; d <= max; d++) {
    const next = [];
    for (const i of ring) for (const li of adj[i]) { const l = lanes[li], j = l.a === i ? l.b : l.a; if (j === b) return d; if (!seen.has(j)) { seen.add(j); next.push(j); } }
    ring = next;
  }
  return max + 1;
}

// stitches from `from` to every place (1e9: none), along any lane or only those `drive` can use
function hopsFrom(n, lanes, from, drive = null) {
  const adj = adjacency(n, lanes), hops = new Array(n).fill(1e9), queue = [from];
  hops[from] = 0;
  while (queue.length) {
    const i = queue.shift();
    for (const li of adj[i]) { const l = lanes[li], j = l.a === i ? l.b : l.a; if (drive && !laneOpen(l, drive)) continue; if (hops[j] > hops[i] + 1) { hops[j] = hops[i] + 1; queue.push(j); } }
  }
  return hops;
}

// The cheapest route (in Glim, then days) from `from` to `to` along lanes this drive can use:
// { hops: [place ids, from first stitch to destination], lanes: [lane indices], len, glim, days }
// or null if there is none.
export function route(galaxy, rules, from, to, drive) {
  const V = rules.content.voyage, n = galaxy.points.length;
  const cost = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
  cost[from] = 0;
  for (;;) {
    let i = -1;
    for (let k = 0; k < n; k++) if (!done[k] && cost[k] < Infinity && (i < 0 || cost[k] < cost[i])) i = k;
    if (i < 0 || i === to) break;
    done[i] = true;
    for (const li of galaxy.adj[i]) {
      const l = galaxy.lanes[li];
      if (!laneOpen(l, drive)) continue;
      const j = l.a === i ? l.b : l.a;
      // Glim first; a small charge per hop prefers fewer stitches when Glim is equal
      const c = cost[i] + stitchGlim(V, l.len) * 64 + 1;
      if (c < cost[j]) { cost[j] = c; prev[j] = li; }
    }
  }
  if (from === to || cost[to] === Infinity) return null;
  const lanesOut = [], hops = [];
  for (let j = to; j !== from;) { const l = galaxy.lanes[prev[j]]; lanesOut.unshift(prev[j]); hops.unshift(j); j = l.a === j ? l.b : l.a; }
  let len = 0, glim = 0, days = 0;
  for (const li of lanesOut) { const l = galaxy.lanes[li]; len += l.len; glim += stitchGlim(V, l.len); days += stitchDays(V, l.len, !!galaxy.short); }
  return { hops, lanes: lanesOut, len, glim, days };
}

export const stitchGlim = (V, len) => Math.trunc((len * +V.GlimPer10 + 9) / 10);
// a short voyage's stitches are quicker (ShortDaySpan)
export const stitchDays = (V, len, short = false) => 1 + Math.trunc(len / +(short && V.ShortDaySpan ? V.ShortDaySpan : V.DaySpan));
