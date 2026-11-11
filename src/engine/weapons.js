import { ProjectileRegistry, WarheadRegistry } from './traits.js';
import { isqrt, distSq3, dirVec, sin as SIN, cos as COS } from './math.js';

// Weapons are data: a Projectile carries the shot, Warheads apply where it lands.
//
//   PulseBattery:
//   	ReloadDelay: 15
//   	Range: 3600
//   	Projectile: Bolt
//   		Speed: 380
//   	Warhead@hit: SpreadDamage
//   		Damage: 1600
//   		Versus:
//   			medium: 130
//
// Every shot is simulated (integer, deterministic) in world.effects; the renderer only draws
// them. Unguided shots fly at where the target will be and can miss a ship that turns away.

// World position of an armament's muzzle: Forward / Side (port +) / Up in the ship's frame.
export function muzzleOf(firer, info, side) {
  const f = dirVec(firer.yaw, firer.pitch);
  const s = side * info.Side;
  return [
    firer.x + Math.trunc((f[0] * info.Forward) / 1024) - Math.trunc((SIN(firer.yaw) * s) / 1024),
    firer.y + Math.trunc((f[1] * info.Forward) / 1024) + Math.trunc((COS(firer.yaw) * s) / 1024),
    firer.z + Math.trunc((f[2] * info.Forward) / 1024) + info.Up,
  ];
}

export function fireWeapon(world, firer, armament, target, side = 1) {
  const weapon = armament.weapon;
  const [sx, sy, sz] = muzzleOf(firer, armament.info, side);
  const args = { world, weapon, firer, owner: firer.owner, sx, sy, sz, target };
  world.fx({ t: 'fire', actor: firer.id, weapon: weapon.name, report: weapon.Report, x: sx, y: sy, z: sz, owner: firer.owner.index });
  weapon.projectile.P.launch(args, weapon.projectile);
}

export function applyWarheads(args, x, y, z, direct) {
  for (const wh of args.weapon.warheads) wh.W.apply(args, wh, x, y, z, direct);
}

// Where the target will be when a shot of this speed gets there. Tracking is how much of
// the target's motion the gunner leads (%): heavy guns can't follow a darting fighter.
function leadPoint(sx, sy, sz, t, speed, tracking) {
  const ticks = Math.trunc(isqrt(distSq3(sx, sy, sz, t.x, t.y, t.z)) / Math.max(1, speed));
  const k = Math.trunc((ticks * tracking) / 100);
  return [t.x + (t.x - t.px) * k, t.y + (t.y - t.py) * k, t.z + (t.z - t.pz) * k];
}
function scatter(world, p, amount) {
  if (amount <= 0) return p;
  return [p[0] + world.rng.range(-amount, amount + 1), p[1] + world.rng.range(-amount, amount + 1), p[2] + world.rng.range(-amount, amount + 1)];
}

// ---------------------------------------------------------------- projectiles
function defineProjectile(name, P, defaults) { P.defaults = { Color: '', Size: 100, ...defaults }; ProjectileRegistry.set(name, P); }

// Hits at once. Beam: true draws a beam from the muzzle to the target (lances); false is
// for contact weapons like a monster's bite.
defineProjectile('InstantHit', {
  launch(args, info) {
    const { world, target } = args;
    world.fx({ t: info.Arc ? 'arc' : info.Beam ? 'beam' : 'bite', from: args.firer.id, to: target.id, x0: args.sx, y0: args.sy, z0: args.sz, x1: target.x, y1: target.y, z1: target.z, color: info.Color, size: info.Size, owner: args.owner.index });
    applyWarheads(args, target.x, target.y, target.z, target);
  },
}, { Beam: true, Arc: false });

// A straight, unguided shot at the target's predicted position. It hits if the target's hull
// is within HitRadius of that point when the shot arrives; otherwise it misses. With
// Detonate: true it bursts at that point regardless (flak), and area warheads hit whatever
// is near.
defineProjectile('Bolt', {
  launch(args, info) {
    const { world, target } = args;
    const a = scatter(world, leadPoint(args.sx, args.sy, args.sz, target, info.Speed, info.Tracking), info.Inaccuracy);
    const life = Math.max(1, Math.ceil(isqrt(distSq3(args.sx, args.sy, args.sz, a[0], a[1], a[2])) / info.Speed));
    world.effects.push({
      id: world.nextEffectId++, kind: 'bolt', vis: info, owner: args.owner.index,
      sx: args.sx, sy: args.sy, sz: args.sz, ax: a[0], ay: a[1], az: a[2],
      x: args.sx, y: args.sy, z: args.sz, px: args.sx, py: args.sy, pz: args.sz, t: 0, life,
      tick(w) {
        this.px = this.x; this.py = this.y; this.pz = this.z;
        this.t++;
        this.x = this.sx + Math.trunc(((this.ax - this.sx) * this.t) / this.life);
        this.y = this.sy + Math.trunc(((this.ay - this.sy) * this.t) / this.life);
        this.z = this.sz + Math.trunc(((this.az - this.sz) * this.t) / this.life);
        if (this.t < this.life) return false;
        const tg = args.target;
        const hit = tg && !tg.dead && w.edgeDistPoint(this.ax, this.ay, this.az, tg) <= info.HitRadius;
        if (hit || info.Detonate) {
          applyWarheads(args, this.ax, this.ay, this.az, hit ? tg : null);
          w.fx({ t: info.Detonate ? 'burst' : 'impact', x: this.ax, y: this.ay, z: this.az, color: info.Color, size: info.Size, hit, owner: this.owner });
        }
        return true;
      },
    });
  },
}, { Speed: 400, HitRadius: 120, Inaccuracy: 0, Tracking: 100, Detonate: false });

// A homing missile: speeds up, turns toward its target a little each tick, and bursts on
// contact or when its fuel runs out.
defineProjectile('Missile', {
  launch(args, info) {
    const { world, firer } = args;
    const f = dirVec(firer.yaw, firer.pitch);
    world.effects.push({
      id: world.nextEffectId++, kind: 'missile', vis: info, owner: args.owner.index,
      x: args.sx, y: args.sy, z: args.sz, px: args.sx, py: args.sy, pz: args.sz,
      dx: f[0], dy: f[1], dz: f[2], speed: info.Speed, t: 0,
      tick(w) {
        this.px = this.x; this.py = this.y; this.pz = this.z;
        const tg = args.target && !args.target.dead ? args.target : null;
        if (tg) {
          // blend the heading toward the target (all vectors scaled to length 1024)
          let wx = tg.x - this.x, wy = tg.y - this.y, wz = tg.z - this.z;
          const wl = isqrt(wx * wx + wy * wy + wz * wz) || 1;
          wx = Math.trunc((wx * 1024) / wl); wy = Math.trunc((wy * 1024) / wl); wz = Math.trunc((wz * 1024) / wl);
          const k = info.TurnRate;
          let nx = this.dx * (1024 - k) + wx * k, ny = this.dy * (1024 - k) + wy * k, nz = this.dz * (1024 - k) + wz * k;
          const nl = isqrt(nx * nx + ny * ny + nz * nz) || 1;
          this.dx = Math.trunc((nx * 1024) / nl); this.dy = Math.trunc((ny * 1024) / nl); this.dz = Math.trunc((nz * 1024) / nl);
        }
        this.speed = Math.min(info.MaxSpeed, this.speed + info.Accel);
        this.x += Math.trunc((this.dx * this.speed) / 1024);
        this.y += Math.trunc((this.dy * this.speed) / 1024);
        this.z += Math.trunc((this.dz * this.speed) / 1024);
        const hit = tg && w.edgeDistPoint(this.x, this.y, this.z, tg) <= info.HitRadius;
        if (hit || ++this.t >= info.Lifetime) {
          applyWarheads(args, this.x, this.y, this.z, hit ? tg : null);
          w.fx({ t: 'impact', x: this.x, y: this.y, z: this.z, color: info.Color, size: info.Size, hit, missile: true, owner: this.owner });
          return true;
        }
        return false;
      },
    });
  },
}, { Speed: 60, MaxSpeed: 180, Accel: 4, TurnRate: 160, Lifetime: 150, HitRadius: 220 });

// ---------------------------------------------------------------- warheads
function defineWarhead(name, W, defaults) { W.defaults = { ...defaults }; WarheadRegistry.set(name, W); }

// Damage to the direct target (Spread 0), or to every enemy hull within Spread of the
// impact (less at the edge: Falloff% at full Spread). Scaled by Versus% per armour type.
defineWarhead('SpreadDamage', {
  apply(args, wh, x, y, z, direct) {
    const { world, owner } = args;
    const firer = args.firer.dead ? null : args.firer;
    const hit = (a, pct) => {
      if (!a.health || a.dead || !owner.isEnemy(a.owner)) return;
      const versus = wh.Versus[a.trait('Armor')?.info.Type] ?? 100;
      let dmg = Math.trunc((((wh.Damage * versus) / 100) * pct) / 100);
      if (firer) {
        // veterans hit harder; so does a Forge with fire control (engineering)
        if ((firer.rank || firer.leadDamage || (firer.owner.slot && firer.owner.slot.shipPct && firer.owner.slot.shipPct !== 100 && !firer.has('Hangar'))) && world.ranks) dmg = Math.trunc((dmg * world.ranks.damagePct(firer)) / 100);
        const fc = firer.owner.slot && firer.owner.slot.forgeDamagePct;
        if (fc && firer.has('Hangar')) dmg = Math.trunc((dmg * fc) / 100);
        firer.fought = true;
      }
      if (dmg > 0) a.health.damage(firer, dmg, owner);
    };
    if (wh.Spread <= 0) { if (direct) hit(direct, 100); return; }
    for (const a of world.unitsInSphere(x, y, z, wh.Spread + world.maxHalfLength + 1500, [])) {
      const d = world.edgeDistPoint(x, y, z, a);
      if (d <= wh.Spread) hit(a, 100 - Math.trunc(((100 - wh.Falloff) * d) / wh.Spread));
    }
  },
}, { Damage: 0, Spread: 0, Falloff: 40, Versus: {} });

// Purely visual: an explosion of a given kind and size where the shot lands.
defineWarhead('CreateEffect', {
  apply(args, wh, x, y, z) { args.world.fx({ t: 'explosion', kind: wh.Explosion, size: wh.Size, x, y, z, owner: args.owner.index }); },
}, { Explosion: 'spark', Size: 100 });
