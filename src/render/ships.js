import * as THREE from '../../lib/three.module.js';
import { radialTexture } from './space.js';
import { buildDemon } from './demons.js';

// Procedural low-poly ship models. Model space: nose along +X, up along +Y, 1 unit = 256 world units.
// Each builder returns { root, body, engines: [{ pos, size }], spin: [{ obj, speed }], length }.
//   root: placed and oriented by the renderer (yaw, pitch)
//   body: child of root; the renderer rolls it to bank into turns

const geoCache = new Map();
const G = (key, make) => geoCache.get(key) || (geoCache.set(key, make()), geoCache.get(key));
const matCache = new Map();
let flareTex = null;

// Milestone 23, the brass age: hulls are riveted plate in each faction's own metal (world.yaml Hull and
// Shine: patched plates for the Rivet Moot, waxy cream for the Synod, rust for the Gaunt, soot for the
// Cinder Pact, polished brass for the Reavers), with copper pipes, brass fittings and warm portholes.
// Creatures and the Choir's light keep their own looks.
export function materials(style) {
  if (matCache.has(style.id)) return matCache.get(style.id);
  const tex = rivets();
  const hulls = style.hull && style.hull.length ? style.hull : [0x8a8478];
  const shine = Math.max(0, Math.min(100, style.shine ?? 50)) / 100;
  const plate = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.75 - shine * 0.4, metalness: 0.2 + shine * 0.6, flatShading: true, map: tex, bumpMap: tex, bumpScale: 0.9 });
  const m = {
    hull: plate(hulls[0]),
    hullAlt: hulls.slice(1).map(plate),
    dark: new THREE.MeshStandardMaterial({ color: 0x2b2620, roughness: 0.75, metalness: 0.45, flatShading: true, map: tex, bumpMap: tex, bumpScale: 0.6 }),
    trim: new THREE.MeshStandardMaterial({ color: style.color, roughness: 0.4, metalness: 0.3, flatShading: true, emissive: style.dark, emissiveIntensity: 0.8 }),
    light: new THREE.MeshStandardMaterial({ color: style.glow, emissive: style.glow, emissiveIntensity: 1.6, flatShading: true }),
    engine: new THREE.MeshBasicMaterial({ color: style.glow }),
    // molten metal: the same hot glow for every faction
    furnace: new THREE.MeshStandardMaterial({ color: 0xffc080, emissive: 0xff7a2a, emissiveIntensity: 2.2, flatShading: true }),
    copper: new THREE.MeshStandardMaterial({ color: 0xb8693d, roughness: 0.35, metalness: 0.85, flatShading: true }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a04e, roughness: 0.3, metalness: 0.9, flatShading: true }),
    port: new THREE.MeshBasicMaterial({ color: 0xffc070, side: THREE.DoubleSide }),
  };
  matCache.set(style.id, m);
  return m;
}

// Riveted plate: a tile of four plates with dark seams and rows of rivets, as the colour and the
// bump of every hull (none without a document, as in the headless tests)
let rivetTex = null;
function rivets() {
  if (rivetTex !== null) return rivetTex || null;
  if (typeof document === 'undefined') { rivetTex = false; return null; }
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d', { willReadFrequently: true });
  for (const [px, py, s] of [[0, 0, 246], [64, 0, 232], [0, 64, 238], [64, 64, 252]]) { x.fillStyle = `rgb(${s},${s},${s})`; x.fillRect(px, py, 64, 64); }
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 600; i++) { x.fillStyle = `rgba(0,0,0,${r() * 0.07})`; x.fillRect(r() * 128, r() * 128, 1 + r() * 3, 1 + r() * 3); }
  x.strokeStyle = 'rgb(96,96,96)'; x.lineWidth = 2.5;
  x.beginPath();
  for (const p of [0, 64, 128]) { x.moveTo(p, 0); x.lineTo(p, 128); x.moveTo(0, p); x.lineTo(128, p); }
  x.stroke();
  for (const p of [5, 59, 69, 123]) for (let q = 6; q < 128; q += 10) for (const [cx, cy] of [[p, q], [q, p]]) {
    x.fillStyle = 'rgb(70,70,70)'; x.beginPath(); x.arc(cx + 0.6, cy + 0.8, 1.9, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgb(250,250,250)'; x.beginPath(); x.arc(cx, cy, 1.5, 0, Math.PI * 2); x.fill();
  }
  rivetTex = new THREE.CanvasTexture(c);
  rivetTex.wrapS = rivetTex.wrapT = THREE.RepeatWrapping;
  rivetTex.colorSpace = THREE.SRGBColorSpace;
  rivetTex.anisotropy = 4;
  return rivetTex;
}

// patched plating: hull parts take the faction's plate colours in turn
let patch = 0;
function part(geo, mat, x, y, z, parent, rx = 0, ry = 0, rz = 0) {
  if (mat === curM?.hull && curM.hullAlt.length) { const k = patch++ % (curM.hullAlt.length + 1); if (k) mat = curM.hullAlt[k - 1]; }
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  parent.add(o);
  return o;
}
// texture coordinates in plates: about two plates to a unit whatever the part's size, so the rivets
// keep one spacing over the whole ship
const PLATE = 0.38;
function plateBox(g, w, h, d) {
  const uv = g.attributes.uv, f = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let i = 0; i < uv.count; i++) { const [a, b] = f[Math.min(5, Math.floor(i / 4))]; uv.setXY(i, uv.getX(i) * a * PLATE, uv.getY(i) * b * PLATE); }
  return g;
}
function plateRound(g, r, h) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(0.5, 2 * Math.PI * r) * PLATE, uv.getY(i) * Math.max(0.5, h) * PLATE);
  return g;
}
const box = (w, h, d) => G(`b${w},${h},${d}`, () => plateBox(new THREE.BoxGeometry(w, h, d), w, h, d));
const cyl = (rt, rb, h, s = 8) => G(`c${rt},${rb},${h},${s}`, () => plateRound(new THREE.CylinderGeometry(rt, rb, h, s), Math.max(rt, rb), h));
const cone = (r, h, s = 6) => G(`k${r},${h},${s}`, () => plateRound(new THREE.ConeGeometry(r, h, s), r, h));
const torus = (r, t, s = 40) => G(`t${r},${t},${s}`, () => new THREE.TorusGeometry(r, t, 6, s));

// A wedge-shaped plate: tapered box, useful for prows and fins.
function wedge(len, w0, w1, h) {
  return G(`w${len},${w0},${w1},${h}`, () => {
    const g = new THREE.BoxGeometry(len, h, 1, 1, 1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), t = (x + len / 2) / len; // 0 at tail, 1 at nose
      p.setZ(i, p.getZ(i) * (w0 + (w1 - w0) * t));
    }
    g.computeVertexNormals();
    return plateBox(g, len, h, Math.max(w0, w1));
  });
}

// A rotary gun: a ring of barrels round a hub, pointing along +X, that spins (out.spin)
function rotary(body, x, y, z, r, len, n, M, out) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  part(cyl(r * 0.55, r * 0.7, len * 0.3, 8), M.brass, -len * 0.35, 0, 0, g, 0, 0, Math.PI / 2);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; part(cyl(r * 0.18, r * 0.18, len, 5), M.dark, 0, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, g, 0, 0, Math.PI / 2); }
  part(cyl(r * 0.62, r * 0.62, len * 0.06, 8), M.brass, len * 0.42, 0, 0, g, 0, 0, Math.PI / 2);
  body.add(g);
  out.spin.push({ obj: g, speed: 3 });
  return g;
}

const CREATURES = new Set(['bloom', 'moth', 'wyrm', 'mites', 'hollowhorn', 'gnasher']);
// where the stacks stand on hulls whose shape the general rule gets wrong (model units)
const STACKS = {
  forge: [[-8.2, 3.2, 1.2, 0.62, 3.4], [-10.4, 3.2, -1.2, 0.62, 3.4], [-12.4, 3.2, 0, 0.5, 2.8]],
  halberd: [[-2.1, 0.45, 0, 0.16, 0.8]],
  spindle: [[-1.9, 0.3, 0, 0.12, 0.6]],
};

// Steamwork for a built hull: a row of warm portholes along the big plates (one mesh for all of
// them) and smokestacks that vent Glim steam (out.stacks: the renderer puffs it)
function steamwork(type, out, M) {
  const body = out.body, boxes = [];
  for (const o of body.children) {
    const p = o.isMesh && o.geometry.parameters;
    if (!p || p.width === undefined || p.depth === undefined || o.rotation.x || o.rotation.y || o.rotation.z) continue;
    if (o.material !== M.hull && !M.hullAlt.includes(o.material)) continue;
    boxes.push({ x: o.position.x, y: o.position.y, z: o.position.z, w: p.width * o.scale.x, h: p.height * o.scale.y, d: p.depth * o.scale.z });
  }
  // portholes
  const pos = [], s = Math.min(0.12, 0.035 + out.length * 0.003), gap = s * 5;
  for (const b of boxes) {
    if (b.w < 2.4 || b.h < 0.7 || pos.length > 80 * 54) continue;
    const n = Math.min(14, Math.floor((b.w - 0.6) / gap)), y = b.y + b.h * 0.18;
    for (let i = 0; i < n; i++) {
      const x = b.x - ((n - 1) * gap) / 2 + i * gap;
      for (const side of [-1, 1]) {
        const z = b.z + side * (b.d / 2 + 0.012);
        // a round port: a hexagon of six triangles
        for (let k = 0; k < 6; k++) {
          const a0 = (k / 6) * Math.PI * 2, a1 = ((k + 1) / 6) * Math.PI * 2;
          pos.push(x, y, z, x + Math.cos(a0) * s, y + Math.sin(a0) * s, z, x + Math.cos(a1) * s, y + Math.sin(a1) * s, z);
        }
      }
    }
  }
  if (pos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    body.add(new THREE.Mesh(g, M.port));
  }
  // smokestacks
  let spots = STACKS[type];
  if (!spots) {
    const n = out.length < 4.5 ? 0 : out.length < 9 ? 1 : 2;
    const top = boxes.filter((b) => b.w >= out.length * 0.25).sort((a, b) => b.y + b.h / 2 - (a.y + a.h / 2))[0];
    spots = [];
    if (top) {
      const k = Math.pow(out.length / 8, 0.8), r = 0.13 * k, ht = 0.65 * k;
      for (let i = 0; i < n; i++) spots.push([top.x - top.w * (0.28 - i * 0.2), top.y + top.h / 2, top.z, r, ht]);
    }
  }
  out.stacks = [];
  for (const [x, y, z, r, ht] of spots) {
    part(cyl(r, r * 1.18, ht, 8), M.dark, x, y + ht / 2, z, body);
    part(cyl(r * 1.3, r * 1.3, ht * 0.14, 8), M.brass, x, y + ht * 0.95, z, body);
    part(cyl(r * 1.22, r * 1.22, ht * 0.08, 8), M.copper, x, y + ht * 0.35, z, body);
    const vent = new THREE.Object3D();
    vent.position.set(x, y + ht * 1.05, z);
    body.add(vent);
    out.stacks.push({ obj: vent, r });
  }
}

let curM = null;
export function buildShip(type, style) {
  const M = materials(style);
  curM = M; patch = 0;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const out = { root, body, engines: [], spin: [], length: 4 };
  switch (type) {
    case 'halberd': {
      // armoured spine
      part(box(5.2, 0.9, 1.1), M.hull, 0, 0, 0, body);
      part(box(3.6, 0.5, 1.5), M.dark, -0.6, -0.55, 0, body);
      // split prow: two blades with a gap, the frigate's signature
      for (const z of [-0.42, 0.42]) part(wedge(2.4, 0.55, 0.12, 0.7), M.hull, 3.5, 0.05, z, body);
      part(box(1.8, 0.12, 0.08), M.trim, 3.2, 0.45, 0, body);
      // bridge tower
      part(box(1.2, 0.8, 0.7), M.hull, -0.9, 0.75, 0, body);
      part(box(0.5, 0.18, 0.72), M.light, -0.55, 1.05, 0, body);
      part(wedge(1.4, 0.05, 0.6, 0.12), M.trim, -1.0, 1.25, 0, body, 0, 0, -0.25);
      // side pulse batteries: rotary guns
      for (const z of [-0.75, 0.75]) {
        part(box(1.6, 0.35, 0.35), M.dark, 1.2, 0.05, z, body);
        rotary(body, 2.4, 0.05, z, 0.3, 1.1, 5, M, out);
      }
      // trim stripes
      for (const z of [-0.56, 0.56]) part(box(4.4, 0.1, 0.04), M.trim, -0.1, 0.1, z, body);
      // twin engine nacelles
      for (const z of [-0.85, 0.85]) {
        part(cyl(0.38, 0.45, 1.6, 8), M.hull, -2.6, -0.1, z, body, 0, 0, Math.PI / 2);
        part(cyl(0.3, 0.3, 0.08, 8), M.engine, -3.42, -0.1, z, body, 0, 0, Math.PI / 2);
        out.engines.push({ pos: new THREE.Vector3(-3.5, -0.1, z), size: 1.0 });
      }
      out.length = 7.6;
      break;
    }
    case 'forge': {
      // The mothership: about 42 units (1 km) from stern to ram. Model z = port side.
      // keel, belly and stern block
      part(box(30, 3.2, 5.6), M.hull, 0, 0, 0, body);
      part(box(22, 1.2, 2.4), M.dark, -1, -2.2, 0, body);
      part(box(3, 3.8, 6.2), M.dark, -14.2, 0, 0, body);
      // prow: a wedge ending in a blunt ram, with the furnace maw glowing along its spine
      part(wedge(9, 5.6, 1.6, 3.0), M.hull, 19.5, -0.1, 0, body);
      part(box(6, 0.3, 1.5), M.furnace, 18.4, 1.42, 0, body);
      part(box(1.4, 1.6, 1.7), M.dark, 24.2, -0.1, 0, body);
      for (const z of [-1, 1]) {
        // furnace vents along the forward flanks
        for (let i = 0; i < 4; i++) part(box(1.1, 0.5, 0.1), M.furnace, 6.5 + i * 2.2, 0.55, z * 2.82, body);
        // trim and deck lights along the keel
        part(box(26, 0.22, 0.06), M.trim, 0, 1.05, z * 2.83, body);
        part(box(22, 0.1, 0.05), M.light, -1, -0.75, z * 2.83, body);
        // hangar pods; the launch bay mouths open on their outer faces
        part(box(14, 2.6, 2.4), M.hull, 2, -0.4, z * 4, body);
        part(wedge(3, 2.4, 0.7, 2.2), M.hull, 10.5, -0.4, z * 4, body);
        part(box(4.4, 1.5, 0.14), M.dark, 2, -0.4, z * 5.22, body);
        part(box(4.4, 0.1, 0.16), M.light, 2, 0.42, z * 5.23, body);
        part(box(4.4, 0.1, 0.16), M.light, 2, -1.22, z * 5.23, body);
        part(box(12, 0.18, 0.06), M.trim, 1.5, 0.75, z * 5.22, body);
      }
      // decks stepping up toward the stern, and the command spire
      part(box(13, 1.6, 4.4), M.hull, -6, 2.4, 0, body);
      part(box(7.5, 1.4, 3.2), M.hull, -4.8, 3.9, 0, body);
      part(box(2.2, 3.2, 1.4), M.hull, -5.4, 6.1, 0, body);
      part(box(2.24, 0.3, 1.44), M.light, -5.4, 7.2, 0, body);
      part(cyl(0.06, 0.06, 3, 4), M.dark, -5.8, 9.2, 0, body);
      for (const z of [-1, 1]) {
        part(box(12, 0.12, 0.05), M.light, -6, 2.6, z * 2.23, body);
        part(box(7, 0.12, 0.05), M.light, -4.8, 4.1, z * 1.63, body);
      }
      // the foundry ring turns slowly around the hull behind the hangars
      const ring = new THREE.Group();
      ring.position.set(-10.5, 0, 0);
      body.add(ring);
      part(torus(6.2, 0.55), M.dark, 0, 0, 0, ring, 0, Math.PI / 2, 0);
      for (const x of [-0.62, 0.62]) part(torus(6.2, 0.1), M.light, x, 0, 0, ring, 0, Math.PI / 2, 0);
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        part(box(0.35, 3.4, 0.35), M.hull, 0, Math.cos(a) * 4.6, Math.sin(a) * 4.6, ring, a, 0, 0);
        if (i % 2 === 0) part(box(1.3, 0.9, 0.9), M.furnace, 0, Math.cos(a + 0.5) * 6.2, Math.sin(a + 0.5) * 6.2, ring, a + 0.5, 0, 0);
      }
      out.spin.push({ obj: ring, speed: 0.12 });
      // four main engines
      for (const y of [0.95, -1.05]) for (const z of [-1.6, 1.6]) {
        part(cyl(1.1, 1.4, 2.6, 10), M.hull, -16.9, y, z, body, 0, 0, Math.PI / 2);
        part(cyl(0.95, 0.95, 0.1, 10), M.engine, -18.25, y, z, body, 0, 0, Math.PI / 2);
        out.engines.push({ pos: new THREE.Vector3(-18.4, y, z), size: 3.0 });
      }
      out.length = 44;
      break;
    }
    case 'gleaner': {
      // collector: a deep hold behind a small cab, scoop arms reaching forward under the nose
      part(box(1.7, 0.95, 1.25), M.hull, -0.3, 0.05, 0, body);
      part(box(1.2, 0.12, 0.9), M.dark, -0.35, 0.58, 0, body);
      // ore gauge on the hold roof: grows with the cargo (the renderer scales it)
      out.gauge = part(box(1.1, 0.06, 0.5), M.furnace, -0.35, 0.65, 0, body);
      part(box(0.7, 0.55, 0.85), M.hull, 0.8, -0.05, 0, body);
      part(box(0.32, 0.22, 0.7), M.light, 1.1, 0.12, 0, body);
      part(box(0.25, 0.5, 0.9), M.dark, 1.2, -0.42, 0, body);
      for (const z of [-1, 1]) {
        part(box(1.1, 0.16, 0.16), M.trim, 1.35, -0.5, z * 0.42, body, 0, z * 0.12, 0);
        part(box(0.3, 0.14, 0.3), M.dark, 1.85, -0.5, z * 0.36, body);
        part(cyl(0.17, 0.22, 0.4, 6), M.dark, -1.3, 0, z * 0.36, body, 0, 0, Math.PI / 2);
        out.engines.push({ pos: new THREE.Vector3(-1.55, 0, z * 0.36), size: 0.5 });
      }
      out.nose = new THREE.Vector3(1.95, -0.45, 0);
      out.length = 3.4;
      break;
    }
    case 'shearer': {
      // salvage tug: a squat cab and engine block, a long jointed cutting arm under the nose
      part(box(1.5, 0.8, 1.1), M.hull, -0.4, 0.1, 0, body);
      part(box(0.7, 0.5, 0.8), M.hull, 0.6, 0.15, 0, body);
      part(box(0.35, 0.22, 0.6), M.light, 0.85, 0.32, 0, body);
      part(box(1.3, 0.16, 0.16), M.trim, 1.0, -0.35, 0, body, 0, 0, -0.18);
      part(box(0.9, 0.12, 0.12), M.trim, 1.95, -0.62, 0, body, 0, 0, 0.3);
      part(cone(0.12, 0.35, 6), M.light, 2.48, -0.5, 0, body, 0, 0, -Math.PI / 2);
      for (const z of [-1, 1]) {
        part(box(1.2, 0.3, 0.25), M.dark, -0.4, -0.35, z * 0.5, body);
        part(cyl(0.18, 0.22, 0.45, 6), M.dark, -1.3, 0.05, z * 0.35, body, 0, 0, Math.PI / 2);
        out.engines.push({ pos: new THREE.Vector3(-1.58, 0.05, z * 0.35), size: 0.5 });
      }
      out.nose = new THREE.Vector3(2.65, -0.5, 0);
      out.gauge = part(box(1.0, 0.06, 0.45), M.furnace, -0.4, 0.53, 0, body);
      out.length = 4;
      break;
    }
    case 'skimmer': {
      // gas collector: a wide intake ring at the nose, a tube body, a bladder down each flank
      part(torus(0.55, 0.1, 18), M.trim, 1.15, 0, 0, body, 0, Math.PI / 2, 0);
      part(cyl(0.5, 0.3, 0.8, 10), M.dark, 0.75, 0, 0, body, 0, 0, Math.PI / 2);
      part(cyl(0.32, 0.32, 1.8, 8), M.hull, -0.3, 0, 0, body, 0, 0, Math.PI / 2);
      part(box(0.45, 0.2, 0.4), M.light, 0.1, 0.36, 0, body);
      for (const z of [-1, 1]) {
        const bl = part(G('sk-bladder', () => new THREE.IcosahedronGeometry(0.5, 1)), M.hull, -0.4, -0.05, z * 0.62, body);
        bl.scale.set(1.6, 0.6, 0.6);
        part(cyl(0.15, 0.19, 0.4, 6), M.dark, -1.3, 0, z * 0.3, body, 0, 0, Math.PI / 2);
        out.engines.push({ pos: new THREE.Vector3(-1.56, 0, z * 0.3), size: 0.5 });
      }
      out.nose = new THREE.Vector3(1.2, 0, 0);
      out.gauge = part(box(1.2, 0.06, 0.3), M.furnace, -0.3, 0.34, 0, body);
      out.length = 3.4;
      break;
    }
    case 'smelter': {
      // mobile refinery: a broad barge, an intake ring at the bow, a glowing crucible on top,
      // dock clamps reaching out from both flanks
      part(box(9, 2.4, 4.4), M.hull, -0.4, 0, 0, body);
      part(box(7, 0.8, 3.2), M.dark, -0.8, -1.5, 0, body);
      part(wedge(3, 4.4, 2.2, 2.2), M.hull, 5.6, -0.1, 0, body);
      part(torus(1.15, 0.28, 24), M.trim, 7.2, -0.1, 0, body, 0, Math.PI / 2, 0);
      part(cyl(1.0, 1.0, 0.1, 16), M.furnace, 7.05, -0.1, 0, body, 0, 0, Math.PI / 2);
      part(cyl(1.5, 1.8, 2.0, 10), M.dark, 0.8, 2.1, 0, body);
      part(cyl(1.28, 1.28, 0.12, 10), M.furnace, 0.8, 3.12, 0, body);
      for (const z of [-0.9, 0.9]) {
        part(cyl(0.25, 0.32, 1.8, 6), M.dark, -2.8, 2.0, z, body);
        part(cyl(0.2, 0.2, 0.06, 6), M.furnace, -2.8, 2.93, z, body);
      }
      for (const z of [-1, 1]) {
        part(box(1.6, 0.35, 1.3), M.trim, 0, 0, z * 2.85, body);
        part(box(1.6, 0.08, 0.08), M.light, 0, 0.22, z * 3.45, body);
        part(box(8, 0.14, 0.06), M.trim, -0.6, 0.9, z * 2.22, body);
        part(cyl(0.6, 0.75, 1.4, 8), M.hull, -5.2, -0.2, z * 1.2, body, 0, 0, Math.PI / 2);
        part(cyl(0.5, 0.5, 0.08, 8), M.engine, -5.92, -0.2, z * 1.2, body, 0, 0, Math.PI / 2);
        out.engines.push({ pos: new THREE.Vector3(-6.05, -0.2, z * 1.2), size: 1.6 });
      }
      out.length = 13;
      break;
    }
    case 'spindle': {
      // lance frigate: a thin spine wrapped round one long lance, capacitor rings along it
      part(cyl(0.18, 0.18, 4.4, 8), M.dark, 1.7, 0, 0, body, 0, 0, Math.PI / 2);
      part(cyl(0.32, 0.16, 0.45, 8), M.light, 4.0, 0, 0, body, 0, 0, -Math.PI / 2);
      // copper coils along the lance, and a brass ball at its tip where the lightning leaves
      for (const x of [0.7, 1.15, 1.6, 2.05, 2.5, 2.95]) part(torus(0.36, 0.07, 14), M.copper, x, 0, 0, body, 0, Math.PI / 2, 0);
      part(G('tesla', () => new THREE.IcosahedronGeometry(0.3, 1)), M.brass, 4.45, 0, 0, body);
      part(box(3.4, 0.6, 0.75), M.hull, -0.6, 0, 0, body);
      part(box(2.2, 0.25, 1.1), M.dark, -0.9, -0.38, 0, body);
      part(box(0.7, 0.36, 0.45), M.hull, -1.4, 0.46, 0, body);
      part(box(0.42, 0.1, 0.47), M.light, -1.2, 0.6, 0, body);
      for (const z of [-1, 1]) part(wedge(1.7, 1.0, 0.2, 0.08), M.trim, -1.0, 0, z * 0.6, body);
      part(cyl(0.34, 0.42, 0.9, 8), M.hull, -2.6, 0, 0, body, 0, 0, Math.PI / 2);
      part(cyl(0.28, 0.28, 0.06, 8), M.engine, -3.07, 0, 0, body, 0, 0, Math.PI / 2);
      out.engines.push({ pos: new THREE.Vector3(-3.15, 0, 0), size: 1.0 });
      out.length = 7.2;
      break;
    }
    case 'sabre': {
      // destroyer: a long armoured hull, torpedo spine on top, pulse batteries on the flanks
      part(box(10, 1.6, 2.6), M.hull, 0, 0, 0, body);
      part(wedge(3.5, 2.6, 0.6, 1.4), M.hull, 6.7, -0.05, 0, body);
      part(box(7, 0.6, 1.2), M.dark, -0.5, -1.05, 0, body);
      part(box(6, 0.6, 1.0), M.dark, 0.6, 1.1, 0, body);
      for (let i = 0; i < 4; i++) part(cyl(0.16, 0.16, 0.12, 8), M.light, -1.4 + i * 1.3, 1.46, 0, body);
      part(box(1.6, 1.2, 1.2), M.hull, -2.6, 1.4, 0, body);
      part(box(1.62, 0.16, 1.22), M.light, -2.4, 1.75, 0, body);
      for (const z of [-1, 1]) {
        part(box(2.2, 0.5, 0.5), M.dark, 3.4, 0.2, z * 1.5, body);
        rotary(body, 5.0, 0.2, z * 1.5, 0.4, 1.3, 6, M, out);
        part(box(9, 0.12, 0.05), M.trim, -0.3, 0.35, z * 1.32, body);
        part(box(4, 0.08, 0.05), M.light, 0.5, -0.4, z * 1.32, body);
      }
      for (const [y, z] of [[0, 0], [0.1, 0.95], [0.1, -0.95]]) {
        part(cyl(0.55, 0.7, 1.2, 10), M.hull, -5.6, y, z, body, 0, 0, Math.PI / 2);
        part(cyl(0.46, 0.46, 0.06, 10), M.engine, -6.22, y, z, body, 0, 0, Math.PI / 2);
        out.engines.push({ pos: new THREE.Vector3(-6.3, y, z), size: 1.5 });
      }
      out.length = 14;
      break;
    }
    // ---------------------------------------------------------------- faction stations
    case 'hulltown': {
      // a gutted capital hull with a town inside: lit windows in rows, scaffolds, beacons
      part(box(40, 6.5, 8.5), M.hull, 0, 0, 0, body);
      part(box(34, 2, 6), M.dark, 0, -4, 0, body);
      part(wedge(8, 8.5, 2.5, 5.5), M.hull, 24, 0, 0, body);
      part(box(6, 7.5, 9.5), M.dark, -22, 0, 0, body);
      // a breach amidships, the town's lights showing through
      part(box(7, 7, 9), M.dark, 4, 0.6, 0, body);
      for (let i = 0; i < 18; i++) {
        const x = -17 + i * 2, z = i % 2 ? 4.3 : -4.3;
        part(box(0.9, 0.5, 0.2), M.light, x, 1.2 + (i % 3) * 1.2, z, body);
        if (i % 4 === 0) part(box(0.2, 9, 0.2), M.dark, x, 2, z * 1.15, body);
      }
      for (const x of [-12, 0, 12]) part(box(1.2, 1.2, 1.2), M.trim, x, 4, 0, body);
      for (const x of [-18, 18]) part(box(0.5, 0.5, 0.5), M.light, x, 4.6, 0, body);
      out.length = 48;
      break;
    }
    case 'refinery': {
      // tall Glim tanks round a spine, hung with lanterns
      part(cyl(1.2, 1.2, 26, 8), M.dark, 0, 0, 0, body);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2, x = Math.cos(a) * 7, z = Math.sin(a) * 7;
        part(cyl(3, 3, 18, 10), M.hull, x, 0, z, body);
        part(torus(3.1, 0.25, 20), M.trim, x, 5, z, body, Math.PI / 2, 0, 0);
        part(torus(3.1, 0.25, 20), M.trim, x, -5, z, body, Math.PI / 2, 0, 0);
        part(box(4, 0.8, 0.8), M.dark, x / 2, 8, z / 2, body, 0, -a, 0);
        for (const y of [-8, 0, 8]) part(G('lantern', () => new THREE.IcosahedronGeometry(0.55, 0)), M.light, x * 1.45, y, z * 1.45, body);
      }
      const ring = new THREE.Group(); body.add(ring);
      part(torus(11, 0.4, 48), M.trim, 0, 0, 0, ring, Math.PI / 2, 0, 0);
      out.spin.push({ obj: ring, speed: 0.05 });
      out.length = 30;
      break;
    }
    case 'den': {
      // a hollowed rock bristling with grapples and stolen plating
      if (!M.rock) M.rock = new THREE.MeshStandardMaterial({ color: 0x3a3130, roughness: 0.95, metalness: 0.1, flatShading: true });
      const rock = part(G('den-rock', () => new THREE.IcosahedronGeometry(10, 1)), M.rock, 0, 0, 0, body);
      rock.scale.set(1.2, 0.8, 1);
      part(G('den-maw', () => new THREE.CylinderGeometry(4, 5, 4, 8, 1, true)), M.dark, 11, 0, 0, body, 0, 0, Math.PI / 2);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2, b = (i % 3 - 1) * 0.5;
        const x = Math.cos(a) * 11, y = Math.sin(b) * 7, z = Math.sin(a) * 10;
        part(cone(0.5, 6, 4), M.dark, x, y, z, body, 0, -a, Math.PI / 2 + b);
        if (i % 2) part(box(4, 0.3, 3), M.trim, x * 0.9, y + 2, z * 0.9, body, 0.3, -a, 0.2);
        part(box(0.5, 0.5, 0.5), M.light, x * 0.95, y - 1, z * 0.95, body);
      }
      out.length = 26;
      break;
    }
    case 'cinderhold': {
      // a foundry ring round the bones of another Forge
      part(box(24, 2.5, 4), M.dark, 0, 0, 0, body);
      part(wedge(7, 4, 1.2, 2.4), M.dark, 15, 0, 0, body);
      for (let i = 0; i < 6; i++) part(box(0.6, 4, 5), M.hull, -10 + i * 4, 1.2, 0, body);
      const ring = new THREE.Group(); body.add(ring);
      part(torus(11, 1.5, 40), M.hull, 0, 0, 0, ring, 0, Math.PI / 2, 0);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; part(box(1.5, 1.5, 1.5), M.furnace, 0, Math.cos(a) * 11, Math.sin(a) * 11, ring); }
      out.spin.push({ obj: ring, speed: 0.08 });
      for (const z of [-1, 1]) part(box(10, 0.6, 0.6), M.trim, 0, 3, z * 2, body);
      out.length = 26;
      break;
    }
    case 'bloom':
    case 'moth': {
      // Choirmoths: luminous wings turning in shells of light; a bloom is thousands of them
      const big = type === 'bloom';
      if (!M.wing) M.wing = new THREE.MeshStandardMaterial({ color: style.color, emissive: style.color, emissiveIntensity: 1.2, flatShading: true, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
      const n = big ? 90 : 14, R0 = big ? 9 : 1.1;
      for (let s = 0; s < (big ? 3 : 1); s++) {
        const shell = new THREE.Group(); body.add(shell);
        for (let i = 0; i < n / (big ? 3 : 1); i++) {
          const u = (i * 0.618 + s * 0.3) % 1, v = (i * 0.381 + s * 0.17) % 1;
          const th = u * Math.PI * 2, ph = Math.acos(2 * v - 1), r = R0 * (0.6 + 0.4 * ((i * 7) % 5) / 4) * (1 + s * 0.35);
          const w = part(G('wing', () => new THREE.PlaneGeometry(0.9, 0.5)), M.wing, Math.sin(ph) * Math.cos(th) * r, Math.cos(ph) * r * 0.8, Math.sin(ph) * Math.sin(th) * r, shell, th, ph, 0);
          w.scale.setScalar(big ? 1.8 : 0.55);
        }
        out.spin.push({ obj: shell, speed: (s % 2 ? -1 : 1) * (big ? 0.15 : 0.9) });
      }
      if (big) part(G('bloom-core', () => new THREE.IcosahedronGeometry(2.5, 1)), M.light, 0, 0, 0, body);
      out.nose = new THREE.Vector3(R0, 0, 0);
      out.length = big ? 24 : 3;
      break;
    }
    case 'wisp': {
      // the Wisp: a needle with a dish, built for looking
      part(box(3.4, 0.35, 0.35), M.hull, 0, 0, 0, body);
      part(cone(0.32, 1.2, 6), M.hull, 2.2, 0, 0, body, 0, 0, -Math.PI / 2);
      const dish = part(G('wisp-dish', () => new THREE.CylinderGeometry(0.9, 0.2, 0.25, 14, 1, true)), M.trim, -0.4, 0.55, 0, body, 0, 0, 0.35);
      dish.material = M.trim;
      part(box(0.1, 0.6, 0.1), M.dark, -0.4, 0.25, 0, body);
      for (const z of [-1, 1]) part(wedge(1.2, 0.8, 0.1, 0.06), M.hull, -0.9, 0, z * 0.35, body, 0, z * 0.25, 0);
      part(box(0.3, 0.12, 0.12), M.light, 1.3, 0.2, 0, body);
      out.engines.push({ pos: new THREE.Vector3(-1.9, 0, 0), size: 0.5 });
      out.nose = new THREE.Vector3(2.8, 0, 0);
      out.length = 5;
      break;
    }
    case 'wyrm': {
      // a Scrapwyrm: a long chain of plated segments, a blunt head full of grinders
      if (!M.plate) {
        M.plate = new THREE.MeshStandardMaterial({ color: 0x9a8670, roughness: 0.85, metalness: 0.35, flatShading: true });
        M.maw = new THREE.MeshStandardMaterial({ color: 0xffb070, emissive: 0xff6a20, emissiveIntensity: 1.4, flatShading: true });
      }
      for (let i = 0; i < 9; i++) {
        const seg = part(G('wy-seg', () => new THREE.DodecahedronGeometry(1.4, 0)), M.plate, 4 - i * 1.6, Math.sin(i * 0.8) * 0.5, Math.cos(i * 0.7) * 0.6, body);
        seg.scale.setScalar(1.1 - i * 0.07);
        if (i % 2 === 0) part(cone(0.35, 1.3, 4), M.plate, 4 - i * 1.6, 1.4, 0, body);
      }
      part(G('wy-head', () => new THREE.IcosahedronGeometry(1.8, 0)), M.plate, 6, 0, 0, body).scale.set(1.3, 0.9, 1);
      part(torus(0.9, 0.25, 12), M.maw, 7.8, 0, 0, body, 0, Math.PI / 2, 0);
      out.nose = new THREE.Vector3(8, 0, 0);
      out.length = 16;
      break;
    }
    case 'mites': {
      // rust mites: a buzzing knot of rust-coloured specks
      if (!M.mite) M.mite = new THREE.MeshStandardMaterial({ color: 0xa8582a, emissive: 0x6a2a10, emissiveIntensity: 0.8, flatShading: true });
      const swarm = new THREE.Group(); body.add(swarm);
      for (let i = 0; i < 26; i++) {
        const u = (i * 0.618) % 1, v = (i * 0.381) % 1, th = u * Math.PI * 2, ph = Math.acos(2 * v - 1), r = 0.4 + ((i * 7) % 5) * 0.12;
        part(G('mite', () => new THREE.TetrahedronGeometry(0.16, 0)), M.mite, Math.sin(ph) * Math.cos(th) * r, Math.cos(ph) * r, Math.sin(ph) * Math.sin(th) * r, swarm, th, ph, 0);
      }
      out.spin.push({ obj: swarm, speed: 2.4 });
      out.nose = new THREE.Vector3(0.8, 0, 0);
      out.length = 2;
      break;
    }
    case 'hollowhorn': {
      // the Hollowhorn: a pale leviathan with a long hollow horn and fins like sails
      if (!M.hide) {
        M.hide = new THREE.MeshStandardMaterial({ color: 0x8a8098, roughness: 0.8, metalness: 0.1, flatShading: true });
        M.song = new THREE.MeshStandardMaterial({ color: 0xd8c8ff, emissive: 0x8a6aff, emissiveIntensity: 1.8, flatShading: true });
      }
      const bodyM = part(G('hh-body', () => new THREE.IcosahedronGeometry(8, 1)), M.hide, 0, 0, 0, body);
      bodyM.scale.set(5.2, 1.6, 1.9);
      part(G('hh-head', () => new THREE.IcosahedronGeometry(6, 1)), M.hide, 34, 1, 0, body).scale.set(1.6, 1, 1.1);
      part(G('hh-horn', () => new THREE.CylinderGeometry(0.6, 3.2, 26, 10, 1, true)), M.hide, 54, 3, 0, body, 0, 0, -Math.PI / 2 + 0.08);
      part(torus(0.8, 0.3, 14), M.song, 67, 3.8, 0, body, 0, Math.PI / 2, 0);
      for (const z of [-1, 1]) part(wedge(22, 10, 1, 0.8), M.hide, -6, 0, z * 13, body, 0, z * 0.3, z * 0.15);
      part(wedge(14, 6, 0.5, 0.8), M.hide, -6, 11, 0, body, 0, 0, Math.PI / 2);
      for (let i = 0; i < 6; i++) part(box(1.2, 0.3, 0.3), M.song, 26 - i * 9, 2.6 + Math.sin(i) * 0.6, 0, body);
      part(cone(4, 16, 6), M.hide, -46, 0, 0, body, 0, 0, Math.PI / 2);
      out.nose = new THREE.Vector3(68, 3.8, 0);
      out.length = 120;
      break;
    }
    case 'gnasher': {
      // a monster: ribbed, eyeless, all jaw; it glows where its nerves run
      if (!M.skin) {
        M.skin = new THREE.MeshStandardMaterial({ color: 0x3a2c46, roughness: 0.75, metalness: 0.1, flatShading: true });
        M.nerve = new THREE.MeshStandardMaterial({ color: style.glow, emissive: style.color, emissiveIntensity: 1.6, flatShading: true });
      }
      const skin = M.skin, glowM = M.nerve;
      const hump = part(G('gn-body', () => new THREE.IcosahedronGeometry(0.6, 1)), skin, 0, 0, 0, body);
      hump.scale.set(2.0, 0.75, 0.85);
      for (const sy of [-1, 1]) part(wedge(1.2, 0.9, 0.25, 0.14), skin, 1.45, sy * 0.16, 0, body, 0, 0, sy * 0.28);
      for (let i = 0; i < 4; i++) {
        const rib = part(torus(0.5, 0.05, 10), glowM, 0.6 - i * 0.42, 0.05, 0, body, 0, Math.PI / 2, 0);
        rib.scale.set(1, 0.95 - i * 0.12, 1.1 - i * 0.12);
      }
      part(cone(0.32, 1.5, 6), skin, -1.7, 0, 0, body, 0, 0, Math.PI / 2);
      for (const z of [-1, 1]) part(wedge(0.9, 0.7, 0.05, 0.05), skin, -1.4, 0, z * 0.32, body, 0, z * 0.5, 0);
      out.engines.push({ pos: new THREE.Vector3(-2.3, 0, 0), size: 0.55 });
      out.nose = new THREE.Vector3(2.0, 0, 0);
      out.length = 4.2;
      break;
    }
    case 'talon': {
      // bomber: blunt fuselage over a delta wing, plasma charge pod slung underneath
      part(box(2.2, 0.42, 0.62), M.hull, 0, 0, 0, body);
      part(cone(0.31, 1.1, 6), M.hull, 1.65, 0, 0, body, 0, 0, -Math.PI / 2);
      part(box(0.6, 0.16, 0.4), M.light, 0.7, 0.26, 0, body);
      part(wedge(2.2, 2.7, 0.4, 0.1), M.trim, -0.45, -0.06, 0, body);
      for (const z of [-1, 1]) part(box(0.55, 0.5, 0.05), M.dark, -0.95, 0.38, z * 0.26, body, z * 0.35, 0, 0);
      part(cyl(0.2, 0.2, 1.3, 8), M.dark, 0.1, -0.4, 0, body, 0, 0, Math.PI / 2);
      part(box(0.2, 0.2, 0.2), M.furnace, 0.8, -0.4, 0, body);
      for (const z of [-1, 1]) {
        part(cyl(0.14, 0.17, 0.5, 6), M.dark, -1.25, 0, z * 0.28, body, 0, 0, Math.PI / 2);
        out.engines.push({ pos: new THREE.Vector3(-1.55, 0, z * 0.28), size: 0.42 });
      }
      out.length = 3.4;
      break;
    }
    case 'picket': {
      // flak corvette: hexagonal hull, outrigger sponsons, a twin flak turret on top
      part(cyl(0.75, 0.85, 3.4, 6), M.hull, 0, 0, 0, body, 0, 0, Math.PI / 2);
      part(cone(0.75, 1.1, 6), M.dark, 2.25, 0, 0, body, 0, 0, -Math.PI / 2);
      part(box(1.8, 0.3, 2.3), M.dark, -0.2, -0.1, 0, body);
      for (const z of [-1, 1]) {
        part(box(1.7, 0.4, 0.45), M.trim, -0.3, -0.1, z * 1.2, body);
        part(cyl(0.16, 0.2, 0.4, 6), M.dark, -1.3, -0.1, z * 1.2, body, 0, 0, Math.PI / 2);
        out.engines.push({ pos: new THREE.Vector3(-1.55, -0.1, z * 1.2), size: 0.38 });
      }
      part(cyl(0.42, 0.52, 0.36, 8), M.dark, 0.5, 0.85, 0, body);
      part(box(0.5, 0.22, 0.5), M.hull, 0.55, 1.12, 0, body);
      rotary(body, 1.15, 1.14, 0, 0.34, 1.0, 6, M, out); // the flak turret's rotary gun
      part(box(0.4, 0.14, 0.6), M.light, -0.6, 0.78, 0, body);
      part(cyl(0.45, 0.55, 0.5, 8), M.hull, -1.9, 0, 0, body, 0, 0, Math.PI / 2);
      part(cyl(0.36, 0.36, 0.06, 8), M.engine, -2.17, 0, 0, body, 0, 0, Math.PI / 2);
      out.engines.push({ pos: new THREE.Vector3(-2.25, 0, 0), size: 0.75 });
      out.length = 4.6;
      break;
    }
    case 'dart': {
      part(cone(0.32, 2.4, 6), M.hull, 0.5, 0, 0, body, 0, 0, -Math.PI / 2);
      part(box(1.2, 0.3, 0.42), M.dark, -0.9, 0, 0, body);
      part(box(0.5, 0.14, 0.34), M.light, 0.1, 0.2, 0, body);
      for (const z of [-1, 1]) {
        const fin = part(wedge(1.4, 0.7, 0.15, 0.06), M.trim, -0.9, 0, z * 0.6, body, 0, z * 0.35, 0);
        fin.scale.z = 1;
        part(box(0.7, 0.05, 0.05), M.trim, -0.4, 0.1, z * 0.95, body);
      }
      part(cyl(0.16, 0.2, 0.3, 6), M.engine, -1.55, 0, 0, body, 0, 0, Math.PI / 2);
      out.engines.push({ pos: new THREE.Vector3(-1.7, 0, 0), size: 0.55 });
      out.length = 3;
      break;
    }
    default:
      // the Wound's grown hulls (demons.js)
      if (buildDemon(type, body, out)) { out.grown = true; break; }
      part(box(2, 0.6, 0.8), M.hull, 0, 0, 0, body);
      out.engines.push({ pos: new THREE.Vector3(-1.1, 0, 0), size: 0.5 });
  }
  if (!CREATURES.has(type) && style.id !== 'choir' && style.id !== 'wound' && !out.grown) steamwork(type, out, M);
  else out.stacks = [];
  curM = null;
  body.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  // engine flares: additive sprites scaled by throttle
  flareTex ||= radialTexture([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.75)'], [0.55, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]);
  out.flares = out.engines.map((e) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, color: style.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.copy(e.pos);
    s.scale.setScalar(e.size);
    body.add(s);
    return s;
  });
  return out;
}

// A wreck: the dead ship's model, charred, with pieces missing (chosen from the actor id, so
// it always looks the same). Embers are drawn by the renderer at `embers` points.
const charMat = new THREE.MeshStandardMaterial({ color: 0x24222a, roughness: 0.95, metalness: 0.2, flatShading: true });
const scorchMat = new THREE.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.9, metalness: 0.1, flatShading: true });
const emberMat = new THREE.MeshStandardMaterial({ color: 0x8a3a1a, emissive: 0xff5a1a, emissiveIntensity: 1.1, flatShading: true });
export function buildWreck(model, seed, style) {
  const out = buildShip(model, style);
  let s = (seed * 2654435761) >>> 0 || 1;
  const rand = () => { s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0; return s / 4294967296; };
  const meshes = [];
  out.body.traverse((o) => { if (o.isMesh) meshes.push(o); });
  out.embers = [];
  for (const m of meshes) {
    const r = rand();
    if (r < 0.22 && meshes.length > 4) { m.parent.remove(m); continue; }
    // only small parts smoulder; big plates are scorched or charred
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    const small = m.geometry.boundingSphere.radius * Math.max(m.scale.x, m.scale.y, m.scale.z) < 0.5;
    m.material = small && r < 0.4 ? emberMat : r < 0.6 ? scorchMat : charMat;
    if (r < 0.4) out.embers.push(m.position.clone());
  }
  for (const f of out.flares) f.parent.remove(f);
  out.flares = []; out.engines = []; out.spin = []; out.stacks = [];
  out.body.rotation.set((rand() - 0.5) * 0.6, 0, (rand() - 0.5) * 0.8);
  out.tumble = new THREE.Vector3((rand() - 0.5) * 0.06, (rand() - 0.5) * 0.04, (rand() - 0.5) * 0.06);
  return out;
}
