import { parseYaml, mergeFiles } from './miniyaml.js';
import { Rules } from './rules.js';
import { lintDialog } from '../galaxy/comms.js';

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
  const ruleTexts = [], weaponTexts = [], data = { Resources: [], PoiTypes: [], Regions: [], Items: [], Voyage: [], Names: [], Races: [], Factions: [], Trade: [], Dialogs: [], Events: [], Hints: [] }, manifests = [];
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
    if (!['start', 'arrive', 'travel', 'day', 'found', 'install', 'home'].includes(e.When)) errs.push(`events: ${e.id}.When: unknown trigger "${e.When}"`);
    if (e.Item && !rules.content.items[e.Item]) errs.push(`events: ${e.id}.Item: unknown item "${e.Item}"`);
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
  for (const a of rules.actors.values()) {
    const c = a.traitInfo('Collector');
    if (c) for (const k of list(c.Kinds)) if (!resources[k]) errs.push(`${a.name}: Collector.Kinds: unknown resource "${k}"`);
  }
  if (errs.length) throw new Error(`Content errors:\n${errs.join('\n')}`);
}
