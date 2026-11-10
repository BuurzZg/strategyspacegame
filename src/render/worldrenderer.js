import * as THREE from '../../lib/three.module.js';
import { buildShip } from './ships.js';
import { buildAsteroid } from './asteroids.js';
import { Effects } from './effects.js';
import { R } from './space.js';
import { yawRate } from '../traits/flight.js';

const TAU = Math.PI * 2;
const RALLY = 0xc9a7ff;
const ORE = 0xffb070;
// mining beams: one persistent additive cylinder per collector, base at the origin, length 1
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0);
const beamUp = new THREE.Vector3(0, 1, 0);
const beamRay = new THREE.Raycaster();
const toRad = (a) => (a / 1024) * TAU;
const lerpAngle = (a, b, t) => { let d = (b - a) & 1023; if (d > 512) d -= 1024; return a + d * t; };

export function factionStyle(info) {
  return { id: info.InternalName, name: info.Name, color: parseInt(info.Color, 16), glow: parseInt(info.Glow, 16), dark: parseInt(info.Dark, 16), css: `#${info.Color}` };
}

// Reads the simulation and draws it. Never writes to it.
export class WorldRenderer {
  constructor(scene, world, viewer) {
    this.scene = scene;
    this.world = world;
    this.viewer = viewer;
    this.styles = new Map([...world.factions].map(([k, v]) => [k, factionStyle(v)]));
    this.views = new Map();
    this.selected = new Set();
    this.hover = null;
    this.fx = new Effects(scene);
    this.tmp = new THREE.Vector3();
    // destination lines for selected ships
    this.goalGeo = new THREE.BufferGeometry();
    this.goalPos = new Float32Array(6 * 128);
    this.goalGeo.setAttribute('position', new THREE.BufferAttribute(this.goalPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.goalLines = new THREE.LineSegments(this.goalGeo, new THREE.LineBasicMaterial({ color: 0x9ff3e6, transparent: true, opacity: 0.45, depthWrite: false }));
    this.goalLines.frustumCulled = false;
    scene.add(this.goalLines);
    // the Forge's rally point: a dashed line from the Forge to a spinning beacon
    this.showRally = false;
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3).setUsage(THREE.DynamicDrawUsage));
    this.rallyLine = new THREE.Line(rg, new THREE.LineDashedMaterial({ color: RALLY, dashSize: 1.6, gapSize: 1.1, transparent: true, opacity: 0.6, depthWrite: false }));
    this.rallyLine.frustumCulled = false;
    this.rallyMark = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), new THREE.MeshBasicMaterial({ color: RALLY, wireframe: true, transparent: true, opacity: 0.9, depthWrite: false }));
    this.rallyLine.visible = this.rallyMark.visible = false;
    scene.add(this.rallyLine, this.rallyMark);
  }

  styleOf(player) { return this.styles.get(player.faction) || this.styles.values().next().value; }

  makeView(a) {
    const wm = a.info.traitInfo('WithModel');
    if (!wm || !wm.Model) return null;
    const style = this.styleOf(a.owner);
    const model = wm.Model === 'asteroid' ? buildAsteroid(a.id) : buildShip(wm.Model, style);
    model.root.rotation.order = 'YZX';
    this.scene.add(model.root);
    const radius = a.asteroid ? a.asteroid.radius() * R : (a.info.traitInfo('Selectable')?.Radius || 800) * R;
    return { actor: a, model, style, roll: 0, radius, pos: new THREE.Vector3() };
  }

  syncViews() {
    for (const a of this.world.actors) if (!this.views.has(a.id) && !a.dead) { const v = this.makeView(a); if (v) this.views.set(a.id, v); }
    for (const [id, v] of this.views) if (v.actor.disposed || v.actor.dead) { this.scene.remove(v.model.root); if (v.beam) this.scene.remove(v.beam); this.views.delete(id); this.selected.delete(v.actor); }
  }

  // Interpolated render-space position of an actor (alpha in [0,1] between ticks).
  renderPos(a, alpha, out = this.tmp) {
    return out.set((a.px + (a.x - a.px) * alpha) * R, (a.pz + (a.z - a.pz) * alpha) * R, (a.py + (a.y - a.py) * alpha) * R);
  }

  update(t, dt, alpha) {
    this.syncViews();
    const glowColor = new THREE.Color();
    for (const v of this.views.values()) {
      const a = v.actor, m = v.model;
      this.renderPos(a, alpha, v.pos);
      m.root.position.copy(v.pos);
      const yaw = lerpAngle(a.pyaw, a.yaw, alpha), pitch = a.ppitch + (a.pitch - a.ppitch) * alpha;
      m.root.rotation.set(0, -toRad(yaw), toRad(pitch));
      // bank into turns (visual only)
      const bank = a.mobile ? a.mobile.info.Bank : 0;
      const targetRoll = Math.max(-1, Math.min(1, -yawRate(a) / 6)) * (bank / 57.3);
      v.roll += (targetRoll - v.roll) * Math.min(1, dt * 3);
      for (const sp of m.spin) sp.obj.rotation.x += sp.speed * dt;
      if (a.asteroid) {
        // rocks shrink as they are mined; the crystals keep glowing until the last of the ore
        v.radius = a.asteroid.radius() * R;
        m.root.scale.setScalar(v.radius);
        continue;
      }
      m.body.rotation.x = v.roll;
      if (m.gauge) m.gauge.scale.x = Math.max(0.02, a.collector.cargo / a.collector.info.Capacity);
      if (a.collector) this.collectorFx(a, v);
      // engines: flare size follows throttle, trails when moving
      const sp = a.mobile ? a.mobile.pspeed + (a.mobile.speed - a.mobile.pspeed) * alpha : 0;
      const throttle = a.mobile ? Math.min(1, sp / a.mobile.info.MaxSpeed) : 0;
      m.engines.forEach((e, i) => {
        const fl = m.flares[i];
        fl.scale.setScalar(e.size * (0.6 + throttle * 1.6 + Math.sin(t * 40 + i) * 0.05));
        fl.material.opacity = 0.35 + throttle * 0.65;
        if (throttle > 0.05) {
          const p = fl.getWorldPosition(this.tmp);
          glowColor.setHex(v.style.glow);
          this.fx.glow.spawn(p.x, p.y, p.z, 0, 0, 0, 0.45 + throttle * 0.9, e.size * 0.9 * throttle + 0.15, 0.05, glowColor, 0.55 * throttle);
        }
      });
    }
    this.updateGoalLines(alpha);
    this.updateRally(t, alpha);
    this.fx.update(dt);
  }

  // Mining beam from a collector's scoop to the rock; ore stream while it unloads into a dock.
  collectorFx(a, v) {
    const c = a.collector, frame = this.world.frame, col = new THREE.Color(ORE);
    const tv = c.miningFrame >= frame - 2 ? this.views.get(c.target) : null;
    if (v.beam) v.beam.visible = !!tv;
    if (tv) {
      const nose = v.model.body.localToWorld((v.model.nose || new THREE.Vector3(1, 0, 0)).clone());
      // the beam ends where it meets the rock's actual surface
      const toRock = tv.pos.clone().sub(nose);
      beamRay.set(nose, toRock.clone().normalize());
      beamRay.far = toRock.length();
      const hit = tv.model.rockMesh && beamRay.intersectObject(tv.model.rockMesh, false)[0];
      const surf = hit ? hit.point : nose.clone().sub(tv.pos).setLength(tv.radius * 0.9).add(tv.pos);
      if (!v.beam) {
        v.beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: ORE, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        v.beam.renderOrder = 6;
        this.scene.add(v.beam);
      }
      const d = surf.clone().sub(nose), w = 0.09 + Math.random() * 0.05;
      v.beam.position.copy(nose);
      v.beam.quaternion.setFromUnitVectors(beamUp, d.clone().normalize());
      v.beam.scale.set(w, d.length(), w);
      v.beam.material.opacity = 0.55 + Math.random() * 0.35;
      if (Math.random() < 0.5) this.fx.glow.spawn(surf.x, surf.y, surf.z, 0, 0, 0, 0.15, 0.9, 0.3, col, 0.8);
      if (Math.random() < 0.35) {
        const d = nose.clone().sub(surf);
        this.fx.glow.spawn(surf.x, surf.y, surf.z, d.x / 0.4, d.y / 0.4, d.z / 0.4, 0.4, 0.35, 0.12, col, 0.9);
      }
    } else if (c.unloadFrame >= frame - 2) {
      const dock = this.views.get(c.dock);
      if (!dock || Math.random() < 0.4) return;
      const target = dock.pos.clone();
      const d = target.sub(v.pos).setLength(Math.min(3, target.length()));
      this.fx.glow.spawn(v.pos.x, v.pos.y - 0.3, v.pos.z, d.x / 0.5, d.y / 0.5 - 1, d.z / 0.5, 0.5, 0.45, 0.15, col, 0.9);
    }
  }

  updateRally(t, alpha) {
    const forge = this.showRally ? this.world.actors.find((a) => a.owner === this.viewer && !a.dead && a.has('ProductionQueue')) : null;
    const pt = forge && forge.trait('RallyPoint')?.point;
    this.rallyLine.visible = this.rallyMark.visible = !!pt;
    if (!pt) return;
    const s = this.renderPos(forge, alpha), x = pt.x * R, y = pt.z * R, z = pt.y * R;
    this.rallyLine.geometry.attributes.position.array.set([s.x, s.y, s.z, x, y, z]);
    this.rallyLine.geometry.attributes.position.needsUpdate = true;
    this.rallyLine.computeLineDistances();
    this.rallyMark.position.set(x, y, z);
    this.rallyMark.rotation.y = t * 1.4;
  }

  updateGoalLines(alpha) {
    let n = 0;
    const p = this.goalPos;
    for (const a of this.selected) {
      if (a.dead || !a.mobile || !a.mobile.goal || n >= 126) continue;
      const g = a.mobile.goal;
      const s = this.renderPos(a, alpha);
      p.set([s.x, s.y, s.z, g.x * R, g.z * R, g.y * R], n * 6); n++;
      // small cross at the destination
      const x = g.x * R, y = g.z * R, z = g.y * R, c = 0.8;
      p.set([x - c, y, z, x + c, y, z], n * 6); n++;
      p.set([x, y, z - c, x, y, z + c], n * 6); n++;
    }
    this.goalGeo.setDrawRange(0, n * 2);
    this.goalGeo.attributes.position.needsUpdate = true;
  }

  // Render-side reactions to simulation events (world.fxEvents).
  consumeEvents(events) {
    const c = new THREE.Color();
    for (const e of events) {
      if (e.t === 'deposit') {
        // a flash of molten ore as the hold empties
        c.setHex(0xffa860);
        this.fx.glow.spawn(e.x * R, e.z * R - 0.3, e.y * R, 0, 0, 0, 0.45, 0.8, 3.5, c, 0.9);
      } else if (e.t === 'depleted') {
        // the last ore is taken: the rock cracks apart
        const x = e.x * R, y = e.z * R, z = e.y * R, r = e.radius * R * 0.6;
        c.setHex(0x8a7466);
        for (let i = 0; i < 26; i++) {
          const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
          const s = 1.5 + Math.random() * 3;
          this.fx.smoke.spawn(x + dir.x * r, y + dir.y * r, z + dir.z * r, dir.x * s, dir.y * s, dir.z * s, 1.2 + Math.random(), r * 0.5, r * 1.4, c, 0.5, 0, 0.6);
        }
        c.setHex(ORE);
        for (let i = 0; i < 14; i++) {
          const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
          this.fx.glow.spawn(x, y, z, dir.x * 6, dir.y * 6, dir.z * 6, 0.6 + Math.random() * 0.4, 0.4, 0.1, c, 1, 0, 1.5);
        }
      }
      if (e.t === 'ready') {
        // launch flash at the bay mouth
        const owner = this.world.players[e.owner];
        c.setHex(owner ? this.styleOf(owner).glow : 0xffffff);
        const x = e.x * R, y = e.z * R, z = e.y * R;
        this.fx.glow.spawn(x, y, z, 0, 0, 0, 0.5, 1.2, 6, c, 0.9);
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * TAU, b = (Math.random() - 0.5) * 2;
          this.fx.glow.spawn(x, y, z, Math.cos(a) * 3, b * 2, Math.sin(a) * 3, 0.5 + Math.random() * 0.4, 0.5, 0.1, c, 0.8);
        }
      }
    }
  }
}
