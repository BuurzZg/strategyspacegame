import { defineTrait, Trait } from '../engine/traits.js';
import { distSq3 } from '../engine/math.js';

// Monsters. Not a faction: no standing, and they fight everyone.

// A Scrapwyrm lies buried (unseen, not targetable, still) until an enemy comes within
// StrikeRange; then it surfaces and fights. After Rest ticks with nothing near, it burrows again.
defineTrait('Burrows', class extends Trait {
  created() { this.self.burrowed = true; this.quiet = 0; }
  tick() {
    const self = this.self, w = this.world;
    if (self.burrowed) {
      if (self.mobile) self.mobile.speed = 0;
      if (w.frame % 10) return;
      const r2 = this.info.StrikeRange * this.info.StrikeRange;
      const prey = w.actors.find((a) => !a.dead && a.health && self.owner.isEnemy(a.owner) && distSq3(a.x, a.y, a.z, self.x, self.y, self.z) <= r2);
      if (!prey) return;
      self.burrowed = false;
      this.quiet = 0;
      w.fx({ t: 'surface', actor: self.id, x: self.x, y: self.y, z: self.z });
      return;
    }
    const scan = self.info.traitInfo('AutoTarget')?.ScanRange || 7000, s2 = scan * scan;
    const near = w.actors.some((a) => !a.dead && a.health && self.owner.isEnemy(a.owner) && distSq3(a.x, a.y, a.z, self.x, self.y, self.z) <= s2);
    this.quiet = near ? 0 : this.quiet + 1;
    if (this.quiet >= this.info.Rest && self.isIdle) { self.burrowed = true; w.fx({ t: 'burrow', actor: self.id, x: self.x, y: self.y, z: self.z }); }
  }
}, { StrikeRange: 6000, Rest: 750 });

// Interdicts: within Range of a spooling Forge, it shakes the Skein loose (see Skein in poi.js).
defineTrait('Interdicts', class extends Trait {}, { Range: 20000 });
