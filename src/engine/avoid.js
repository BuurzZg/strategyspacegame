import { isqrt, clamp, dirVec } from './math.js';

// Steering around obstacles. A ship flying from P to a target T checks the straight line
// against every obstacle in its way: asteroids, and hulls much bigger than its own. Each
// obstacle is a capsule (a line segment with a radius; a sphere is a segment of length 0).
// If the line passes too close, the ship aims for a detour point beside the first obstacle
// in the way, checks the line to that point the same way, and so on (up to 4 detours).
//
// Integer maths only. Directions are planned at 1/64 precision so products stay well
// inside the exact range of a double.
const SH = 6, ONE = 4096;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lsh = (a, b) => [(b[0] - a[0]) >> SH, (b[1] - a[1]) >> SH, (b[2] - a[2]) >> SH];

// Closest points between segments p0-p1 and q0-q1 (world units). s is the position of the
// closest point along p (0..ONE); (px, py, pz) and (qx, qy, qz) are the two points.
export function closestSegSeg(p0, p1, q0, q1) {
  const d1 = lsh(p0, p1), d2 = lsh(q0, q1), r = lsh(q0, p0);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s = 0, t = 0;
  if (a > 0 || e > 0) {
    if (a === 0) t = clamp(Math.trunc((f * ONE) / e), 0, ONE);
    else {
      const c = dot(d1, r);
      if (e === 0) s = clamp(Math.trunc((-c * ONE) / a), 0, ONE);
      else {
        const b = dot(d1, d2), den = a * e - b * b;
        s = den > 0 ? clamp(Math.trunc(((b * f - c * e) * ONE) / den), 0, ONE) : 0;
        t = Math.trunc((b * s + f * ONE) / e);
        if (t < 0) { t = 0; s = clamp(Math.trunc((-c * ONE) / a), 0, ONE); }
        else if (t > ONE) { t = ONE; s = clamp(Math.trunc(((b - c) * ONE) / a), 0, ONE); }
      }
    }
  }
  return {
    s,
    px: p0[0] + Math.trunc(((p1[0] - p0[0]) * s) / ONE), py: p0[1] + Math.trunc(((p1[1] - p0[1]) * s) / ONE), pz: p0[2] + Math.trunc(((p1[2] - p0[2]) * s) / ONE),
    qx: q0[0] + Math.trunc(((q1[0] - q0[0]) * t) / ONE), qy: q0[1] + Math.trunc(((q1[1] - q0[1]) * t) / ONE), qz: q0[2] + Math.trunc(((q1[2] - q0[2]) * t) / ONE),
  };
}
const gap = (c) => { const x = c.px - c.qx, y = c.py - c.qy, z = c.pz - c.qz; return isqrt(x * x + y * y + z * z); };

// A ship's reach from its centre: its radius, plus half its length if it is a long hull.
export function reach(a) { return a.health ? a.health.info.Radius + a.health.info.HalfLength : 0; }

// What `self` should steer around: every asteroid and wreck, and every hull at least 2.5 times its size.
// Ghosts (launching, docking) are left out: they are inside another hull on purpose.
export function obstaclesFor(w, self, ignore = 0) {
  const out = [];
  for (const t of w.solids()) {
    const a = t.self;
    if (a.dead) continue;
    const hl = t.halfLength | 0;
    if (!hl) { out.push({ id: a.id, q0: [a.x, a.y, a.z], q1: [a.x, a.y, a.z], r: t.radius() }); continue; }
    const f = dirVec(a.yaw, a.pitch);
    const ox = Math.trunc((f[0] * hl) / 1024), oy = Math.trunc((f[1] * hl) / 1024), oz = Math.trunc((f[2] * hl) / 1024);
    out.push({ id: a.id, q0: [a.x - ox, a.y - oy, a.z - oz], q1: [a.x + ox, a.y + oy, a.z + oz], r: t.radius() });
  }
  const rs = reach(self);
  for (const a of w.actors) {
    if (a === self || a.id === ignore || !a.mobile || a.dead || a.mobile.ghost || !a.health || 2 * reach(a) < 5 * rs) continue;
    const h = a.health.info;
    if (!h.HalfLength) { out.push({ id: a.id, q0: [a.x, a.y, a.z], q1: [a.x, a.y, a.z], r: h.Radius }); continue; }
    const f = dirVec(a.yaw, a.pitch), hl = h.HalfLength;
    const ox = Math.trunc((f[0] * hl) / 1024), oy = Math.trunc((f[1] * hl) / 1024), oz = Math.trunc((f[2] * hl) / 1024);
    out.push({ id: a.id, q0: [a.x - ox, a.y - oy, a.z - oz], q1: [a.x + ox, a.y + oy, a.z + oz], r: h.Radius });
  }
  return out;
}

// Where to steer on the way from self to (tx, ty, tz): the target itself when the way is
// clear, otherwise a detour point. `margin` is extra room beyond touching (faster ships,
// which turn wider, want more).
//
// `ignore` is a hull not to steer round: the ship being attacked (a strafing run has to pass it).
// An obstacle only counts when the line comes closer to it than both its ends do: a ship
// leaving a rock it was mining, or flying to a point beside a rock, isn't sent round it.
export function planRoute(w, self, tx, ty, tz, margin, ignore = 0) {
  const obs = obstaclesFor(w, self, ignore);
  if (!obs.length) return [tx, ty, tz];
  const rs = reach(self);
  const P = [self.x, self.y, self.z];
  const axisDist = (o, pt) => gap(closestSegSeg(pt, pt, o.q0, o.q1));
  const dP = obs.map((o) => axisDist(o, P));
  let A = [tx, ty, tz];
  for (let iter = 0; iter < 4; iter++) {
    // bounding box of the line, to skip far-away obstacles cheaply
    const lo = [Math.min(P[0], A[0]), Math.min(P[1], A[1]), Math.min(P[2], A[2])];
    const hi = [Math.max(P[0], A[0]), Math.max(P[1], A[1]), Math.max(P[2], A[2])];
    let best = -1, bs = ONE + 1, bc = null;
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i], R = o.r + rs + margin;
      let far = false;
      for (let k = 0; k < 3 && !far; k++) far = Math.min(o.q0[k], o.q1[k]) - R > hi[k] || Math.max(o.q0[k], o.q1[k]) + R < lo[k];
      if (far) continue;
      const c = closestSegSeg(P, A, o.q0, o.q1);
      const dm = gap(c);
      if (dm < R && dm + 32 < Math.min(dP[i], axisDist(o, A)) && c.s < bs) { bs = c.s; best = i; bc = c; }
    }
    if (best < 0) break;
    const o = obs[best], R = o.r + rs + margin;
    // detour: out from the obstacle's axis through the line's closest point...
    let u = [bc.px - bc.qx, bc.py - bc.qy, bc.pz - bc.qz];
    let ul = isqrt(dot(u, u));
    if (ul < 64) {
      // ...or, if the line runs straight through the axis, over the long hull / round the rock
      const d = lsh(P, A), ax = lsh(o.q0, o.q1);
      const side = ax[0] || ax[1] || ax[2] ? ax : [0, 0, 1];
      u = [d[1] * side[2] - d[2] * side[1], d[2] * side[0] - d[0] * side[2], d[0] * side[1] - d[1] * side[0]];
      ul = isqrt(dot(u, u));
      if (ul === 0) { u = [0, 0, 1]; ul = 1; }
    }
    const Rw = Math.trunc((R * 5) / 4), b = w.bounds;
    A = [
      clamp(bc.qx + Math.trunc((u[0] * Rw) / ul), b.x0, b.x1),
      clamp(bc.qy + Math.trunc((u[1] * Rw) / ul), b.y0, b.y1),
      clamp(bc.qz + Math.trunc((u[2] * Rw) / ul), b.z0, b.z1),
    ];
  }
  return A;
}
