import * as THREE from '../../lib/three.module.js';

// The Wound's biomechanical models (Milestone 21; PLAN.md §3, "Their look"): wet, cold,
// blue-black metal grown together with flesh and pale bone, lit from inside by a pulsing
// arterial crimson and magenta. Model space as in ships.js: nose along +X, up along +Y,
// 1 unit = 256 world units. buildDemon() fills ships.js's `out` and returns true for a demon type.

const geo = new Map();
const G = (key, make) => geo.get(key) || (geo.set(key, make()), geo.get(key));
let MAT = null;
function mats() {
  if (MAT) return MAT;
  MAT = {
    metal: new THREE.MeshStandardMaterial({ color: 0x1a2232, roughness: 0.28, metalness: 0.8, flatShading: true }),
    flesh: new THREE.MeshStandardMaterial({ color: 0x5c1a2a, roughness: 0.5, metalness: 0.1, flatShading: true, emissive: 0x2a0410, emissiveIntensity: 0.9 }),
    bone: new THREE.MeshStandardMaterial({ color: 0xd8cdb8, roughness: 0.85, metalness: 0.05, flatShading: true }),
    vein: new THREE.MeshStandardMaterial({ color: 0xff4a62, emissive: 0xff1a44, emissiveIntensity: 1.6, flatShading: true }),
    heart: new THREE.MeshStandardMaterial({ color: 0xff7ac0, emissive: 0xff2aa0, emissiveIntensity: 2.0, flatShading: true }),
    maw: new THREE.MeshStandardMaterial({ color: 0x0a0408, roughness: 1, metalness: 0, flatShading: true }),
  };
  return MAT;
}
// the light inside them pulses, like a slow heartbeat (worldrenderer.js calls this each frame)
export function pulseDemons(t) {
  if (!MAT) return;
  const beat = Math.max(0, Math.sin(t * 2.4)) ** 6 + Math.max(0, Math.sin(t * 2.4 - 0.5)) ** 8 * 0.6;
  MAT.vein.emissiveIntensity = 1.1 + beat * 1.4;
  MAT.heart.emissiveIntensity = 1.4 + beat * 2.0;
  MAT.flesh.emissiveIntensity = 0.6 + beat * 0.6;
}

function part(g, mat, x, y, z, parent, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(g, mat);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  parent.add(o);
  return o;
}
const ico = (r, d = 0) => G(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));
const cone = (r, h, s = 6) => G(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const torus = (r, t, s = 16, arc = Math.PI * 2) => G(`t${r},${t},${s},${arc}`, () => new THREE.TorusGeometry(r, t, 5, s, arc));
const cyl = (rt, rb, h, s = 8) => G(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
// a bump-skinned blob: an icosahedron with its vertices pushed in and out (the same every time)
function lump(key, r, d, amp) {
  return G(`l${key}`, () => {
    const g = new THREE.IcosahedronGeometry(r, d), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + amp * Math.sin(x * 3.1 + y * 1.7) * Math.cos(z * 2.3 - y);
      p.setXYZ(i, x * k, y * k, z * k);
    }
    g.computeVertexNormals();
    return g;
  });
}
// a horn or claw: a cone bent along its length
function claw(key, r, len, bend) {
  return G(`h${key}`, () => {
    const g = new THREE.ConeGeometry(r, len, 5, 4), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = (y + len / 2) / len; p.setX(i, p.getX(i) + bend * t * t); }
    g.computeVertexNormals();
    return g;
  });
}
// a coiled spring along +X: the Mainspring's mark, grown into its Hours
function coil(key, r, tube, turns, len) {
  return G(`s${key}`, () => {
    class Helix extends THREE.Curve {
      getPoint(t, out = new THREE.Vector3()) { const a = t * Math.PI * 2 * turns; return out.set((t - 0.5) * len, Math.sin(a) * r, Math.cos(a) * r); }
    }
    return new THREE.TubeGeometry(new Helix(), Math.trunc(turns * 28), tube, 6, false);
  });
}

export function buildDemon(type, body, out) {
  const M = mats();
  switch (type) {
    case 'tick': {
      // a wet black knot of claws with a red light at its heart
      part(lump('tick', 0.5, 1, 0.12), M.metal, 0, 0, 0, body).scale.set(1.25, 0.8, 0.9);
      part(ico(0.2, 0), M.heart, 0.25, 0.12, 0, body);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        part(claw('tick', 0.07, 0.9, 0.35), M.bone, 0.45, Math.sin(a) * 0.3, Math.cos(a) * 0.3, body, a, 0, -Math.PI / 2 - 0.25);
      }
      out.engines.push({ pos: new THREE.Vector3(-0.65, 0, 0), size: 0.35 });
      out.nose = new THREE.Vector3(1, 0, 0);
      out.length = 2;
      return true;
    }
    case 'stinger': {
      // a bone lance with a body behind it
      part(cone(0.2, 2.4, 6), M.bone, 1.4, 0, 0, body, 0, 0, -Math.PI / 2);
      part(lump('sting', 0.55, 1, 0.1), M.flesh, -0.5, 0, 0, body).scale.set(1.9, 0.75, 0.75);
      for (let i = 0; i < 3; i++) part(torus(0.5 - i * 0.08, 0.04, 12), M.vein, -0.1 - i * 0.45, 0, 0, body, 0, Math.PI / 2, 0);
      for (const z of [-1, 1]) part(claw('stfin', 0.12, 1.2, -0.4), M.metal, -0.8, 0, z * 0.45, body, z * 1.3, 0, Math.PI / 2);
      out.engines.push({ pos: new THREE.Vector3(-1.6, 0, 0), size: 0.45 });
      out.nose = new THREE.Vector3(2.6, 0, 0);
      out.length = 4;
      return true;
    }
    case 'chime': {
      // a hollow bell of grown metal, ringing; its clapper glows
      const bell = new THREE.Group(); body.add(bell);
      const shape = [[0.15, 1.5], [0.5, 1.35], [0.85, 0.8], [1.05, 0], [1.25, -0.8], [1.6, -1.2], [1.5, -1.3]].map(([x, y]) => new THREE.Vector2(x, y));
      part(G('chime-bell', () => new THREE.LatheGeometry(shape, 9)), M.metal, 0, 0, 0, bell).material.side = THREE.DoubleSide;
      part(torus(1.55, 0.1, 18), M.vein, 0, -1.25, 0, bell, Math.PI / 2, 0, 0);
      part(ico(0.38, 1), M.heart, 0, -0.9, 0, bell);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; part(claw('chrib', 0.06, 1.6, 0.25), M.bone, Math.cos(a) * 0.9, 0.2, Math.sin(a) * 0.9, bell, 0, -a, 0.2); }
      out.bell = bell;
      out.nose = new THREE.Vector3(1.6, 0, 0);
      out.length = 4;
      return true;
    }
    case 'hound': {
      // long and low, ribbed like a dog's chest, spitting hot ichor
      part(lump('hound', 1, 1, 0.08), M.metal, 0, 0, 0, body).scale.set(3.0, 0.65, 0.9);
      for (let i = 0; i < 6; i++) part(torus(0.95 - Math.abs(i - 2) * 0.06, 0.07, 10, Math.PI), M.bone, 1.4 - i * 0.6, 0.05, 0, body, 0, Math.PI / 2, 0);
      part(lump('hound-head', 0.6, 0, 0.1), M.metal, 3.0, -0.05, 0, body).scale.set(1.5, 0.55, 0.7);
      for (const z of [-1, 1]) {
        part(ico(0.18, 0), M.vein, 2.6, 0.1, z * 0.42, body);
        part(claw('hjaw', 0.09, 0.9, 0.2), M.bone, 3.6, -0.25, z * 0.25, body, 0, 0, -Math.PI / 2);
      }
      for (let i = 0; i < 4; i++) part(cone(0.16, 0.6, 4), M.bone, 1.2 - i * 0.7, 0.75, 0, body, 0, 0, 0.35);
      part(torus(0.3, 0.06, 10), M.vein, -2.9, 0, 0, body, 0, Math.PI / 2, 0);
      out.engines.push({ pos: new THREE.Vector3(-3.1, 0, 0), size: 0.8 });
      out.nose = new THREE.Vector3(3.8, 0, 0);
      out.length = 7.5;
      return true;
    }
    case 'gnawer': {
      // a slow mountain of jaws
      part(lump('gnawer', 2.4, 1, 0.14), M.flesh, 0, 0, 0, body).scale.set(2.6, 1.45, 1.6);
      for (let i = 0; i < 5; i++) part(lump(`gnplate${i % 2}`, 1.4, 0, 0.1), M.metal, 3 - i * 2.2, 2.4 - Math.abs(i - 2) * 0.3, (i % 2 ? 1 : -1) * 0.6, body).scale.set(1.2, 0.6, 1);
      part(torus(1.9, 0.35, 16), M.vein, 6.0, 0, 0, body, 0, Math.PI / 2, 0);
      part(cyl(1.7, 1.7, 0.3, 14), M.maw, 6.1, 0, 0, body, 0, 0, Math.PI / 2);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; part(claw('gnjaw', 0.45, 3.2, -1.2), M.bone, 6.6, Math.sin(a) * 1.6, Math.cos(a) * 1.6, body, a, 0, -Math.PI / 2); }
      for (let i = 0; i < 3; i++) part(ico(0.5, 0), M.vein, -1 - i * 2, 1.9, 0, body);
      out.engines.push({ pos: new THREE.Vector3(-6.3, 0, 0), size: 1.6 });
      out.nose = new THREE.Vector3(8, 0, 0);
      out.length = 15;
      return true;
    }
    case 'feeder': {
      // a bloated thing with a mouth like a drain
      part(lump('feeder', 1, 1, 0.12), M.flesh, -0.2, 0, 0, body).scale.set(1.5, 1.05, 1.1);
      part(torus(0.55, 0.16, 14), M.bone, 1.25, 0, 0, body, 0, Math.PI / 2, 0);
      part(cyl(0.48, 0.2, 0.5, 12), M.maw, 1.2, 0, 0, body, 0, 0, Math.PI / 2);
      part(torus(0.4, 0.05, 12), M.vein, 1.1, 0, 0, body, 0, Math.PI / 2, 0);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; part(claw('ftend', 0.06, 1.6, 0.5), M.metal, -1.4, Math.sin(a) * 0.4, Math.cos(a) * 0.4, body, a, 0, Math.PI / 2); }
      part(ico(0.25, 0), M.heart, -0.3, 0.75, 0, body);
      out.engines.push({ pos: new THREE.Vector3(-1.7, 0, 0), size: 0.5 });
      out.nose = new THREE.Vector3(1.4, 0, 0);
      out.length = 3.5;
      return true;
    }
    case 'hour': {
      // a lesser living carrier, coiled like a sleeping thing: a spring grown round a spine, its
      // flanks crowded with pods
      part(cyl(1.8, 2.6, 30, 10), M.metal, 0, 0, 0, body, 0, 0, Math.PI / 2);
      part(coil('hour', 5.2, 1.1, 3.5, 26), M.flesh, -1, 0, 0, body);
      part(coil('hour-v', 5.2, 0.25, 3.5, 26), M.vein, -1, 0.9, 0, body);
      for (let i = 0; i < 10; i++) {
        const x = 10 - i * 2.3, side = i % 2 ? 1 : -1;
        const pod = part(lump(`pod${i % 3}`, 1.3, 1, 0.1), M.flesh, x, -0.5 + (i % 3) * 0.4, side * 6.6, body);
        pod.scale.set(1.4, 0.9, 0.9);
        part(ico(0.42, 0), M.heart, x + 0.6, -0.1 + (i % 3) * 0.4, side * 7.5, body);
      }
      // the crown at its head: bone, and the eye of it
      part(lump('hour-head', 3.4, 1, 0.12), M.metal, 16.5, 0, 0, body).scale.set(1.5, 0.9, 1);
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; part(claw('crown', 0.4, 5, -1.8), M.bone, 18.5, Math.sin(a) * 2.6, Math.cos(a) * 2.6, body, a, 0, -Math.PI / 2); }
      part(ico(1.2, 1), M.heart, 20.5, 0, 0, body);
      // spines along its back (the guns), and the tail
      for (let i = 0; i < 6; i++) part(claw('spine', 0.35, 3.2, -0.8), M.bone, 9 - i * 3.4, 2.8, 0, body);
      part(cone(2.4, 8, 8), M.metal, -18.5, 0, 0, body, 0, 0, Math.PI / 2);
      for (const z of [-1, 1]) out.engines.push({ pos: new THREE.Vector3(-17, 0, z * 2.2), size: 3 });
      out.nose = new THREE.Vector3(21, 0, 0);
      out.length = 42;
      return true;
    }
    case 'nursery': {
      // a flesh growth anchored to a rock, pulsing with red light
      part(lump('nursery', 3, 1, 0.18), M.flesh, 0, 0, 0, body).scale.set(1.1, 0.85, 1);
      for (let i = 0; i < 5; i++) part(torus(2.6 + (i % 2) * 0.3, 0.12, 18, Math.PI * 1.4), M.vein, 0, 0, 0, body, i * 0.6, i * 1.3, i * 0.4);
      for (let i = 0; i < 4; i++) part(lump(`nbud${i % 2}`, 0.9, 1, 0.1), M.flesh, Math.cos(i * 1.6) * 3, 1.2 + (i % 2), Math.sin(i * 1.6) * 3, body);
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; part(claw('nroot', 0.35, 4.5, 1.2), M.metal, Math.cos(a) * 2.2, -2, Math.sin(a) * 2.2, body, Math.sin(a) * 0.6, 0, Math.PI + Math.cos(a) * 0.6); }
      part(ico(1, 1), M.heart, 0, 2.4, 0, body);
      out.nose = new THREE.Vector3(3, 0, 0);
      out.length = 7;
      return true;
    }
    case 'mainspring': {
      // the demon lord: a vast coil of wet dark metal grown through with flesh round a spine
      // that is itself a spring, winding; red light along its veins, and a crown of bone
      part(cyl(4.5, 6.5, 52, 12), M.metal, 0, 0, 0, body, 0, 0, Math.PI / 2);
      part(coil('ms', 13, 3, 5.5, 50), M.flesh, -2, 0, 0, body);
      part(coil('ms-v', 13, 0.7, 5.5, 50), M.vein, -2, 2.6, 0, body);
      part(coil('ms-in', 8, 1.2, 9, 46), M.metal, -1, 0, 0, body);
      for (let i = 0; i < 14; i++) part(claw('ms-rib', 0.9, 9, -2.4), M.bone, 22 - i * 3.4, 6 + (i % 2), 0, body, (i % 2 ? 0.4 : -0.4), 0, 0);
      part(lump('ms-head', 8, 1, 0.12), M.metal, 30, 0, 0, body).scale.set(1.5, 0.9, 1.1);
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; part(claw('ms-crown', 1, 12, -4), M.bone, 36, Math.sin(a) * 6, Math.cos(a) * 6, body, a, 0, -Math.PI / 2); }
      part(ico(3, 1), M.heart, 41, 0, 0, body);
      part(cone(6, 18, 10), M.metal, -33, 0, 0, body, 0, 0, Math.PI / 2);
      for (const z of [-1, 1]) out.engines.push({ pos: new THREE.Vector3(-32, 0, z * 5), size: 6 });
      out.nose = new THREE.Vector3(42, 0, 0);
      out.length = 90;
      return true;
    }
    case 'heart': {
      // a fist of red muscle the size of a frigate, beating
      const beat = new THREE.Group(); body.add(beat);
      part(lump('heart', 4, 1, 0.16), M.flesh, 0, 0, 0, beat).scale.set(1.1, 1.25, 1);
      for (let i = 0; i < 4; i++) part(torus(3.6 - i * 0.3, 0.25, 16, Math.PI * 1.3), M.vein, 0, 0, 0, beat, i * 0.8, i * 1.4, 0.3);
      for (let i = 0; i < 3; i++) part(cyl(0.9, 1.2, 5, 8), M.metal, Math.cos(i * 2.1) * 2, 4.5, Math.sin(i * 2.1) * 2, beat, 0.4, 0, Math.cos(i * 2.1) * 0.4);
      part(ico(1.4, 1), M.heart, 0, 0.5, 2.6, beat);
      out.pulse = { obj: beat, speed: 2.4, amp: 0.08 };
      out.nose = new THREE.Vector3(4, 0, 0);
      out.length = 10;
      return true;
    }
    case 'coil': {
      // the spring in its spine, turning
      const turn = new THREE.Group(); body.add(turn);
      part(coil('coil', 5, 1.1, 4, 14), M.metal, 0, 0, 0, turn);
      part(coil('coil-v', 5, 0.3, 4, 14), M.vein, 0, 1, 0, turn);
      part(cyl(1.6, 1.6, 16, 10), M.bone, 0, 0, 0, turn, 0, 0, Math.PI / 2);
      out.spin.push({ obj: turn, speed: 0.6 });
      out.nose = new THREE.Vector3(8, 0, 0);
      out.length = 16;
      return true;
    }
    default:
      return false;
  }
}
