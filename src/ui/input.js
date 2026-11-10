import * as THREE from '../../lib/three.module.js';
import { makeOrder, makeWorldOrder } from '../engine/order.js';
import { R } from '../render/space.js';
import { MoveWidget } from './movewidget.js';
import { FORMATIONS, slotTemplate } from '../traits/formation.js';
import { STANCES } from '../traits/combat.js';
import { VERBS } from './hud.js';
import { sin as SIN, cos as COS, angleOf } from '../engine/math.js';

// Mouse and keyboard → selection, camera and Orders.
//   Left click / drag     select / box select (Shift adds)     Double-click  select + focus
//   Right-drag            rotate camera       Scroll  zoom      Middle-drag  pan
//   Right-click (space)   open the move disc  M  same            F  focus and follow selection
//   In move mode: move the mouse over the plane, hold Shift and move up/down for height,
//   left-click to confirm, right-click or Esc to cancel.
//   B  production panel     R  place the Forge's rally point (same disc, tinted lilac)
//   Home  select and focus the Forge     G  Proving Grounds panel (sandbox)
//   Right-click an enemy  attack it      Ctrl + left-click on the disc  advance, fighting on the way
//   T  cycle formation (Wall, Sphere, Wedge, Column, Ring, Loose)   V  cycle stance
//   Ctrl + 1-9  make a control group   1-9  select it (Shift adds; press twice to jump to it)
const DRAG = 5;
export const RALLY = 0xc9a7ff;

export class Input {
  constructor(canvas, session, hud, audio) {
    this.canvas = canvas;
    this.s = session;
    this.world = session.world;
    this.viewer = session.viewer;
    this.renderer = session.renderer;
    this.orbit = session.orbit;
    this.cam = session.camera;
    this.hud = hud;
    this.audio = audio;
    this.selection = [];
    this.mx = 0; this.my = 0;
    this.buttons = new Map(); // button -> { x, y, moved }
    this.box = null;
    this.keys = new Set();
    this.hover = null;
    this.lastClick = { t: 0, id: 0 };
    this.ray = new THREE.Raycaster();
    this.widget = new MoveWidget(session.scene);
    this.move = null; // { center, height, anchorY, anchorH, onPlane, dest }
    this.groups = Array.from({ length: 10 }, () => []); // control groups: actor ids
    this.lastGroup = { n: -1, t: 0 };
    this.listeners = [];
    this.bind();
  }

  on(t, ev, fn, o) { t.addEventListener(ev, fn, o); this.listeners.push([t, ev, fn, o]); }
  dispose() { for (const [t, e, f, o] of this.listeners) t.removeEventListener(e, f, o); }

  bind() {
    const c = this.canvas;
    this.on(c, 'contextmenu', (e) => e.preventDefault());
    this.on(c, 'pointerdown', (e) => this.down(e));
    this.on(window, 'pointermove', (e) => this.moveEv(e));
    this.on(window, 'pointerup', (e) => this.up(e));
    this.on(c, 'wheel', (e) => { e.preventDefault(); this.orbit.zoom(e.deltaY); }, { passive: false });
    this.on(c, 'dblclick', (e) => e.preventDefault());
    this.on(window, 'keydown', (e) => this.keyDown(e));
    this.on(window, 'keyup', (e) => this.keyUp(e));
    this.on(window, 'blur', () => { this.keys.clear(); this.buttons.clear(); });
  }

  // ---------------------------------------------------------- picking
  ndc(x, y) { const r = this.canvas.getBoundingClientRect(); return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); }
  project(v) {
    const p = v.clone().project(this.cam), r = this.canvas.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height, z: p.z };
  }
  // On-screen radius (px) of a sphere of radius r (render units) at v.
  screenRadius(v, r) {
    const d = this.cam.position.distanceTo(v);
    return (r / Math.max(0.01, d)) * (this.canvas.clientHeight / (2 * Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2))));
  }
  pick(x, y) {
    let best = null, bs = Infinity;
    for (const v of this.renderer.views.values()) {
      if (v.actor.dead) continue;
      const p = this.project(v.pos);
      if (p.z > 1 || p.z < -1) continue;
      const rpx = Math.max(10, this.screenRadius(v.pos, v.radius));
      const d = Math.hypot(p.x - x, p.y - y);
      // closest to its own centre, relative to its size: a Gleaner sitting on the Forge's prow
      // wins over the Forge around it
      if (d < rpx && d / rpx < bs) { bs = d / rpx; best = v.actor; }
    }
    return best;
  }
  isMine(a) { return a.owner === this.viewer; }
  isEnemy(a) { return this.viewer.isEnemy(a.owner); }
  // ships that manoeuvre to fight (the Forge's turrets fire on their own and it never chases)
  armed() { return this.own().filter((a) => a.attack && a.mobile && a.attack.info.Style !== 'turret'); }
  forge() { return this.world.actors.find((a) => a.owner === this.viewer && !a.dead && a.has('ProductionQueue')) || null; }
  own() { return this.selection.filter((a) => !a.dead && this.isMine(a)); }

  setSelection(list, sound = true) {
    this.selection = list.filter((a) => !a.dead);
    this.renderer.selected = new Set(this.selection);
    if (sound && list.length) this.audio.play('select');
    this.hud.selectionChanged();
  }
  center(list) {
    const c = new THREE.Vector3();
    for (const a of list) c.add(this.renderer.views.get(a.id)?.pos || c);
    return c.multiplyScalar(1 / Math.max(1, list.length));
  }

  // ---------------------------------------------------------- move mode
  // mode 'move': plot a course for the selected ships. mode 'rally': place the Forge's rally point.
  beginMove(mode = 'move') {
    const ships = mode === 'rally' ? [this.forge()].filter(Boolean) : this.own().filter((a) => a.mobile);
    if (!ships.length) return;
    if (this.move) this.cancelMove();
    const center = this.center(ships);
    this.move = { mode, ships, center, height: 0, anchorY: null, anchorH: 0, onPlane: center.clone(), dest: center.clone() };
    this.widget.setTint(mode === 'rally' ? RALLY : undefined);
    this.widget.show();
    this.updateMove();
    this.hud.modeChanged();
  }
  cancelMove() { this.move = null; this.widget.hide(); this.hud.modeChanged(); }
  updateMove() {
    const m = this.move;
    if (!m) return;
    const b = this.s.renderBounds;
    if (this.keys.has('shift')) {
      // height: vertical mouse motion, scaled to the distance of the destination from the camera
      if (m.anchorY === null) { m.anchorY = this.my; m.anchorH = m.height; }
      const perPx = (2 * Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)) * this.cam.position.distanceTo(m.onPlane)) / this.canvas.clientHeight;
      m.height = m.anchorH + (m.anchorY - this.my) * perPx;
    } else {
      m.anchorY = null;
      this.ray.setFromCamera(this.ndc(this.mx, this.my), this.cam);
      const o = this.ray.ray.origin, d = this.ray.ray.direction;
      if (Math.abs(d.y) > 1e-4) {
        const t = (m.center.y - o.y) / d.y;
        if (t > 0) m.onPlane.set(o.x + d.x * t, m.center.y, o.z + d.z * t);
        else m.onPlane.copy(m.center); // looking away from the plane
      }
      m.onPlane.x = Math.max(b.x0, Math.min(b.x1, m.onPlane.x));
      m.onPlane.z = Math.max(b.z0, Math.min(b.z1, m.onPlane.z));
    }
    m.height = Math.max(b.y0 - m.center.y, Math.min(b.y1 - m.center.y, m.height));
    m.dest.set(m.onPlane.x, m.center.y + m.height, m.onPlane.z);
  }
  moveShips() { return this.move ? (this.move.mode === 'rally' ? this.move.ships.filter((a) => !a.dead) : this.own().filter((a) => a.mobile)) : []; }
  confirmMove() {
    const m = this.move;
    const ships = this.moveShips();
    if (!m || !ships.length) { this.cancelMove(); return; }
    const target = { x: Math.round(m.dest.x / R), y: Math.round(m.dest.z / R), z: Math.round(m.dest.y / R) };
    if (m.mode === 'rally') {
      this.issue('SetRallyPoint', ships, target);
      this.renderer.fx.marker(m.dest.x, m.dest.y, m.dest.z, RALLY);
      this.audio.play('order');
      this.cancelMove();
      return;
    }
    // Ctrl: advance and fight anything met on the way (ships without guns just move)
    const fights = (a) => a.attack && a.attack.info.Style !== 'turret';
    const advance = this.keys.has('control') && ships.some(fights);
    if (advance) {
      const armed = ships.filter(fights), rest = ships.filter((a) => !fights(a));
      this.issue('AttackMove', armed, target);
      if (rest.length) this.issue('Move', rest, target);
    } else this.issue('Move', ships, target);
    this.renderer.fx.marker(m.dest.x, m.dest.y, m.dest.z, advance ? 0xff5a64 : 0x5fe3d0);
    this.audio.play('order');
    this.cancelMove();
    if (!this.orbit.follow) this.followSelection();
    this.hud.firstOrder();
  }
  orderCollectors(name, collectors, target) {
    this.issue(name, collectors, { actor: target });
    const v = this.renderer.views.get(target.id);
    if (v) this.renderer.fx.marker(v.pos.x, v.pos.y, v.pos.z, 0xffb070);
    this.audio.play('order');
    this.hud.firstOrder();
  }
  // What a right-click on `a` would do with the current selection (for the hover label).
  hoverAction(a) {
    if (!a) return null;
    const collectors = this.own().some((s) => s.collector);
    if (a.deposit && this.own().some((s) => s.collector && s.collector.canWork(a))) return VERBS[a.deposit.kind] || 'Gather';
    if (collectors && this.isMine(a) && a.has('OreDropoff') && !this.selection.includes(a)) return 'Unload here';
    if (a.health && this.isEnemy(a) && this.armed().length) return 'Attack';
    if (a.health && this.keys.has('control') && a.owner !== this.viewer && !a.owner.isNeutral && this.armed().length) return 'Attack (declares war)';
    return null;
  }
  // ---------------------------------------------------------- formations, stances, control groups
  fleet() { return this.own().filter((a) => a.mobile); }
  formationOf(ships) { const F = this.world.formations; const g = F && F.exactGroup(ships); return g ? g.type : ships.some((a) => a.formation) ? null : 'loose'; }
  stanceOf(ships) { const m = ships[0] && ships[0].stance && ships[0].stance.mode; return m && ships.every((a) => a.stance && a.stance.mode === m) ? m : null; }
  setFormation(type) {
    const ships = this.fleet();
    if (!ships.length) return;
    this.issue('SetFormation', ships, null, type);
    this.audio.play('order');
    this.hud.selectionChanged();
  }
  cycleFormation() {
    const cur = this.formationOf(this.fleet()), all = [...FORMATIONS, 'loose'];
    this.setFormation(all[(all.indexOf(cur) + 1) % all.length]);
  }
  setStance(mode) {
    const ships = this.own().filter((a) => a.stance);
    if (!ships.length) return;
    this.issue('SetStance', ships, null, mode);
    this.audio.play('select');
    this.hud.selectionChanged();
  }
  cycleStance() { const cur = this.stanceOf(this.own().filter((a) => a.stance)); this.setStance(STANCES[(STANCES.indexOf(cur) + 1) % STANCES.length]); }
  groupNumberOf(a) { for (let i = 1; i <= 9; i++) if (this.groups[i].includes(a.id)) return i; return 0; }
  assignGroup(n) {
    const ids = this.own().map((a) => a.id);
    if (!ids.length) return;
    for (let i = 1; i <= 9; i++) this.groups[i] = this.groups[i].filter((id) => !ids.includes(id));
    this.groups[n] = ids;
    this.audio.play('place');
    this.hud.toast(`Group ${n}: ${ids.length} ship${ids.length > 1 ? 's' : ''}`, 'info');
    this.hud.selectionChanged();
  }
  recallGroup(n, add) {
    const ships = this.groups[n].map((id) => this.world.actorById.get(id)).filter((a) => a && !a.dead);
    this.groups[n] = ships.map((a) => a.id);
    if (!ships.length) return;
    const now = performance.now();
    const twice = this.lastGroup.n === n && now - this.lastGroup.t < 400;
    this.lastGroup = { n, t: now };
    this.setSelection(add ? [...new Set([...this.own(), ...ships])] : ships);
    if (twice) this.focusSelection();
  }
  // Where a formation group's ships will sit at `dest` (render units), facing the way it travels.
  formationGhosts(dest) {
    const F = this.world.formations, ships = this.fleet();
    const g = F && F.exactGroup(ships);
    if (!g) return [];
    const dx = dest.x / R - g.x, dy = dest.z / R - g.y;
    const yaw = Math.abs(dx) + Math.abs(dy) > 512 ? angleOf(Math.round(dx), Math.round(dy)) : g.yaw;
    const c = COS(yaw) / 1024, s = SIN(yaw) / 1024, S = g.spacing;
    return slotTemplate(g.type, g.members.length).map(([f, l, u]) => {
      const fw = (f * S) / 1024, lw = (l * S) / 1024, uw = (u * S) / 1024;
      return { x: dest.x + (c * fw - s * lw) * R, y: dest.y + uw * R, z: dest.z + (s * fw + c * lw) * R };
    });
  }

  selectForge() {
    const f = this.forge();
    if (!f) return;
    this.setSelection([f]);
    this.focusSelection();
  }
  issue(name, subjects, target, extra) { this.s.om.issue(makeOrder(name, subjects, target, extra)); }
  issueWorld(name, extra) { this.s.om.issue(makeWorldOrder(name, extra)); }

  // ---------------------------------------------------------- pointer
  down(e) {
    this.mx = e.clientX; this.my = e.clientY;
    this.audio.init();
    this.buttons.set(e.button, { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false });
    if (e.button === 0 && !this.move) this.box = { x: e.clientX, y: e.clientY, shift: e.shiftKey, active: false };
    this.canvas.setPointerCapture?.(e.pointerId);
  }
  moveEv(e) {
    const dx = e.clientX - this.mx, dy = e.clientY - this.my;
    this.mx = e.clientX; this.my = e.clientY;
    for (const [btn, st] of this.buttons) {
      if (!st.moved && Math.hypot(e.clientX - st.x, e.clientY - st.y) > DRAG) st.moved = true;
      if (!st.moved) continue;
      if (btn === 2) this.orbit.rotate(dx, dy);
      else if (btn === 1) this.orbit.pan(dx, dy);
    }
    if (this.box && this.buttons.get(0)?.moved) this.box.active = true;
    if (this.move && !this.buttons.get(2)?.moved) this.updateMove();
  }
  up(e) {
    const st = this.buttons.get(e.button);
    this.buttons.delete(e.button);
    if (!st) return;
    if (e.button === 0) {
      const box = this.box;
      this.box = null;
      if (this.move) { if (!st.moved) this.confirmMove(); return; }
      if (box && box.active) { this.boxSelect(box, e.clientX, e.clientY); return; }
      this.clickSelect(e.clientX, e.clientY, e.shiftKey);
    } else if (e.button === 2 && !st.moved) {
      if (this.move) { this.cancelMove(); return; }
      const hit = this.pick(e.clientX, e.clientY);
      const collectors = this.own().filter((a) => a.collector);
      // collectors selected: right-click a rock to mine it, or the Forge / a Smelter to unload now
      const workers = hit && hit.deposit ? collectors.filter((c) => c.collector.canWork(hit)) : [];
      if (workers.length) { this.orderCollectors('Harvest', workers, hit); return; }
      if (hit && collectors.length && this.isMine(hit) && hit.has('OreDropoff') && !collectors.includes(hit)) { this.orderCollectors('Dock', collectors, hit); return; }
      // armed ships selected: right-click an enemy to attack it
      const armed = this.armed();
      // Ctrl + right-click: attack anyone who is not yours (on the voyage, that declares war)
      const force = e.ctrlKey && hit && hit.health && hit.owner !== this.viewer && !hit.owner.isNeutral && !hit.owner.isAlly(this.viewer);
      if (hit && armed.length && hit.health && (this.isEnemy(hit) || force)) {
        this.issue('Attack', armed, { actor: hit });
        const v = this.renderer.views.get(hit.id);
        if (v) this.renderer.fx.marker(v.pos.x, v.pos.y, v.pos.z, 0xff5a64);
        this.audio.play('order');
        this.hud.firstOrder();
        return;
      }
      if (hit && this.isMine(hit)) { if (!this.selection.includes(hit)) this.setSelection([hit]); return; }
      if (this.own().some((a) => a.mobile)) { this.beginMove(); this.updateMove(); }
    }
  }
  clickSelect(x, y, additive) {
    const a = this.pick(x, y);
    const now = performance.now();
    if (a && this.lastClick.id === a.id && now - this.lastClick.t < 350) { this.focusSelection(); this.lastClick = { t: 0, id: 0 }; return; }
    this.lastClick = { t: now, id: a ? a.id : 0 };
    if (!a) { if (!additive) this.setSelection([]); return; }
    if (additive) this.setSelection(this.selection.includes(a) ? this.selection.filter((s) => s !== a) : [...this.selection, a]);
    else this.setSelection([a]);
  }
  boxSelect(b, x, y) {
    const lx = Math.min(b.x, x), hx = Math.max(b.x, x), ly = Math.min(b.y, y), hy = Math.max(b.y, y);
    const hits = [];
    for (const v of this.renderer.views.values()) {
      if (v.actor.dead || !this.isMine(v.actor)) continue;
      const p = this.project(v.pos);
      if (p.z < 1 && p.x >= lx && p.x <= hx && p.y >= ly && p.y <= hy) hits.push(v.actor);
    }
    this.setSelection(b.shift ? [...new Set([...this.own(), ...hits])] : hits);
  }
  followSelection() {
    const list = this.selection.filter((a) => !a.dead);
    if (!list.length) return false;
    this.orbit.focusOn(this.center(list), () => { const l = this.selection.filter((a) => !a.dead); return l.length ? this.center(l) : null; });
    return true;
  }
  focusSelection() {
    const list = this.selection.filter((a) => !a.dead);
    if (!this.followSelection()) return;
    const maxR = Math.max(...list.map((a) => this.renderer.views.get(a.id)?.radius || 2));
    const spread = Math.max(...list.map((a) => this.renderer.views.get(a.id)?.pos.distanceTo(this.center(list)) || 0));
    this.orbit.distT = Math.max(this.orbit.minDist, Math.min(400, (maxR * 6 + spread * 2.2)));
  }

  // ---------------------------------------------------------- keys
  keyDown(e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'shift' && !this.keys.has('shift') && this.move) { this.move.anchorY = null; }
    this.keys.add(k);
    if (k === 'escape') { if (this.move) this.cancelMove(); else if (this.hud.buildOpen) this.hud.toggleBuild(false); else this.setSelection([], false); return; }
    if (k === 'm') { if (this.move) this.cancelMove(); else this.beginMove(); return; }
    if (k === 'b') { this.hud.toggleBuild(); return; }
    if (k === 'r') { if (this.move && this.move.mode === 'rally') this.cancelMove(); else this.beginMove('rally'); return; }
    if (k === 'home') { e.preventDefault(); this.selectForge(); return; }
    if (k === 'g') { this.hud.toggleGrounds(); return; }
    if (k === 't') { this.cycleFormation(); return; }
    if (k === 'v') { this.cycleStance(); return; }
    const digit = /^Digit([1-9])$/.exec(e.code || '');
    if (digit) {
      const n = +digit[1];
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.assignGroup(n); } else this.recallGroup(n, e.shiftKey);
      return;
    }
    if (k === 'f') { this.focusSelection(); return; }
    if (k === 'h' || k === '?') { this.hud.toggleHelp(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'a') { e.preventDefault(); this.setSelection(this.world.actors.filter((a) => this.isMine(a) && a.mobile)); return; }
    if (k === 'backspace' || k === 'delete') { const u = this.own().filter((a) => a.mobile); if (u.length) this.issue('Stop', u); }
  }
  keyUp(e) {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
    if (k === 'shift' && this.move) { this.move.anchorY = null; this.updateMove(); }
  }

  update(dt) {
    let dx = 0, dz = 0, rot = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) dz += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dz -= 1;
    if (this.keys.has('q')) rot -= 1;
    if (this.keys.has('e')) rot += 1;
    if (dx || dz) this.orbit.panPlane(dx * dt * 60, dz * dt * 60);
    if (rot) this.orbit.rotate(rot * dt * 260, 0);
    if (this.selection.some((a) => a.dead)) this.setSelection(this.selection.filter((a) => !a.dead), false);
    if (this.move) {
      if (dx || dz || rot) this.updateMove();
      const ships = this.moveShips().map((a) => this.renderer.views.get(a.id)?.pos).filter(Boolean);
      if (!ships.length) this.cancelMove();
      else this.widget.update(this.move.center, this.move.onPlane, this.move.dest, ships, performance.now() / 1000, this.move.mode === 'move' ? this.formationGhosts(this.move.dest) : []);
    }
    this.hover = this.box && this.box.active ? null : this.pick(this.mx, this.my);
  }
}
