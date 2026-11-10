import * as THREE from '../../lib/three.module.js';

// The backdrop: a procedural nebula skybox, a starfield, the dying star Orrin, the lights,
// and the distant debris of the Drift ring outside the play area. Everything is generated
// here; no asset files. (Mineable asteroids are actors, drawn by the world renderer.)
//
// Render space: three.js X = sim x, Y = sim z (up), Z = sim y. 1 render unit = 256 world units.
export const R = 1 / 256;
export const toRender = (x, y, z, v = new THREE.Vector3()) => v.set(x * R, z * R, y * R);

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Direction of Orrin, the collapsing star (also the key light).
export const STAR_DIR = new THREE.Vector3(-0.62, 0.32, -0.71).normalize();

export class SpaceScene {
  constructor(scene, bounds, seed = 7) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.sky = this.makeSky();
    this.stars = this.makeStars(seed);
    this.sun = this.makeSun();
    this.makeLights();
    this.rocks = this.makeLandmarks(bounds, seed);
    this.sky.add(this.stars, this.sun);
    this.group.add(this.sky);
  }

  // Large sphere drawn from the inside; follows the camera so it is always "at infinity".
  makeSky() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { starDir: { value: STAR_DIR } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec3 vDir; uniform vec3 starDir;
        float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float noise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
        float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++){ s += a * noise(p); p *= 2.07; a *= 0.5; } return s; }
        void main(){
          vec3 d = normalize(vDir);
          vec3 base = vec3(0.012, 0.010, 0.026);
          // a broad band of dust across the sky, like the plane of the ring
          float band = exp(-pow(d.y * 3.2 + 0.25 * sin(d.x * 2.0), 2.0));
          float n1 = fbm(d * 2.4 + vec3(3.1, 0.0, 1.7));
          float n2 = fbm(d * 5.1 + vec3(-2.0, 4.0, 0.3));
          float cloud = smoothstep(0.42, 0.85, n1) * (0.35 + band);
          float wisp = smoothstep(0.55, 0.9, n2) * band;
          vec3 violet = vec3(0.20, 0.07, 0.30), teal = vec3(0.03, 0.20, 0.22), ember = vec3(0.45, 0.13, 0.05);
          float toStar = max(dot(d, starDir), 0.0);
          vec3 col = base + violet * cloud * 0.9 + teal * wisp * 0.7 + ember * pow(toStar, 6.0) * (0.35 + cloud);
          col += vec3(1.0, 0.55, 0.25) * pow(toStar, 90.0) * 0.6;          // halo around Orrin
          col *= 0.85 + 0.3 * fbm(d * 14.0);                               // fine dust grain
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), mat);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    return sky;
  }

  makeStars(seed) {
    const rand = rng(seed * 13 + 5);
    const N = 9000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      // uniform on a sphere, denser toward the dust band
      let y = rand() * 2 - 1;
      if (rand() < 0.45) y *= 0.25;
      const t = rand() * Math.PI * 2, r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(t) * r * 8500, y * 8500, Math.sin(t) * r * 8500], i * 3);
      const k = rand();
      c.setHSL(k < 0.15 ? 0.06 : k < 0.3 ? 0.58 : 0.62, k < 0.3 ? 0.6 : 0.15, 0.7 + rand() * 0.3);
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = rand() < 0.03 ? 2.6 + rand() * 1.6 : 0.8 + rand() * 1.2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    const m = new THREE.ShaderMaterial({
      vertexColors: true, transparent: true, depthWrite: false, fog: false,
      uniforms: { pr: { value: 1 } },
      vertexShader: `attribute float size; varying vec3 vC; uniform float pr; void main(){ vC = color; gl_PointSize = size * pr; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * a, a); }`,
    });
    this.starMat = m;
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    pts.renderOrder = -9;
    return pts;
  }

  makeSun() {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(130, 48), new THREE.MeshBasicMaterial({ color: 0xffb27a, fog: false }));
    const glowTex = radialTexture([[0, 'rgba(255,214,170,1)'], [0.15, 'rgba(255,150,90,0.6)'], [0.45, 'rgba(200,70,40,0.15)'], [1, 'rgba(120,30,20,0)']]);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
    glow.scale.setScalar(1500);
    g.add(glow, disc);
    g.position.copy(STAR_DIR).multiplyScalar(8200);
    disc.lookAt(0, 0, 0);
    g.renderOrder = -8;
    return g;
  }

  makeLights() {
    const key = new THREE.DirectionalLight(0xffb58a, 2.6);
    key.position.copy(STAR_DIR).multiplyScalar(500);
    const fill = new THREE.HemisphereLight(0x6a6fd8, 0x1a0f24, 0.55);
    const rim = new THREE.DirectionalLight(0x4fd1c5, 0.5);
    rim.position.set(0.6, -0.2, 0.8).multiplyScalar(500);
    this.scene.add(key, key.target, fill, rim);
    this.key = key;
  }

  // The Drift ring: big inert rock clusters scattered outside the play area, so the edges of
  // the battlefield have depth. Nothing inside the bounds is scenery: every rock there is ore.
  makeLandmarks(bounds, seed) {
    const rand = rng(seed * 101 + 3);
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      v.multiplyScalar(0.75 + 0.5 * Math.abs(Math.sin(v.x * 3.1 + v.y * 2.3) * Math.cos(v.z * 2.7)));
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0x3e3b47, roughness: 0.97, metalness: 0.04, flatShading: true });
    const W = (bounds.x1 - bounds.x0) * R, D = (bounds.y1 - bounds.y0) * R, H = (bounds.z1 - bounds.z0) * R;
    const clusters = 16, per = 30;
    const mesh = new THREE.InstancedMesh(geo, mat, clusters * per);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), e = new THREE.Euler();
    let k = 0;
    const mx = W / 2, mz = D / 2, ring = Math.max(W, D) * 0.5;
    for (let c = 0; c < clusters; c++) {
      const ang = (c / clusters) * Math.PI * 2 + rand() * 0.3, dist = ring * (1.35 + rand() * 0.5);
      const cx = mx + Math.cos(ang) * dist, cz = mz + Math.sin(ang) * dist, cy = (rand() - 0.5) * H * 1.2;
      for (let i = 0; i < per; i++) {
        const r = Math.pow(rand(), 0.6) * 70;
        const a = rand() * Math.PI * 2, b = (rand() - 0.5) * 0.9;
        v.set(cx + Math.cos(a) * r, cy + Math.sin(b) * r * 0.6, cz + Math.sin(a) * r);
        e.set(rand() * 6, rand() * 6, rand() * 6); q.setFromEuler(e);
        const sz = rand() < 0.15 ? 10 + rand() * 18 : 2 + rand() * 6;
        s.set(sz, sz * (0.6 + rand() * 0.5), sz * (0.7 + rand() * 0.6));
        m.compose(v, q, s);
        mesh.setMatrixAt(k++, m);
      }
    }
    this.group.add(mesh);
    return mesh;
  }

  update(camera, pixelRatio) {
    this.sky.position.copy(camera.position);
    this.starMat.uniforms.pr.value = pixelRatio;
  }
}

export function radialTexture(stops, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grd.addColorStop(o, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
