import * as THREE from '../../lib/three.module.js';

// Mineable asteroids: a lumpy low-poly rock studded with glowing ore crystals. Each rock's
// shape comes from its actor id, so it looks the same every time. Unit radius; the renderer
// scales it to the asteroid's current size (rocks shrink as they are mined).
// ore: warm rock with copper crystals; ice: pale blue rock with glassy white-blue crystals
const MATS = {
  ore: [new THREE.MeshStandardMaterial({ color: 0x75645a, emissive: 0x1c130e, roughness: 0.93, metalness: 0.06, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0xffc58a, emissive: 0xd9772e, emissiveIntensity: 1.4, roughness: 0.35, metalness: 0.6, flatShading: true })],
  ice: [new THREE.MeshStandardMaterial({ color: 0x9fc0d6, emissive: 0x0c1a26, roughness: 0.45, metalness: 0.15, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0xeaf8ff, emissive: 0x5fc8ff, emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.2, flatShading: true })],
};
const shardGeo = new THREE.OctahedronGeometry(1, 0);
const UP = new THREE.Vector3(0, 1, 0);

function seeded(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function buildAsteroid(seed, kind = 'ore') {
  const [rockMat, oreMat] = MATS[kind] || MATS.ore;
  const rand = seeded(seed);
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const p = geo.attributes.position, v = new THREE.Vector3();
  // a few broad bumps and dents
  const bumps = Array.from({ length: 5 }, () => [new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(), (rand() - 0.4) * 0.5]);
  const stretch = new THREE.Vector3(0.8 + rand() * 0.5, 0.7 + rand() * 0.3, 0.8 + rand() * 0.4);
  const shape = (u) => { let k = 1; for (const [dir, amt] of bumps) k += Math.max(0, u.dot(dir)) ** 3 * amt; return u.multiplyScalar(k).multiply(stretch); };
  // normalise so the rock's average surface sits on the unit sphere (its collision radius):
  // bumps stand a little proud of it, dents sit a little inside
  let max = 0;
  for (let i = 0; i < p.count; i++) max += shape(v.fromBufferAttribute(p, i)).length();
  max /= p.count;
  for (let i = 0; i < p.count; i++) { shape(v.fromBufferAttribute(p, i)).divideScalar(max); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  body.add(new THREE.Mesh(geo, rockMat));
  // ore crystals poking out of the surface
  // ore crystals in a few veins: small clusters set into the surface, not spikes
  const veins = 3 + Math.floor(rand() * 3);
  for (let vn = 0; vn < veins; vn++) {
    const centre = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
    const n = 3 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const dir = centre.clone().add(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.45)).normalize();
      const shard = new THREE.Mesh(shardGeo, oreMat);
      shard.position.copy(shape(dir.clone())).divideScalar(max).multiplyScalar(0.9);
      shard.quaternion.setFromUnitVectors(UP, dir);
      const w = 0.04 + rand() * 0.04;
      shard.scale.set(w, 0.07 + rand() * 0.09, w);
      body.add(shard);
    }
  }
  body.rotation.set(rand() * 6.3, rand() * 6.3, rand() * 6.3);
  return { root, body, rockMesh: body.children[0], engines: [], flares: [], spin: [{ obj: body, speed: (rand() - 0.5) * 0.12 }], length: 2 };
}
