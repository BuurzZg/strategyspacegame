import { defineTrait, Trait } from '../engine/traits.js';
import { distSq3 } from '../engine/math.js';

// How far a ship (or station) sees on a map with sensor fog. Nebulae halve it.
defineTrait('Sensors', class extends Trait {}, { Range: 9000 });

// ---------------------------------------------------------------- sensor fog
// World trait, on when settings.fog is set (maps on the voyage). Each player sees the ships of
// others only within sensor range of one of its own; inside a nebula, seeing and being seen both
// happen at half the range. What cannot be seen cannot be targeted (World.canSee), by you or by
// anyone else, and the last place each was seen is remembered (for the Tactical Plot). Allies,
// derelicts and deposits are always seen. Scanned every 10 ticks, deterministically.
defineTrait('Shroud', class extends Trait {
  worldLoaded() {
    const w = this.world;
    this.on = !!w.settings.fog;
    w.shroud = this;
    // the voyage's sensor upgrades (percent) for the player whose slot sets it
    for (const p of w.players) { p.seen = new Set(); p.lastSeen = new Map(); p.sensorPct = (p.slot && p.slot.sensorPct) || 100; }
    this.scan();
  }
  tick() { if (this.on && this.world.frame % 10 === 0) this.scan(); }
  inNebula(a) {
    for (const n of this.world.nebulae || []) if (distSq3(a.x, a.y, a.z, n.at[0], n.at[1], n.at[2]) <= n.radius * n.radius) return true;
    return false;
  }
  scan() {
    if (!this.on) return;
    const w = this.world;
    const live = w.actors.filter((a) => !a.dead && a.health);
    const fogged = new Map(live.map((a) => [a.id, this.inNebula(a)]));
    for (const p of w.players) {
      if (p.isNeutral) continue;
      const eyes = [];
      for (const a of live) {
        if (a.owner !== p) continue;
        const s = a.info.traitInfo('Sensors');
        if (!s) continue;
        let r = Math.trunc((s.Range * p.sensorPct) / 100);
        if (fogged.get(a.id)) r >>= 1;
        eyes.push([a.x, a.y, a.z, r]);
      }
      const seen = new Set();
      for (const a of live) {
        if (a.owner === p || a.owner.isNeutral || p.isAlly(a.owner)) continue;
        const half = fogged.get(a.id);
        // (seen when any of its hull is in range: a great hull is seen by its flank, not its middle)
        const big = (a.health.info.Radius | 0) + (a.health.info.HalfLength | 0) > 1500;
        for (const [x, y, z, r0] of eyes) {
          const r = half ? r0 >> 1 : r0;
          if (big ? w.edgeDistPoint(x, y, z, a) <= r : distSq3(a.x, a.y, a.z, x, y, z) <= r * r) { seen.add(a.id); break; }
        }
      }
      p.seen = seen;
      for (const id of seen) { const a = w.actorById.get(id); p.lastSeen.set(id, { x: a.x, y: a.y, z: a.z, type: a.type, owner: a.owner.index, frame: w.frame }); }
      for (const id of [...p.lastSeen.keys()]) { const a = w.actorById.get(id); if (!a || a.dead) p.lastSeen.delete(id); }
    }
  }
  visible(p, a) {
    if (!this.on || !p || !a || !a.health || a.owner === p || a.owner.isNeutral || p.isNeutral || p.isAlly(a.owner)) return true;
    return p.seen.has(a.id);
  }
}, {});
