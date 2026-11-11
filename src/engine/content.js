import { parseYaml, mergeFiles } from './miniyaml.js';
import { Rules } from './rules.js';
import { lintDialog, parseCond } from '../galaxy/comms.js';

// Content packs. Each pack is a folder under content/ with a pack.yaml manifest that lists
// its rule, weapon and data files. Packs load in order; files from later packs merge into
// earlier ones, so an add-on can add a ship, a resource or a point-of-interest type, or
// change existing ones, without touching the base game.
export const DEFAULT_PACKS = ['core'];

// Resource kinds that exist on point-of-interest maps (food and air live only in the galaxy hold).
export const mapKinds = (rules) => Object.keys(rules.content?.resources || { ore: 1 }).filter((k) => !rules.content?.resources?.[k]?.Galaxy);

const list = (v) => (Array.isArray(v) ? v : String(v || '').split(',').map((s) => s.trim()).filter(Boolean));

// A parsed data file as plain objects: { key: { Field: value or nested object } }.
export function nodesToObject(nodes) {
  const out = {};
  for (const n of nodes) out[n.key] = n.nodes.length ? { ...(n.value !== '' ? { _value: n.value } : {}), ...nodesToObject(n.nodes) } : n.value;
  return out;
}

export async function loadContent(readText, packs = DEFAULT_PACKS) {
  const ruleTexts = [], weaponTexts = [], data = { Resources: [], PoiTypes: [], Regions: [], Items: [], Voyage: [], Names: [], Races: [], Factions: [], Trade: [], Dialogs: [], Events: [], Hints: [], Crew: [], Memories: [], Hazards: [] }, manifests = [];
  for (const id of packs) {
    const base = `content/${id}/`;
    const nodes = parseYaml(await readText(`${base}pack.yaml`), `${base}pack.yaml`);
    const pack = nodes.find((n) => n.key === 'Pack');
    if (!pack) throw new Error(`${base}pack.yaml: no Pack node`);
    const field = (k) => pack.nodes.find((n) => n.key === k)?.value || '';
    manifests.push({ id: field('Id') || id, name: field('Name'), version: field('Version') });
    for (const f of list(field('Rules'))) ruleTexts.push([base + f, await readText(base + f)]);
    for (const f of list(field('Weapons'))) weaponTexts.push([base + f, await readText(base + f)]);
    for (const kind of Object.keys(data)) for (const f of list(field(kind))) data[kind].push(parseYaml(await readText(base + f), base + f));
  }
  const rules = new Rules(ruleTexts, weaponTexts);
  rules.packs = manifests;
  rules.content = {
    resources: Object.fromEntries([...mergeFiles(data.Resources)].map(([k, n]) => [k, { id: k, ...nodesToObject(n.nodes) }]).sort((a, b) => (+a[1].Order || 99) - (+b[1].Order || 99))),
    poiTypes: Object.fromEntries([...mergeFiles(data.PoiTypes)].map(([k, n]) => [k, { id: k, nodes: n.nodes, ...nodesToObject(n.nodes) }])),
    regions: Object.fromEntries([...mergeFiles(data.Regions)].map(([k, n]) => [k, { id: k, ...nodesToObject(n.nodes) }])),
    items: Object.fromEntries([...mergeFiles(data.Items)].filter(([k]) => k !== 'Blueprints').map(([k, n]) => [k, { id: k, ...nodesToObject(n.nodes) }])),
    blueprintStart: (([...mergeFiles(data.Items)].find(([k]) => k === 'Blueprints') || [null, { nodes: [] }])[1].nodes.find((n) => n.key === 'Start')?.value || '').split(',').map((s) => s.trim()).filter(Boolean),
  };
  const voyage = new Map(mergeFiles(data.Voyage));
  rules.content.voyage = voyage.has('Voyage') ? nodesToObject(voyage.get('Voyage').nodes) : {};
  rules.content.races = Object.fromEntries([...mergeFiles(data.Races)].map(([k, n]) => [k, { id: k, ...nodesToObject(n.nodes) }]));
  const factions = [...mergeFiles(data.Factions)];
  rules.content.reputation = nodesToObject(factions.find(([k]) => k === 'Reputation')?.[1].nodes || []);
  rules.content.factions = Object.fromEntries(factions.filter(([k]) => k !== 'Reputation').map(([k, n]) => [k, { id: k, ...nodesToObject(n.nodes) }]));
  const trade = new Map(mergeFiles(data.Trade));
  rules.content.trade = trade.has('Trade') ? nodesToObject(trade.get('Trade').nodes) : {};
  rules.content.treaties = trade.has('Treaties') ? nodesToObject(trade.get('Treaties').nodes) : {};
  rules.content.dialogs = Object.fromEntries([...mergeFiles(data.Dialogs)].map(([k, n]) => [k, { id: k, nodes: n.nodes, ...nodesToObject(n.nodes) }]));
  rules.content.events = Object.fromEntries([...mergeFiles(data.Events)].map(([k, n]) => [k, { id: k, nodes: n.nodes, ...nodesToObject(n.nodes) }]));
  rules.content.hints = Object.fromEntries([...mergeFiles(data.Hints)].map(([k, n]) => [k, { id: k, ...nodesToObject(n.nodes) }]));
  rules.content.names = Object.fromEntries([...mergeFiles(data.Names)].map(([k, n]) => [k, nodesToObject(n.nodes)]));
  const crew = new Map(mergeFiles(data.Crew));
  const crewPart = (k) => (crew.has(k) ? Object.fromEntries(crew.get(k).nodes.map((n) => [n.key, { id: n.key, ...nodesToObject(n.nodes) }])) : {});
  rules.content.crew = { posts: crewPart('Posts'), traits: crewPart('Traits'), stations: crewPart('Stations'), skills: crewPart('Skills'), leads: crew.has('Leads') ? nodesToObject(crew.get('Leads').nodes) : {} };
  const mem = [...mergeFiles(data.Memories)];
  rules.content.memories = Object.fromEntries(mem.filter(([k]) => k !== 'Anchors').map(([k, n]) => [k, { id: k, ...nodesToObject(n.nodes) }]));
  const anc = mem.find(([k]) => k === 'Anchors');
  rules.content.anchors = anc ? Object.fromEntries(anc[1].nodes.map((n) => [n.key, { id: n.key, ...nodesToObject(n.nodes) }])) : {};
  rules.content.hazards = Object.fromEntries([...mergeFiles(data.Hazards)].map(([k, n]) => [k, { id: k, ...nodesToObject(n.nodes) }]));
  // strain, moods and All hands (Milestone 17)
  for (const k of ['Strain', 'Mood', 'AllHands', 'Training']) rules.content[k[0].toLowerCase() + k.slice(1)] = voyage.has(k) ? nodesToObject(voyage.get(k).nodes) : {};
  rules.content.systems = voyage.has('Systems') ? Object.fromEntries(voyage.get('Systems').nodes.map((n) => [n.key, { id: n.key, ...nodesToObject(n.nodes) }])) : {};
  lintContent(rules);
  return rules;
}

// Cross-reference checks so broken content fails at load, not mid-game.
// "OreReef 3, ScrapShoal 2" -> [['OreReef', 3], ['ScrapShoal', 2]]
export const weights = (v) => list(v).map((s) => { const [k, w] = s.split(/\s+/); return [k, w === undefined ? 1 : +w]; });

export function lintContent(rules) {
  const { resources, poiTypes } = rules.content;
  if (!rules.content.factions) return;
  const errs = [];
  for (const [id, t] of Object.entries(poiTypes)) {
    for (const n of t.nodes) {
      const [kind] = n.key.split('@');
      const v = nodesToObject(n.nodes);
      if ((kind === 'Deposit' || kind === 'Clouds') && !resources[v.Kind]) errs.push(`${n.loc}: ${id}.${n.key}: unknown resource "${v.Kind}"`);
      if (kind === 'Wrecks') for (const s of list(v.Of)) if (!rules.actors.has(s)) errs.push(`${n.loc}: ${id}.${n.key}: unknown ship "${s}"`);
      if (kind === 'Encounter') {
        for (const s of list(v.Ships)) if (!rules.actors.has(s)) errs.push(`${n.loc}: ${id}.${n.key}: unknown ship "${s}"`);
        if (v.Side !== 'fauna' && !(rules.content.factions || {})[v.Side]) errs.push(`${n.loc}: ${id}.${n.key}: Side must be fauna or a faction`);
      }
    }
  }
  for (const [id, r] of Object.entries(rules.content.regions || {})) {
    for (const [t] of weights(r.Types)) if (!poiTypes[t]) errs.push(`regions: ${id}.Types: unknown point-of-interest type "${t}"`);
  }
  const { races = {}, factions = {}, regions = {} } = rules.content;
  for (const d of Object.values(rules.content.dialogs || {})) errs.push(...lintDialog(rules, d));
  for (const e of Object.values(rules.content.events || {})) {
    errs.push(...lintDialog(rules, e));
    if (!['start', 'arrive', 'travel', 'day', 'found', 'install', 'home', 'hazard', 'allhands'].includes(e.When)) errs.push(`events: ${e.id}.When: unknown trigger "${e.When}"`);
    if (e.Item && !rules.content.items[e.Item] && !(rules.content.memories || {})[e.Item] && !(rules.content.hazards || {})[e.Item]) errs.push(`events: ${e.id}.Item: unknown item, memory or hazard "${e.Item}"`);
  }
  for (const [id, f] of Object.entries(factions)) {
    if (f.Dialog && !(rules.content.dialogs || {})[f.Dialog]) errs.push(`factions: ${id}.Dialog: no dialog "${f.Dialog}"`);
    if (!races[f.Race]) errs.push(`factions: ${id}.Race: unknown race "${f.Race}"`);
    if (f.Station && !poiTypes[f.Station]) errs.push(`factions: ${id}.Station: unknown place type "${f.Station}"`);
    for (const s of list(f.Patrol)) if (!rules.actors.has(s)) errs.push(`factions: ${id}.Patrol: unknown ship "${s}"`);
    for (const e of list(f.Enemies)) if (!factions[e]) errs.push(`factions: ${id}.Enemies: unknown faction "${e}"`);
    for (const [r] of [...weights(f.Regions), ...weights(f.Seats)]) if (!regions[r]) errs.push(`factions: ${id}: unknown region "${r}"`);
  }
  for (const [id, it] of Object.entries(rules.content.items || {})) {
    if (it.Region && !rules.content.regions[it.Region]) errs.push(`items: ${id}.Region: unknown region "${it.Region}"`);
  }
  // named crew: posts come from a role and change a known bonus; traits point at traits
  const crew = rules.content.crew || { posts: {}, traits: {}, leads: {} };
  const BONUS = ['RepairPct', 'BuildPct', 'FoodPct', 'GlimPct', 'SensorPct', 'TradePct', 'CarePct', 'XpPct', 'HullPct', 'LaunchPct', 'ForgeDamagePct', 'CluePct'];
  const ROLES = ['engineers', 'pilots', 'miners', 'hands'];
  for (const [id, p] of Object.entries(crew.posts)) {
    if (!ROLES.includes(p.Role)) errs.push(`crew: Posts.${id}.Role: unknown role "${p.Role}"`);
    if (!BONUS.includes(p.Bonus)) errs.push(`crew: Posts.${id}.Bonus: unknown bonus "${p.Bonus}"`);
  }
  for (const r of Object.keys(crew.leads)) if (!ROLES.includes(r)) errs.push(`crew: Leads.${r}: unknown role`);
  for (const [id, st] of Object.entries(crew.stations || {})) {
    if (st.Post && !crew.posts[st.Post]) errs.push(`crew: Stations.${id}.Post: unknown post "${st.Post}"`);
    if (st.System && !(rules.content.systems || {})[st.System]) errs.push(`crew: Stations.${id}.System: unknown system "${st.System}"`);
    if (st.Room && (rules.content.items || {})[st.Room]?.Kind !== 'room') errs.push(`crew: Stations.${id}.Room: unknown room "${st.Room}"`);
    if (st.Needs && !(rules.content.memories || {})[st.Needs]) errs.push(`crew: Stations.${id}.Needs: unknown memory "${st.Needs}"`);
    for (const m of list(st.Memories)) if (!(rules.content.memories || {})[m]) errs.push(`crew: Stations.${id}.Memories: unknown memory "${m}"`);
    for (const k of list(st.Train)) if (!(crew.skills || {})[k]) errs.push(`crew: Stations.${id}.Train: unknown skill "${k}"`);
  }
  const SKILL = ['RepairCostPct', 'SystemWearPct', 'GlimPct', 'QuickStitch', 'SensorPct', 'ScanPct', 'BuildPct', 'SalvageCogPct', 'NeedPct', 'WaterPct', 'XpPct', 'LaunchPct', 'HailReach', 'Decode', 'Triage', 'CarePct', 'TradePct', 'CargoPct'];
  for (const [id, sk] of Object.entries(crew.skills || {})) if (!Object.keys(sk).some((k) => SKILL.includes(k))) errs.push(`crew: Skills.${id}: no effect (one of ${SKILL.join(', ')})`);
  for (const [k, ids] of Object.entries((rules.content.strain || {}).Dark || {})) for (const id of list(ids)) if (!(crew.stations || {})[id]) errs.push(`voyage: Strain.Dark.${k}: unknown station "${id}"`);
  for (const [id, it] of Object.entries(rules.content.items || {})) if (it.Kind === 'room' && it.Requires && rules.content.items[it.Requires]?.Kind !== 'room') errs.push(`items: ${id}.Requires: unknown room "${it.Requires}"`);
  for (const [id, tr] of Object.entries(crew.traits)) {
    if (!['officer', 'lead', 'both'].includes(tr.For || 'both')) errs.push(`crew: Traits.${id}.For: officer, lead or both`);
    for (const k of ['Becomes', 'Escape']) if (tr[k] && !crew.traits[tr[k]]) errs.push(`crew: Traits.${id}.${k}: unknown trait "${tr[k]}"`);
    for (const c of list(tr.When)) if (parseCond(c).op === 'bad') errs.push(`crew: Traits.${id}.When: unknown condition "${c}"`);
  }
  if (Object.keys(crew.posts).length && !(rules.content.names?.People?.Given && rules.content.names?.People?.Family)) errs.push('names: People needs Given and Family names for the crew');
  // memories: what they need and give point at real things; anchors at real regions and places
  const M = rules.content.memories || {}, A = rules.content.anchors || {}, items = rules.content.items || {};
  const BRANCHES = ['origins', 'skein', 'forge', 'fleet', 'decks'];
  for (const [id, m] of Object.entries(M)) {
    if (!m.Name) errs.push(`memories: ${id}: no Name`);
    if (!['knowledge', 'ability'].includes(m.Kind)) errs.push(`memories: ${id}.Kind: knowledge or ability`);
    if (!BRANCHES.includes(m.Branch)) errs.push(`memories: ${id}.Branch: one of ${BRANCHES.join(', ')}`);
    for (const n of list(m.Needs)) if (!M[n]) errs.push(`memories: ${id}.Needs: unknown memory "${n}"`);
    if (m.Found && !A[m.Found] && !(items[m.Found] && items[m.Found].Region)) errs.push(`memories: ${id}.Found: unknown anchor "${m.Found}"`);
    if (m.Blueprint && items[m.Blueprint]?.Kind !== 'blueprint') errs.push(`memories: ${id}.Blueprint: unknown blueprint "${m.Blueprint}"`);
    if (m.Ready !== 'false' && !m.Found && !m.Blueprint && m.Cost === undefined) errs.push(`memories: ${id}: needs Found, Blueprint or Cost`);
    for (const g of list(m.Gives)) {
      const [op, arg] = g.split(/\s+/);
      if (op === 'drive' && items[arg]?.Kind !== 'drive') errs.push(`memories: ${id}.Gives: unknown drive part "${arg}"`);
      else if (op === 'hull' && !rules.actors.has(arg)) errs.push(`memories: ${id}.Gives: unknown ship "${arg}"`);
      else if (op === 'echoes' && !(+arg > 0)) errs.push(`memories: ${id}.Gives: echoes needs a number`);
      else if (op === 'open' && !(rules.content.hazards || {})[arg]) errs.push(`memories: ${id}.Gives: unknown hazard "${arg}"`);
      else if (op === 'room' && items[arg]?.Kind !== 'room') errs.push(`memories: ${id}.Gives: unknown room "${arg}"`);
      else if (!['radar', 'drive', 'hull', 'echoes', 'open', 'room'].includes(op)) errs.push(`memories: ${id}.Gives: unknown effect "${g}"`);
    }
  }
  for (const [id, m] of Object.entries(M)) if (m.Seen && !(rules.content.hazards || {})[m.Seen]) errs.push(`memories: ${id}.Seen: unknown hazard "${m.Seen}"`);
  for (const [id, h] of Object.entries(rules.content.hazards || {})) {
    if (!M[h.Opens]) errs.push(`hazards: ${id}.Opens: unknown memory "${h.Opens}"`);
    if (!crew.posts[h.Report]) errs.push(`hazards: ${id}.Report: unknown post "${h.Report}"`);
    for (const [r] of weights(h.Pockets)) if (!(rules.content.regions || {})[r]) errs.push(`hazards: ${id}.Pockets: unknown region "${r}"`);
  }
  for (const [id, a] of Object.entries(A)) {
    if (!(rules.content.regions || {})[a.Region]) errs.push(`memories: Anchors.${id}.Region: unknown region "${a.Region}"`);
    if (!poiTypes[a.Type]) errs.push(`memories: Anchors.${id}.Type: unknown place type "${a.Type}"`);
  }
  for (const a of rules.actors.values()) {
    const c = a.traitInfo('Collector');
    if (c) for (const k of list(c.Kinds)) if (!resources[k]) errs.push(`${a.name}: Collector.Kinds: unknown resource "${k}"`);
  }
  if (errs.length) throw new Error(`Content errors:\n${errs.join('\n')}`);
}
