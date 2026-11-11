import * as V from '../galaxy/voyage.js';
import * as B from '../galaxy/base.js';
import { traitOf } from '../galaxy/crew.js';

// The bridge (PLAN.md §6, decision 35): the crew screen as the Forge's bridge, in the approved
// brass style. A layered drawing seen from behind Jacob's chair: the stations in a ring round
// it, each a console with its name plate, officer, mood medallion, level lamps and a state
// gauge. A dark station is grey glass and a still needle; a lit one glows, its needle moves and
// steam drifts from its vents. For All hands every lamp goes gold at once. On a phone the ring
// becomes a column. Click a station for its panel (officer, what it runs, its skills from
// memories, training this life, what keeps it dark); click the chair for the captain's panel.
//   open(s, { onChange, onLoom, onLetGo })   close()   isOpen   key(k)
const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const list = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
const MOOD = { content: 'Content', uneasy: 'Uneasy', angry: 'Angry' };
const MOOD_COLOR = { content: '#7fd18b', uneasy: '#e3a33b', angry: '#d9573c', '': '#3b352d' };
const STATE = { online: 'Online', dim: 'Dim', dark: 'Dark', striking: 'On strike', cold: 'Cold' };
// the gauge needle for each state, in degrees from straight up
const NEEDLE = { online: 38, dim: 0, cold: -22, dark: -62, striking: -62 };
const LEVEL = ['Dark', 'Manned', 'Trained', 'Expert'];

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const txt = (parent, x, y, s, attrs = {}) => { const t = el('text', { x, y, ...attrs }, parent); t.textContent = s; return t; };

export class BridgeScreen {
  constructor(rules, audio) {
    this.rules = rules; this.audio = audio; this.s = null; this.chosen = 'chair'; this.note = '';
    $('bridge-close').addEventListener('click', () => this.close());
    $('bridge-svg').addEventListener('click', (e) => { const n = e.target.closest('[data-st]'); if (n) this.choose(n.dataset.st); });
    $('bridge-svg').addEventListener('keydown', (e) => { const n = e.target.closest('[data-st]'); if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.choose(n.dataset.st); } });
    $('bridge-detail').addEventListener('click', (e) => this.detailClick(e));
    $('bridge').addEventListener('click', (e) => { if (e.target === $('bridge')) this.close(); });
    window.addEventListener('resize', () => { if (this.isOpen) this.render(); });
  }
  get isOpen() { return !$('bridge').hidden; }

  open(s, { onChange, onLoom, onLetGo } = {}) {
    this.s = s; this.onChange = onChange; this.onLoom = onLoom; this.onLetGo = onLetGo; this.note = '';
    $('bridge').hidden = false;
    this.render();
    this.audio && this.audio.play('order');
  }
  close() { if (!this.isOpen) return; $('bridge').hidden = true; }
  key(k) {
    if (!this.isOpen) return false;
    if (k === 'Escape' || k === 'b' || k === 'B') { this.close(); return true; }
    return true; // modal
  }
  choose(id) { this.chosen = id; this.note = ''; this.audio && this.audio.play('select'); this.render(); }

  // ---------------------------------------------------------------- drawing
  render() {
    const s = this.s, rules = this.rules, svg = $('bridge-svg');
    const st = B.stations(rules, s), ah = (s.allHands && s.allHands.days) | 0, mood = B.moodOf(rules, s);
    const narrow = $('bridge-view').clientWidth < 620;
    $('bridge-sub').textContent = `Life ${(s.campaign && s.campaign.life) || 1} · Day ${s.day} · ${MOOD[mood.mark]}, morale ${s.morale}`;
    $('bridge-cog').textContent = `${s.stores.cogmarks | 0} cogmarks`;
    $('bridge-hands').hidden = !ah;
    $('bridge-hands').textContent = ah ? `All hands · ${ah} day${ah > 1 ? 's' : ''}${s.allHands.best > ah ? ` · best ${s.allHands.best}` : ''}` : '';
    svg.innerHTML = '';
    svg.classList.toggle('allhands', !!ah);
    const Wd = narrow ? 360 : 1000, Ht = narrow ? 250 + st.length * 132 : 690;
    svg.setAttribute('viewBox', `0 0 ${Wd} ${Ht}`);
    svg.style.minWidth = narrow ? '0' : '';
    this.backdrop(svg, Wd, Ht, narrow);
    // where each console stands: a horseshoe round the chair (two down the left, five along
    // the back under the window, two down the right), or a column on a phone
    const n = st.length, back = Math.max(1, n - 4), side = (n - back) >> 1;
    const pos = st.map((x, i) => {
      if (narrow) return { x: 180, y: 250 + i * 132 };
      if (i < side) return { x: 130 + 30 * i, y: 590 - 140 * i };
      if (i >= side + back) { const k = n - 1 - i; return { x: 870 - 30 * k, y: 590 - 140 * k }; }
      const k = i - side;
      return { x: back > 1 ? 180 + (640 * k) / (back - 1) : 500, y: 320 };
    });
    const chair = narrow ? { x: 180, y: 120 } : { x: 500, y: 545 };
    this.drawChair(svg, chair, narrow);
    st.forEach((x, i) => this.drawStation(svg, x, pos[i], ah));
    this.renderDetail(st);
  }

  backdrop(svg, W, H, narrow) {
    const d = el('defs', {}, svg);
    const lg = el('linearGradient', { id: 'br-brass', x1: 0, y1: 0, x2: 0, y2: 1 }, d);
    el('stop', { offset: '0', 'stop-color': '#e0bd6a' }, lg); el('stop', { offset: '0.5', 'stop-color': '#c9a04e' }, lg); el('stop', { offset: '1', 'stop-color': '#7a5a24' }, lg);
    const ig = el('linearGradient', { id: 'br-iron', x1: 0, y1: 0, x2: 0, y2: 1 }, d);
    el('stop', { offset: '0', 'stop-color': '#3a3128' }, ig); el('stop', { offset: '1', 'stop-color': '#1a1511' }, ig);
    const gl = el('radialGradient', { id: 'br-glow' }, d);
    el('stop', { offset: '0', 'stop-color': '#ffcf7a', 'stop-opacity': '0.55' }, gl); el('stop', { offset: '1', 'stop-color': '#ffcf7a', 'stop-opacity': '0' }, gl);
    const blur = el('filter', { id: 'br-blur', x: '-1', y: '-1', width: '3', height: '3' }, d);
    el('feGaussianBlur', { stdDeviation: '3' }, blur);
    const sky = el('radialGradient', { id: 'br-sky', cx: '0.5', cy: '0.2', r: '0.8' }, d);
    el('stop', { offset: '0', 'stop-color': '#16202e' }, sky); el('stop', { offset: '1', 'stop-color': '#07090d' }, sky);
    // the hull: dark iron, the great window, and the stars beyond it (they drift slowly)
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#120f0c' }, svg);
    const win = narrow ? { x: 20, y: 14, w: W - 40, h: 150 } : { x: 150, y: 18, w: 700, h: 240 };
    const clip = el('clipPath', { id: 'br-win' }, d);
    el('rect', { x: win.x, y: win.y, width: win.w, height: win.h, rx: win.w / 2.2 }, clip);
    const sk = el('g', { 'clip-path': 'url(#br-win)' }, svg);
    el('rect', { x: win.x, y: win.y, width: win.w, height: win.h, fill: 'url(#br-sky)' }, sk);
    const stars = el('g', { class: 'br-stars' }, sk);
    for (let i = 0; i < 90; i++) {
      const k = (i * 7919) % 997, x = win.x + ((k * 37) % win.w), y = win.y + ((k * 53) % win.h);
      el('circle', { cx: x, cy: y, r: (k % 3) * 0.5 + 0.5, fill: k % 11 ? '#d8e2f0' : '#9ef0d8', opacity: 0.35 + (k % 5) / 8 }, stars);
    }
    el('rect', { x: win.x, y: win.y, width: win.w, height: win.h, rx: win.w / 2.2, fill: 'none', stroke: 'url(#br-brass)', 'stroke-width': 7 }, svg);
    // window ribs and rivets
    for (let i = 1; i < 6; i++) el('line', { x1: win.x + (win.w * i) / 6, y1: win.y + 4, x2: win.x + (win.w * i) / 6, y2: win.y + win.h - 4, stroke: '#5a4628', 'stroke-width': 3, opacity: 0.8 }, svg);
    // the deck: floor plates in perspective, pipes along the walls
    el('path', { d: narrow ? `M0 ${H} L0 ${win.y + win.h + 20} L${W} ${win.y + win.h + 20} L${W} ${H}Z` : `M0 ${H} L90 290 L910 290 L1000 ${H}Z`, fill: 'url(#br-iron)' }, svg);
    if (!narrow) {
      for (let i = 0; i < 8; i++) el('line', { x1: 500, y1: 300, x2: -200 + i * 200, y2: H, stroke: '#2a231c', 'stroke-width': 1.5 }, svg);
      for (const [x1, x2] of [[30, 120], [970, 880]]) {
        el('path', { d: `M${x1} 60 L${x1} ${H - 20} M${x1 + (x2 > x1 ? 14 : -14)} 80 L${x1 + (x2 > x1 ? 14 : -14)} ${H - 30}`, stroke: '#7a5a24', 'stroke-width': 7, fill: 'none', 'stroke-linecap': 'round', opacity: 0.8 }, svg);
        for (let y = 100; y < H - 40; y += 90) el('rect', { x: Math.min(x1, x1 + (x2 > x1 ? 14 : -14)) - 6, y, width: 26, height: 8, rx: 2, fill: '#8c6a2c' }, svg);
      }
    }
    // a warm pool of light round the chair
    el('ellipse', { cx: narrow ? 180 : 500, cy: narrow ? 150 : 570, rx: narrow ? 150 : 300, ry: narrow ? 60 : 110, fill: 'url(#br-glow)', class: 'br-pool' }, svg);
  }

  drawChair(svg, c, narrow) {
    const g = el('g', { class: `br-chair${this.chosen === 'chair' ? ' chosen' : ''}`, 'data-st': 'chair', tabindex: 0, role: 'button', 'aria-label': "Jacob's chair: the captain's panel" }, svg);
    el('ellipse', { cx: c.x, cy: c.y + 46, rx: 78, ry: 18, fill: '#2a2119', stroke: '#8c6a2c', 'stroke-width': 2 }, g); // the dais
    el('path', { d: `M${c.x - 40} ${c.y + 40} L${c.x - 34} ${c.y - 46} Q${c.x} ${c.y - 70} ${c.x + 34} ${c.y - 46} L${c.x + 40} ${c.y + 40}Z`, fill: '#4a2c1c', stroke: 'url(#br-brass)', 'stroke-width': 3 }, g); // the back
    el('rect', { x: c.x - 52, y: c.y + 4, width: 18, height: 30, rx: 4, fill: '#5a3a22', stroke: '#c9a04e', 'stroke-width': 2 }, g);
    el('rect', { x: c.x + 34, y: c.y + 4, width: 18, height: 30, rx: 4, fill: '#5a3a22', stroke: '#c9a04e', 'stroke-width': 2 }, g);
    for (let i = 0; i < 5; i++) el('circle', { cx: c.x - 24 + i * 12, cy: c.y - 34, r: 2, fill: '#e0bd6a' }, g);
    el('rect', { x: c.x - 70, y: c.y - 104, width: 140, height: 26, rx: 3, fill: 'url(#br-brass)', class: 'sel-plate' }, g);
    txt(g, c.x, c.y - 86, 'Jacob', { 'text-anchor': 'middle', class: 'br-plate' });
    if (!narrow) txt(g, c.x, c.y + 86, 'the captain', { 'text-anchor': 'middle', class: 'br-small' });
  }

  drawStation(svg, st, p, ah) {
    const lit = !st.notYet && st.state !== 'dark' && st.state !== 'striking';
    const lv = B.levelOf(this.rules, this.s, st.id, st);
    const g = el('g', { class: `br-st st-${st.notYet ? 'notyet' : st.state}${lit ? ' lit' : ''}${this.chosen === st.id ? ' chosen' : ''}`, 'data-st': st.id, tabindex: 0, role: 'button', 'aria-label': `${st.name}: ${st.notYet ? 'not open yet' : STATE[st.state]}, level ${lv}` }, svg);
    const x = p.x, y = p.y;
    // a glow when lit (gold for All hands)
    if (lit) el('ellipse', { cx: x, cy: y + 10, rx: 92, ry: 46, fill: 'url(#br-glow)', opacity: ah ? 0.95 : 0.5, class: 'br-halo' }, g);
    // the console: an iron cabinet with a brass rim and a sloped glass face
    el('path', { d: `M${x - 70} ${y + 44} L${x - 62} ${y - 20} L${x + 62} ${y - 20} L${x + 70} ${y + 44}Z`, fill: 'url(#br-iron)', stroke: '#8c6a2c', 'stroke-width': 2 }, g);
    el('rect', { x: x - 56, y: y - 16, width: 112, height: 42, rx: 4, fill: lit ? '#1d2a2a' : '#22262a', stroke: '#5a4628', 'stroke-width': 1.5, class: 'br-glass' }, g);
    // the state gauge, its needle by the station's state (a lit one wavers)
    const gx = x - 32, gy = y + 6;
    el('circle', { cx: gx, cy: gy, r: 16, fill: '#efe6cf', stroke: 'url(#br-brass)', 'stroke-width': 3, opacity: lit ? 1 : 0.55 }, g);
    for (let k = -2; k <= 2; k++) { const a = ((k * 30 - 90) * Math.PI) / 180; el('line', { x1: gx + Math.cos(a) * 11, y1: gy + Math.sin(a) * 11, x2: gx + Math.cos(a) * 14, y2: gy + Math.sin(a) * 14, stroke: '#3a2e1d', 'stroke-width': 1.2 }, g); }
    const ng = el('g', { transform: `rotate(${st.notYet ? -62 : NEEDLE[st.state]} ${gx} ${gy})` }, g);
    el('line', { x1: gx, y1: gy + 3, x2: gx, y2: gy - 12, stroke: '#b8432c', 'stroke-width': 2, 'stroke-linecap': 'round', class: lit ? 'br-needle' : '' }, ng);
    el('circle', { cx: gx, cy: gy, r: 2.5, fill: '#3a2e1d' }, g);
    // the mood medallion
    el('circle', { cx: x + 6, cy: y + 6, r: 9, fill: MOOD_COLOR[st.mood || ''], stroke: '#c9a04e', 'stroke-width': 2, class: 'br-medal' }, g);
    // the level lamps: three, lit up to the station's level (all gold for All hands)
    for (let k = 0; k < 3; k++) el('circle', { cx: x + 26 + k * 12, cy: y + 6, r: 4.2, fill: k < lv ? (ah ? '#ffd36a' : '#f0a848') : '#2f2a24', stroke: '#6a5230', 'stroke-width': 1, class: k < lv ? 'br-lamp on' : 'br-lamp' }, g);
    // steam from the vents of a lit console
    if (lit) for (let k = 0; k < 2; k++) el('circle', { cx: x + (k ? 50 : -50), cy: y - 26, r: 6, fill: '#ede6d6', filter: 'url(#br-blur)', class: `br-steam s${k}` }, g);
    // the name plate and the officer
    el('rect', { x: x - 64, y: y + 48, width: 128, height: 22, rx: 3, fill: lit ? 'url(#br-brass)' : '#5a4e3c', class: 'sel-plate' }, g);
    txt(g, x, y + 63.5, st.name, { 'text-anchor': 'middle', class: 'br-plate' });
    txt(g, x, y + 86, st.notYet ? 'not yet' : st.officer || (st.post ? 'nobody' : 'the hands'), { 'text-anchor': 'middle', class: 'br-small' });
    if (st.state === 'striking') txt(g, x, y - 30, 'ON STRIKE', { 'text-anchor': 'middle', class: 'br-strike' });
  }

  // ---------------------------------------------------------------- the panels
  renderDetail(st) {
    const s = this.s, rules = this.rules, C = rules.content;
    let h = '';
    if (this.chosen === 'chair' || !st.find((x) => x.id === this.chosen)) {
      const m = B.moodOf(rules, s), ah = s.allHands || { days: 0, best: 0 }, L = (s.campaign && s.campaign.life) || 1;
      const date = V.remembers(s, 'horologe') ? 'known' : 'UNKNOWN';
      h += `<h3>The captain's chair</h3><p class="kind">Jacob Smith · life ${L}, day ${s.day}</p><p class="date">Meridian date: <b>${date}</b></p>`;
      h += `<p>Morale ${s.morale}, ${MOOD[m.mark].toLowerCase()}.${m.causes.length ? ` ${esc(m.causes.map((c) => c.text).join(' '))}` : ' Nothing is wrong.'}</p>`;
      h += `<p class="how">${ah.days ? `All hands for ${ah.days} day${ah.days > 1 ? 's' : ''}.` : 'Not All hands now.'}${ah.best ? ` The best streak this life: ${ah.best} days.` : ''} All hands comes when every station that is open is lit and green.</p>`;
      h += '<div class="row"><button type="button" class="loom-btn" data-act="loom">Open the Loom <kbd>L</kbd></button><button type="button" class="loom-btn" data-act="letgo">Let go</button></div>';
    } else {
      const x = st.find((y) => y.id === this.chosen), S = C.crew.stations[x.id], lv = B.levelOf(rules, s, x.id, x);
      const o = x.post ? (s.crew.people || []).find((p) => p.post === x.post) : null, t = o ? traitOf(rules, o) : null;
      h += `<h3>${esc(x.name)}</h3><p class="kind">${x.notYet ? 'Not open yet' : `${STATE[x.state]} · level ${lv}, ${LEVEL[lv].toLowerCase()}`}</p>`;
      h += `<p>${esc(x.text)}</p>`;
      h += o ? `<p class="who"><b>${esc(C.crew.posts[x.post].Name)} ${esc(o.name)}</b>, ${esc(t.Name.toLowerCase())}: ${esc(t.Text || '')}${x.mood ? ` Their station is ${MOOD[x.mood].toLowerCase()}.` : ''}${lv === 1 ? ' At level 1 their work counts half.' : ''}</p>` : `<p class="who">${x.post ? 'Nobody holds the post.' : 'The hands keep it.'}</p>`;
      if (x.why) h += `<p class="why">${esc(x.why)}${x.state === 'dark' || x.state === 'striking' ? ` ${esc(x.dark)}` : ''}</p>`;
      // skills from memories: known for good, or a question mark
      const mem = list(S.Memories);
      if (mem.length) {
        h += '<h4>What Jacob remembers for it</h4><ul class="skills">';
        for (const id of mem) { const M = C.memories[id], k = V.remembers(s, id); h += `<li class="${k ? 'known' : 'q'}">${k ? esc(M.Name) : '?'}<span>${esc(k ? M.Text || '' : M.Hint || '')}</span></li>`; }
        h += '</ul>';
      }
      // training this life
      const tr = list(S.Train);
      if (tr.length) {
        h += '<h4>Training, this life</h4><ul class="skills">';
        tr.forEach((id, k) => { const K = C.crew.skills[id], have = lv >= k + 2; h += `<li class="${have ? 'known' : 'later'}">${esc(K.Name)} <i>level ${k + 2}</i><span>${esc(K.Text)}</span></li>`; });
        h += '</ul>';
        const p = V.trainPlan(rules, s, x.id);
        if (lv < 3 && !x.notYet) h += `<button type="button" class="loom-btn${p.ok ? ' primary' : ''}" data-train="${x.id}" ${p.ok ? '' : 'disabled'}>Train to level ${lv + 1}: ${p.cogmarks ?? '?'} cogmarks, ${p.days ?? 1} day${(p.days || 1) > 1 ? 's' : ''}</button>${p.ok ? (p.cheaper ? '<p class="how">Jacob remembers how to teach it: half the cogmarks.</p>' : '') : `<p class="why">${esc(p.why)}</p>`}`;
        h += '<p class="how">Trained levels are relearned every life. What Jacob remembers lasts.</p>';
      }
    }
    if (this.note) h += `<p class="note">${esc(this.note)}</p>`;
    $('bridge-detail').innerHTML = h;
  }
  detailClick(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.train) {
      const was = (this.s.allHands && this.s.allHands.days) | 0;
      const r = V.train(this.rules, this.s, b.dataset.train);
      this.note = r.ok ? `Trained to level ${r.level}.` : r.why;
      this.audio && this.audio.play(r.ok ? 'complete' : 'error');
      // the All hands moment: every lamp gold, the bell and the organ
      if (r.ok && !was && this.s.allHands && this.s.allHands.days) { this.note += ' All hands! Every station is green.'; this.audio && this.audio.play('allhands'); }
      if (r.ok && this.onChange) this.onChange();
      this.render();
    } else if (b.dataset.act === 'loom' && this.onLoom) { this.close(); this.onLoom(); }
    else if (b.dataset.act === 'letgo' && this.onLetGo) { this.close(); this.onLetGo(); }
  }
}
