import { weights } from '../engine/content.js';
import { TIERS, tierIndex, standingOf, change, meet } from './standing.js';
import { ROLES } from './crew.js';

// Comms and trade. Dialogs are YAML trees (content/core/dialogs): nodes that say something and
// offer choices; a choice shows when its conditions hold and does a short list of effects from
// a fixed vocabulary. The same dialog runs on the star chart (effects change the voyage at once)
// and on a map (effects go to the simulation as an order; see traits/diplomacy.js).
//
// Trade is barter: every good has a value (trade.yaml), and a deal is fair when what you give is
// worth at least what you take at their prices. Prices move with your standing, their stock and
// what they want.

const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
const num = (o, k, d = 0) => (o && o[k] !== undefined ? +o[k] : d);
export const TREATIES = ['Ceasefire', 'Peace', 'Leave', 'Tribute'];
const COND_VERBS = ['station', 'not', 'tier', 'where', 'at', 'treaty', 'no', 'has', 'flag'];
const EFFECT_VERBS = ['trade', 'hire', 'close', 'pay', 'standing', 'treaty', 'ceasefire', 'threaten', 'reveal', 'flag'];

// ---------------------------------------------------------------- parsing
export function parseCond(text) {
  const w = text.trim().split(/\s+/);
  if (w[0] === 'station') return { op: 'station', want: true };
  if (w[0] === 'not' && w[1] === 'station') return { op: 'station', want: false };
  if (w[0] === 'tier' && (w[1] === '>=' || w[1] === '<=') && TIERS.includes(w[2])) return { op: 'tier', cmp: w[1], tier: TIERS.indexOf(w[2]) };
  if (w[0] === 'where' && (w[1] === 'chart' || w[1] === 'map')) return { op: 'where', where: w[1] };
  if (w[0] === 'at' && w[1] === 'war') return { op: 'war', want: true };
  if (w[0] === 'not' && w[1] === 'at' && w[2] === 'war') return { op: 'war', want: false };
  if (w[0] === 'treaty' && TREATIES.includes(w[1])) return { op: 'treaty', kind: w[1], want: true };
  if (w[0] === 'no' && w[1] === 'treaty' && TREATIES.includes(w[2])) return { op: 'treaty', kind: w[2], want: false };
  if (w[0] === 'has' && w[1] && +w[2] > 0) return { op: 'has', store: w[1], n: +w[2] };
  if (w[0] === 'flag' && w[1]) return { op: 'flag', flag: w[1], want: true };
  if (w[0] === 'not' && w[1] === 'flag' && w[2]) return { op: 'flag', flag: w[2], want: false };
  // voyage conditions (events, and dialogs on the star chart)
  if (w[0] === 'region' && w[1]) return { op: 'region', region: w[1] };
  if (w[0] === 'type' && w[1]) return { op: 'type', type: w[1], want: true };
  if (w[0] === 'not' && w[1] === 'type' && w[2]) return { op: 'type', type: w[2], want: false };
  if (w[0] === 'day' && w[1] === '>=' && +w[2] >= 0) return { op: 'day', n: +w[2] };
  if (w[0] === 'item' && w[1] && ['missing', 'found', 'installed'].includes(w[2])) return { op: 'item', item: w[1], state: w[2] };
  if (w[0] === 'here' && w[1] === 'relic' && w[2]) return { op: 'relic', item: w[2] };
  if (w[0] === 'crew' && w[1] === '>=' && +w[2] >= 0) return { op: 'crew', n: +w[2] };
  return { op: 'bad', text };
}
export function parseEffect(text) {
  const w = text.trim().split(/\s+/);
  switch (w[0]) {
    case 'trade': case 'hire': case 'close': case 'ceasefire': case 'threaten': return { op: w[0] };
    case 'pay': return w[1] && +w[2] > 0 ? { op: 'pay', store: w[1], n: +w[2] } : { op: 'bad', text };
    case 'standing': return Number.isFinite(+w[1]) ? { op: 'standing', n: +w[1] } : { op: 'bad', text };
    case 'treaty': return TREATIES.includes(w[1]) ? { op: 'treaty', kind: w[1] } : { op: 'bad', text };
    case 'reveal': return w[1] === 'survey' || w[1] === 'chart' ? { op: 'reveal', what: w[1] } : { op: 'bad', text };
    case 'flag': return w[1] ? { op: 'flag', flag: w[1] } : { op: 'bad', text };
    // events
    case 'give': return w[1] && +w[2] > 0 ? { op: 'give', store: w[1], n: +w[2] } : { op: 'bad', text };
    case 'crew': return ROLES.includes(w[1]) && +w[2] > 0 ? { op: 'crew', role: w[1], n: +w[2] } : { op: 'bad', text };
    case 'lose': return (w[1] === 'crew' || ROLES.includes(w[1])) && +w[2] > 0 ? { op: 'lose', role: w[1], n: +w[2] } : { op: 'bad', text };
    case 'damage': return (w[1] === 'hull' || ['drive', 'reactor', 'life', 'hydro', 'foundry', 'sensors'].includes(w[1])) && +w[2] > 0 ? { op: 'damage', system: w[1], n: +w[2] } : { op: 'bad', text };
    case 'morale': return Number.isFinite(+w[1]) ? { op: 'morale', n: +w[1] } : { op: 'bad', text };
    case 'item': return w[1] && w[2] === 'found' ? { op: 'item', item: w[1] } : { op: 'bad', text };
    case 'days': return +w[1] > 0 ? { op: 'days', n: +w[1] } : { op: 'bad', text };
    case 'ambush': return w[1] && w[2] ? { op: 'ambush', side: w[1], ships: w[2].split('+'), delay: +w[3] || 60 } : { op: 'bad', text };
    case 'monster': return w[1] ? { op: 'ambush', side: 'fauna', ships: w[1].split('+'), delay: +w[2] || 0, behaviour: w[1] === 'wyrm' ? 'burrow' : 'hunt' } : { op: 'bad', text };
    case 'roll': return +w[1] > 0 && w[2] && w[3] ? { op: 'roll', chance: +w[1], yes: w[2], no: w[3] } : { op: 'bad', text };
    case 'faction': return w[1] && Number.isFinite(+w[2]) ? { op: 'fstanding', fid: w[1], n: +w[2] } : { op: 'bad', text };
    default: return { op: 'bad', text };
  }
}

export function dialogOf(rules, fid) {
  const f = rules.content.factions[fid];
  return f ? rules.content.dialogs[f.Dialog || fid] || null : null;
}
const nodeKey = (id) => `Node@${id}`;

// Problems with a dialog (empty when it is sound).
export function lintDialog(rules, d) {
  const errs = [], stores = Object.keys(rules.content.resources);
  if (!d[nodeKey(d.Start)]) errs.push(`${d.id}: Start "${d.Start}" is not a node`);
  for (const [k, node] of Object.entries(d)) {
    if (!k.startsWith('Node@')) continue;
    if (!node.Say) errs.push(`${d.id}.${k}: no Say`);
    for (const [ck, c] of Object.entries(node)) {
      if (!ck.startsWith('Choice@')) continue;
      const where = `${d.id}.${k}.${ck}`;
      if (!c.Text) errs.push(`${where}: no Text`);
      for (const x of list(c.If)) { const p = parseCond(x); if (p.op === 'bad') errs.push(`${where}: unknown condition "${x}"`); else if (p.op === 'has' && !stores.includes(p.store)) errs.push(`${where}: unknown store "${p.store}"`); }
      for (const x of list(c.Do)) { const p = parseEffect(x); if (p.op === 'bad') errs.push(`${where}: unknown effect "${x}"`); else if (p.op === 'pay' && !stores.includes(p.store)) errs.push(`${where}: unknown store "${p.store}"`); }
      if (c.Goto && !d[nodeKey(c.Goto)]) errs.push(`${where}: Goto "${c.Goto}" is not a node`);
      for (const x of list(c.Do)) { const p = parseEffect(x); if (p.op === 'roll') for (const n of [p.yes, p.no]) if (!d[nodeKey(n)]) errs.push(`${where}: roll goes to "${n}", which is not a node`); if (p.op === 'item' && !rules.content.items[p.item]) errs.push(`${where}: unknown item "${p.item}"`); if (p.op === 'fstanding' && !rules.content.factions[p.fid]) errs.push(`${where}: unknown faction "${p.fid}"`); if (p.op === 'ambush' && p.side !== 'fauna' && !rules.content.factions[p.side]) errs.push(`${where}: unknown side "${p.side}"`); if (p.op === 'ambush') for (const t of p.ships) if (!rules.actors.has(t)) errs.push(`${where}: unknown ship "${t}"`); }
      if (!c.Goto && !list(c.Do).some((x) => ['close', 'trade', 'hire', 'roll'].includes(x.trim().split(/\s+/)[0]))) errs.push(`${where}: neither Goto nor close, trade, hire or roll`);
    }
  }
  return errs;
}

// ---------------------------------------------------------------- running a dialog
// ctx: { rules, fid, tier (0-4), station, where ('chart' | 'map'), atWar, treaties (kinds that
//        hold), flags (Set), stores { store: n }, place, region }
function holds(ctx, c) {
  switch (c.op) {
    case 'station': return !!ctx.station === c.want;
    case 'tier': return c.cmp === '>=' ? ctx.tier >= c.tier : ctx.tier <= c.tier;
    case 'where': return ctx.where === c.where;
    case 'war': return !!ctx.atWar === c.want;
    case 'treaty': return ctx.treaties.includes(c.kind) === c.want;
    case 'has': return (ctx.stores[c.store] | 0) >= c.n;
    case 'flag': return ctx.flags.has(c.flag) === c.want;
    // voyage conditions: only on the star chart (ctx.s), never on a map
    case 'region': return !!ctx.s && ctx.point && ctx.point.region === c.region;
    case 'type': return !!ctx.s && ctx.point && (ctx.point.type === c.type) === c.want;
    case 'day': return !!ctx.s && ctx.s.day >= c.n;
    case 'item': { if (!ctx.s) return false; const st = ctx.s.items[c.item]; return c.state === 'missing' ? !st : st === c.state; }
    case 'relic': return !!ctx.s && ctx.point && ctx.point.relic === c.item;
    case 'crew': return !!ctx.s && ROLES.reduce((t, r) => t + ctx.s.crew.roles[r], 0) >= c.n;
    default: return false;
  }
}
const fill = (ctx, t) => String(t).replace(/\{place\}/g, ctx.place || '').replace(/\{region\}/g, ctx.region || '').replace(/\{faction\}/g, ctx.factionName || '');

export const conditionsHold = (ctx, conds) => conds.every((c) => holds(ctx, c));

// What the node says, and the choices on offer: { say, choices: [{ id, text, ok, why, effects, goto }] }
export function nodeView(ctx, nodeId) {
  const d = ctx.dialog || dialogOf(ctx.rules, ctx.fid), node = d && d[nodeKey(nodeId)];
  if (!node) return null;
  const say = node[`Say@${TIERS[ctx.tier]}`] || node.Say;
  const choices = [];
  for (const [ck, c] of Object.entries(node)) {
    if (!ck.startsWith('Choice@')) continue;
    if (!list(c.If).map(parseCond).every((x) => holds(ctx, x))) continue;
    const effects = list(c.Do).map(parseEffect);
    const short = effects.find((e) => e.op === 'pay' && (ctx.stores[e.store] | 0) < e.n);
    choices.push({ id: ck.slice(7), text: fill(ctx, c.Text), ok: !short, why: short ? `You have ${ctx.stores[short.store] | 0} ${short.store}.` : '', effects, goto: c.Goto || null });
  }
  return { id: nodeId, say: fill(ctx, say), choices };
}

// ---------------------------------------------------------------- the voyage's side
export const activeTreaties = (s, fid) => (s.treaties || []).filter((t) => t.faction === fid && t.until > s.day).map((t) => t.kind);
export function addTreaty(rules, s, fid, kind) {
  s.treaties = (s.treaties || []).filter((t) => !(t.faction === fid && t.kind === kind) && t.until > s.day);
  const days = num(rules.content.treaties, kind, 10);
  s.treaties.push({ faction: fid, kind, until: s.day + days });
  return days;
}
export function breakTreaties(rules, s, fid) {
  const had = activeTreaties(s, fid);
  if (!had.length) return 0;
  s.treaties = s.treaties.filter((t) => t.faction !== fid);
  return num(rules.content.treaties, 'Break', -40);
}

// A dialog context for hailing a faction from the star chart, at the Forge's place.
export function chartContext(rules, s, galaxy, fid) {
  const p = galaxy.points[s.at];
  return {
    s, point: p,
    rules, fid, factionName: rules.content.factions[fid].Name,
    tier: tierIndex(rules, standingOf(rules, s, fid)), station: !!p.seat && p.owner === fid, where: 'chart', atWar: false,
    treaties: activeTreaties(s, fid), flags: new Set(s.flags || []), stores: s.stores,
    place: p.name, region: rules.content.regions[p.region].Name,
  };
}

// Do a choice's effects on the voyage (the star chart). Returns { open, close, notes: [] }.
export function applyOnChart(rules, s, galaxy, fid, effects) {
  const out = { open: null, close: false, notes: [] }, F = rules.content.factions[fid];
  for (const e of effects) {
    if (e.op === 'pay') { s.stores[e.store] = Math.max(0, (s.stores[e.store] | 0) - e.n); out.notes.push(`Paid ${e.n} ${e.store}.`); }
    else if (e.op === 'standing') { if (!fid) continue; const t = change(rules, s, fid, e.n); out.notes.push(`${F.Name}: ${e.n > 0 ? '+' : ''}${e.n} standing.`); if (t) out.notes.push(`The ${F.Name} are now ${t.to} toward the Forge.`); }
    else if (e.op === 'treaty') { const d = addTreaty(rules, s, fid, e.kind); out.notes.push(`${e.kind} with the ${F.Name} for ${d} days.`); }
    else if (e.op === 'ceasefire') { const d = addTreaty(rules, s, fid, 'Ceasefire'); out.notes.push(`Ceasefire with the ${F.Name} for ${d} days.`); }
    else if (e.op === 'flag') { s.flags = [...new Set([...(s.flags || []), e.flag])]; }
    else if (e.op === 'reveal') out.notes.push(reveal(rules, s, galaxy, e.what));
    else if (e.op === 'threaten') out.notes.push(threatenOnChart(rules, s, galaxy, fid));
    else if (e.op === 'trade' || e.op === 'hire') out.open = e.op;
    else if (e.op === 'close') out.close = true;
    else applyEventEffect(rules, s, galaxy, e, out);
  }
  return out;
}

// Effects that events use (and dialogs may): goods and crew gained or lost, damage, morale,
// a drive part, time passing, an ambush or a monster waiting on the next map here, a roll.
function applyEventEffect(rules, s, galaxy, e, out) {
  const sys = rules.content.systems, maxHp = rules.actor('forge').traitInfo('Health').HP;
  if (e.op === 'give') { s.stores[e.store] = (s.stores[e.store] | 0) + e.n; out.notes.push(`+${e.n} ${rules.content.resources[e.store]?.Name || e.store}.`); }
  else if (e.op === 'crew') { s.crew.roles[e.role] += e.n; out.notes.push(`${e.n} ${e.role} join the crew.`); }
  else if (e.op === 'lose') {
    let n = e.n;
    if (e.role === 'crew') { const lost = lossFrom(s, n); n = lost; } else n = Math.min(n, s.crew.roles[e.role]), s.crew.roles[e.role] -= n, s.crew.assigned[e.role] = Math.min(s.crew.assigned[e.role], s.crew.roles[e.role]);
    out.notes.push(`${n} of the crew lost.`);
  } else if (e.op === 'damage') {
    if (e.system === 'hull') s.forge.hp = Math.max(1, s.forge.hp - Math.trunc((maxHp * e.n) / 100));
    else s.systems[e.system] = Math.max(0, s.systems[e.system] - e.n);
    out.notes.push(`${e.system === 'hull' ? 'Hull' : sys[e.system].Name} −${e.n}%.`);
  } else if (e.op === 'morale') { s.morale = Math.max(0, Math.min(100, s.morale + e.n)); out.notes.push(`Morale ${e.n > 0 ? '+' : ''}${e.n}.`); }
  else if (e.op === 'item') { if (!s.items[e.item]) { s.items[e.item] = 'found'; out.notes.push(`The ${rules.content.items[e.item].Name} is aboard.`); out.found = e.item; } }
  else if (e.op === 'days') { out.days = (out.days || 0) + e.n; }
  else if (e.op === 'ambush') { (s.ahead ||= []).push({ at: s.at, side: e.side, ships: e.ships, delay: e.delay, behaviour: e.behaviour || 'hunt' }); }
  else if (e.op === 'roll') { out.goto = rollFor(s, e.chance) ? e.yes : e.no; }
  else if (e.op === 'fstanding') { const t = change(rules, s, e.fid, e.n); out.notes.push(`${rules.content.factions[e.fid].Name}: ${e.n > 0 ? '+' : ''}${e.n} standing.`); if (t) out.notes.push(`The ${rules.content.factions[e.fid].Name} are now ${t.to} toward the Forge.`); }
}
function lossFrom(s, n) {
  let left = n;
  for (const r of ROLES) { const k = Math.min(left, Math.max(0, s.crew.roles[r] - s.crew.assigned[r])); s.crew.roles[r] -= k; left -= k; }
  return n - left;
}
// A deterministic roll: the same voyage, day and place give the same result.
function rollFor(s, chance) {
  let h = (s.seed ^ Math.imul(s.day, 0x9e3779b1) ^ Math.imul(s.at + 1, 0x85ebca77) ^ Math.imul((s.rolls = (s.rolls | 0) + 1), 0xc2b2ae3d)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return (h % 100) < chance;
}

export function reveal(rules, s, galaxy, what) {
  const here = galaxy.points[s.at], known = new Set(s.known);
  let n = 0;
  if (what === 'chart') { for (const p of galaxy.points) if (p.region === here.region && !known.has(p.id)) { known.add(p.id); n++; } }
  else {
    let ring = [s.at];
    const seen = new Set(ring);
    for (let d = 0; d < 2; d++) {
      const next = [];
      for (const i of ring) for (const li of galaxy.adj[i]) { const l = galaxy.lanes[li], j = l.a === i ? l.b : l.a; if (!seen.has(j)) { seen.add(j); next.push(j); } }
      ring = next;
    }
    for (const j of seen) if (!known.has(j)) { known.add(j); n++; }
  }
  s.known = [...known].sort((a, b) => a - b);
  return what === 'chart' ? `The chart of ${rules.content.regions[here.region].Name}: ${n} places newly known.` : `A survey of everything within two stitches: ${n} places newly known.`;
}

// Threats: the fleet aboard against what they have here. Frightened, they hand over goods
// (and like you less); otherwise it only costs you.
export function fleetPower(rules, fleet) { return fleet.reduce((t, e) => t + (rules.actor(e.type).traitInfo('Armament') ? num(rules.actor(e.type).traitInfo('Valued'), 'Cost') : 0), 0); }
export function theirPower(rules, fid, danger, station) {
  const base = list(rules.content.factions[fid].Patrol).reduce((t, x) => t + num(rules.actor(x).traitInfo('Valued'), 'Cost'), 0);
  return Math.trunc((base * (2 + danger)) / 3) * (station ? 2 : 1);
}
function threatenOnChart(rules, s, galaxy, fid) {
  const p = galaxy.points[s.at], F = rules.content.factions[fid];
  const mine = fleetPower(rules, s.fleet), theirs = theirPower(rules, fid, +rules.content.regions[p.region].Danger || 1, !!p.seat && p.owner === fid);
  if (mine * 2 >= theirs * 3) {
    const [good, have] = weights(F.Sells)[0] || ['ore', 0];
    const n = Math.min(200, have);
    s.stores[good] = (s.stores[good] | 0) + n;
    change(rules, s, fid, -10);
    return `The ${F.Name} take one look at your fleet and hand over ${n} ${good}. They will not forget it (−10).`;
  }
  change(rules, s, fid, -15);
  return `The ${F.Name} laugh at you. Your fleet does not frighten them (−15).`;
}

// ---------------------------------------------------------------- trade
// What a station has, restocking a little each day since you last traded there.
export function stockOf(rules, s, fid, pointId) {
  const F = rules.content.factions[fid];
  const max = Object.fromEntries([...weights(F.Sells), ...weights(F.Hires)]);
  for (const t of list(F.Ships)) max[`ship:${t}`] = 2;
  s.stock ||= {};
  const k = String(pointId), rec = s.stock[k];
  if (!rec) return { max, goods: { ...max } };
  const goods = {};
  for (const [g, m] of Object.entries(max)) goods[g] = Math.min(m, (rec.goods[g] ?? m) + Math.trunc((m * 5 * Math.max(0, s.day - rec.day)) / 100));
  return { max, goods };
}

export function valueOf(rules, good) {
  if (good.startsWith('ship:')) { const t = good.slice(5); return Math.trunc((num(rules.actor(t).traitInfo('Valued'), 'Cost') * num(rules.content.trade, 'ShipPct', 140)) / 100); }
  return Object.fromEntries(weights(rules.content.trade.Value))[good] || 0;
}
const standingPct = (rules, tier) => Object.fromEntries(weights(rules.content.trade.Standing))[TIERS[tier]] || 0;

// Prices are in hundredths of a value unit, so small goods keep their discounts; a deal's total
// is rounded at the end (up for what you pay, down for what you get).
// What one unit costs you, bought from them: dearer when they dislike you and as stock runs low.
export function buyPrice(rules, tier, good, stock, max) {
  const T = rules.content.trade, base = valueOf(rules, good);
  const scarce = max > 0 ? Math.trunc((num(T, 'Scarce', 50) * (max - Math.min(max, stock))) / max) : 0;
  return Math.trunc((base * (100 + standingPct(rules, tier)) * (100 + scarce)) / 100);
}
// What they give you for one unit, sold to them: more for what they want, less when they dislike you.
export function sellPrice(rules, tier, fid, good) {
  const T = rules.content.trade, base = valueOf(rules, good);
  const wants = list(rules.content.factions[fid].Wants).includes(good) ? num(T, 'Wants', 70) : num(T, 'Unwanted', 30);
  return Math.trunc((base * wants * (100 - standingPct(rules, tier))) / 100);
}

// What you could sell them: everything in the hold that has a value.
export const sellable = (rules, s) => Object.keys(s.stores).filter((k) => valueOf(rules, k) > 0 && s.stores[k] > 0);

// Price a deal: buy { good: n } from them, sell { store: n } to them.
export function quote(rules, s, fid, pointId, buy, sell) {
  const tier = tierIndex(rules, standingOf(rules, s, fid)), { max, goods } = stockOf(rules, s, fid, pointId);
  let cost = 0, pay = 0;
  const why = [];
  for (const [g, n] of Object.entries(buy)) {
    if (n <= 0) continue;
    if ((goods[g] | 0) < n) why.push(`They have only ${goods[g] | 0} ${g.replace('ship:', '')}.`);
    // price rises as their stock runs down: each unit at the price for the stock left
    for (let i = 0; i < n; i++) cost += buyPrice(rules, tier, g, (goods[g] | 0) - i, max[g] | 0);
  }
  for (const [g, n] of Object.entries(sell)) {
    if (n <= 0) continue;
    if ((s.stores[g] | 0) < n) why.push(`You have only ${s.stores[g] | 0} ${g}.`);
    pay += sellPrice(rules, tier, fid, g) * n;
  }
  if (tier === 0) why.push('They will not trade with you.');
  cost = Math.ceil(cost / 100); pay = Math.trunc(pay / 100);
  // ships need room in the hangar
  const ships = Object.entries(buy).filter(([g, n]) => g.startsWith('ship:') && n > 0);
  if (ships.length) {
    const cap = rules.actor('forge').traitInfo('ProvidesCapacity')?.Amount || 30;
    const used = s.fleet.reduce((t, e) => t + (rules.actor(e.type).traitInfo('ConsumesCapacity')?.Amount || 0), 0);
    const add = ships.reduce((t, [g, n]) => t + n * (rules.actor(g.slice(5)).traitInfo('ConsumesCapacity')?.Amount || 0), 0);
    if (used + add > cap) why.push(used >= cap ? 'The hangar is full.' : `The hangar has room for ${cap - used} more capacity.`);
  }
  return { cost, pay, ok: !why.length && pay >= cost && cost > 0, why: why.length ? why.join(' ') : pay < cost ? `Not a fair deal: you give ${pay}, they want ${cost}.` : '' };
}

// Make the deal: goods change hands, crew and ships come aboard, their stock goes down, and
// trading warms them a little (+1 a deal).
export function deal(rules, s, fid, pointId, buy, sell) {
  const q = quote(rules, s, fid, pointId, buy, sell);
  if (!q.ok) return { ok: false, why: q.why || 'Nothing to trade.' };
  const { goods } = stockOf(rules, s, fid, pointId);
  for (const [g, n] of Object.entries(sell)) if (n > 0) s.stores[g] -= n;
  for (const [g, n] of Object.entries(buy)) {
    if (n <= 0) continue;
    goods[g] -= n;
    if (ROLES.includes(g)) s.crew.roles[g] += n;
    else if (g.startsWith('ship:')) {
      const t = g.slice(5), info = rules.actor(t), crew = info.traitInfo('Crew');
      for (let i = 0; i < n; i++) s.fleet.push({ type: t, hp: info.traitInfo('Health').HP });
      // a hired hull comes with its crew
      if (crew && crew.Count) { s.crew.roles[crew.Role] += crew.Count * n; s.crew.assigned[crew.Role] += crew.Count * n; }
    } else s.stores[g] = (s.stores[g] | 0) + n;
  }
  s.stock ||= {};
  s.stock[String(pointId)] = { day: s.day, goods };
  meet(rules, s, fid);
  change(rules, s, fid, num(rules.content.reputation, 'Trade', 1));
  return { ok: true, cost: q.cost, pay: q.pay };
}
