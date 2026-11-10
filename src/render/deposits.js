import * as THREE from '../../lib/three.module.js';
import { radialTexture } from './space.js';

// Gas clouds, crystal formations and nebulae. Unit-sized (the renderer scales them).
let puffTex = null;
const tex = () => (puffTex ||= radialTexture([[0, 'rgba(255,255,255,0.9)'], [0.35, 'rgba(255,255,255,0.35)'], [0.7, 'rgba(255,255,255,0.08)'], [1, 'rgba(255,255,255,0)']]));
function seeded(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const CLOUD_COLORS = { glim: 0xfff0b0, spores: 0x8fe8a0 };

// A gas cloud: a loose knot of soft glowing puffs that turn slowly.
export function buildCloud(seed, kind) {
  const rand = seeded(seed), root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const color = new THREE.Color(CLOUD_COLORS[kind] || 0xffffff);
  const n = 9 + Math.floor(rand() * 5);
  for (let i = 0; i < n; i++) {
    const m = new THREE.SpriteMaterial({ map: tex(), color: color.clone().offsetHSL((rand() - 0.5) * 0.06, 0, (rand() - 0.5) * 0.1), transparent: true, opacity: 0.16 + rand() * 0.12, depthWrite: false, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(m);
    const r = Math.pow(rand(), 0.7) * 0.75;
    const dir = new THREE.Vector3(rand() - 0.5, (rand() - 0.5) * 0.6, rand() - 0.5).normalize();
    s.position.copy(dir.multiplyScalar(r));
    s.scale.setScalar(0.9 + rand() * 0.9);
    body.add(s);
  }
  // a brighter heart
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(), color, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  core.scale.setScalar(0.9);
  body.add(core);
  return { root, body, engines: [], flares: [], spin: [{ obj: body, speed: (rand() - 0.5) * 0.05 }], length: 2, cloud: true };
}

// A crystal formation piece: a few long faceted shards growing from one root, glowing from inside.
const crystalMats = [0x7fe8e0, 0xb59cff, 0x9fd8ff].map((c) => new THREE.MeshStandardMaterial({
  color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.88,
}));
const shardGeo = new THREE.OctahedronGeometry(1, 0);
export function buildSpire(seed) {
  const rand = seeded(seed), root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const mat = crystalMats[Math.floor(rand() * crystalMats.length)];
  const n = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(shardGeo, mat);
    m.scale.set(0.35 + rand() * 0.2, 0.9 + rand() * 0.5, 0.35 + rand() * 0.2);
    m.rotation.set((rand() - 0.5) * 0.9, rand() * 6.3, (rand() - 0.5) * 0.9);
    m.position.set((rand() - 0.5) * 0.4, (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.4);
    body.add(m);
  }
  body.rotation.set((rand() - 0.5) * 0.5, rand() * 6.3, (rand() - 0.5) * 0.5);
  return { root, body, engines: [], flares: [], spin: [], length: 2 };
}

// A nebula: very large, very faint coloured light, a few overlapping layers.
export function buildNebula(seed, color, radius) {
  const rand = seeded(seed), g = new THREE.Group();
  const c = new THREE.Color(parseInt(color, 16));
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(), color: c.clone().offsetHSL((rand() - 0.5) * 0.05, 0, (rand() - 0.5) * 0.08), transparent: true, opacity: 0.05 + rand() * 0.05, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set((rand() - 0.5) * radius, (rand() - 0.5) * radius * 0.4, (rand() - 0.5) * radius);
    s.scale.setScalar(radius * (1.1 + rand() * 0.8));
    s.renderOrder = -1;
    g.add(s);
  }
  return g;
}
