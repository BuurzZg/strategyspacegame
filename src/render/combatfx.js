import * as THREE from '../../lib/three.module.js';
import { R } from './space.js';

// Draws the fighting: shots in flight (heads plus tracer streaks), missile smoke, muzzle
// flashes, beams, hits, flak bursts, explosions and tumbling debris. Reads world.effects
// and the world's fx events; never touches the simulation.
const MAX = 3000;
const colorCache = new Map();
const colorOf = (hex, fallback = 0xffffff) => {
  if (!hex) return fallback;
  if (!colorCache.has(hex)) colorCache.set(hex, parseInt(hex, 16));
  return colorCache.get(hex);
};
const tmp = new THREE.Color(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();

export class CombatFx {
  constructor(scene, fx, world) {
    this.scene = scene; this.fx = fx; this.world = world;
    // shot heads: additive points with per-point size and colour
    const g = new THREE.BufferGeometry();
    this.hPos = new Float32Array(MAX * 3); this.hCol = new Float32Array(MAX * 3); this.hSize = new Float32Array(MAX);
    g.setAttribute('position', new THREE.BufferAttribute(this.hPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.hCol, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('psize', new THREE.BufferAttribute(this.hSize, 1).setUsage(THREE.DynamicDrawUsage));
    this.heads = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { scale: { value: 600 } },
      vertexShader: `attribute vec3 pcolor; attribute float psize; varying vec3 vC; uniform float scale;
        void main(){ vC = pcolor; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = max(2.0, psize * scale / max(1.0, -mv.z)); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d);
          if (a < 0.02) discard; gl_FragColor = vec4(mix(vC, vec3(1.0), a * a * 0.6), a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.heads.frustumCulled = false; this.heads.renderOrder = 7;
    // tracer streaks behind each shot
    const tg = new THREE.BufferGeometry();
    this.tPos = new Float32Array(MAX * 6); this.tCol = new Float32Array(MAX * 6);
    tg.setAttribute('position', new THREE.BufferAttribute(this.tPos, 3).setUsage(THREE.DynamicDrawUsage));
    tg.setAttribute('color', new THREE.BufferAttribute(this.tCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.tracers = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.tracers.frustumCulled = false; this.tracers.renderOrder = 7;
    scene.add(this.heads, this.tracers);
    // debris: pooled tumbling chunks
    this.debris = [];
    const dg = [new THREE.TetrahedronGeometry(1, 0), new THREE.BoxGeometry(1.4, 0.5, 0.9), new THREE.OctahedronGeometry(0.8, 0)];
    this.debrisMat = new THREE.MeshStandardMaterial({ color: 0x3a3b44, roughness: 0.8, metalness: 0.5, flatShading: true, emissive: 0x401808, emissiveIntensity: 0.6 });
    for (let i = 0; i < 160; i++) {
      const m = new THREE.Mesh(dg[i % 3], this.debrisMat);
      m.visible = false; scene.add(m);
      this.debris.push({ m, life: 0, max: 1, v: new THREE.Vector3(), spin: new THREE.Vector3(), s: 1 });
    }
    this.nextDebris = 0;
    this.pending = []; // delayed secondary explosions [time, fn]
    this.time = 0;
  }
  setScale(s) { this.heads.material.uniforms.scale.value = s; }

  // ---------------------------------------------------------------- shots in flight
  update(dt, alpha) {
    this.time += dt;
    let n = 0;
    for (const e of this.world.effects) {
      if (n >= MAX) break;
      const x = (e.px + (e.x - e.px) * alpha) * R, y = (e.pz + (e.z - e.pz) * alpha) * R, z = (e.py + (e.y - e.py) * alpha) * R;
      const c = tmp.setHex(colorOf(e.vis && e.vis.Color, 0xffe6a8));
      const size = ((e.vis && e.vis.Size) || 100) * R * 2.2;
      this.hPos.set([x, y, z], n * 3); this.hCol.set([c.r, c.g, c.b], n * 3); this.hSize[n] = size;
      // streak back along the last tick's motion
      const dx = (e.x - e.px) * R, dy = (e.z - e.pz) * R, dz = (e.y - e.py) * R;
      const k = e.kind === 'missile' ? 0.6 : 1.6;
      this.tPos.set([x, y, z, x - dx * k, y - dy * k, z - dz * k], n * 6);
      this.tCol.set([c.r, c.g, c.b, c.r * 0.1, c.g * 0.1, c.b * 0.1], n * 6);
      if (e.kind === 'missile' && Math.random() < 0.8) {
        tmp.setHex(0x8a8f99);
        this.fx.smoke.spawn(x - dx * 0.5, y - dy * 0.5, z - dz * 0.5, 0, 0, 0, 1.2, 0.25, 1.1, tmp, 0.35);
        tmp.setHex(0xffb36b);
        this.fx.glow.spawn(x, y, z, 0, 0, 0, 0.12, 0.9, 0.3, tmp, 0.9);
      }
      n++;
    }
    const hg = this.heads.geometry, tg = this.tracers.geometry;
    hg.setDrawRange(0, n); tg.setDrawRange(0, n * 2);
    hg.attributes.position.needsUpdate = hg.attributes.pcolor.needsUpdate = hg.attributes.psize.needsUpdate = true;
    tg.attributes.position.needsUpdate = tg.attributes.color.needsUpdate = true;
    // debris
    for (const d of this.debris) {
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) { d.m.visible = false; continue; }
      d.m.position.addScaledVector(d.v, dt);
      d.v.multiplyScalar(Math.max(0, 1 - dt * 0.25));
      d.m.rotation.x += d.spin.x * dt; d.m.rotation.y += d.spin.y * dt; d.m.rotation.z += d.spin.z * dt;
      d.m.scale.setScalar(d.s * Math.min(1, d.life / 1.2));
    }
    // delayed secondary blasts
    for (let i = 0; i < this.pending.length; i++) if (this.pending[i][0] <= this.time) { this.pending[i][1](); this.pending.splice(i--, 1); }
  }

  // ---------------------------------------------------------------- one-off effects
  flash(x, y, z, size, color, life = 0.12) { tmp.setHex(color); this.fx.glow.spawn(x, y, z, 0, 0, 0, life, size, size * 0.4, tmp, 1); }
  sparks(x, y, z, color, n, speed, size = 0.35) {
    tmp.setHex(color);
    for (let i = 0; i < n; i++) {
      v1.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      this.fx.glow.spawn(x, y, z, v1.x, v1.y, v1.z, 0.25 + Math.random() * 0.3, size, 0.05, tmp, 1, 0, 1.5);
    }
  }
  puff(x, y, z, n, size, color = 0x2a2630, alpha = 0.5) {
    tmp.setHex(color);
    for (let i = 0; i < n; i++) {
      v1.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(size * (0.5 + Math.random()));
      this.fx.smoke.spawn(x + v1.x * 0.3, y + v1.y * 0.3, z + v1.z * 0.3, v1.x, v1.y, v1.z, 1.4 + Math.random(), size * 0.5, size * 1.6, tmp, alpha, 0, 0.9);
    }
  }
  // A spherical blast of radius r (render units): white-hot core, fireball, smoke, sparks.
  blast(x, y, z, r, color = 0xffa24a) {
    this.flash(x, y, z, r * 4, 0xfff3d8, 0.22);
    tmp.setHex(color);
    const n = Math.min(40, 8 + Math.round(r * 6));
    for (let i = 0; i < n; i++) {
      v1.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(r * (1.5 + Math.random() * 3));
      this.fx.glow.spawn(x, y, z, v1.x, v1.y, v1.z, 0.35 + Math.random() * 0.5, r * 0.9, r * 0.2, tmp, 1, 0, 1.8);
    }
    this.puff(x, y, z, Math.min(16, 3 + Math.round(r * 2)), r * 1.2);
    this.sparks(x, y, z, 0xffd9a0, Math.min(24, 6 + Math.round(r * 4)), r * 6);
  }
  throwDebris(x, y, z, r, count, vel) {
    for (let i = 0; i < count; i++) {
      const d = this.debris[this.nextDebris++ % this.debris.length];
      d.m.position.set(x, y, z);
      d.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(r * (1 + Math.random() * 2.5)).add(vel);
      d.spin.set(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2);
      d.s = r * (0.08 + Math.random() * 0.12);
      d.life = d.max = 2.5 + Math.random() * 2.5;
      d.m.visible = true;
    }
  }

  consume(events, views) {
    const rules = this.world.rules;
    for (const e of events) {
      const x = e.x * R, y = e.z * R, z = e.y * R;
      switch (e.t) {
        case 'fire': {
          const wpn = rules.weapons.get(e.weapon);
          const c = colorOf(wpn && wpn.projectile.Color, 0xffe6a8);
          this.flash(x, y, z, Math.max(0.5, ((wpn && wpn.projectile.Size) || 100) * R * 3), c, 0.08);
          break;
        }
        case 'beam': {
          v1.set(e.x0 * R, e.z0 * R, e.y0 * R); v2.set(e.x1 * R, e.z1 * R, e.y1 * R);
          const c = colorOf(e.color, 0xd8f7ff);
          this.fx.beam(v1, v2, c, Math.max(0.12, (e.size || 100) * R * 0.9), 0.35);
          this.flash(v1.x, v1.y, v1.z, 2.2, c, 0.25);
          this.flash(v2.x, v2.y, v2.z, 3.2, c, 0.3);
          this.sparks(v2.x, v2.y, v2.z, c, 10, 8);
          break;
        }
        case 'bite': this.sparks(e.x1 * R, e.z1 * R, e.y1 * R, colorOf(e.color, 0xe9b8ff), 8, 5); break;
        case 'impact':
          if (e.missile) this.blast(x, y, z, 0.9, 0xffa24a);
          else if (e.hit) { this.flash(x, y, z, Math.max(0.6, (e.size || 100) * R * 4), colorOf(e.color), 0.12); this.sparks(x, y, z, colorOf(e.color), 4, 4, 0.25); }
          break;
        case 'burst':
          this.flash(x, y, z, 2.2, 0xffd38a, 0.15);
          this.puff(x, y, z, 3, 0.9, 0x3a3436, 0.45);
          break;
        case 'explosion':
          if (e.kind === 'plasma') { this.flash(x, y, z, 5, 0xb8f0ff, 0.3); this.sparks(x, y, z, 0xb8f0ff, 14, 7); this.fx.ring(x, y - 0.2, z, 3, 0xb8f0ff, 0.4); }
          else if (e.kind === 'torpedo') this.blast(x, y, z, 1.6, 0xffa24a);
          else this.flash(x, y, z, 1.5, 0xffd9a0, 0.15);
          break;
        case 'killed': {
          const r = Math.max(0.6, (e.radius || 400) * R);
          const v = views.get(e.actor);
          const vel = v ? v3fromActor(v.actor) : new THREE.Vector3();
          this.blast(x, y, z, r, 0xffa24a);
          this.throwDebris(x, y, z, r, Math.min(18, 3 + Math.round(r * 3)), vel);
          this.fx.ring(x, y - 0.2, z, r * 5, 0xffc890, 0.6);
          // big hulls go up in stages
          if (r > 2.5) for (let i = 1; i <= 3; i++) {
            const ox = (Math.random() - 0.5) * r * 2, oy = (Math.random() - 0.5) * r, oz = (Math.random() - 0.5) * r * 2;
            this.pending.push([this.time + i * 0.25 + Math.random() * 0.2, () => this.blast(x + ox, y + oy, z + oz, r * 0.6)]);
          }
          break;
        }
      }
    }
  }
}

// A dead ship's last velocity, in render units per second (for its debris).
function v3fromActor(a) {
  return new THREE.Vector3((a.x - a.px) * R * 25, (a.z - a.pz) * R * 25, (a.y - a.py) * R * 25);
}
