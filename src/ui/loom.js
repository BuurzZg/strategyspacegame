import * as V from '../galaxy/voyage.js';

// The Loom: the memory tree (PLAN.md §4), in the approved brass style. Five branches as rows
// of cogs on a loom frame; threads run from each memory to the ones it needs. A remembered
// memory is a lit brass cog with a Glim thread; one you can recall now with echoes pulses; one
// you have not found is a dark iron blank with a stamped question mark.
//   open(s, { onChange })   close()   isOpen   key(k): true if the Loom used it
const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const BRANCHES = [['origins', 'Origins'], ['skein', 'The Skein'], ['forge', 'The Forge'], ['fleet', 'The fleet'], ['decks', 'The decks']];
const W = 1000, X0 = 210, DX = 112, R = 26;

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function gearPath(cx, cy, r, teeth, depth) {
  let d = '';
  const n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, k = i % 4, rr = k === 1 || k === 2 ? r + depth : r;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
  }
  return `${d}Z`;
}

export class LoomScreen {
  constructor(rules, audio) {
    this.rules = rules; this.audio = audio; this.s = null; this.chosen = null;
    $('loom-close').addEventListener('click', () => this.close());
    $('loom-svg').addEventListener('click', (e) => { const n = e.target.closest('[data-m]'); if (n) this.choose(n.dataset.m); });
    $('loom-svg').addEventListener('keydown', (e) => { const n = e.target.closest('[data-m]'); if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.choose(n.dataset.m); } });
    $('loom-detail').addEventListener('click', (e) => { const b = e.target.closest('[data-recall]'); if (b && !b.disabled) this.recall(b.dataset.recall); });
    $('loom').addEventListener('click', (e) => { if (e.target === $('loom')) this.close(); });
  }
  get isOpen() { return !$('loom').hidden; }

  open(s, { onChange } = {}) {
    this.s = s; this.onChange = onChange;
    const M = this.rules.content.memories;
    if (!this.chosen || !M[this.chosen]) this.chosen = Object.keys(s.campaign.memories || {}).slice(-1)[0] || 'radar';
    $('loom').hidden = false;
    this.render();
    this.audio && this.audio.play('order');
  }
  close() { if (!this.isOpen) return; $('loom').hidden = true; }
  key(k) {
    if (!this.isOpen) return false;
    if (k === 'Escape' || k === 'l' || k === 'L') { this.close(); return true; }
    return true; // the Loom is modal: nothing else reacts while it is open
  }

  // a memory's state: known, recall (affordable now), named (recallable later, or seen), unknown, later
  state(id) {
    const s = this.s, m = this.rules.content.memories[id];
    if (V.remembers(s, id)) return 'known';
    if (m.Ready === 'false') return 'later';
    if (m.Cost !== undefined) return V.recallPlan(this.rules, s, id).ok ? 'recall' : 'named';
    return 'unknown';
  }

  layout() {
    const M = Object.values(this.rules.content.memories), pos = {};
    let y = 70;
    const rows = [];
    for (const [b, name] of BRANCHES) {
      const list = M.filter((m) => m.Branch === b).sort((x, z) => (+x.Order || 0) - (+z.Order || 0));
      // the long Origins thread folds onto two rows
      const per = 7;
      for (let i = 0; i < list.length; i += per) {
        const row = list.slice(i, i + per);
        rows.push({ b, name: i ? '' : name, y, n: row.length });
        row.forEach((m, k) => { pos[m.id] = { x: X0 + k * DX, y }; });
        y += 112;
      }
    }
    return { pos, rows, height: y - 40 };
  }

  render() {
    const svg = $('loom-svg'), s = this.s, rules = this.rules, M = rules.content.memories;
    svg.innerHTML = '';
    const { pos, rows, height } = this.layout();
    svg.setAttribute('viewBox', `0 0 ${W} ${height}`);
    const defs = el('defs', {}, svg);
    const grad = (id, stops) => { const g = el('radialGradient', { id, cx: '35%', cy: '30%', r: '80%' }, defs); for (const [o, c] of stops) el('stop', { offset: o, 'stop-color': c }, g); };
    grad('lm-brass', [[0, '#f1d58e'], [0.55, '#c9a04e'], [1, '#6b4f1e']]);
    grad('lm-iron', [[0, '#4a4239'], [1, '#1d1813']]);
    const f = el('filter', { id: 'lm-glow', x: '-60%', y: '-60%', width: '220%', height: '220%' }, defs);
    el('feGaussianBlur', { stdDeviation: 4, result: 'b' }, f);
    const mg = el('feMerge', {}, f); el('feMergeNode', { in: 'b' }, mg); el('feMergeNode', { in: 'SourceGraphic' }, mg);
    // the frame: beams top and bottom, warp threads, and a beam for each row with its name
    el('rect', { x: 14, y: 14, width: W - 28, height: 9, rx: 3, fill: '#5d4519' }, svg);
    el('rect', { x: 14, y: height - 23, width: W - 28, height: 9, rx: 3, fill: '#5d4519' }, svg);
    for (let x = 40; x < W - 20; x += 24) el('line', { x1: x, y1: 23, x2: x, y2: height - 23, stroke: '#241e18', 'stroke-width': 1 }, svg);
    for (const r of rows) {
      el('line', { x1: X0 - 40, y1: r.y, x2: X0 + (r.n - 1) * DX + 40, y2: r.y, stroke: '#3a3127', 'stroke-width': 2 }, svg);
      if (r.name) { const t = el('text', { x: 30, y: r.y + 6, 'font-family': "'IM Fell English SC', Georgia, serif", 'font-size': 20, fill: '#c9a04e' }, svg); t.textContent = r.name; }
    }
    // threads: from each memory to those it needs (and along the story, in order)
    const story = Object.values(M).filter((m) => m.Branch === 'origins').sort((x, z) => (+x.Order || 0) - (+z.Order || 0));
    const pairs = [];
    for (const m of Object.values(M)) for (const n of String(m.Needs || '').split(',').map((x) => x.trim()).filter(Boolean)) pairs.push([n, m.id]);
    // (the story thread runs along each row; where Origins folds onto its second row, the frame carries it)
    for (let i = 1; i < story.length; i++) pairs.push([story[i - 1].id, story[i].id, 'row']);
    for (const [a, b, kind] of pairs) {
      const p = pos[a], q = pos[b];
      if (!p || !q || (kind === 'row' && p.y !== q.y)) continue;
      const lit = V.remembers(s, a) && V.remembers(s, b);
      const d = p.y === q.y ? `M${p.x} ${p.y} L${q.x} ${q.y}` : `M${p.x} ${p.y} C${p.x} ${(p.y + q.y) / 2}, ${q.x} ${(p.y + q.y) / 2}, ${q.x} ${q.y}`;
      el('path', { d, fill: 'none', stroke: lit ? '#9ef0d8' : '#8c6a2c', 'stroke-width': lit ? 2.5 : 1.4, 'stroke-dasharray': lit ? '' : '5 5', opacity: lit ? 1 : 0.6, filter: lit ? 'url(#lm-glow)' : '' }, svg);
    }
    // the cogs
    for (const m of Object.values(M)) {
      const p = pos[m.id], st = this.state(m.id);
      if (!p) continue;
      const g = el('g', { class: `node${m.id === this.chosen ? ' chosen' : ''}`, 'data-m': m.id, tabindex: 0, role: 'button', 'aria-label': st === 'known' || st === 'recall' || st === 'named' ? m.Name : 'A memory not yet found' }, svg);
      el('circle', { class: 'sel', cx: p.x, cy: p.y, r: R + 14, fill: 'none', stroke: '#ede6d6', 'stroke-width': 1.5, opacity: 0, 'stroke-dasharray': '3 4' }, g);
      if (st === 'recall') el('circle', { class: 'pulse', cx: p.x, cy: p.y, r: R + 10, fill: 'none', stroke: '#9ef0d8', 'stroke-width': 2.5 }, g);
      el('path', { d: gearPath(p.x, p.y, R, 11, 6), fill: st === 'known' ? 'url(#lm-brass)' : 'url(#lm-iron)', stroke: st === 'known' ? '#5d4519' : '#0e0c09', 'stroke-width': 1.5, opacity: st === 'later' ? 0.55 : 1 }, g);
      el('circle', { cx: p.x, cy: p.y, r: 11, fill: st === 'known' ? '#9ef0d8' : st === 'recall' ? '#2c5c52' : '#16130f', filter: st === 'known' ? 'url(#lm-glow)' : '' }, g);
      if (st !== 'known') { const q = el('text', { x: p.x, y: p.y + 7, 'text-anchor': 'middle', 'font-family': "'IM Fell English SC', Georgia, serif", 'font-size': 20, fill: st === 'recall' ? '#9ef0d8' : '#8c6a2c', opacity: st === 'later' ? 0.6 : 1 }, g); q.textContent = st === 'recall' || st === 'named' ? '' : '?'; }
      const label = st === 'known' || st === 'recall' || st === 'named' ? m.Name : '';
      if (label) {
        const words = label.split(' '), lines = [];
        for (const w of words) { if (lines.length && (lines[lines.length - 1] + ' ' + w).length <= 16) lines[lines.length - 1] += ` ${w}`; else lines.push(w); }
        lines.slice(0, 2).forEach((ln, i) => { const t = el('text', { x: p.x, y: p.y + R + 22 + i * 15, 'text-anchor': 'middle', 'font-family': "'Spectral', Georgia, serif", 'font-size': 13, fill: st === 'known' ? '#ede6d6' : '#a8997f' }, g); t.textContent = ln; });
      }
    }
    const known = Object.keys(s.campaign.memories || {}).length, total = Object.keys(M).length, e = s.campaign.echoes | 0;
    $('loom-count').textContent = `${known} of ${total} remembered`;
    $('loom-echoes').textContent = `${e} echo${e === 1 ? '' : 'es'}`;
    this.detail();
  }

  choose(id) { this.chosen = id; this.render(); }

  detail() {
    const id = this.chosen, rules = this.rules, s = this.s, m = rules.content.memories[id];
    if (!m) { $('loom-detail').innerHTML = ''; return; }
    const st = this.state(id), seen = st === 'known' || st === 'recall' || st === 'named';
    const kind = `${m.Kind === 'knowledge' ? 'Knowledge' : 'Ability'} · ${BRANCHES.find((b) => b[0] === m.Branch)[1]}`;
    let how = '';
    if (st === 'known') {
      const at = s.campaign.memories[id];
      how = `<p class="when">Remembered in life ${at.life}, on day ${at.day}.</p>`;
    } else if (st === 'later') how = '<p class="how">Not in this part of the voyage yet.</p>';
    else if (m.Found) {
      const A = (rules.content.anchors || {})[m.Found], item = rules.content.items[m.Found];
      how = `<p class="how">${A ? `It waits in ${esc(A.Name)}.` : item ? 'It waits in a derelict somewhere out there.' : 'It waits somewhere out there.'} Cut into the hulk with Shearers to bring it back.</p>`;
    } else if (m.Blueprint) how = '<p class="how">Cut up a wreck of one, or buy its plans from someone who has them.</p>';
    else if (m.Cost !== undefined) {
      const p = V.recallPlan(rules, s, id);
      how = `<p class="how">Recall it with ${m.Cost} echo${+m.Cost === 1 ? '' : 'es'}.</p><button type="button" class="loom-btn${p.ok ? ' primary' : ''}" data-recall="${esc(id)}" ${p.ok ? '' : 'disabled'}>Remember it (${m.Cost} echo${+m.Cost === 1 ? '' : 'es'})</button>${p.ok ? '' : `<p class="why">${esc(p.why)}</p>`}`;
    }
    $('loom-detail').innerHTML = `<h3>${esc(seen ? m.Name : 'Not yet remembered')}</h3><span class="kind">${esc(kind)}</span><p>${esc(st === 'known' ? m.Text || '' : m.Hint || '')}</p>${how}`;
  }

  recall(id) {
    const r = V.recall(this.rules, this.s, id);
    if (!r.ok) { this.audio && this.audio.play('error'); return; }
    this.audio && this.audio.play('organ'); // a memory comes back: the organ
    if (this.onChange) this.onChange();
    this.render();
  }
}
