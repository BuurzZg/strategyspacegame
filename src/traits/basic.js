import { defineTrait, Trait } from '../engine/traits.js';
import { CELL } from '../engine/math.js';

// ---------------------------------------------------------------- info-only traits
defineTrait('Tooltip', class extends Trait {}, { Name: '', Class: '', Role: '', Description: '' });
defineTrait('Valued', class extends Trait {}, { Cost: 0 });
defineTrait('Armor', class extends Trait {}, { Type: 'light' });
defineTrait('Selectable', class extends Trait {}, { Radius: 1024, Priority: 10 });
defineTrait('WithModel', class extends Trait {}, { Model: '', Scale: 100 });

// World traits
defineTrait('Faction', class extends Trait {}, { InternalName: '', Name: '', Color: 'ffffff', Glow: 'ffffff', Dark: '000000', Description: '' });

// ---------------------------------------------------------------- Health
// Radius: the hull's half-width. HalfLength > 0 makes the hull a capsule: a line along the
// nose, HalfLength each way from the centre, with Radius around it (long hulls like the Forge).
defineTrait('Health', class Health extends Trait {
  created() {
    this.hp = this.info.HP;
    this.maxHp = this.info.HP;
    this.lastDamaged = -100000;
    this.self.health = this;
  }
  damage(attacker, amount, byPlayer) {
    const self = this.self;
    if (self.dead || amount <= 0) return;
    this.hp -= amount;
    this.lastDamaged = self.world.frame;
    self.notify('damaged', { attacker, amount, by: byPlayer });
    if (this.hp <= 0) { this.hp = 0; this.kill(attacker, byPlayer); }
  }
  heal(amount) { if (!this.self.dead) this.hp = Math.min(this.maxHp, this.hp + amount); }
  kill(attacker, byPlayer) {
    const self = this.self, world = self.world;
    if (self.dead) return;
    self.dead = true;
    self.cancelActivity();
    self.activity = null;
    self.notify('killed', { attacker, by: byPlayer });
    world.fx({ t: 'killed', actor: self.id, type: self.type, x: self.x, y: self.y, z: self.z, owner: self.owner.index, radius: this.info.Radius });
    world.emit('killed', self, attacker, byPlayer);
    world.addFrameEndTask((w) => w.removeActor(self));
  }
}, { HP: 10000, Radius: 512, HalfLength: 0 });

// ---------------------------------------------------------------- world: starting fleets
// Each player starts at settings.spawns[spawn] (cells; [x, y, z]) facing the centre of the map.
// The first ship in the list (the Forge) sits on the spawn point; the rest form a line
// abreast ahead of it, 3 cells apart.
defineTrait('StartingFleet', class extends Trait {
  worldLoaded() {
    const w = this.world, b = w.bounds;
    const spawns = w.settings.spawns || [[96, 96, 0]];
    const extra = w.settings.extraShips || [];
    for (const p of w.players) {
      const [sx, sy, sz] = spawns[p.spawn % spawns.length];
      const cx = Math.trunc((b.x0 + b.x1) / 2), cy = Math.trunc((b.y0 + b.y1) / 2);
      const x0 = sx * CELL, y0 = sy * CELL, z0 = sz * CELL;
      const yaw = x0 === cx && y0 === cy ? 0 : angleOf(cx - x0, cy - y0);
      const ships = [...(w.settings.startingShips || this.info.Ships), ...(p.index === 0 ? extra : [])];
      if (!ships.length) continue;
      const flagship = w.createActor(ships[0], p, { x: x0, y: y0, z: z0, yaw });
      // escorts line up ahead of a big flagship (clear of its whole hull), or beside a small one
      const reach = flagship.health ? flagship.health.info.Radius + flagship.health.info.HalfLength : 0;
      const big = reach > 2 * CELL;
      const f = big ? reach + 3 * CELL : 0;
      ships.slice(1).forEach((type, j) => {
        const i = big ? j : j + 1;
        const side = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2);
        const l = side * 3 * CELL;
        w.createActor(type, p, { x: x0 + Math.trunc((COS(yaw) * f - SIN(yaw) * l) / 1024), y: y0 + Math.trunc((SIN(yaw) * f + COS(yaw) * l) / 1024), z: z0, yaw });
      });
    }
  }
}, { Ships: [] });

import { angleOf, sin as SIN, cos as COS } from '../engine/math.js';
