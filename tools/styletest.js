// The brass age holds together, no browser needed:  npm test  (Milestone 23)
// Text stays readable: every pair of text and background colours the screens use (the soot panels,
// the parchment chart and telegrams, the Choir's light, the gauges) has a contrast of at least 4.5:1.
// The models stay cheap: every hull, in every faction's plating, is built and counted against a
// budget of meshes (draw calls) and triangles for its size. And the pieces of the reskin are there:
// plating for every faction, smokestacks and portholes on the hulls, rotary guns, the lightning
// lance, a wax seal for every kind of place, gauges and medallions.
import { readFile } from 'node:fs/promises';
import { rules as loadCore } from './headless.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

// a stand-in for the browser's canvas, so the models' textures can be made (and ignored) here
const ctx2d = new Proxy({}, { get: (_, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }) };
const THREE = await import('../lib/three.module.js');
const { buildShip } = await import('../src/render/ships.js');
const { factionStyle } = await import('../src/render/worldrenderer.js');
const { sealOf } = await import('../src/render/galaxy.js');
const { gauge, medal, causeIcon } = await import('../src/ui/instruments.js');
const rules = await loadCore();

// ---------------------------------------------------------------- contrast
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const root = html.slice(html.indexOf(':root {'), html.indexOf('}', html.indexOf(':root {')));
const tok = {};
for (const m of root.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6}|rgba?\([^)]*\))/gi)) tok[m[1]] = m[2];
const rgb = (c) => {
  if (c.startsWith('#')) return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 1];
  const v = c.match(/[\d.]+/g).map(Number);
  return [v[0], v[1], v[2], v[3] ?? 1];
};
// a colour with alpha laid over a solid one
const over = (fg, bg) => { const f = rgb(fg), b = rgb(bg); return `#${[0, 1, 2].map((i) => Math.round(f[i] * f[3] + b[i] * (1 - f[3])).toString(16).padStart(2, '0')).join('')}`; };
const lum = (c) => { const v = rgb(c).slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const ratio = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };
const panel = over(tok.panel, tok.ink), paper = tok.parchment, sepia = tok.sepia;
check(Object.keys(tok).length >= 20 && panel && paper && sepia, `the colour tokens are read from index.html (${Object.keys(tok).length}: panel on iron is ${panel})`);
const pairs = [
  // the soot panels
  ['text on a panel', tok.text, panel], ['muted text on a panel', tok.muted, panel], ['Glim accent on a panel', tok.accent, panel],
  ['amber on a panel', tok.height, panel], ['signal red on a panel', tok.hostile, panel], ['enamel green on a panel', tok.good, panel],
  ['ore costs on a panel', tok.ore, panel], ['the rally colour on a panel', tok.rally, panel], ['brass on a panel', tok.brass, panel],
  ['text on iron', tok.text, tok.ink], ['muted text on iron', tok.muted, tok.ink],
  // the parchment chart: names, regions, the Veil, pencil, the Hands
  ['a place name in ink on the chart', '#2a1d10', paper], ['a far place name', over('rgba(59,42,26,0.82)', paper), paper],
  ['a region name', over('rgba(59,42,26,0.78)', paper), paper], ['the Veil in violet ink', over('rgba(92,58,110,0.9)', paper), paper],
  ['a pencil clue', over('rgba(60,60,60,0.92)', paper), paper], ['a Hand in red ink', '#8e1a24', paper],
  // telegrams
  ['a telegram in ink', sepia, paper], ['a Gaunt telegram, half burned', sepia, '#e2d0a8'], ['the Choir in light', '#e6f6ff', '#15131c'],
  ['a refused choice', '#8a4b0f', paper], ['a note on a telegram', '#2f5a26', paper],
  ...[['Hostile', '#9e1b2a'], ['Wary', '#8a4b0f'], ['Neutral', '#5d4519'], ['Friendly', '#2f5a26'], ['Allied', '#1f5a50']].map(([n, c]) => [`the ${n} stamp on a telegram`, c, paper]),
  // instruments
  ['a gauge counter', tok.parchment, '#0d0b09'], ['a gauge label on its dial', '#3b2a1a', '#efe6cf'], ['a counter plate', tok.text, '#2f271d'],
];
for (const [name, fg, bg] of pairs) { const r = ratio(fg, bg); check(r >= 4.5, `${name}: ${r.toFixed(2)}:1`); }

// ---------------------------------------------------------------- models
const factions = rules.actor('World').traitInfosOf('Faction');
const styles = factions.map(factionStyle);
const types = [...new Set([...rules.actors.values()].map((a) => a.traitInfo && a.traitInfo('WithModel')).filter(Boolean).map((w) => w.Model))];
const count = (m) => { let meshes = 0, tris = 0; m.root.traverse((o) => { if (o.isMesh) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return { meshes, tris: Math.round(tris) }; };
// budgets by length (model units): small craft, ships of the line, capitals and stations
const budget = (L) => (L < 5 ? { meshes: 40, tris: 1500 } : L < 20 ? { meshes: 80, tris: 3500 } : { meshes: 130, tris: 9000 });
const over_ = [];
let worst = { tris: 0 };
for (const st of styles) for (const t of types) {
  const m = buildShip(t, st), c = count(m), b = budget(m.length);
  if (c.meshes > b.meshes || c.tris > b.tris) over_.push(`${t}/${st.id} ${c.meshes} meshes ${c.tris} tris`);
  if (c.tris > worst.tris) worst = { ...c, t, st: st.id };
}
check(types.length >= 30, `${types.length} hulls built in each of ${styles.length} platings`);
check(!over_.length, `every hull within its budget (40 meshes / 1500 triangles under 5 units long, 80 / 3500 under 20, 130 / 9000 above); the heaviest is ${worst.t} (${worst.tris} triangles)${over_.length ? `; over: ${over_.slice(0, 6).join(', ')}` : ''}`);
// a 40-a-side battle of the line: what the renderer is asked to draw
const line = ['dart', 'talon', 'picket', 'halberd', 'spindle', 'sabre'], meridian = styles.find((s) => s.id === 'meridian'), gauntS = styles.find((s) => s.id === 'gaunt');
let calls = 0, tris = 0;
for (let i = 0; i < 40; i++) for (const st of [meridian, gauntS]) { const c = count(buildShip(line[i % line.length], st)); calls += c.meshes; tris += c.tris; }
check(calls <= 2400 && tris <= 120000, `40 a side: ${calls} meshes and ${tris} triangles (budget 2400 and 120000)`);

// ---------------------------------------------------------------- the pieces
const plated = styles.filter((s) => !['choir', 'fauna', 'wound'].includes(s.id));
check(plated.every((s) => s.hull.length >= 1 && s.shine >= 0 && s.shine <= 100), `every faction that builds ships has its plating (${plated.map((s) => `${s.id} ${s.hull.length}`).join(', ')})`);
const rivet = styles.find((s) => s.id === 'rivet'), syn = styles.find((s) => s.id === 'synod');
check(rivet.hull.length >= 3 && syn.hull.length === 1 && lum(`#${syn.hull[0].toString(16)}`) > 0.6, 'the Rivet Moot is patched from several plates; the Synod is waxy cream');
const plateColours = new Set(plated.map((s) => s.hull[0]));
check(plateColours.size === plated.length, 'no two factions share their first plate colour');
const hal = buildShip('halberd', meridian), forge = buildShip('forge', meridian), dart = buildShip('dart', meridian), sab = buildShip('sabre', gauntS);
check(forge.stacks.length === 3 && hal.stacks.length >= 1 && sab.stacks.length >= 1 && dart.stacks.length === 0, `smokestacks vent steam: the Forge 3, a halberd ${hal.stacks.length}, a sabre ${sab.stacks.length}, a dart none`);
const ports = (m) => m.body.children.some((o) => o.isMesh && o.material.color && o.material.color.getHex() === 0xffc070);
check(ports(forge) && ports(sab) && !ports(dart), 'big plates carry rows of warm portholes; small craft none');
check(['halberd', 'picket', 'sabre'].every((t) => buildShip(t, meridian).spin.length >= 1), 'halberds, pickets and sabres carry rotary guns that spin');
check(['bloom', 'moth', 'gnasher', 'hollowhorn'].every((t) => !buildShip(t, styles.find((s) => s.id === 'fauna')).stacks.length) && !buildShip('tick', styles.find((s) => s.id === 'wound')).stacks.length, 'creatures, the Choir and the Wound get no smokestacks');
const wreck = (await import('../src/render/ships.js')).buildWreck('halberd', 3, meridian);
check(wreck.stacks.length === 0 && wreck.spin.length === 0, 'a wreck neither steams nor spins');
const lance = rules.weapons.get('Lance');
check(lance && lance.projectile.Arc === true && !rules.weapons.get('MothLight').projectile.Arc, 'the Spindle\'s lance throws lightning (Arc); the Choir\'s light stays a beam');
check(typeof THREE.Mesh === 'function', 'three.js loads without a browser');

// the chart's seals and the instruments
const T = rules.content.poiTypes, bad = Object.keys(T).filter((k) => { const [c, l] = sealOf(rules, k); return !T[k].Seal || !(c >= 0 && c <= 0xffffff) || !l || l.length !== 1; });
check(!bad.length, `every kind of place has a wax seal with a colour and one letter (${Object.keys(T).length})${bad.length ? `; missing: ${bad.join(', ')}` : ''}`);
const g0 = gauge('Water', 0, '0 D', { low: true }), g1 = gauge('Water', 1, '30 D');
check(g0.includes('rotate(-135.0') && g1.includes('rotate(135.0') && g0.includes('gauge low') && g1.includes('>30 D<'), 'a gauge sweeps from -135 to +135 degrees and warns when low');
check(['content', 'uneasy', 'angry'].every((k) => medal(k).includes(`${k} crew`)) && causeIcon('thirst', 'Thirst').includes('<title>Thirst</title>'), 'mood medallions have faces; causes have stamped icons with their words');

console.log(failures ? `\n${failures} check(s) failed` : '\nAll style checks passed.');
process.exit(failures ? 1 : 0);
