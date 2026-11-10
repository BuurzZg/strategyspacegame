import { defineTrait, Trait } from '../engine/traits.js';
import { CELL, angleOf, sin as SIN, cos as COS, clamp } from '../engine/math.js';
import { AttackMove } from '../activities/attack.js';

// The Proving Grounds: a testing sandbox. Its commands are world orders, so they go through
// the order queue like everything else and the simulation stays deterministic. They only
// work when the match settings say `sandbox: true`.
//
//   SandboxSpawn  { player, types: [...], at: [x, y, z] (world units), attack: [x, y, z]? }
//                 ships appear in a loose block facing `attack` (or the map centre), and with
//                 `attack` they advance on it, fighting whatever they meet
//   SandboxOre    { player, amount }
//   SandboxClear  { player }   remove that player's ships (no wrecks)
defineTrait('ProvingGrounds', class extends Trait {
  resolveOrder(o) {
    const w = this.world, x = o.extra || {};
    if (!w.settings.sandbox) return;
    const p = w.players[x.player | 0];
    if (!p) return;
    if (o.name === 'SandboxSpawn') this.spawn(p, x);
    else if (o.name === 'SandboxOre') p.resources.give(clamp(x.amount | 0, 0, 1000000));
    else if (o.name === 'SandboxClear') for (const a of w.actors.slice()) if (a.owner === p && a.health && !a.dead) w.removeActor(a);
  }
  spawn(p, x) {
    const w = this.world, b = w.bounds;
    const types = (Array.isArray(x.types) ? x.types : []).slice(0, 60).filter((t) => {
      const info = w.rules.actors.get(String(t));
      return info && info.has('Health') && info.has('Flight') && !info.has('ProductionQueue');
    });
    if (!types.length || !Array.isArray(x.at)) return;
    const [cx, cy, cz] = x.at.map((v) => v | 0);
    const face = Array.isArray(x.attack) ? x.attack.map((v) => v | 0) : [(b.x0 + b.x1) >> 1, (b.y0 + b.y1) >> 1, 0];
    const yaw = angleOf(face[0] - cx, face[1] - cy);
    const c = COS(yaw), s = SIN(yaw);
    types.forEach((type, i) => {
      // rows of six across the line of advance, 3 cells apart
      const row = Math.trunc(i / 6);
      const l = ((2 * (i % 6) - 5) * 3 * CELL) >> 1, f = -row * 3 * CELL;
      const px = clamp(cx + Math.trunc((c * f - s * l) / 1024), b.x0, b.x1);
      const py = clamp(cy + Math.trunc((s * f + c * l) / 1024), b.y0, b.y1);
      const pz = clamp(cz + ((i % 3) - 1) * CELL, b.z0, b.z1);
      const a = w.createActor(type, p, { x: px, y: py, z: pz, yaw });
      if (Array.isArray(x.attack) && a.attack) a.queueActivity(new AttackMove(face[0], face[1], face[2]));
    });
  }
}, {});
