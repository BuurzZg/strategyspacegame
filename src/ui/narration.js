import * as THREE from '../../lib/three.module.js';
import { buildShip } from '../render/ships.js';
import { factionStyle } from '../render/worldrenderer.js';
import { radialTexture } from '../render/space.js';
import { narrationFor, voiceOf } from '../galaxy/narration.js';

// The ending narration screen (Milestone 22). Old Jacob tells the story, scene by scene: each a
// still built from the game's own models, posed, and drawn through an engraved, sepia etching
// (a post-process shader), with a slow camera move, his words beneath it, and music and sound.
// A scene whose memories weren't found is black, with faint scratches, and he falters.
//   Click, Space or Enter: the next line   Esc: skip to the end
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

const ETCH = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, dark: { value: 0 }, fade: { value: 1 }, res: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform float dark; uniform float fade; uniform vec2 res;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
    float line(float v, float w) { return smoothstep(w, 0.0, abs(fract(v) - 0.5) * 2.0 - (1.0 - w)); }
    void main() {
      vec2 px = vUv * res;
      vec3 paper = vec3(0.84, 0.76, 0.6) * (0.9 + 0.1 * noise(px * 0.02)) - 0.05 * noise(px * 0.6);
      vec3 inkc = vec3(0.2, 0.13, 0.08);
      // a scene Jacob can't remember: black, with faint scratches drifting through it
      if (dark > 0.5) {
        float sc = step(0.997, hash(vec2(floor(px.x / 2.0), floor(time * 7.0)))) * 0.35;
        sc += step(0.9993, hash(floor(px / 2.0) + floor(time * 9.0))) * 0.5;
        gl_FragColor = vec4(vec3(0.02, 0.016, 0.012) + sc * vec3(0.5, 0.42, 0.3), 1.0) * fade; return;
      }
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      l = pow(clamp(l * 1.15, 0.0, 1.0), 0.85);
      // engraving: three sets of hatching, crossed in as the tone darkens, with a wobble
      float w = 0.25 + 0.06 * noise(px * 0.05);
      float wob = noise(px * 0.01) * 3.0;
      float ink = 0.0;
      if (l < 0.82) ink = max(ink, line((px.x + px.y + wob) / 6.0, w) * smoothstep(0.82, 0.6, l));
      if (l < 0.55) ink = max(ink, line((px.x - px.y + wob) / 6.0, w) * smoothstep(0.55, 0.35, l));
      if (l < 0.3) ink = max(ink, line((px.y + wob) / 4.5, w + 0.1) * smoothstep(0.3, 0.12, l));
      if (l < 0.08) ink = max(ink, 0.9);
      // the Wound's light keeps its colour: arterial red ink
      float red = clamp((c.r - max(c.g, c.b)) * 2.5, 0.0, 1.0);
      vec3 col = mix(paper, mix(inkc, vec3(0.55, 0.06, 0.08), red), ink * 0.92);
      col = mix(col, vec3(0.7, 0.1, 0.1), red * 0.35 * (1.0 - ink));
      // the plate's edge: a vignette and a ruled border
      vec2 q = vUv - 0.5; float vig = smoothstep(0.75, 0.35, length(q * vec2(1.0, 1.25)));
      col *= 0.55 + 0.45 * vig;
      float border = step(abs(q.x), 0.485) * step(abs(q.y), 0.47);
      col = mix(vec3(0.12, 0.08, 0.05), col, border);
      gl_FragColor = vec4(col * fade, 1.0);
    }`,
};

export class NarrationScreen {
  constructor({ rules, voyage, audio, renderer, onDone }) {
    Object.assign(this, { rules, s: voyage, audio, renderer, onDone });
    this.scenes = narrationFor(rules, voyage).filter((sc) => sc.lines.length);
    this.voice = voiceOf(rules);
    this.styles = new Map(rules.actor('World').traitInfosOf('Faction').map((f) => [f.InternalName, factionStyle(f)]));
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 6000);
    const size = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio();
    this.target = new THREE.WebGLRenderTarget(Math.max(2, Math.trunc(size.x * pr)), Math.max(2, Math.trunc(size.y * pr)));
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mat = new THREE.ShaderMaterial({ ...ETCH, uniforms: THREE.UniformsUtils.clone(ETCH.uniforms) });
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
    this.t = 0; this.i = -1; this.listeners = [];
    this.el = $('narration');
    this.el.hidden = false;
    document.body.classList.add('at-narration');
    const on = (t, e, f) => { t.addEventListener(e, f); this.listeners.push([t, e, f]); };
    on(this.el, 'click', () => this.advance());
    on(window, 'keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); this.finish(); } else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.advance(); } });
    if (this.audio.narration) this.audio.narration(true);
    this.next();
  }

  // ---------------------------------------------------------------- the scenes
  next() {
    this.i++;
    if (this.i >= this.scenes.length) { this.finish(); return; }
    const sc = this.scenes[this.i];
    if (this.scene) this.scene.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose?.(); });
    this.scene = new THREE.Scene();
    // an engraving: pale paper, with the shadows hatched in (the etching shader)
    this.scene.background = new THREE.Color(0xd8ccb2);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xfff0d8, 2.6); key.position.set(1, 1.4, 0.6); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xb8c8ff, 0.8); rim.position.set(-1, 0.3, -1); this.scene.add(rim);
    this.shot = sc.shown ? this.still(sc.still) : { target: new THREE.Vector3(), dist: 60, yaw: 0, pitch: 0.2 };
    this.mat.uniforms.dark.value = sc.shown ? 0 : 1;
    this.st = 0; this.line = -1; this.lineT = 0; this.sceneEnd = 0;
    this.el.innerHTML = `<div class="nr-plate"><span class="nr-num">${sc.roman}</span><h2>${esc(sc.title)}</h2></div><div class="nr-lines${sc.shown ? '' : ' gap'}"></div><div class="nr-hint">Click or Space for the next line · Esc to skip</div>`;
    if (this.audio.narrationScene) this.audio.narrationScene(sc.sound, !sc.shown);
    this.nextLine();
  }
  nextLine() {
    const sc = this.scenes[this.i];
    this.line++;
    if (this.line >= sc.lines.length) { this.sceneEnd = this.st + 2.5; return; }
    const l = sc.lines[this.line], box = this.el.querySelector('.nr-lines');
    const p = document.createElement('p');
    p.dataset.id = l.id;
    p.textContent = l.text;
    box.appendChild(p);
    requestAnimationFrame(() => p.classList.add('in'));
    this.lineT = this.st + 3.2 + l.text.length * 0.05;
    if (this.voice) { try { const a = new Audio(`${this.voice}/${l.id}.ogg`); a.play().catch(() => {}); this.playing = a; } catch (e) { /* no voice */ } }
  }
  advance() {
    const sc = this.scenes[this.i];
    if (!sc) return;
    if (this.line < sc.lines.length - 1) this.nextLine();
    else this.next();
  }
  finish() {
    if (this.done) return;
    this.done = true;
    this.dispose();
    if (this.onDone) this.onDone();
  }
  dispose() {
    for (const [t, e, f] of this.listeners) t.removeEventListener(e, f);
    this.listeners = [];
    if (this.audio.narration) this.audio.narration(false);
    if (this.playing) this.playing.pause();
    this.el.hidden = true; this.el.innerHTML = '';
    document.body.classList.remove('at-narration');
    this.target.dispose();
  }

  frame(dt, renderer) {
    if (this.done) return;
    this.t += dt; this.st += dt;
    const sc = this.scenes[this.i];
    if (this.line >= 0 && this.line < sc.lines.length && this.st >= this.lineT) this.nextLine();
    if (this.sceneEnd && this.st >= this.sceneEnd) { this.next(); if (this.done) return; }
    // a slow camera move over the plate
    const sh = this.shot, k = Math.min(1, this.st / 30), cam = this.scenes[this.i].camera;
    let dist = sh.dist, yaw = sh.yaw, pitch = sh.pitch;
    if (cam === 'push') dist *= 1.25 - 0.3 * k;
    else if (cam === 'pull') dist *= 0.9 + 0.35 * k;
    else if (cam === 'pan') yaw += -0.35 + 0.7 * k;
    else { yaw += 0.25 * Math.sin(this.st * 0.05); dist *= 1 + 0.05 * Math.sin(this.st * 0.07); }
    this.camera.position.set(sh.target.x + Math.cos(yaw) * Math.cos(pitch) * dist, sh.target.y + Math.sin(pitch) * dist, sh.target.z + Math.sin(yaw) * Math.cos(pitch) * dist);
    this.camera.lookAt(sh.target);
    if (sh.spin) sh.spin.rotation.y += dt * 0.15;
    if (sh.fires) for (const f of sh.fires) { f.material.opacity = 0.55 + 0.45 * Math.abs(Math.sin(this.t * f.userData.s + f.userData.p)); }
    const size = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio();
    const W = Math.max(2, Math.trunc(size.x * pr)), H = Math.max(2, Math.trunc(size.y * pr));
    if (this.target.width !== W || this.target.height !== H) this.target.setSize(W, H);
    this.camera.aspect = size.x / Math.max(1, size.y); this.camera.updateProjectionMatrix();
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(null);
    const u = this.mat.uniforms;
    u.tDiffuse.value = this.target.texture; u.time.value = this.t; u.res.value.set(W, H);
    u.fade.value = Math.min(1, this.st / 1.5) * (this.sceneEnd ? Math.max(0, Math.min(1, (this.sceneEnd - this.st) / 1.2)) : 1);
    renderer.render(this.quadScene, this.quadCam);
    const ov = $('overlay'), ctx = ov && ov.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, ov.width, ov.height);
  }

  // ---------------------------------------------------------------- the stills
  // Each returns { target, dist, yaw, pitch } (and spin, fires): where the camera looks.
  model(type, faction = 'meridian') {
    const m = buildShip(type, this.styles.get(faction) || this.styles.values().next().value);
    for (const f of m.flares || []) f.visible = false;
    return m;
  }
  place(m, x, y, z, yaw = 0) { m.root.position.set(x, y, z); m.root.rotation.set(0, yaw, 0); this.scene.add(m.root); return m; }
  planet(r, x, y, z, color = 0x8a8070) {
    const g = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 4), new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true }));
    g.position.set(x, y, z); this.scene.add(g); return g;
  }
  glow(r, x, y, z, color) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: (this.glowTex ||= radialTexture([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']])), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set(x, y, z); s.scale.setScalar(r); this.scene.add(s); return s;
  }
  still(kind) {
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    switch (kind) {
      case 'forge': {
        const f = this.place(this.model('forge'), 0, 0, 0, 0.4);
        return { target: V3(0, 0, 0), dist: f.length * 1.15, yaw: 0.9, pitch: 0.25 };
      }
      case 'anchorage': {
        const st = this.place(this.model('hulltown', 'rivet'), 0, 0, 0, 0.2);
        this.place(this.model('forge'), st.length * 0.9, -4, st.length * 0.5, 2.6);
        this.planet(st.length * 1.4, -st.length * 3, st.length * 0.6, -st.length * 4);
        return { target: V3(st.length * 0.3, 0, 0), dist: st.length * 2.3, yaw: 1.2, pitch: 0.2 };
      }
      case 'greeted': {
        const st = this.place(this.model('hulltown', 'rivet'), 0, 0, 0, 0);
        this.place(this.model('den', 'gaunt'), -st.length * 1.4, 6, -st.length * 0.8, 1.2);
        for (let i = 0; i < 5; i++) this.place(this.model('dart', i % 2 ? 'gaunt' : 'rivet'), st.length * 0.6 + i * 6, 6 + (i % 2) * 4, st.length * 0.4 - i * 5, 2.4);
        return { target: V3(-st.length * 0.3, 0, 0), dist: st.length * 2.4, yaw: 0.6, pitch: 0.3 };
      }
      case 'twain': {
        const g = new THREE.Group(), brass = new THREE.MeshStandardMaterial({ color: 0x6a5634, roughness: 0.35, metalness: 0.9, flatShading: true });
        const half = new THREE.TorusKnotGeometry(6, 1.6, 90, 10, 2, 3);
        const a = new THREE.Mesh(half, brass); a.position.x = -9; a.scale.set(1, 1, 0.6); g.add(a);
        const b = new THREE.Mesh(half, brass); b.position.x = 9; b.rotation.y = Math.PI; b.scale.set(1, 1, 0.6); g.add(b);
        this.scene.add(g);
        this.glow(30, 0, 0, 0, 0xffe0b0);
        return { target: V3(0, 0, 0), dist: 75, yaw: 1.5, pitch: 0.2, spin: g };
      }
      case 'theft': {
        this.planet(60, -40, -10, -90, 0x7a7262);
        this.glow(90, -40, -10, -90, 0x8a80ff);
        const r = this.place(this.model('bloom', 'choir'), 10, 8, -20, 0.6);
        this.place(this.model('forge'), 40, 2, 20, 2.0);
        return { target: V3(10, 0, -10), dist: r.length * 4.5 + 60, yaw: 0.8, pitch: 0.18 };
      }
      case 'barge': {
        const ms = this.place(this.model('mainspring', 'wound'), -40, 10, -120, 0.3);
        const b = this.place(this.model('smelter', 'meridian'), 0, 0, 0, 2.2);
        return { target: V3(-10, 4, -30), dist: ms.length * 1.25, yaw: 1.0, pitch: 0.15 };
      }
      case 'burning': {
        const st = this.place(this.model('hulltown', 'meridian'), 0, 0, 0, 0.3);
        const fires = [];
        for (let i = 0; i < 18; i++) {
          const f = this.glow(8 + (i % 4) * 4, (Math.sin(i * 2.3)) * st.length * 0.45, (Math.cos(i * 1.7)) * 8, (Math.sin(i * 3.1)) * st.length * 0.3, i % 3 ? 0xff7a2a : 0xff3a1a);
          f.userData = { s: 3 + (i % 5), p: i }; fires.push(f);
        }
        for (let i = 0; i < 6; i++) this.place(this.model(i % 2 ? 'gleaner' : 'dart'), st.length * 0.7 + i * 7, 6 + i * 2, -10 - i * 8, -0.7);
        return { target: V3(st.length * 0.2, 0, 0), dist: st.length * 1.9, yaw: 1.1, pitch: 0.22, fires };
      }
      case 'relic': {
        const f = this.place(this.model('forge'), 0, 0, 0, 0.5);
        const shield = new THREE.Mesh(new THREE.IcosahedronGeometry(f.length * 0.75, 3), new THREE.MeshBasicMaterial({ color: 0xffe8c0, transparent: true, opacity: 0.12, depthWrite: false }));
        this.scene.add(shield);
        for (let i = 0; i < 3; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(f.length * (0.6 + i * 0.12), 0.4, 6, 80), new THREE.MeshBasicMaterial({ color: 0xffe0a0 })); ring.rotation.x = Math.PI / 2 + i * 0.4; ring.rotation.z = i; this.scene.add(ring); }
        return { target: V3(0, 0, 0), dist: f.length * 1.8, yaw: 0.7, pitch: 0.3 };
      }
      case 'waking': {
        const f = this.place(this.model('forge'), 0, 0, 0, 0.2);
        const fold = new THREE.Mesh(new THREE.TorusGeometry(f.length * 0.9, 1.5, 8, 120), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        fold.position.set(-f.length * 0.5, 0, 0); fold.rotation.y = Math.PI / 2; this.scene.add(fold);
        this.glow(f.length * 2.5, -f.length * 0.6, 0, 0, 0xffffff);
        return { target: V3(0, 0, 0), dist: f.length * 1.6, yaw: 1.3, pitch: 0.12 };
      }
      default: {
        // the Shore: the Forge small against the dark, and a star the navigators recognise
        const f = this.place(this.model('forge'), 0, 0, 0, Math.PI);
        this.glow(f.length * 1.2, -f.length * 6, f.length * 0.4, 0, 0xfff4e0);
        return { target: V3(-f.length * 1.5, 0, 0), dist: f.length * 3, yaw: 0.45, pitch: 0.1 };
      }
    }
  }
}
