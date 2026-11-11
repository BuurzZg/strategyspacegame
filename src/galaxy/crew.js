import { hashMix } from '../engine/math.js';

// The crew. Everyone aboard is counted in four roles; a few of them also have names: the
// officers who head the Forge's departments (content/core/crew.yaml, Posts), and the lead of
// every armed ship (its pilot, or the captain of a ship crewed by hands). Named people are
// counted in their role like everyone else, and every change goes through these functions,
// so the head counts and the names always agree:
//   named in a role <= everyone in it; officers never fly; a ship's lead flies it.
//
// A roster is plain data:
//   roles     everyone, by role
//   assigned  those flying ships in the fleet (the rest are free for work and new ships)
//   people    the named: { id, name, role, post ('' for a ship's lead), trait, traitDay, joined, kills }
//   fallen    the named who died or left: { ...person, day, how }
//   seed, next (the next person's id), rolls (draws made, for the dice)
// A fleet entry ({ type, hp, xp }) names its lead by id: e.lead.

export const ROLES = ['engineers', 'pilots', 'miners', 'hands'];

export function makeRoster(counts, seed = 1) {
  const roles = {}, assigned = {};
  for (const r of ROLES) { roles[r] = Math.max(0, counts[r] | 0); assigned[r] = 0; }
  return { roles, assigned, seed: seed | 0, next: 1, rolls: 0, people: [], fallen: [] };
}

export const count = (c, role) => (role ? c.roles[role] | 0 : ROLES.reduce((s, r) => s + (c.roles[r] | 0), 0));
export const free = (c, role) => Math.max(0, (c.roles[role] | 0) - (c.assigned[role] | 0));
export const freeAll = (c) => Object.fromEntries(ROLES.map((r) => [r, free(c, r)]));

// ---------------------------------------------------------------- who is who
const people = (c) => c.people || [];
export const personById = (c, id) => people(c).find((p) => p.id === id) || null;
export const officerOf = (c, post) => people(c).find((p) => p.post === post) || null;
export const officersIn = (c, role) => people(c).filter((p) => p.post && p.role === role);
export const named = (c, role) => people(c).filter((p) => p.role === role);
// the leads of fleet entries, and named leads with no ship (their ship was lost; they got out)
export const leadsOf = (c, fleet) => fleet.filter((e) => e.lead && personById(c, e.lead)).map((e) => personById(c, e.lead));
export const idle = (c, fleet, role) => people(c).filter((p) => !p.post && p.role === role && !fleet.some((e) => e.lead === p.id));

// The role whose member leads this ship (an armed ship crewed by pilots or hands), or null.
export function leadRole(rules, type) {
  const info = rules.actor(type), k = info.traitInfo('Crew');
  if (!k || !k.Count || !info.traitInfo('Armament')) return null;
  return (rules.content.crew || {}).leads?.[k.Role] ? k.Role : null;
}
export const traitOf = (rules, p) => (rules.content.crew?.traits || {})[p.trait] || { Name: p.trait || '', Text: '' };
export const titleOf = (rules, p) => (p.post ? rules.content.crew.posts[p.post]?.Name || p.post : rules.content.crew?.leads?.[p.role] || 'Crew');
export const fullName = (rules, p) => `${titleOf(rules, p)} ${p.name}`;

// ---------------------------------------------------------------- dice and names
const hash = (...xs) => { let h = 2166136261; for (const x of xs) h = hashMix(h, x | 0); return h >>> 0; };
function roll(c, n) { c.rolls = (c.rolls | 0) + 1; return hash(c.seed, 0x5eed, c.rolls) % Math.max(1, n); }

const nameList = (rules, k) => String(rules.content.names?.People?.[k] || 'Nobody').split(',').map((x) => x.trim()).filter(Boolean);
// Someone new, decided by the voyage's seed and their id. `taken`: names already in use.
export function newPerson(rules, c, id, role, { lead = false, trait = '', day = 1, taken = new Set() } = {}) {
  const G = nameList(rules, 'Given'), F = nameList(rules, 'Family');
  const g = G[hash(c.seed, id, 1) % G.length];
  let f = hash(c.seed, id, 2) % F.length, name = `${g} ${F[f]}`;
  for (let i = 0; i < F.length && taken.has(name); i++) { f = (f + 1) % F.length; name = `${g} ${F[f]}`; }
  if (!trait) {
    const pool = Object.values(rules.content.crew?.traits || {}).filter((t) => (+t.Weight | 0) > 0 && (t.For === 'both' || t.For === (lead ? 'lead' : 'officer')));
    let r = hash(c.seed, id, 3) % Math.max(1, pool.reduce((s, t) => s + (+t.Weight | 0), 0));
    for (const t of pool) { r -= +t.Weight | 0; if (r < 0) { trait = t.id; break; } }
  }
  return { id, name, role, post: '', trait, traitDay: day, joined: day, kills: 0 };
}
export const namesInUse = (c) => new Set([...people(c), ...(c.fallen || [])].map((p) => p.name));

// ---------------------------------------------------------------- traits
// A person's modifiers now: { work, damage, hull, learn, morale } in percent (morale in points).
// `holds(text)`: whether a trait's When conditions hold (the voyage supplies it).
export function mods(rules, p, holds = () => true) {
  const t = traitOf(rules, p);
  if (t.When && !holds(t.When)) return { work: 0, damage: 0, hull: 0, learn: 0, morale: 0 };
  return { work: +t.Work | 0, damage: +t.Damage | 0, hull: +t.Hull | 0, learn: +t.Learn | 0, morale: +t.Morale | 0 };
}
// The officers' part of a bonus key, in percent (100: no change).
export function officerPct(rules, c, key, holds) {
  let v = 100;
  for (const post of Object.values(rules.content.crew?.posts || {})) {
    if (post.Bonus !== key) continue;
    const o = officerOf(c, post.id);
    if (!o) continue;
    const w = mods(rules, o, holds).work;
    v = Math.trunc((v * (100 + (post.Less === 'true' ? -w : w))) / 100);
  }
  return v;
}
// What everyone named adds to the crew's morale.
export const moraleMod = (rules, c, holds) => people(c).reduce((t, p) => t + mods(rules, p, holds).morale, 0);

// A day passes: traits that grow into others do. Returns notes.
export function grow(rules, c, day) {
  const out = [];
  for (const p of people(c)) {
    const t = traitOf(rules, p), to = rules.content.crew?.traits?.[t.Becomes];
    if (!t.After || !to || day - (p.traitDay | 0) < +t.After) continue;
    p.trait = to.id; p.traitDay = day;
    out.push(`${fullName(rules, p)} is ${t.Name.toLowerCase()} no longer: now ${to.Name.toLowerCase()}.`);
  }
  return out;
}

// ---------------------------------------------------------------- losses
// Someone named dies or leaves (the head count is changed by the caller).
function bury(c, p, why) {
  c.people = people(c).filter((q) => q !== p);
  (c.fallen ||= []).push({ ...p, day: why.day | 0, how: why.how || 'lost' });
}
// One named person dies (an event, or a ship lost with its lead aboard).
export function kill(c, id, why = {}) {
  const p = personById(c, id);
  if (!p) return null;
  bury(c, p, why);
  c.roles[p.role] = Math.max(0, (c.roles[p.role] | 0) - 1);
  if (c.assigned[p.role] > c.roles[p.role]) c.assigned[p.role] = c.roles[p.role];
  return p;
}
// Of `pool` people, `k` are lost; each of `list` (named, among the pool) is one of them with
// the right odds, drawing one by one.
function pick(c, list, pool, k, why) {
  for (const p of [...list].sort((a, b) => a.id - b.id)) {
    if (k <= 0 || pool <= 0) break;
    if (roll(c, pool) < k) { bury(c, p, why); k--; }
    pool--;
  }
}

// n of a role die (or leave). Free crew go first (officers among them); if a role runs short,
// ships lose theirs too (their leads among them). Who dies is drawn at random: a named person
// is as likely to be lost as anyone else in their role. `fleet`: to tell leads from idle.
export function lose(c, role, n, why = {}, fleet = []) {
  const k = Math.min(n | 0, c.roles[role] | 0);
  if (k <= 0) return 0;
  const fr = free(c, role), kFree = Math.min(k, fr), kFly = k - kFree;
  const leads = new Set(fleet.map((e) => e.lead));
  pick(c, named(c, role).filter((p) => !leads.has(p.id)), fr, kFree, why);
  if (kFly > 0) pick(c, named(c, role).filter((p) => leads.has(p.id)), c.assigned[role] | 0, kFly, why);
  c.roles[role] -= k;
  if (c.assigned[role] > c.roles[role]) c.assigned[role] = c.roles[role];
  return k;
}

// n people from the whole crew, spread over the roles in proportion to their size (largest
// remainder first, in role order on ties). Returns { role: lost }.
export function loseAny(c, n, why = {}, fleet = []) {
  const total = count(c), out = Object.fromEntries(ROLES.map((r) => [r, 0]));
  n = Math.min(n | 0, total);
  if (n <= 0) return out;
  let left = n;
  const rem = [];
  for (const r of ROLES) {
    const share = Math.trunc((n * c.roles[r]) / total);
    out[r] = share; left -= share;
    rem.push([((n * c.roles[r]) % total), r]);
  }
  rem.sort((a, b) => b[0] - a[0] || ROLES.indexOf(a[1]) - ROLES.indexOf(b[1]));
  for (let i = 0; left > 0; i = (i + 1) % rem.length) { const r = rem[i][1]; if (c.roles[r] - out[r] > 0) { out[r]++; left--; } }
  for (const r of ROLES) lose(c, r, out[r], why, fleet);
  return out;
}

// n free people, role by role in order (an event's "lose crew"): nobody flying is touched.
export function loseFree(c, n, why = {}, fleet = []) {
  let left = n | 0;
  for (const r of ROLES) { const k = Math.min(left, free(c, r)); lose(c, r, k, why, fleet); left -= k; }
  return (n | 0) - left;
}

// n of a role lost with ships on a map, besides their named leads (whom the caller has
// already counted out): the unnamed go; only if there are not enough does anyone named.
export function loseFlying(c, role, n, why = {}, fleet = []) {
  const unnamed = Math.max(0, (c.roles[role] | 0) - named(c, role).length), k = Math.min(n | 0, unnamed);
  c.roles[role] -= k;
  return k + lose(c, role, (n | 0) - k, why, fleet);
}

// ---------------------------------------------------------------- keeping it consistent
// Re-count who is flying (the crew of every ship in the fleet, from the rules), fill empty
// posts and give every armed ship a lead. Officers are counted first and never fly; a post is
// filled by promoting someone unnamed (Green, unless `fresh`: a new voyage's officers), or a
// named lead with no ship. Returns notes about who stepped up.
export function assignFleet(c, rules, fleet, { day = 1, fresh = false } = {}) {
  const out = [], C = rules.content.crew || { posts: {}, leads: {} };
  c.people ||= []; c.fallen ||= [];
  // leads who are gone, or of ships that have none
  const seen = new Set();
  for (const e of fleet) {
    if (!e.lead) continue;
    const p = personById(c, e.lead), r = leadRole(rules, e.type);
    if (!p || !r || p.role !== r || p.post || seen.has(e.lead)) delete e.lead;
    else seen.add(e.lead);
  }
  // never more named than people in a role (only if something changed the counts directly)
  for (const r of ROLES) {
    while (named(c, r).length > (c.roles[r] | 0)) {
      const list = named(c, r), p = idle(c, fleet, r)[0] || list.find((q) => !q.post) || list[list.length - 1];
      bury(c, p, { day, how: 'lost' });
      for (const e of fleet) if (e.lead === p.id) delete e.lead;
    }
  }
  const unnamed = (r) => (c.roles[r] | 0) - named(c, r).length;
  const taken = namesInUse(c);
  const join = (role, opts) => { const p = newPerson(rules, c, c.next++, role, { ...opts, day, taken }); taken.add(p.name); c.people.push(p); return p; };
  for (const post of Object.values(C.posts)) {
    if (officerOf(c, post.id)) continue;
    const r = post.Role;
    let p = null;
    if (unnamed(r) > 0) p = join(r, fresh ? {} : { trait: C.traits?.green ? 'green' : '' });
    else p = idle(c, fleet, r)[0] || null;
    if (!p) continue;
    p.post = post.id;
    if (!fresh) out.push(`${p.name} steps up as ${post.Name.toLowerCase()} (${traitOf(rules, p).Name.toLowerCase()}).`);
  }
  // who is flying
  for (const r of ROLES) c.assigned[r] = 0;
  for (const e of fleet) {
    const k = rules.actor(e.type).traitInfo('Crew');
    if (k && k.Count) c.assigned[k.Role] = (c.assigned[k.Role] | 0) + k.Count;
  }
  for (const r of ROLES) c.assigned[r] = Math.max(0, Math.min(c.assigned[r], (c.roles[r] | 0) - officersIn(c, r).length));
  // every armed ship has a lead: a named lead with no ship first, or someone new
  for (const e of fleet) {
    const r = leadRole(rules, e.type);
    if (!r || e.lead) continue;
    let p = idle(c, fleet, r)[0] || null;
    if (!p && unnamed(r) > 0) p = join(r, { lead: true });
    if (!p) continue;
    e.lead = p.id;
    if (!fresh) out.push(`${fullName(rules, p)} (${traitOf(rules, p).Name.toLowerCase()}) takes the ${rules.actor(e.type).traitInfo('Tooltip').Name}.`);
  }
  return out;
}

// Problems with a roster (empty when it is sound): for tests.
export function checkRoster(rules, c, fleet) {
  const errs = [], ids = new Set(), names = new Set();
  for (const p of people(c)) {
    if (ids.has(p.id)) errs.push(`two people with id ${p.id}`);
    if (names.has(p.name)) errs.push(`two people named ${p.name}`);
    ids.add(p.id); names.add(p.name);
    if (!ROLES.includes(p.role)) errs.push(`${p.name}: unknown role ${p.role}`);
    if (p.post && rules.content.crew.posts[p.post]?.Role !== p.role) errs.push(`${p.name}: a ${p.role} cannot be ${p.post}`);
    if (!rules.content.crew.traits[p.trait]) errs.push(`${p.name}: unknown trait ${p.trait}`);
    if (p.id >= c.next) errs.push(`${p.name}: id ${p.id} is not below next (${c.next})`);
  }
  for (const f of c.fallen || []) if (ids.has(f.id)) errs.push(`${f.name} is both aboard and fallen`);
  for (const r of ROLES) {
    if (named(c, r).length > c.roles[r]) errs.push(`${r}: ${named(c, r).length} named but only ${c.roles[r]} aboard`);
    if (c.assigned[r] > c.roles[r] - officersIn(c, r).length) errs.push(`${r}: officers are flying`);
  }
  const posts = new Set();
  for (const p of people(c)) if (p.post) { if (posts.has(p.post)) errs.push(`two people are ${p.post}`); posts.add(p.post); }
  const leading = new Set();
  for (const e of fleet) {
    if (!e.lead) continue;
    const p = personById(c, e.lead);
    if (!p) errs.push(`a ${e.type} is led by someone who is not aboard (${e.lead})`);
    else if (p.post) errs.push(`${p.name} is an officer and leads a ${e.type}`);
    else if (p.role !== leadRole(rules, e.type)) errs.push(`${p.name} (${p.role}) cannot lead a ${e.type}`);
    if (leading.has(e.lead)) errs.push(`${e.lead} leads two ships`);
    leading.add(e.lead);
  }
  return errs;
}
