import { defineTrait, Trait } from '../engine/traits.js';
import { CELL, isqrt, angleOf, angleDiff, turnToward, clamp, distSq3, sin as SIN, cos as COS } from '../engine/math.js';
import { planRoute, reach } from '../engine/avoid.js';
import { FormationMove } from '../activities/formation.js';

// Formations. A formation is a group of ships flying around a shared anchor point: the
// anchor moves at the pace of the group's slowest ship (and waits for stragglers), turns
// at the rate of its slowest turner, and steers round asteroids; every member keeps
// station on its slot, which is laid out in the anchor's frame (forward, port, up), so the
// whole shape turns with the group. The frame is kept level so climbing groups stay readable.
//
//   Wall    a flat sheet facing the direction of travel
//   Sphere  a shell round the biggest ship (escort)
//   Wedge   an arrowhead, biggest ship at the point
//   Column  single file
//   Ring    a flat circle
//   Loose   no formation: the group is dissolved
export const FORMATIONS = ['wall', 'sphere', 'wedge', 'column', 'ring'];

// Slot offsets for n ships, in 1/1024 of the group's spacing: [forward, port, up].
export function slotTemplate(type, n) {
  const out = [];
  if (type === 'column') for (let i = 0; i < n; i++) out.push([-i * 1024, 0, 0]);
  else if (type === 'wedge') {
    for (let i = 0; i < n; i++) { const r = (i + 1) >> 1; out.push([-r * 1024, i === 0 ? 0 : (i % 2 ? 1 : -1) * r * 1024, 0]); }
  } else if (type === 'wall') {
    const cols = Math.max(1, Math.ceil(isqrt(n * 2 * 1024 * 1024) / 1024)), rows = Math.ceil(n / cols);
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.trunc(i / cols);
      const inRow = r === rows - 1 ? n - r * cols : cols; // centre a short last row
      out.push([0, ((inRow - 1) * 512) - c * 1024, ((rows - 1) * 512) - r * 1024]);
    }
  } else if (type === 'ring') {
    const rad = Math.max(1024, Math.trunc((n * 1024) / 6) + 512);
    for (let i = 0; i < n; i++) { const a = Math.trunc((i * 1024) / n); out.push([Math.trunc((SIN(a) * rad) / 1024), Math.trunc((COS(a) * rad) / 1024), 0]); }
  } else if (type === 'sphere') {
    out.push([0, 0, 0]);
    const m = n - 1, rad = 1024 + Math.trunc((m * 1024) / 8);
    for (let i = 0; i < m; i++) {
      // spread over the shell: height steps evenly, longitude turns by the golden angle
      const h = m > 1 ? Math.trunc(((2 * i - (m - 1)) * 1024) / m) : 0;
      const r = isqrt(1024 * 1024 - h * h), a = (i * 391) & 1023;
      out.push([Math.trunc((SIN(a) * r * rad) / (1024 * 1024)), Math.trunc((COS(a) * r * rad) / (1024 * 1024)), Math.trunc((h * rad) / 1024)]);
    }
  } else for (let i = 0; i < n; i++) out.push([0, 0, 0]);
  return out;
}

defineTrait('Formations', class Formations extends Trait {
  created() { this.groups = new Map(); this.nextId = 1; }
  worldLoaded() { this.world.formations = this; }
  get(id) { return this.groups.get(id) || null; }
  groupOf(a) { return a.formation ? this.groups.get(a.formation) || null : null; }

  // The group whose members are exactly these ships, if there is one.
  exactGroup(ships) {
    if (!ships.length) return null;
    const g = this.groupOf(ships[0]);
    if (!g || g.members.length !== ships.length) return null;
    for (const a of ships) if (a.formation !== g.id) return null;
    return g;
  }

  // Put ships into a formation (or out of one, with 'loose'). They form up where they are.
  form(owner, ships, type) {
    ships = ships.filter((a) => a.mobile && !a.dead && a.owner === owner);
    this.leave(ships);
    if (!FORMATIONS.includes(type) || ships.length < 2) return null;
    const w = this.world;
    let cx = 0, cy = 0, cz = 0;
    for (const a of ships) { cx += a.x; cy += a.y; cz += a.z; }
    const n = ships.length;
    const big = ships.slice().sort((a, b) => reach(b) - reach(a) || a.id - b.id)[0];
    const g = {
      id: this.nextId++, owner, type, members: [], slots: [], spacing: 0,
      x: Math.trunc(cx / n), y: Math.trunc(cy / n), z: Math.trunc(cz / n), yaw: big.yaw,
      vx: 0, vy: 0, vz: 0, speed: 0, dest: null, attack: false, engaged: -10, route: null,
    };
    for (const a of ships) { a.formation = g.id; g.members.push(a.id); }
    this.groups.set(g.id, g);
    this.relayout(g);
    for (const a of ships) a.queueActivity(new FormationMove(g.id), false);
    w.fx({ t: 'formation', group: g.id, type, owner: owner.index });
    return g;
  }

  // Ships leave whatever groups they are in; groups left with fewer than two ships dissolve.
  leave(ships) {
    for (const a of ships) {
      const g = this.groupOf(a);
      a.formation = 0;
      if (!g) continue;
      g.members = g.members.filter((id) => id !== a.id);
      if (g.members.length < 2) this.dissolve(g); else this.relayout(g);
    }
  }
  dissolve(g) {
    for (const id of g.members) { const a = this.world.actorById.get(id); if (a && a.formation === g.id) a.formation = 0; }
    this.groups.delete(g.id);
  }

  // Order the slots: biggest ships first (the centre of a sphere, the point of a wedge),
  // then by id, and size the spacing to the biggest hull.
  relayout(g) {
    const w = this.world;
    const ships = g.members.map((id) => w.actorById.get(id)).filter((a) => a && !a.dead);
    ships.sort((a, b) => reach(b) - reach(a) || a.id - b.id);
    g.members = ships.map((a) => a.id);
    g.slots = slotTemplate(g.type, ships.length);
    g.spacing = Math.max(1100, Math.trunc((ships.reduce((m, a) => Math.max(m, reach(a)), 0) * 22) / 10));
  }

  // World position of member `id`'s slot.
  slotPos(g, id) {
    const i = g.members.indexOf(id);
    if (i < 0) return null;
    const [f, l, u] = g.slots[i], S = g.spacing;
    const fw = Math.trunc((f * S) / 1024), lw = Math.trunc((l * S) / 1024), uw = Math.trunc((u * S) / 1024);
    const c = COS(g.yaw), s = SIN(g.yaw), b = this.world.bounds;
    return [clamp(g.x + Math.trunc((c * fw - s * lw) / 1024), b.x0, b.x1), clamp(g.y + Math.trunc((s * fw + c * lw) / 1024), b.y0, b.y1), clamp(g.z + uw, b.z0, b.z1)];
  }

  move(g, target, attack) {
    const b = this.world.bounds;
    g.dest = { x: clamp(target.x, b.x0, b.x1), y: clamp(target.y, b.y0, b.y1), z: clamp(target.z, b.z0, b.z1) };
    g.attack = !!attack; g.route = null;
    for (const id of g.members) {
      const a = this.world.actorById.get(id);
      if (!a) continue;
      if (a.collector) a.collector.auto = false;
      a.mobile.goal = { ...g.dest };
      a.queueActivity(new FormationMove(g.id), false);
    }
  }
  stop(g) { g.dest = null; g.speed = 0; g.vx = g.vy = g.vz = 0; }

  // ---------------------------------------------------------------- anchors
  tick() {
    const w = this.world;
    for (const g of [...this.groups.values()]) {
      const before = g.members.length;
      g.members = g.members.filter((id) => { const a = w.actorById.get(id); return a && !a.dead && a.formation === g.id; });
      if (g.members.length < 2) { this.dissolve(g); continue; }
      if (g.members.length !== before) this.relayout(g);
      this.fly(g);
    }
  }
  fly(g) {
    const w = this.world;
    g.vx = g.vy = g.vz = 0;
    if (!g.dest) { g.speed = 0; return; }
    const ships = g.members.map((id) => w.actorById.get(id));
    let vmax = Infinity, acc = Infinity, dec = Infinity, turn = Infinity, lag = 0;
    for (const a of ships) {
      const f = a.mobile.info;
      vmax = Math.min(vmax, f.MaxSpeed); acc = Math.min(acc, f.Acceleration); dec = Math.min(dec, f.Deceleration); turn = Math.min(turn, f.TurnSpeed);
      const p = this.slotPos(g, a.id);
      lag = Math.max(lag, distSq3(a.x, a.y, a.z, p[0], p[1], p[2]));
    }
    vmax = Math.trunc((vmax * 85) / 100);
    const { x: tx, y: ty, z: tz } = g.dest;
    const ex = tx - g.x, ey = ty - g.y, ez = tz - g.z, d = isqrt(ex * ex + ey * ey + ez * ez);
    if (d <= Math.max(48, g.speed)) { g.x = tx; g.y = ty; g.z = tz; g.dest = null; g.speed = 0; return; }
    // steer round obstacles as one body the size of the formation
    if (!g.route || w.frame - g.route.frame >= 8) {
      const extent = g.spacing * (1 + (g.members.length >> 2));
      const pseudo = { x: g.x, y: g.y, z: g.z, health: { info: { Radius: extent, HalfLength: 0 } } };
      const [x, y, z] = planRoute(w, pseudo, tx, ty, tz, 300);
      g.route = { x, y, z, frame: w.frame };
    }
    const sx = g.route.x - g.x, sy = g.route.y - g.y, sz = g.route.z - g.z, sd = isqrt(sx * sx + sy * sy + sz * sz) || 1;
    // turn the formation toward its course; it only gathers speed once it is facing that way
    const h = isqrt(sx * sx + sy * sy);
    let align = 1024;
    if (h > 256) {
      const want = angleOf(sx, sy);
      g.yaw = turnToward(g.yaw, want, turn);
      align = COS(Math.min(256, Math.abs(angleDiff(g.yaw, want))));
    }
    let want = Math.min(vmax, isqrt(2 * dec * d));
    want = Math.trunc((want * Math.max(0, align)) / 1024);
    if (lag > 25 * CELL * CELL) want = Math.min(want, 6);            // wait for stragglers
    if (g.attack && g.engaged >= w.frame - 2) want = 0;              // hold while members fight
    g.speed = g.speed < want ? Math.min(want, g.speed + acc) : Math.max(want, g.speed - dec);
    g.vx = Math.trunc((sx * g.speed) / sd); g.vy = Math.trunc((sy * g.speed) / sd); g.vz = Math.trunc((sz * g.speed) / sd);
    g.x += g.vx; g.y += g.vy; g.z += g.vz;
    const b = w.bounds;
    g.x = clamp(g.x, b.x0, b.x1); g.y = clamp(g.y, b.y0, b.y1); g.z = clamp(g.z, b.z0, b.z1);
  }

  hash(h, mix) {
    for (const g of this.groups.values()) { h = mix(h, g.id); h = mix(h, g.x); h = mix(h, g.y); h = mix(h, g.z); h = mix(h, g.yaw); h = mix(h, g.speed); h = mix(h, g.members.length); }
    return h;
  }
}, {});
