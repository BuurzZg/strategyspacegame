import * as THREE from '../../lib/three.module.js';
import { radialTexture } from './space.js';

// Procedural low-poly ship models. Model space: nose along +X, up along +Y, 1 unit = 256 world units.
// Each builder returns { root, body, engines: [{ pos, size }], length }.
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
  const out = { root, body, engines: [], length: 4 };
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
