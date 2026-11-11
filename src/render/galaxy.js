import * as THREE from '../../lib/three.module.js';

// The star chart in 3D, as a navigation parchment laid out on the chart table (Milestone 23, the
// approved style guide): the Wrack as a stained, burnt-edged sheet round the dead star Orrin, inked
// with the regions' rings. Places are wax seals coloured and lettered by kind once known
// (poi-types.yaml Seal), lanes are inked (teal where the drive can stitch now, dashed in the
// hazard's colour while a hazard closes them), the Veil is hatched in violet, clues are pencil
// rings, and the Forge is a brass token with the drive's reach round it. The camera still orbits:
// the chart is a sheet on a table, not a picture. The chart screen (ui/chart.js) owns the camera,
// the input and the lettering.

export const GS = 0.1; // render units per span
export const chartPos = (p, v = new THREE.Vector3()) => v.set(p.x * GS, p.z * GS * 0.6, p.y * GS);

export const PAPER = 0xe9dcbc, INK = 0x3b2a1a, LIVE = 0x2f7f6d, PENCIL = 0x4c4a46, VEIL = 0x5c3a6e;
const FELL_SC = "'IM Fell English SC', Georgia, serif";

// A place type's seal: [colour, letter] from poi-types.yaml (Seal: 7fb6c9, I)
export function sealOf(rules, type) {
  const T = rules.content.poiTypes[type], v = T && T.Seal ? String(T.Seal).split(',').map((x) => x.trim()) : [];
  return [parseInt(v[0] || '8c7a62', 16), v[1] || '·'];
}
// a type's colour, for swatches outside the chart
export const typeColor = (rules, type) => sealOf(rules, type)[0];

const PAPER_Y = -2.6; // the sheet lies under the lowest place

export class StarChart {
  constructor(scene, galaxy, rules) {
    this.scene = scene; this.g = galaxy; this.rules = rules;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.pos = galaxy.points.map((p) => chartPos(p));
    this.half = Math.max(...galaxy.points.map((p) => Math.hypot(p.x, p.y))) * GS + 24; // the sheet's half width
    this.dist = 95; // how far off the camera is (the chart screen sets it)
    this.textures = [];
    this.makePaper();
    this.makeRings();
    this.makeVeil();
    this.makeOrrin();
    this.makeLanes();
    this.makePoints();
    this.makeForge();
    this.makeRoute();
    this.makeMarkers();
    this.t = 0;
    // the lettering on the seals, the sheet and the token waits for the old typefaces
    if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load(`40px ${FELL_SC}`), document.fonts.load("italic 40px 'IM Fell English'")]).then(() => {
        if (this.disposed) return;
        this.drawAtlas(); this.drawPaper(); this.drawToken();
      }).catch(() => {});
    }
  }

  // ------------------------------------------------------------------ the sheet
  makePaper() {
    const c = document.createElement('canvas');
    c.width = c.height = 2048;
    this.paperCanvas = c;
    this.paperTex = this.tex(c);
    this.drawPaper();
    const S = this.half * 2;
    const geo = new THREE.PlaneGeometry(S, S);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { map: { value: this.paperTex } },
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vW = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform sampler2D map; varying vec2 vUv; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        void main(){
          vec4 p = texture2D(map, vUv);
          if (p.a < 0.5) discard;
          // the grain of the paper and its fibres, fine enough to hold up close
          float g = n(vW.xz * 3.1) * 0.5 + n(vW.xz * 7.3) * 0.3 + n(vec2(vW.x * 0.6, vW.z * 11.0)) * 0.2;
          // specks of old dirt in the fibres
          vec2 cell = floor(vW.xz * 2.5), f = fract(vW.xz * 2.5) - 0.5;
          float sp = step(0.93, h(cell)) * smoothstep(0.22, 0.05, length(f + (vec2(h(cell + 3.1), h(cell + 7.7)) - 0.5) * 0.4)) * h(cell + 1.7);
          gl_FragColor = vec4(p.rgb * (0.94 + g * 0.09) * (1.0 - sp * 0.28), 1.0);
        }`,
    });
    this.paper = new THREE.Mesh(geo, mat);
    this.paper.position.y = PAPER_Y;
    this.paper.renderOrder = -10;
    this.group.add(this.paper);
  }

  // The sheet: paper, mottling, stains and a coffee ring, the folds, a burnt and torn edge; the
  // compass rose, the scale bar in spans and the cartouche in its corners.
  drawPaper() {
    // drawn once, so on the CPU (a GPU canvas defers all of it to the first upload)
    const c = this.paperCanvas, x = c.getContext('2d', { willReadFrequently: true }), W = c.width, R = rng(this.g.seed || 7);
    const u = W / (this.half * 2); // pixels per render unit
    x.clearRect(0, 0, W, W);
    // the torn edge
    x.save();
    x.beginPath();
    const edge = (i, n) => 18 + R() * 22 + Math.sin(i * 0.37) * 8;
    const N = 90;
    for (let i = 0; i < N; i++) x.lineTo((i / N) * W, edge(i, N));
    for (let i = 0; i < N; i++) x.lineTo(W - edge(i, N), (i / N) * W);
    for (let i = N; i > 0; i--) x.lineTo((i / N) * W, W - edge(i, N));
    for (let i = N; i > 0; i--) x.lineTo(edge(i, N), (i / N) * W);
    x.closePath();
    x.fillStyle = '#e9dcbc'; x.fill();
    x.clip();
    // mottling
    for (let i = 0; i < 70; i++) {
      const px = R() * W, py = R() * W, r = 120 + R() * 320, a = R() * 0.06;
      const gr = x.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, `rgba(${120 + R() * 40},${80 + R() * 30},30,${a})`); gr.addColorStop(1, 'rgba(120,80,30,0)');
      x.fillStyle = gr; x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    // (the speckle is in the sheet's shader, so it stays sharp up close)
    // tide-mark stains and a ring where a mug stood
    for (let i = 0; i < 3; i++) {
      const px = W * (0.12 + R() * 0.76), py = W * (0.12 + R() * 0.76), r = W * (0.03 + R() * 0.05);
      const gr = x.createRadialGradient(px, py, r * 0.6, px, py, r);
      gr.addColorStop(0, 'rgba(130,85,30,0.02)'); gr.addColorStop(0.88, 'rgba(120,75,25,0.08)'); gr.addColorStop(1, 'rgba(120,80,30,0)');
      x.fillStyle = gr; x.beginPath(); x.ellipse(px, py, r, r * (0.8 + R() * 0.3), R() * 3, 0, Math.PI * 2); x.fill();
    }
    {
      const px = W * 0.8, py = W * 0.17, r = W * 0.045;
      x.strokeStyle = 'rgba(105,62,22,0.16)'; x.lineWidth = W * 0.006;
      x.beginPath(); x.arc(px, py, r, 0.4, Math.PI * 1.85); x.stroke();
      x.lineWidth = W * 0.002; x.beginPath(); x.arc(px + 3, py - 2, r * 0.93, 0, Math.PI * 2); x.stroke();
    }
    // folds: in quarters, long ago
    for (const [ax, ay, bx, by] of [[W / 2, 0, W / 2, W], [0, W / 2, W, W / 2]]) {
      const gr = x.createLinearGradient(ax === bx ? ax - 10 : 0, ay === by ? ay - 10 : 0, ax === bx ? ax + 10 : 0, ay === by ? ay + 10 : 0);
      gr.addColorStop(0, 'rgba(90,60,25,0)'); gr.addColorStop(0.45, 'rgba(90,60,25,0.10)'); gr.addColorStop(0.55, 'rgba(255,250,235,0.18)'); gr.addColorStop(1, 'rgba(255,250,235,0)');
      x.fillStyle = gr;
      if (ax === bx) x.fillRect(ax - 10, 0, 20, W); else x.fillRect(0, ay - 10, W, 20);
    }
    // the burnt edge
    const v = x.createRadialGradient(W / 2, W / 2, W * 0.36, W / 2, W / 2, W * 0.72);
    v.addColorStop(0, 'rgba(70,40,15,0)'); v.addColorStop(0.75, 'rgba(70,40,15,0.22)'); v.addColorStop(1, 'rgba(50,25,8,0.7)');
    x.fillStyle = v; x.fillRect(0, 0, W, W);
    x.restore();
    x.strokeStyle = 'rgba(60,32,12,0.55)'; x.lineWidth = 5; x.stroke();
    const ink = (a) => `rgba(59,42,26,${a})`;
    const toPx = (rx, rz) => [W / 2 + rx * u, W / 2 + rz * u];
    // the compass rose, in the bottom right corner of the sheet (north is up the chart)
    {
      const [cx, cy] = toPx(this.half - 20, this.half - 22), rr = 13 * u;
      x.save(); x.translate(cx, cy);
      x.strokeStyle = ink(0.8); x.fillStyle = ink(0.8); x.lineWidth = Math.max(1.5, u * 0.18);
      x.beginPath(); x.arc(0, 0, rr * 0.82, 0, Math.PI * 2); x.stroke();
      x.beginPath(); x.arc(0, 0, rr * 0.74, 0, Math.PI * 2); x.stroke();
      for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2, r0 = rr * (i % 4 ? 0.74 : 0.66); x.beginPath(); x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); x.lineTo(Math.cos(a) * rr * 0.82, Math.sin(a) * rr * 0.82); x.stroke(); }
      for (let i = 0; i < 8; i++) {
        x.save(); x.rotate((i * Math.PI) / 4);
        const L = i % 2 ? rr * 0.6 : rr, w = i % 2 ? rr * 0.1 : rr * 0.16;
        x.beginPath(); x.moveTo(0, -L); x.lineTo(w, 0); x.lineTo(0, 0); x.closePath(); x.fill();
        x.beginPath(); x.moveTo(0, -L); x.lineTo(-w, 0); x.lineTo(0, 0); x.closePath(); x.stroke();
        x.restore();
      }
      x.fillStyle = ink(0.9); x.font = `${Math.round(rr * 0.42)}px ${FELL_SC}`; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
      x.fillText('N', 0, -rr * 1.08);
      x.restore();
    }
    // the scale bar: a hundred spans
    {
      const [sx, sy] = toPx(-this.half + 14, this.half - 12), len = 100 * GS * u;
      x.strokeStyle = ink(0.85); x.lineWidth = Math.max(2, u * 0.25);
      x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + len, sy);
      for (const t of [0, 0.25, 0.5, 0.75, 1]) { const tk = t === 0 || t === 1 ? 10 : 6; x.moveTo(sx + len * t, sy - tk); x.lineTo(sx + len * t, sy + tk); }
      x.stroke();
      x.fillStyle = ink(0.75); x.fillRect(sx, sy - 4, len * 0.25, 4); x.fillRect(sx + len * 0.5, sy - 4, len * 0.25, 4);
      x.fillStyle = ink(0.88); x.font = `${Math.round(2.4 * u)}px 'Cutive Mono', monospace`; x.textAlign = 'left'; x.textBaseline = 'middle';
      x.fillText('100 SPANS', sx + len + 2 * u, sy);
    }
    // the cartouche
    {
      const [tx, ty] = toPx(-this.half + 14, -this.half + 16);
      x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      x.fillStyle = ink(0.85); x.font = `${Math.round(5.2 * u)}px ${FELL_SC}`; x.fillText('The Wrack', tx, ty);
      x.fillStyle = ink(0.7); x.font = `italic ${Math.round(2.6 * u)}px 'IM Fell English', Georgia, serif`; x.fillText('round the dead star Orrin, as the Forge has charted it', tx, ty + 4 * u);
      x.strokeStyle = ink(0.55); x.lineWidth = 2; x.beginPath(); x.moveTo(tx, ty + 6 * u); x.lineTo(tx + 60 * u, ty + 6 * u); x.stroke();
    }
    this.paperTex.needsUpdate = true;
  }

  makeRings() {
    // the inner edge of each region, inked and dotted
    for (const R of Object.values(this.rules.content.regions)) {
      const [r0] = this.g.rings ? this.g.rings[R.id] : String(R.Ring).split(',').map(Number);
      if (r0 < 80) continue;
      const line = this.circle(INK, 0.34, 0.5, 1.0);
      line.position.y = PAPER_Y + 0.02;
      line.scale.setScalar(r0 * GS);
    }
  }

  makeVeil() {
    if (!this.g.veil) return;
    const [a, b] = this.g.veil;
    const geo = new THREE.RingGeometry(a * GS, b * GS, 192, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { color: { value: new THREE.Color(VEIL) }, r0: { value: a * GS }, r1: { value: b * GS } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        varying vec3 vP; uniform vec3 color; uniform float r0, r1;
        void main(){
          // hatched: fine diagonal strokes, softened where they get too fine to draw
          float s = (vP.x + vP.z) / 0.9;
          float w = fwidth(s);
          float f = abs(fract(s) - 0.5);
          float line = 1.0 - smoothstep(0.16 - w, 0.16 + w, f);
          line = mix(line, 0.32, smoothstep(0.25, 0.6, w));
          float r = length(vP.xz), k = (r - r0) / (r1 - r0);
          float edge = smoothstep(0.0, 0.04, k) * smoothstep(1.0, 0.96, k);
          gl_FragColor = vec4(color, line * 0.42 * edge);
        }`,
    });
    mat.extensions = { derivatives: true };
    this.veil = new THREE.Mesh(geo, mat);
    this.veil.position.y = PAPER_Y + 0.03;
    this.group.add(this.veil);
    for (const r of [a, b]) { const l = this.circle(VEIL, 0.6, 0, 0); l.position.y = PAPER_Y + 0.04; l.scale.setScalar(r * GS); }
  }

  makeOrrin() {
    // the dead star: a dark ink disc with rays
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const x = c.getContext('2d'), m = 256;
    x.fillStyle = '#1e140b'; x.beginPath(); x.arc(m, m, 70, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(30,20,11,0.45)'; x.lineWidth = 3; x.beginPath(); x.arc(m, m, 82, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = 'rgba(59,42,26,0.6)'; x.lineWidth = 4;
    for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2, r1 = i % 2 ? 150 : 200 + (i % 4 ? 0 : 40); x.beginPath(); x.moveTo(m + Math.cos(a) * 96, m + Math.sin(a) * 96); x.lineTo(m + Math.cos(a) * r1, m + Math.sin(a) * r1); x.stroke(); }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.tex(c), transparent: true, depthWrite: false }));
    mesh.position.y = PAPER_Y + 0.05;
    this.group.add(mesh);
  }

  // ------------------------------------------------------------------ lanes, inked
  // Each lane is a flat ribbon of ink so it can be drawn thicker where it matters (lines in
  // WebGL are always a pixel wide): its colour, width and dash change with the voyage.
  makeLanes() {
    const L = this.g.lanes, n = L.length;
    const pos = new Float32Array(n * 12), dir = new Float32Array(n * 12), side = new Float32Array(n * 4), along = new Float32Array(n * 4);
    const idx = [];
    L.forEach((l, i) => {
      const a = this.pos[l.a], b = this.pos[l.b], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
      for (let k = 0; k < 4; k++) {
        const p = k < 2 ? a : b;
        pos.set([p.x, p.y, p.z], (i * 4 + k) * 3);
        dir.set([dx / len, 0, dz / len], (i * 4 + k) * 3);
        side[i * 4 + k] = k % 2 ? 1 : -1;
        along[i * 4 + k] = k < 2 ? 0 : len;
      }
      const o = i * 4;
      idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('dir', new THREE.BufferAttribute(dir, 3));
    geo.setAttribute('side', new THREE.BufferAttribute(side, 1));
    geo.setAttribute('along', new THREE.BufferAttribute(along, 1));
    geo.setAttribute('lcol', new THREE.BufferAttribute(new Float32Array(n * 16), 4));
    geo.setAttribute('width', new THREE.BufferAttribute(new Float32Array(n * 4), 1));
    geo.setAttribute('dash', new THREE.BufferAttribute(new Float32Array(n * 4), 1));
    geo.setIndex(idx);
    this.laneMat = ribbonMaterial();
    this.lanes = new THREE.Mesh(geo, this.laneMat);
    this.lanes.renderOrder = -5;
    this.lanes.frustumCulled = false;
    this.group.add(this.lanes);
  }

  // ------------------------------------------------------------------ places: wax seals
  makePoints() {
    // the seal atlas: one cell per kind of place, and an ink dot for places not yet known
    this.types = Object.keys(this.rules.content.poiTypes);
    this.cols = 8; this.rows = Math.ceil((this.types.length + 1) / 8);
    const c = document.createElement('canvas');
    c.width = 128 * this.cols; c.height = 128 * this.rows;
    this.atlasCanvas = c;
    this.atlas = this.tex(c);
    this.atlas.generateMipmaps = true; this.atlas.minFilter = THREE.LinearMipmapLinearFilter;
    this.drawAtlas();
    const n = this.g.points.length;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos.flatMap((v) => [v.x, v.y, v.z])), 3));
    geo.setAttribute('cell', new THREE.BufferAttribute(new Float32Array(n), 1));
    geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n), 1));
    geo.setAttribute('ring', new THREE.BufferAttribute(new Float32Array(n), 1));
    geo.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
    geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n), 1));
    this.pointMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { scale: { value: 600 }, atlas: { value: this.atlas }, grid: { value: new THREE.Vector2(this.cols, this.rows) } },
      vertexShader: `
        attribute float cell; attribute float size; attribute float ring; attribute vec4 tint; attribute float alpha;
        varying float vCell; varying float vR; varying vec4 vT; varying float vA; uniform float scale;
        void main(){ vCell = cell; vR = ring; vT = tint; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(7.0, size * scale / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        uniform sampler2D atlas; uniform vec2 grid; varying float vCell; varying float vR; varying vec4 vT; varying float vA;
        void main(){
          vec2 pc = gl_PointCoord;
          vec2 q = pc - 0.5;
          float d = length(q) * 2.0;
          if (d > 1.0) discard;
          float col = mod(vCell, grid.x), row = floor(vCell / grid.x);
          vec4 s = texture2D(atlas, vec2((col + pc.x) / grid.x, 1.0 - (row + pc.y) / grid.y));
          vec3 c = s.rgb; float a = s.a;
          vec3 ink = vec3(0.23, 0.165, 0.10);
          // whose territory: a ring of the faction's colour round the seal
          float claim = smoothstep(0.07, 0.0, abs(d - 0.68)) * vT.a;
          c = mix(c, vT.rgb, claim * (1.0 - a)); a = max(a, claim * 0.85);
          // visited: an inked ring this life; a dashed one for a place known from an earlier life
          float ang = atan(q.y, q.x);
          float r1 = smoothstep(0.045, 0.0, abs(d - 0.84)) * step(0.6, vR);
          float r2 = smoothstep(0.04, 0.0, abs(d - 0.9)) * step(0.1, vR) * (1.0 - step(0.6, vR)) * step(0.5, fract(ang * 3.8197));
          float r = max(r1 * 0.9, r2 * 0.6);
          c = mix(c, ink, r * (1.0 - a)); a = max(a, r);
          gl_FragColor = vec4(c, a * vA);
        }`,
    });
    this.points = new THREE.Points(geo, this.pointMat);
    this.points.renderOrder = 2;
    this.points.frustumCulled = false;
    this.group.add(this.points);
  }

  drawAtlas() {
    const c = this.atlasCanvas, x = c.getContext('2d', { willReadFrequently: true });
    x.clearRect(0, 0, c.width, c.height);
    this.cellOf = {};
    this.types.forEach((t, i) => {
      const [col, letter] = sealOf(this.rules, t);
      const cx = (i % this.cols) * 128 + 64, cy = Math.floor(i / this.cols) * 128 + 64;
      seal(x, cx, cy, 33, `#${col.toString(16).padStart(6, '0')}`, letter, i);
      this.cellOf[t] = i;
    });
    // a place not yet known: a small ring of ink with a dot
    const k = this.types.length, cx = (k % this.cols) * 128 + 64, cy = Math.floor(k / this.cols) * 128 + 64;
    x.strokeStyle = 'rgba(59,42,26,0.85)'; x.lineWidth = 5; x.beginPath(); x.arc(cx, cy, 15, 0, Math.PI * 2); x.stroke();
    x.fillStyle = 'rgba(59,42,26,0.85)'; x.beginPath(); x.arc(cx, cy, 5, 0, Math.PI * 2); x.fill();
    this.unknownCell = k;
    this.atlas.needsUpdate = true;
  }

  // ------------------------------------------------------------------ the Forge's token
  makeForge() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    this.tokenCanvas = c;
    this.tokenTex = this.tex(c);
    this.drawToken();
    this.forge = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tokenTex, depthWrite: false, depthTest: false, transparent: true }));
    this.forge.scale.set(4.2, 4.2, 1);
    this.forge.renderOrder = 5;
    this.group.add(this.forge);
    // its shadow on the paper, and a pin down to its place
    this.forgeShadow = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2a1a0a, transparent: true, opacity: 0.16, depthWrite: false }));
    this.group.add(this.forgeShadow);
    this.rangeRing = this.circle(LIVE, 0.75, 0, 0);
    this.sensorRing = this.circle(PENCIL, 0.55, 0.012, 0.012);
    this.clueRings = [];
  }

  drawToken() {
    const x = this.tokenCanvas.getContext('2d'), m = 64;
    x.clearRect(0, 0, 128, 128);
    x.save();
    x.shadowColor = 'rgba(30,18,6,0.5)'; x.shadowBlur = 8; x.shadowOffsetY = 4;
    const gr = x.createRadialGradient(m - 14, m - 16, 4, m, m, 52);
    gr.addColorStop(0, '#f6dc94'); gr.addColorStop(0.5, '#c9a04e'); gr.addColorStop(1, '#6b4f1e');
    x.fillStyle = gr; x.strokeStyle = '#3b2a1a'; x.lineWidth = 4;
    x.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; x.lineTo(m + Math.cos(a) * 46, m + Math.sin(a) * 46); } x.closePath(); x.fill();
    x.restore();
    x.strokeStyle = '#3b2a1a'; x.lineWidth = 4; x.stroke();
    x.strokeStyle = 'rgba(59,42,26,0.6)'; x.lineWidth = 2;
    x.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; x.lineTo(m + Math.cos(a) * 37, m + Math.sin(a) * 37); } x.closePath(); x.stroke();
    // rivets at the corners
    x.fillStyle = '#7a5a22';
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; x.beginPath(); x.arc(m + Math.cos(a) * 41, m + Math.sin(a) * 41, 2.6, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = '#2a1d10'; x.font = `48px ${FELL_SC}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('F', m, m + 3);
    this.tokenTex.needsUpdate = true;
  }

  makeRoute() {
    // the planned route: a red-ink ribbon, and a brass bead running along it
    const max = 64, n = max;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 12), 3));
    geo.setAttribute('dir', new THREE.BufferAttribute(new Float32Array(n * 12), 3));
    geo.setAttribute('side', new THREE.BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 2 ? 1 : -1)), 1));
    geo.setAttribute('along', new THREE.BufferAttribute(new Float32Array(n * 4), 1));
    const col = new Float32Array(n * 16), w = new Float32Array(n * 4).fill(0.5);
    for (let i = 0; i < n * 4; i++) col.set([0.62, 0.2, 0.12, 0.92], i * 4);
    geo.setAttribute('lcol', new THREE.BufferAttribute(col, 4));
    geo.setAttribute('width', new THREE.BufferAttribute(w, 1));
    geo.setAttribute('dash', new THREE.BufferAttribute(new Float32Array(n * 4).fill(1), 1));
    const idx = [];
    for (let i = 0; i < n; i++) { const o = i * 4; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    geo.setIndex(idx);
    geo.setDrawRange(0, 0);
    this.routeGeo = geo;
    this.route = new THREE.Mesh(geo, ribbonMaterial(0.9, 0.62));
    this.route.renderOrder = -4;
    this.route.frustumCulled = false;
    this.group.add(this.route);
    this.bead = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture('#d9b45e', '#5d4519'), depthWrite: false, transparent: true }));
    this.bead.scale.set(1.3, 1.3, 1);
    this.bead.visible = false;
    this.bead.renderOrder = 3;
    this.group.add(this.bead);
    this.routePts = [];
  }

  makeMarkers() {
    // the drive component the engineers have a fix on: a slow ring of gold ink
    this.signal = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture('rgba(168,112,18,0.95)', 5), depthWrite: false, transparent: true }));
    this.signal.visible = false;
    this.select = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture('rgba(42,29,16,0.9)', 3), depthWrite: false, transparent: true }));
    this.select.visible = false;
    this.signal.renderOrder = this.select.renderOrder = 3;
    this.group.add(this.signal, this.select);
    // traders: a brass bell stamped beside the place, once it is known
    const bell = bellTexture();
    this.bells = this.g.points.filter((p) => p.trader).map((p) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bell, depthWrite: false, transparent: true }));
      sp.position.copy(this.pos[p.id]); sp.position.y += 2.6; sp.scale.set(2.2, 2.2, 1); sp.visible = false; sp.userData.id = p.id;
      sp.renderOrder = 3;
      this.group.add(sp);
      return sp;
    });
  }

  // a unit circle on the sheet (scaled to its radius); dashed in world units when dash > 0
  circle(color, opacity, dash, gap) {
    const pts = [];
    for (let i = 0; i <= 192; i++) { const a = (i / 192) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a))); }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = dash ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: dash, gapSize: gap, depthWrite: false }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const line = new THREE.Line(geo, mat);
    if (dash) line.computeLineDistances();
    line.renderOrder = -6;
    this.group.add(line);
    return line;
  }

  // Clue circles: [{ x, y, r }] in galaxy spans, drawn as dashed pencil rings on the sheet.
  setClues(list) {
    while (this.clueRings.length < list.length) this.clueRings.push(this.circle(PENCIL, 0.75, 0.04, 0.03));
    this.clueRings.forEach((ring, i) => {
      const c = list[i];
      ring.visible = !!c;
      if (!c) return;
      chartPos({ x: c.x, y: c.y, z: 0 }, ring.position);
      ring.position.y = PAPER_Y + 0.06;
      ring.scale.setScalar(c.r * GS);
      // dashes of about a span and a half, however big the circle
      ring.material.dashSize = 1.4 / Math.max(1, c.r);
      ring.material.gapSize = 1.0 / Math.max(1, c.r);
    });
  }

  // view: { at, known: Set, visited: {}, before: Set (visited in an earlier life), range, sensor, veil, signal (place id or -1), selected, open: lane index -> bool, dark (no radar yet), hazards: [ids the drive goes through] }
  update(view) {
    const g = this.g, n = g.points.length, c = new THREE.Color();
    const A = this.points.geometry.attributes;
    for (let i = 0; i < n; i++) {
      const p = g.points[i], known = view.known.has(i);
      A.cell.setX(i, known ? this.cellOf[p.type] ?? this.unknownCell : this.unknownCell);
      let size = (known ? 5.2 : 3.4) * (i === view.selected ? 1.4 : 1) * (p.edge && known ? 1.12 : 1);
      if (known && p.seat) size *= 1.3;
      A.size.setX(i, size);
      A.ring.setX(i, view.visited[i] ? 1 : view.before && view.before.has(i) ? 0.3 : 0);
      A.alpha.setX(i, known ? 1 : view.dark ? 0.16 : 0.7); // before the radar, the chart is mostly blank
      const fc = known && p.owner ? factionColor(this.rules, p.owner) : null;
      if (fc) { c.setHex(fc).multiplyScalar(0.72); A.tint.setXYZW(i, c.r, c.g, c.b, 1); } else A.tint.setXYZW(i, 0, 0, 0, 0);
    }
    for (const k of ['cell', 'size', 'ring', 'alpha', 'tint']) A[k].needsUpdate = true;
    // lanes: open ones in teal (thicker next to the Forge), the rest in faint ink; the Veil's lanes
    // violet while it holds; lanes into a hazard pocket dashed in the hazard's colour
    // (hazards.yaml) while it is closed
    const L = this.lanes.geometry.attributes, H = this.rules.content.hazards || {}, through = view.hazards || [];
    g.lanes.forEach((l, i) => {
      const near = l.a === view.at || l.b === view.at;
      const seen = !view.dark || view.known.has(l.a) || view.known.has(l.b);
      let a, w, dash = 0;
      if (view.open[i] && near) { c.setHex(LIVE); a = 0.95; w = 0.55; } // live: the drive can stitch it now
      else if (view.open[i]) { c.setHex(INK); a = 0.5; w = 0.2; }
      else if (l.hazard && H[l.hazard] && !through.includes(l.hazard)) { c.setHex(parseInt(H[l.hazard].Color, 16) || 0x884422).multiplyScalar(0.66); a = 0.85; w = 0.34; dash = 1; }
      else if (l.veil && !view.veil) { c.setHex(VEIL); a = 0.55; w = 0.2; }
      else { c.setHex(INK); a = 0.24; w = 0.14; } // too long for the drive as it is
      if (!seen) a *= 0.12;
      for (let k = 0; k < 4; k++) { L.lcol.setXYZW(i * 4 + k, c.r, c.g, c.b, a); L.width.setX(i * 4 + k, w); L.dash.setX(i * 4 + k, dash); }
    });
    L.lcol.needsUpdate = true; L.width.needsUpdate = true; L.dash.needsUpdate = true;
    const here = this.pos[view.at];
    this.forgeAt = here;
    this.forgeShadow.position.set(here.x + 0.5, PAPER_Y + 0.07, here.z + 0.4);
    this.rangeRing.position.set(here.x, PAPER_Y + 0.08, here.z);
    this.rangeRing.scale.setScalar(Math.max(0.01, view.range * GS));
    this.rangeRing.visible = view.range > 0;
    this.sensorRing.position.set(here.x, PAPER_Y + 0.08, here.z);
    this.sensorRing.scale.setScalar(view.sensor * GS);
    const sr = Math.max(1, view.sensor * GS);
    this.sensorRing.material.dashSize = 0.9 / sr; this.sensorRing.material.gapSize = 0.7 / sr;
    this.signal.visible = view.signal >= 0;
    if (view.signal >= 0) this.signal.position.copy(this.pos[view.signal]);
    for (const b of this.bells) b.visible = view.known.has(b.userData.id);
    this.select.visible = view.selected >= 0 && view.selected !== view.at;
    if (this.select.visible) this.select.position.copy(this.pos[view.selected]);
  }

  // The planned route, as place ids from here to there (or none).
  setRoute(ids) {
    const A = this.routeGeo.attributes;
    this.routePts = ids.map((i) => this.pos[i]);
    let k = 0, run = 0;
    for (let i = 0; i + 1 < ids.length && k < 64; i++, k++) {
      const p = this.pos[ids[i]], q = this.pos[ids[i + 1]], dx = q.x - p.x, dz = q.z - p.z, len = Math.hypot(dx, dz) || 1;
      for (let j = 0; j < 4; j++) {
        const v = j < 2 ? p : q;
        A.position.setXYZ(k * 4 + j, v.x, v.y + 0.05, v.z);
        A.dir.setXYZ(k * 4 + j, dx / len, 0, dz / len);
        A.along.setX(k * 4 + j, run + (j < 2 ? 0 : len));
      }
      run += len;
    }
    A.position.needsUpdate = true; A.dir.needsUpdate = true; A.along.needsUpdate = true;
    this.routeGeo.setDrawRange(0, k * 6);
    this.bead.visible = k > 0;
  }

  frame(dt, camera) {
    this.t += dt;
    if (this.forgeAt) {
      const bob = Math.sin(this.t * 2) * 0.12;
      this.forge.position.set(this.forgeAt.x, this.forgeAt.y + 2.6 + bob, this.forgeAt.z);
    }
    const pulse = 1 + 0.18 * Math.sin(this.t * 3);
    this.signal.scale.set(6.4 * pulse, 6.4 * pulse, 1);
    this.select.scale.set(5.6, 5.6, 1);
    // the bead runs the route, a stitch a second
    if (this.routePts.length > 1) {
      const n = this.routePts.length - 1, u = (this.t * 0.9) % n, i = Math.floor(u), f = u - i;
      this.bead.position.lerpVectors(this.routePts[i], this.routePts[i + 1], f);
      this.bead.position.y += 0.1;
    }
    // ink keeps a readable width when the chart is seen from far off
    const z = Math.max(1, this.dist / 110);
    void camera;
    this.laneMat.uniforms.wscale.value = z;
    this.route.material.uniforms.wscale.value = z;
  }

  setScale(scale) { this.pointMat.uniforms.scale.value = scale; }
  tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; this.textures.push(t); return t; }
  dispose() {
    this.disposed = true;
    this.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    for (const t of this.textures) t.dispose();
  }
}

// Ink ribbons for lanes and the route. Attributes: position (an end of the lane), dir (along the
// lane, flat), side (-1 or 1), along (distance from the lane's start, for dashes), lcol (rgba),
// width (render units), dash (0 or 1).
function ribbonMaterial(dashOn = 1.1, dashOff = 0.8) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { wscale: { value: 1 }, on: { value: dashOn }, period: { value: dashOn + dashOff } },
    vertexShader: `
      attribute vec3 dir; attribute float side; attribute float along; attribute vec4 lcol; attribute float width; attribute float dash;
      varying float vS; varying float vAlong; varying vec4 vC; varying float vDash; uniform float wscale;
      void main(){
        vec3 perp = normalize(vec3(-dir.z, 0.0, dir.x));
        vec3 p = position + perp * side * width * 0.5 * wscale;
        vS = side; vAlong = along; vC = lcol; vDash = dash;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      varying float vS; varying float vAlong; varying vec4 vC; varying float vDash; uniform float on; uniform float period;
      void main(){
        if (vC.a < 0.005) discard;
        if (vDash > 0.5 && mod(vAlong, period) > on) discard;
        float edge = smoothstep(1.0, 0.55, abs(vS));
        gl_FragColor = vec4(vC.rgb, vC.a * edge);
      }`,
  });
}

// A wax seal (the style guide's): a wobbly disc with a highlight, a pressed inner ring and its
// letter; black wax for the story's places gets a gilt letter.
function seal(x, cx, cy, r, col, letter, salt) {
  x.save();
  x.beginPath();
  for (let i = 0; i <= 20; i++) { const a = (i / 20) * Math.PI * 2, rr = r * (1 + 0.08 * Math.sin(i * 2.7 + salt * 1.3)); x.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
  x.closePath();
  const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r * 1.1);
  g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(0.35, col); g.addColorStop(1, shade(col, -0.35));
  x.fillStyle = g; x.shadowColor = 'rgba(40,25,10,0.45)'; x.shadowBlur = r * 0.5; x.shadowOffsetY = r * 0.14; x.fill();
  x.shadowColor = 'transparent';
  const dark = lum(col) < 0.25;
  x.strokeStyle = dark ? 'rgba(201,160,78,0.45)' : 'rgba(30,18,8,0.35)'; x.lineWidth = Math.max(1, r * 0.1);
  x.beginPath(); x.arc(cx, cy, r * 0.66, 0, Math.PI * 2); x.stroke();
  x.fillStyle = dark ? '#d9b45e' : 'rgba(30,18,8,0.62)';
  x.font = `${Math.round(r * 0.98)}px ${FELL_SC}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(letter, cx, cy + r * 0.06);
  x.restore();
}
function shade(hex, f) { const c = parseInt(hex.slice(1), 16); let r = c >> 16, g = (c >> 8) & 255, b = c & 255; r = Math.round(r * (1 + f)); g = Math.round(g * (1 + f)); b = Math.round(b * (1 + f)); return `rgb(${r},${g},${b})`; }
function lum(hex) { const c = parseInt(hex.slice(1), 16); return (0.2126 * (c >> 16) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255; }
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// A faction's colour on the chart: its map colour from the World actor's Faction entries.
export function factionColor(rules, fid) {
  for (const f of rules.actor('World').traitInfosOf('Faction')) if (f.InternalName === fid) return parseInt(f.Color, 16);
  return 0xffffff;
}

function canvasTex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function dotTexture(fill, stroke) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(26, 24, 2, 32, 32, 22);
  gr.addColorStop(0, '#f6dc94'); gr.addColorStop(0.6, fill); gr.addColorStop(1, stroke);
  x.fillStyle = gr; x.strokeStyle = stroke; x.lineWidth = 4;
  x.beginPath(); x.arc(32, 32, 22, 0, Math.PI * 2); x.fill(); x.stroke();
  return canvasTex(c);
}
// a small brass bell, for traders
function bellTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 8, 0, 54);
  gr.addColorStop(0, '#f2d27a'); gr.addColorStop(1, '#9a6e28');
  x.fillStyle = gr; x.strokeStyle = '#3a2a10'; x.lineWidth = 2.5;
  x.beginPath(); x.moveTo(32, 8); x.bezierCurveTo(16, 10, 18, 34, 10, 46); x.lineTo(54, 46); x.bezierCurveTo(46, 34, 48, 10, 32, 8); x.closePath(); x.fill(); x.stroke();
  x.beginPath(); x.arc(32, 52, 5, 0, Math.PI * 2); x.fill(); x.stroke();
  x.beginPath(); x.arc(32, 6, 3, 0, Math.PI * 2); x.stroke();
  return canvasTex(c);
}
function ringTexture(color, w = 3) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.strokeStyle = color; x.lineWidth = w * 2;
  x.beginPath(); x.arc(64, 64, 54, 0, Math.PI * 2); x.stroke();
  return canvasTex(c);
}
