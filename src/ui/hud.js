import { R } from '../render/space.js';
import { CELL } from '../engine/math.js';

// HUD: an overlay canvas for in-world marks (selection brackets, box select, move readout)
// plus DOM panels (selection card, controls card, hints).
// Units shown to the player: 1 cell = 100 m, so 10.24 world units = 1 m.
const $ = (id) => document.getElementById(id);
const M_PER_UNIT = 100 / CELL;
const fmtDist = (units) => { const m = Math.abs(units) * M_PER_UNIT; return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`; };
const fmtAlt = (units) => `${units >= 0 ? '+' : '−'}${fmtDist(units)}`;

export class Hud {
  constructor() {
    this.overlay = $('overlay');
    this.ctx = this.overlay.getContext('2d');
    this.dirty = true;
    this.refreshT = 0;
    this.helpOpen = true;
  }
  attach(session, input) { this.s = session; this.input = input; this.world = session.world; this.renderer = session.renderer; this.dirty = true; }
  resize(w, h, dpr) {
    this.overlay.width = w * dpr; this.overlay.height = h * dpr;
    this.overlay.style.width = `${w}px`; this.overlay.style.height = `${h}px`;
    this.dpr = dpr;
  }
  selectionChanged() { this.dirty = true; }
  modeChanged() { this.dirty = true; }
  toggleHelp(force) { this.helpOpen = force !== undefined ? force : !this.helpOpen; $('help').hidden = !this.helpOpen; }
  // The controls card tucks itself away after your first move order (H brings it back).
  firstOrder() { if (!this.ordered) { this.ordered = true; if (this.helpOpen) this.toggleHelp(false); } }

  // ---------------------------------------------------------------- panels
  refresh() {
    const sel = this.input.selection.filter((a) => !a.dead);
    $('move-hint').hidden = !this.input.move;
    const card = $('sel');
    if (!sel.length) { card.hidden = true; return; }
    card.hidden = false;
    if (sel.length === 1) {
      const a = sel[0], tt = a.info.traitInfo('Tooltip'), f = a.mobile;
      const speed = f ? Math.round(f.speed * 25 * M_PER_UNIT) : 0;
      const heading = Math.round((a.yaw / 1024) * 360);
      const status = f && (a.activity || f.speed > 0) ? (a.activity ? 'Under way' : 'Coasting') : 'Holding';
      $('sel-name').textContent = tt.Name;
      $('sel-class').textContent = `${tt.Class} · ${tt.Role}`;
      $('sel-desc').textContent = tt.Description;
      $('sel-status').textContent = status;
      $('sel-stats').innerHTML = [
        ['Speed', `${speed} m/s`],
        ['Altitude', fmtAlt(a.z)],
        ['Heading', `${String(heading).padStart(3, '0')}°`],
        ['Pitch', `${Math.round((a.pitch / 1024) * 360)}°`],
        ['Hull', `${Math.ceil((a.health.hp / a.health.maxHp) * 100)}%`],
      ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    } else {
      const counts = {};
      for (const a of sel) { const n = a.info.traitInfo('Tooltip').Name; counts[n] = (counts[n] || 0) + 1; }
      $('sel-name').textContent = `${sel.length} ships`;
      $('sel-class').textContent = Object.entries(counts).map(([n, c]) => `${c} × ${n}`).join(' · ');
      $('sel-desc').textContent = '';
      $('sel-status').textContent = sel.some((a) => a.activity) ? 'Under way' : 'Holding';
      const z = sel.reduce((s, a) => s + a.z, 0) / sel.length;
      $('sel-stats').innerHTML = `<div><dt>Mean altitude</dt><dd>${fmtAlt(z)}</dd></div>`;
    }
  }

  // ---------------------------------------------------------------- overlay
  drawBrackets(ctx, v, color, strong) {
    const inp = this.input;
    const p = inp.project(v.pos);
    if (p.z > 1) return null;
    const r = Math.max(9, inp.screenRadius(v.pos, v.radius) * 1.15);
    const l = Math.max(4, r * 0.38);
    ctx.strokeStyle = color; ctx.lineWidth = strong ? 1.6 : 1;
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cx = p.x + sx * r, cy = p.y + sy * r;
      ctx.moveTo(cx, cy - sy * l); ctx.lineTo(cx, cy); ctx.lineTo(cx - sx * l, cy);
    }
    ctx.stroke();
    return { p, r };
  }

  draw() {
    const ctx = this.ctx, inp = this.input, rd = this.renderer;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    for (const a of inp.selection) {
      const v = rd.views.get(a.id);
      if (!v) continue;
      const b = this.drawBrackets(ctx, v, rd.styleOf(a.owner).css, true);
      if (!b) continue;
      const f = a.health.hp / a.health.maxHp, w = Math.max(18, b.r * 1.4);
      ctx.fillStyle = 'rgba(5,6,11,0.7)'; ctx.fillRect(b.p.x - w / 2 - 1, b.p.y + b.r + 5, w + 2, 4);
      ctx.fillStyle = f > 0.6 ? '#7cf2a8' : f > 0.3 ? '#ffb547' : '#ff5a64'; ctx.fillRect(b.p.x - w / 2, b.p.y + b.r + 6, w * f, 2);
    }
    if (inp.hover && !inp.selection.includes(inp.hover)) {
      const v = rd.views.get(inp.hover.id);
      if (v) {
        const b = this.drawBrackets(ctx, v, 'rgba(223,232,242,0.6)', false);
        if (b) { ctx.font = '500 11px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(223,232,242,0.85)'; ctx.fillText(inp.hover.info.traitInfo('Tooltip').Name, b.p.x + b.r + 6, b.p.y - b.r + 10); }
      }
    }
    const box = inp.box;
    if (box && box.active) {
      ctx.strokeStyle = 'rgba(95,227,208,0.9)'; ctx.fillStyle = 'rgba(95,227,208,0.07)'; ctx.lineWidth = 1;
      ctx.fillRect(box.x, box.y, inp.mx - box.x, inp.my - box.y);
      ctx.strokeRect(box.x + 0.5, box.y + 0.5, inp.mx - box.x, inp.my - box.y);
    }
    const m = inp.move;
    if (m) {
      const dist = Math.hypot(m.dest.x - m.center.x, m.dest.y - m.center.y, m.dest.z - m.center.z) / R;
      const alt = m.dest.y / R;
      const d = inp.project(m.dest);
      if (d.z < 1) {
        const lines = [`${fmtDist(dist)}`, `alt ${fmtAlt(alt)}${Math.abs(m.height) > 0.01 ? `  (${fmtAlt(m.height / R)})` : ''}`];
        ctx.font = '500 12px "IBM Plex Mono", monospace';
        const w = Math.max(...lines.map((t) => ctx.measureText(t).width)) + 14;
        // place the readout beside the marker, flipping sides to stay clear of panels and edges
        let x = d.x + 14, y = d.y - 12;
        const blocked = (bx) => bx + w > innerWidth - 8 || this.covered(bx, y, w, 38);
        if (blocked(x)) x = d.x - 14 - w;
        if (x < 8 || this.covered(x, y, w, 38)) { x = Math.max(8, Math.min(innerWidth - w - 8, d.x - w / 2)); y = d.y + 18; }
        ctx.fillStyle = 'rgba(5,6,11,0.8)'; ctx.fillRect(x, y, w, 38);
        ctx.fillStyle = '#5fe3d0'; ctx.fillText(lines[0], x + 7, y + 15);
        ctx.fillStyle = '#ffb547'; ctx.fillText(lines[1], x + 7, y + 31);
      }
    }
  }

  // Does a screen rectangle overlap a visible HUD panel?
  covered(x, y, w, h) {
    for (const id of ['help', 'sel', 'move-hint']) {
      const el = $(id);
      if (!el || el.hidden) continue;
      const r = el.getBoundingClientRect();
      if (x < r.right && x + w > r.left && y < r.bottom && y + h > r.top) return true;
    }
    return false;
  }

  update(dt) {
    this.refreshT -= dt;
    if (this.dirty || this.refreshT <= 0) { this.refresh(); this.refreshT = 0.15; this.dirty = false; }
    this.draw();
  }
}
