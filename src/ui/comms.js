import * as C from '../galaxy/comms.js';
import { TIERS } from '../galaxy/standing.js';
import { ROLES } from '../galaxy/crew.js';
import { factionColor } from '../render/galaxy.js';

// The comms panel: a faction's dialog, and from it the trade and hiring screens. It runs on the
// star chart (effects change the voyage at once) and on a map (effects become an order to the
// simulation, which is paused while you talk).
//   open({ fid, context: () => ctx, apply: (effects) => { open, close, notes }, trade, onClose })
//   trade: { s, pointId, onDeal } on the chart, where you can trade and hire; null on a map
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

export class CommsPanel {
  constructor(rules, audio) {
    this.rules = rules; this.audio = audio; this.o = null;
    $('comms-close').addEventListener('click', () => this.close());
    $('comms-choices').addEventListener('click', (e) => this.choose(e));
    $('trade-body').addEventListener('click', (e) => this.tradeClick(e));
    $('trade-deal').addEventListener('click', () => this.makeDeal());
    $('trade-settle').addEventListener('click', () => { const { s, pointId, trader } = this.o.trade, r = C.settle(this.rules, s, this.o.fid, pointId, this.buy, this.sell, trader || ''); this.buy = r.buy; this.sell = r.sell; this.renderTrade(); });
    $('trade-back').addEventListener('click', () => this.showDialog(this.node));
  }
  get isOpen() { return !!this.o; }

  // o.fid: a faction's dialog; or o.title and o.dialog (an event) with o.start
  open(o) {
    this.o = o;
    const ctx = o.context();
    if (o.fid) {
      const F = this.rules.content.factions[o.fid];
      $('comms-who').textContent = o.who || F.Name;
      $('comms-who').style.color = hex(factionColor(this.rules, o.fid));
      $('comms-tier').textContent = TIERS[ctx.tier];
      $('comms-tier').className = `t-${TIERS[ctx.tier]}`;
    } else {
      $('comms-who').textContent = o.title || '';
      $('comms-who').style.color = '';
      $('comms-tier').textContent = '';
    }
    $('comms').classList.toggle('event', !o.fid);
    $('comms-notes').innerHTML = '';
    $('comms').hidden = false;
    this.showDialog(o.start || C.dialogOf(this.rules, o.fid).Start);
    this.audio.play(o.fid ? 'comm' : 'event');
  }
  close() {
    if (!this.o) return;
    const o = this.o;
    this.o = null;
    $('comms').hidden = true;
    if (o.onClose) o.onClose();
  }

  showDialog(nodeId) {
    this.node = nodeId;
    $('comms-dialog').hidden = false; $('trade').hidden = true;
    const v = C.nodeView(this.o.context(), nodeId);
    $('comms-say').textContent = v.say;
    $('comms-choices').innerHTML = v.choices.map((c, i) => `<button type="button" data-c="${esc(c.id)}" ${c.ok ? '' : 'disabled'} title="${esc(c.why)}"><kbd>${i + 1}</kbd>${esc(c.text)}${c.ok ? '' : ` <span class="why">${esc(c.why)}</span>`}</button>`).join('');
    this.view = v;
  }
  choose(e) {
    const b = e.target.closest('button[data-c]');
    if (!b || b.disabled) return;
    this.pick(b.dataset.c);
  }
  // also from number keys
  pick(id) {
    const c = this.view && this.view.choices.find((x) => x.id === id);
    if (!c || !c.ok) return;
    const r = this.o.apply(c.effects);
    for (const n of r.notes || []) $('comms-notes').insertAdjacentHTML('beforeend', `<li>${esc(n)}</li>`);
    this.audio.play('order');
    if (r.open && this.o.trade) return this.showTrade(r.open);
    if (r.goto) return this.showDialog(r.goto);
    if (r.close || (!c.goto && !r.open)) return this.close();
    this.showDialog(c.goto);
  }
  key(k) {
    if (!this.o) return false;
    if (k === 'Escape' && this.o.fid) { this.close(); return true; } // events must be answered
    const n = +k;
    if (n >= 1 && n <= 9 && !$('comms-dialog').hidden && this.view.choices[n - 1]) { this.pick(this.view.choices[n - 1].id); return true; }
    return false;
  }

  // ---------------------------------------------------------------- trade and hiring
  showTrade(mode) {
    this.mode = mode;
    this.buy = {}; this.sell = {};
    $('comms-dialog').hidden = true; $('trade').hidden = false;
    $('trade-title').textContent = mode === 'hire' ? 'Hire crew and ships' : 'Trade';
    this.renderTrade();
  }
  goods() {
    const { s, pointId } = this.o.trade, rules = this.rules;
    const { goods } = C.stockOf(rules, s, this.o.fid, pointId, this.o.trade.trader || '');
    return Object.keys(goods).filter((g) => (this.mode === 'hire' ? ROLES.includes(g) || g.startsWith('ship:') : !ROLES.includes(g) && !g.startsWith('ship:')));
  }
  label(g) {
    if (g.startsWith('ship:')) { const t = this.rules.actor(g.slice(5)), c = t.traitInfo('Crew'); return `${t.traitInfo('Tooltip').Name}${c && c.Count ? ` <span class="sub">with ${c.Count} ${c.Role}</span>` : ''}`; }
    if (ROLES.includes(g)) return g[0].toUpperCase() + g.slice(1);
    if (g.startsWith('bp-') || this.rules.content.items[g]) return esc(this.rules.content.items[g]?.Name || g);
    if (g === 'echo') return 'An echo <span class="sub">for the Loom</span>';
    if (g === 'clue') return 'A clue <span class="sub">to the next drive part</span>';
    if (g === 'chart') return 'A chart <span class="sub">of the whole region</span>';
    return esc(this.rules.content.resources[g]?.Name || g);
  }
  renderTrade() {
    const { s, pointId } = this.o.trade, rules = this.rules, fid = this.o.fid, ctx = this.o.context(), tr = this.o.trade.trader || '';
    const { goods, max } = C.stockOf(rules, s, fid, pointId, tr);
    const step = (g) => (g.startsWith('ship:') || ROLES.includes(g) || g.startsWith('bp-') || this.rules.content.items[g] || ['echo', 'clue', 'chart'].includes(g) ? 1 : 50);
    const row = (side, g, have, each) => `<tr><th>${this.label(g)}</th><td>${fmt(have)}</td><td>${each}</td><td class="q"><button type="button" data-s="${side}" data-g="${g}" data-d="-${step(g)}">−</button><b>${fmt((side === 'buy' ? this.buy : this.sell)[g] || 0)}</b><button type="button" data-s="${side}" data-g="${g}" data-d="${step(g)}">+</button></td></tr>`;
    const theirs = this.goods().map((g) => row('buy', g, goods[g], (C.buyPrice(rules, ctx.tier, g, goods[g], max[g]) / 100).toFixed(2).replace(/\.00$/, ''))).join('');
    const yours = C.sellable(rules, s).map((g) => row('sell', g, s.stores[g], (C.sellPrice(rules, ctx.tier, fid, g, tr) / 100).toFixed(2).replace(/\.00$/, ''))).join('');
    $('trade-body').innerHTML = `<div><h3>They offer</h3><table><thead><tr><th></th><th>Stock</th><th>Each</th><th>You take</th></tr></thead><tbody>${theirs || '<tr><td colspan="4">Nothing today.</td></tr>'}</tbody></table></div>
      <div><h3>You offer</h3><table><thead><tr><th></th><th>Aboard</th><th>Each</th><th>You give</th></tr></thead><tbody>${yours}</tbody></table></div>`;
    const q = C.quote(rules, s, fid, pointId, this.buy, this.sell, tr);
    const pct = q.cost ? Math.min(100, (q.pay / q.cost) * 100) : 0;
    $('trade-balance').innerHTML = `<span>You give <b>${fmt(q.pay)}</b> · they ask <b>${fmt(q.cost)}</b></span><div class="bar"><i style="width:${pct}%;background:${q.ok ? 'var(--good)' : 'var(--height)'}"></i></div><p>${esc(q.why)}</p>`;
    $('trade-deal').disabled = !q.ok;
    // cogmarks can make up the difference, either way
    const st = C.settle(rules, s, fid, pointId, this.buy, this.sell, tr);
    $('trade-settle').hidden = this.mode === 'hire' && !(s.stores.cogmarks | 0);
    $('trade-settle').disabled = (st.sell.cogmarks | 0) === (this.sell.cogmarks | 0) && (st.buy.cogmarks | 0) === (this.buy.cogmarks | 0);
    $('trade-settle').textContent = q.cost > q.pay ? 'Pay the difference in cogmarks' : q.pay > q.cost ? 'Take the change in cogmarks' : 'Settle in cogmarks';
  }
  tradeClick(e) {
    const b = e.target.closest('button[data-g]');
    if (!b) return;
    const side = b.dataset.s, g = b.dataset.g, d = +b.dataset.d, bag = side === 'buy' ? this.buy : this.sell;
    const { s, pointId } = this.o.trade;
    const cap = side === 'buy' ? C.stockOf(this.rules, s, this.o.fid, pointId, this.o.trade.trader || '').goods[g] | 0 : s.stores[g] | 0;
    bag[g] = Math.max(0, Math.min(cap, (bag[g] || 0) + d));
    this.renderTrade();
  }
  makeDeal() {
    const { s, pointId, onDeal, trader, deal } = this.o.trade;
    const r = deal ? deal(this.buy, this.sell) : C.deal(this.rules, s, this.o.fid, pointId, this.buy, this.sell, trader || '');
    if (!r.ok) { this.audio.play('error'); return; }
    this.audio.play('deal');
    const got = Object.entries(this.buy).filter(([, n]) => n > 0).map(([g, n]) => `${n} ${g.replace('ship:', '')}`).join(', ');
    $('comms-notes').insertAdjacentHTML('beforeend', `<li>Deal: ${esc(got)} for goods worth ${fmt(r.pay)}.</li>`);
    this.buy = {}; this.sell = {};
    if (onDeal) onDeal();
    this.renderTrade();
  }
}
