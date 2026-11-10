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
}, { HP: 10000, Radius: 512 });

// ---------------------------------------------------------------- player
defineTrait('PlayerResources', class extends Trait {
  created() {
    const slot = this.self.owner.slot;
    this.cash = slot && slot.cash !== undefined ? slot.cash : this.info.Cash;
    this.self.owner.resources = this;
  }
  take(n) { if (this.cash < n) return false; this.cash -= n; return true; }
  give(n) { this.cash += n; }
}, { Cash: 1000 });

// ---------------------------------------------------------------- world: starting fleets
// Each player starts at settings.spawns[spawn] (cells; [x, y, z]) with the listed ships,
// arranged in a loose line abreast facing the centre of the map.
defineTrait('StartingFleet', class extends Trait {
  worldLoaded() {
    const w = this.world, b = w.bounds;
    const spawns = w.settings.spawns || [[96, 96, 0]];
    const extra = w.settings.extraShips || [];
    for (const p of w.players) {
      const [sx, sy, sz] = spawns[p.spawn % spawns.length];
      const cx = Math.trunc((b.x0 + b.x1) / 2), cy = Math.trunc((b.y0 + b.y1) / 2);
      const x0 = sx * CELL, y0 = sy * CELL, z0 = sz * CELL;
      const yaw = x0 === cx && y0 === cy ? 0 : angleTo(x0, y0, cx, cy);
      const ships = [...this.info.Ships, ...(p.index === 0 ? extra : [])];
      ships.forEach((type, i) => {
        const side = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2);
        // offset sideways (perpendicular to the facing) by 3 cells per slot
        const px = x0 - Math.trunc((side * 3 * CELL * SIN(yaw)) / 1024);
        const py = y0 + Math.trunc((side * 3 * CELL * COS(yaw)) / 1024);
        w.createActor(type, p, { x: px, y: py, z: z0, yaw });
      });
    }
  }
}, { Ships: [] });

import { angleOf, sin as SIN, cos as COS } from '../engine/math.js';
function angleTo(x0, y0, x1, y1) { return angleOf(x1 - x0, y1 - y0); }
