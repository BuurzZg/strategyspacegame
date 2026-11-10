import * as THREE from '../../lib/three.module.js';
import { radialTexture } from './space.js';

// Procedural low-poly ship models. Model space: nose along +X, up along +Y, 1 unit = 256 world units.
// Each builder returns { root, body, engines: [{ pos, size }], spin: [{ obj, speed }], length }.
//   root: placed and oriented by the renderer (yaw, pitch)
//   body: child of root; the renderer rolls it to bank into turns

const geoCache = new Map();
const G = (key, make) => geoCache.get(key) || (geoCache.set(key, make()), geoCache.get(key));
const matCache = new Map();
let flareTex = null;

export function materials(style) {
  if (matCache.has(style.id)) return matCache.get(style.id);
  const m = {
    hull: new THREE.MeshStandardMaterial({ color: 0x9aa3b4, roughness: 0.55, metalness: 0.55, flatShading: true }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2b303d, roughness: 0.7, metalness: 0.4, flatShading: true }),
    trim: new THREE.MeshStandardMaterial({ color: style.color, roughness: 0.4, metalness: 0.3, flatShading: true, emissive: style.dark, emissiveIntensity: 0.8 }),
    light: new THREE.MeshStandardMaterial({ color: style.glow, emissive: style.glow, emissiveIntensity: 1.6, flatShading: true }),
    engine: new THREE.MeshBasicMaterial({ color: style.glow }),
    // molten metal: the same hot glow for every faction
    furnace: new THREE.MeshStandardMaterial({ color: 0xffc080, emissive: 0xff7a2a, emissiveIntensity: 2.2, flatShading: true }),
  };
  matCache.set(style.id, m);
  return m;
}

function part(geo, mat, x, y, z, parent, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  parent.add(o);
  return o;
}
const box = (w, h, d) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt, rb, h, s = 8) => G(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const cone = (r, h, s = 6) => G(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
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
    return g;
  });
}

export function buildShip(type, style) {
  const M = materials(style);
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
      // side pulse batteries
      for (const z of [-0.75, 0.75]) {
        part(box(1.6, 0.35, 0.35), M.dark, 1.2, 0.05, z, body);
        part(cyl(0.07, 0.07, 1.1, 6), M.dark, 2.3, 0.05, z, body, 0, 0, Math.PI / 2);
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
      for (const z of [-0.13, 0.13]) part(cyl(0.05, 0.05, 1.0, 5), M.dark, 1.1, 1.14, z, body, 0, 0, Math.PI / 2);
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
      part(box(2, 0.6, 0.8), M.hull, 0, 0, 0, body);
      out.engines.push({ pos: new THREE.Vector3(-1.1, 0, 0), size: 0.5 });
  }
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
