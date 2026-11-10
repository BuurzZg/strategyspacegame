import * as THREE from '../../lib/three.module.js';

// The 3D move widget: a disc on the horizontal plane through the selection, a radius line
// to the cursor, and a height line from the plane up (or down) to the destination.
// Stalks from every selected ship to the plane show where the fleet sits in height.
const PLANE = 0x5fe3d0, HEIGHT = 0xffb547;

function lineMat(color, opacity, dashed = false) {
  const opts = { color, transparent: true, opacity, depthWrite: false, depthTest: false };
  return dashed ? new THREE.LineDashedMaterial({ ...opts, dashSize: 0.8, gapSize: 0.6 }) : new THREE.LineBasicMaterial(opts);
}
function dynLine(n, mat, segments = false) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const l = segments ? new THREE.LineSegments(g, mat) : new THREE.Line(g, mat);
  l.frustumCulled = false;
  l.renderOrder = 20;
  return l;
}
function circlePoints(r, n = 96) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
  return pts;
}

export class MoveWidget {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.renderOrder = 20;
    scene.add(this.group);

    // disc on the plane (scaled to the cursor distance)
    this.disc = new THREE.Group();
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePoints(1)), lineMat(PLANE, 0.85));
    const inner = [0.25, 0.5, 0.75].map((r) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePoints(r)), lineMat(PLANE, 0.18)));
    const spokes = [];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; spokes.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a), 0, Math.sin(a))); }
    const spokeLines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(spokes), lineMat(PLANE, 0.12));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: PLANE, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide }));
    for (const o of [ring, ...inner, spokeLines, fill]) { o.renderOrder = 20; o.frustumCulled = false; if (o.material) o.material.depthTest = false; this.disc.add(o); }
    this.group.add(this.disc);

    this.radius = dynLine(2, lineMat(PLANE, 0.9));
    this.height = dynLine(2, lineMat(HEIGHT, 0.95));
    this.path = dynLine(2, lineMat(0xffffff, 0.25, true));
    this.stalks = dynLine(2 * 64, lineMat(PLANE, 0.35), true);
    this.ticks = dynLine(2 * 40, lineMat(HEIGHT, 0.7), true);
    // point on the plane and the destination marker
    this.foot = new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePoints(0.6, 24)), lineMat(PLANE, 0.9));
    this.marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), new THREE.MeshBasicMaterial({ color: HEIGHT, wireframe: true, transparent: true, opacity: 0.95, depthTest: false }));
    for (const o of [this.radius, this.height, this.path, this.stalks, this.ticks, this.foot, this.marker]) { o.renderOrder = 21; o.frustumCulled = false; this.group.add(o); }
    // formation preview: where each ship's slot will be at the destination
    const gg = new THREE.BufferGeometry();
    this.ghostPos = new Float32Array(64 * 3);
    gg.setAttribute('position', new THREE.BufferAttribute(this.ghostPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.ghosts = new THREE.Points(gg, new THREE.PointsMaterial({ color: PLANE, size: 7, sizeAttenuation: false, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false }));
    this.ghosts.frustumCulled = false; this.ghosts.renderOrder = 22;
    this.group.add(this.ghosts);
    // everything drawn in the plane colour can be re-tinted (rally placement uses lilac)
    this.planeMats = [];
    this.group.traverse((o) => { if (o.material && o.material.color.getHex() === PLANE) this.planeMats.push(o.material); });
  }
  setTint(color = PLANE) { for (const m of this.planeMats) m.color.setHex(color); }

  show() { this.group.visible = true; }
  hide() { this.group.visible = false; }
  get visible() { return this.group.visible; }

  static set(line, pts) {
    const a = line.geometry.attributes.position;
    pts.forEach((p, i) => a.setXYZ(i, p.x, p.y, p.z));
    line.geometry.setDrawRange(0, pts.length);
    a.needsUpdate = true;
    if (line.material.isLineDashedMaterial) line.computeLineDistances();
  }

  // center: selection centre (plane height = center.y); onPlane: cursor point on that plane;
  // dest: final destination (onPlane raised by the height offset); ships: render positions.
  update(center, onPlane, dest, ships, t, ghosts = []) {
    const gn = Math.min(64, ghosts.length);
    for (let i = 0; i < gn; i++) this.ghostPos.set([ghosts[i].x, ghosts[i].y, ghosts[i].z], i * 3);
    this.ghosts.geometry.setDrawRange(0, gn);
    this.ghosts.geometry.attributes.position.needsUpdate = true;
    const r = Math.max(0.5, Math.hypot(onPlane.x - center.x, onPlane.z - center.z));
    this.disc.position.copy(center);
    this.disc.scale.setScalar(r);
    MoveWidget.set(this.radius, [center, onPlane]);
    MoveWidget.set(this.height, [onPlane, dest]);
    MoveWidget.set(this.path, [center, dest]);
    this.foot.position.copy(onPlane);
    this.marker.position.copy(dest);
    this.marker.rotation.y = t * 1.5;
    // tick marks on the height line every ~2 units
    const dh = dest.y - onPlane.y, n = Math.min(40, Math.floor(Math.abs(dh) / 2));
    const tick = [];
    for (let i = 1; i <= n; i++) { const y = onPlane.y + Math.sign(dh) * i * 2; tick.push({ x: onPlane.x - 0.35, y, z: onPlane.z }, { x: onPlane.x + 0.35, y, z: onPlane.z }); }
    MoveWidget.set(this.ticks, tick);
    const stalk = [];
    for (const s of ships.slice(0, 64)) stalk.push(s, { x: s.x, y: center.y, z: s.z });
    MoveWidget.set(this.stalks, stalk);
  }
}
