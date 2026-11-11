import * as THREE from '../../lib/three.module.js';

// The star chart in 3D: the Wrack as a mostly flat disc round the dead star Orrin. Places are
// glowing points (coloured by kind once known), lanes are lines (bright where the drive can
// stitch now), the Veil is a band of violet haze, and the Forge sits on its place with the
// drive's reach drawn round it. The chart screen (ui/chart.js) owns the camera and the input.

export const GS = 0.1; // render units per span
export const chartPos = (p, v = new THREE.Vector3()) => v.set(p.x * GS, p.z * GS * 0.6, p.y * GS);

export const TYPE_COLORS = {
  IceTail: 0xa8e4ff, LanternMist: 0xffe08a, OreReef: 0xe0a36a, ScrapShoal: 0xc9b8a6, Wreck: 0xe0705a, StillWater: 0x8fd8d0,
  HullTown: 0xffe6a0, SynodRefinery: 0xd8ffe8, GauntDen: 0xff8a7a, CinderHold: 0xffc08a, ChoirBloom: 0xf0f6ff,
};
const UNKNOWN = 0x8090ac;

export class StarChart {
  constructor(scene, galaxy, rules) {
    this.scene = scene; this.g = galaxy; this.rules = rules;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.pos = galaxy.points.map((p) => chartPos(p));
    this.makeOrrin();
    this.makeRings();
    this.makeVeil();
    this.makePoints();
    this.makeLanes();
    this.makeForge();
    this.makeRoute();
    this.makeMarkers();
    this.t = 0;
  }

  makeOrrin() {
    // a dead star: a dark ember with a faint, cold corona
    const core = new THREE.Mesh(new THREE.SphereGeometry(1.6, 32, 16), new THREE.MeshBasicMaterial({ color: 0x1a0c08 }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,120,70,0.55)', 'rgba(120,40,30,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.scale.set(14, 14, 1);
    this.group.add(core, glow);
  }

  makeRings() {
    // faint circles at the inner edge of each region, in its colour
    for (const R of Object.values(this.rules.content.regions)) {
      const [r0] = this.g.rings ? this.g.rings[R.id] : String(R.Ring).split(',').map(Number);
      if (r0 < 80) continue;
      const pts = [];
      for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r0 * GS, 0, Math.sin(a) * r0 * GS)); }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: parseInt(R.Color, 16), transparent: true, opacity: 0.16, depthWrite: false }));
      this.group.add(line);
    }
  }

  makeVeil() {
    if (!this.g.veil) return;
    const [a, b] = this.g.veil;
    const geo = new THREE.RingGeometry(a * GS, b * GS, 192, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { t: { value: 0 }, r0: { value: a * GS }, r1: { value: b * GS } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        varying vec3 vP; uniform float t, r0, r1;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        void main(){
          float r = length(vP.xz), a = atan(vP.z, vP.x);
          float k = (r - r0) / (r1 - r0);
          float edge = smoothstep(0.0, 0.25, k) * smoothstep(1.0, 0.7, k);
          vec2 q = vec2(a * 18.0, r * 0.35);
          float c = n(q + vec2(t * 0.05, 0.0)) * 0.6 + n(q * 2.3 - vec2(0.0, t * 0.03)) * 0.4;
          gl_FragColor = vec4(vec3(0.55, 0.32, 0.85) * (0.25 + c * 0.75) * edge * 0.55, 1.0);
        }`,
    });
    this.veil = new THREE.Mesh(geo, mat);
    this.group.add(this.veil);
  }

  makePoints() {
    const n = this.g.points.length;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos.flatMap((v) => [v.x, v.y, v.z])), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n), 1));
    geo.setAttribute('ring', new THREE.BufferAttribute(new Float32Array(n), 1));
    geo.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.pointMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { scale: { value: 600 } },
      vertexShader: `
        attribute vec3 color; attribute float size; attribute float ring; attribute vec3 tint; varying vec3 vC; varying vec3 vT; varying float vR; uniform float scale;
        void main(){ vC = color; vR = ring; vT = tint; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(5.0, size * scale / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        varying vec3 vC; varying vec3 vT; varying float vR;
        void main(){
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard;
          // whose territory: a faint ring in the faction's colour
          vec3 claim = vT * smoothstep(0.16, 0.0, abs(d - 0.66)) * 0.9;
          float core = smoothstep(0.5, 0.05, d), halo = smoothstep(1.0, 0.25, d) * 0.45;
          // visited: a bright ring this life, a faint one in an earlier life
          float ring = vR > 0.1 ? smoothstep(0.08, 0.0, abs(d - 0.82)) * (vR > 0.5 ? 0.9 : 0.35) : 0.0;
          gl_FragColor = vec4(vC * (core + halo) + claim + vec3(1.0) * ring * 0.8 + vec3(1.0) * pow(core, 3.0) * 0.5, 1.0);
        }`,
    });
    this.points = new THREE.Points(geo, this.pointMat);
    this.group.add(this.points);
  }

  makeLanes() {
    const L = this.g.lanes;
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(L.length * 6);
    L.forEach((l, i) => { const a = this.pos[l.a], b = this.pos[l.b]; p.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6); });
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(L.length * 6), 3));
    this.lanes = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.group.add(this.lanes);
  }

  makeForge() {
    // the Forge: a small bright spindle above its place, and the drive's reach round it
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshBasicMaterial({ color: 0x5fe3d0 }));
    m.scale.set(0.6, 1.4, 0.6);
    this.forge = new THREE.Group();
    this.forge.add(m);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(95,227,208,0.7)', 'rgba(95,227,208,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.scale.set(6, 6, 1);
    this.forge.add(glow);
    this.forgeMesh = m;
    this.group.add(this.forge);
    const circle = (color, opacity, dashed) => {
      const pts = [];
      for (let i = 0; i <= 160; i++) { const a = (i / 160) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a))); }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = dashed ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.03, gapSize: 0.03, depthWrite: false }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
      const line = new THREE.Line(geo, mat);
      if (dashed) line.computeLineDistances();
      this.group.add(line);
      return line;
    };
    this.rangeRing = circle(0x5fe3d0, 0.55, false);
    this.sensorRing = circle(0x8fa3c0, 0.35, true);
  }

  makeRoute() {
    this.routeGeo = new THREE.BufferGeometry();
    this.routeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 64), 3));
    this.routeGeo.setDrawRange(0, 0);
    this.route = new THREE.LineSegments(this.routeGeo, new THREE.LineBasicMaterial({ color: 0xffb547, transparent: true, opacity: 0.95, depthWrite: false }));
    this.group.add(this.route);
    // a bead running along the route
    this.bead = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,200,120,0.9)', 'rgba(255,181,71,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.bead.scale.set(2.4, 2.4, 1);
    this.bead.visible = false;
    this.group.add(this.bead);
    this.routePts = [];
  }

  makeMarkers() {
    // the drive component the engineers have a fix on: a slow golden pulse
    this.signal = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture('rgba(255,215,120,0.95)'), depthWrite: false, transparent: true }));
    this.signal.visible = false;
    this.select = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture('rgba(255,255,255,0.9)'), depthWrite: false, transparent: true }));
    this.select.visible = false;
    this.group.add(this.signal, this.select);
  }

  // Colours, sizes and lines from the voyage as it is now.
  // view: { at, known: Set, visited: {}, before: Set (visited in an earlier life), range, sensor, veil, signal (place id or -1), selected, open: lane index -> bool }
  update(view) {
    const g = this.g, n = g.points.length, c = new THREE.Color();
    const col = this.points.geometry.attributes.color, size = this.points.geometry.attributes.size, ring = this.points.geometry.attributes.ring, tint = this.points.geometry.attributes.tint;
    for (let i = 0; i < n; i++) {
      const p = g.points[i], known = view.known.has(i);
      c.setHex(known ? TYPE_COLORS[p.type] || 0xffffff : UNKNOWN);
      if (!known) c.multiplyScalar(0.55);
      col.setXYZ(i, c.r, c.g, c.b);
      size.setX(i, (known ? 3.2 : 2.2) * (i === view.selected ? 1.5 : 1) * (p.edge && known ? 1.15 : 1));
      ring.setX(i, view.visited[i] ? 1 : view.before && view.before.has(i) ? 0.3 : 0);
      const fc = known && p.owner ? factionColor(this.rules, p.owner) : null;
      if (fc) { c.setHex(fc); tint.setXYZ(i, c.r, c.g, c.b); } else tint.setXYZ(i, 0, 0, 0);
      if (known && p.seat) size.setX(i, size.getX(i) * 1.35);
    }
    col.needsUpdate = true; size.needsUpdate = true; ring.needsUpdate = true; tint.needsUpdate = true;
    // lanes: open ones bright, the rest faint; the Veil's lanes violet
    const lc = this.lanes.geometry.attributes.color;
    g.lanes.forEach((l, i) => {
      const near = l.a === view.at || l.b === view.at;
      if (view.open[i]) c.setRGB(0.07, 0.25, 0.24).multiplyScalar(near ? 3 : 1);
      else if (l.veil && !view.veil) c.setRGB(0.2, 0.09, 0.26);
      else c.setRGB(0.05, 0.06, 0.09);
      lc.setXYZ(i * 2, c.r, c.g, c.b); lc.setXYZ(i * 2 + 1, c.r, c.g, c.b);
    });
    lc.needsUpdate = true;
    const here = this.pos[view.at];
    this.forge.position.set(here.x, here.y + 1.6, here.z);
    this.rangeRing.position.set(here.x, here.y, here.z);
    this.rangeRing.scale.setScalar(Math.max(0.01, view.range * GS));
    this.rangeRing.visible = view.range > 0;
    this.sensorRing.position.set(here.x, here.y, here.z);
    this.sensorRing.scale.setScalar(view.sensor * GS);
    this.sensorRing.material.dashSize = this.sensorRing.material.gapSize = 0.02;
    this.signal.visible = view.signal >= 0;
    if (view.signal >= 0) this.signal.position.copy(this.pos[view.signal]);
    this.select.visible = view.selected >= 0 && view.selected !== view.at;
    if (this.select.visible) this.select.position.copy(this.pos[view.selected]);
  }

  // The planned route, as place ids from here to there (or none).
  setRoute(ids) {
    const a = this.routeGeo.attributes.position;
    this.routePts = ids.map((i) => this.pos[i]);
    let k = 0;
    for (let i = 0; i + 1 < ids.length && k < 64; i++, k++) {
      const p = this.pos[ids[i]], q = this.pos[ids[i + 1]];
      a.setXYZ(k * 2, p.x, p.y + 0.05, p.z); a.setXYZ(k * 2 + 1, q.x, q.y + 0.05, q.z);
    }
    a.needsUpdate = true;
    this.routeGeo.setDrawRange(0, k * 2);
    this.bead.visible = k > 0;
  }

  frame(dt, camera) {
    this.t += dt;
    this.forgeMesh.rotation.y += dt * 0.8;
    this.forge.children[0].position.y = Math.sin(this.t * 2) * 0.15;
    if (this.veil) this.veil.material.uniforms.t.value = this.t;
    const pulse = 1 + 0.25 * Math.sin(this.t * 3);
    this.signal.scale.set(5 * pulse, 5 * pulse, 1);
    this.select.scale.set(4.2, 4.2, 1);
    // the bead runs the route, a stitch a second
    if (this.routePts.length > 1) {
      const n = this.routePts.length - 1, u = (this.t * 0.9) % n, i = Math.floor(u), f = u - i;
      this.bead.position.lerpVectors(this.routePts[i], this.routePts[i + 1], f);
    }
    void camera;
  }

  setScale(scale) { this.pointMat.uniforms.scale.value = scale; }
  dispose() { this.scene.remove(this.group); }
}

// A faction's colour on the chart: its map colour from the World actor's Faction entries.
export function factionColor(rules, fid) {
  for (const f of rules.actor('World').traitInfosOf('Faction')) if (f.InternalName === fid) return parseInt(f.Color, 16);
  return 0xffffff;
}

function glowTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function ringTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.strokeStyle = color; x.lineWidth = 3;
  x.beginPath(); x.arc(32, 32, 26, 0, Math.PI * 2); x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
