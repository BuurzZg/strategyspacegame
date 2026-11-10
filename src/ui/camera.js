import * as THREE from '../../lib/three.module.js';

// Orbit camera: circles a focus point at a distance. Everything is smoothed toward targets,
// so input feels fluid even when the simulation ticks at 25 Hz.
//   rotate(dx, dy)  right-drag      zoom(delta)  scroll      pan(dx, dy)  middle-drag
//   panPlane(dx, dz)  keys (along the horizontal plane, relative to the view)
//   focusOn(point, follow)          follow: a function returning the point to track
export class OrbitCamera {
  constructor(camera) {
    this.cam = camera;
    this.focus = new THREE.Vector3();
    this.focusT = new THREE.Vector3();
    this.yaw = this.yawT = 0.9;
    this.pitch = this.pitchT = 0.42;
    this.dist = this.distT = 46;
    this.minDist = 5; this.maxDist = 1100;
    this.follow = null;
    this.bounds = null;
    this.right = new THREE.Vector3(); this.up = new THREE.Vector3(); this.fwd = new THREE.Vector3();
  }
  rotate(dx, dy) {
    this.yawT += dx * 0.0055;
    this.pitchT = Math.max(-1.45, Math.min(1.45, this.pitchT + dy * 0.0055));
  }
  zoom(delta) { this.distT = Math.max(this.minDist, Math.min(this.maxDist, this.distT * Math.exp(delta * 0.0011))); }
  pan(dx, dy) {
    this.follow = null;
    const k = this.dist * 0.0017;
    this.right.setFromMatrixColumn(this.cam.matrixWorld, 0);
    this.up.setFromMatrixColumn(this.cam.matrixWorld, 1);
    this.focusT.addScaledVector(this.right, -dx * k).addScaledVector(this.up, dy * k);
    this.clampFocus();
  }
  panPlane(dx, dz) {
    this.follow = null;
    const k = Math.max(0.6, this.dist * 0.025);
    // forward along the view direction, flattened onto the horizontal plane
    this.fwd.set(-Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.right.set(-this.fwd.z, 0, this.fwd.x);
    this.focusT.addScaledVector(this.right, dx * k).addScaledVector(this.fwd, dz * k);
    this.clampFocus();
  }
  focusOn(point, follow = null) {
    this.focusT.copy(point);
    this.follow = follow;
  }
  clampFocus() {
    const b = this.bounds;
    if (!b) return;
    this.focusT.x = Math.max(b.x0, Math.min(b.x1, this.focusT.x));
    this.focusT.y = Math.max(b.y0, Math.min(b.y1, this.focusT.y));
    this.focusT.z = Math.max(b.z0, Math.min(b.z1, this.focusT.z));
  }
  update(dt) {
    if (this.follow) { const p = this.follow(); if (p) this.focusT.copy(p); else this.follow = null; }
    const k = 1 - Math.exp(-dt * 9), kr = 1 - Math.exp(-dt * 14);
    this.focus.lerp(this.focusT, k);
    this.yaw += (this.yawT - this.yaw) * kr;
    this.pitch += (this.pitchT - this.pitch) * kr;
    this.dist += (this.distT - this.dist) * k;
    const cp = Math.cos(this.pitch);
    this.cam.position.set(this.focus.x + this.dist * cp * Math.cos(this.yaw), this.focus.y + this.dist * Math.sin(this.pitch), this.focus.z + this.dist * cp * Math.sin(this.yaw));
    this.cam.lookAt(this.focus);
  }
}
