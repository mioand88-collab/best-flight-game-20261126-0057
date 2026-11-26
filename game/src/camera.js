// Skyline Courier — camera and projection.
// The camera sits a little behind and above the aircraft and looks along
// its heading, so the pilot always sees the plane and the sky ahead.
// project() turns a world point into screen pixels (or null when it is
// behind the camera), which terrain, runway, rings and scenery all share.
import { CONFIG } from './config.js';

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.heading = 0;
    this.pitch = 0;
    this.roll = 0;
    this.width = 1280;
    this.height = 720;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  // Chase the aircraft: trail it, sit above it, look where it looks.
  follow(plane, dt) {
    const back = 14;
    const up = 5.5;
    const fx = Math.sin(plane.heading);
    const fz = Math.cos(plane.heading);
    const tx = plane.x - fx * back;
    const tz = plane.z - fz * back;
    const ty = plane.y + up;
    // Ease the camera so it never snaps when the plane banks hard.
    const k = 1 - Math.exp(-6 * dt);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    this.z += (tz - this.z) * k;
    this.heading = plane.heading;
    this.pitch = plane.pitch * 0.55;
    this.roll = plane.roll * 0.35;
  }

  focalLength() {
    return CONFIG.focal * (this.width / 1280);
  }

  horizonY() {
    // The horizon sits where the camera's pitch puts it, rolled with the
    // camera so the sky always tilts the way the plane banks.
    return this.height * 0.46 - Math.tan(this.pitch) * this.focalLength();
  }

  project(wx, wy, wz) {
    const dx = wx - this.x;
    const dy = wy - this.y;
    const dz = wz - this.z;
    const sinH = Math.sin(this.heading);
    const cosH = Math.cos(this.heading);
    // Camera space: z forward along the heading, x to the right.
    const cx = dx * cosH - dz * sinH;
    const cz = dx * sinH + dz * cosH;
    const sinP = Math.sin(this.pitch);
    const cosP = Math.cos(this.pitch);
    const cy = dy * cosP - cz * sinP;
    const cz2 = dy * sinP + cz * cosP;
    if (cz2 < CONFIG.nearClip) return null;
    const f = this.focalLength();
    const horizon = this.horizonY();
    // Roll the screen point around the centre of the horizon line.
    const sx = this.width / 2 + (cx / cz2) * f;
    const sy = horizon - (cy / cz2) * f;
    const roll = this.roll;
    const relX = sx - this.width / 2;
    const relY = sy - horizon;
    const cosR = Math.cos(roll);
    const sinR = Math.sin(roll);
    return {
      x: this.width / 2 + relX * cosR - relY * sinR,
      y: horizon + relX * sinR + relY * cosR,
      depth: cz2,
      scale: f / cz2,
    };
  }

  // Rough screen size of an object of world radius r at world point p.
  screenRadius(wx, wy, wz, r) {
    const p = this.project(wx, wy, wz);
    if (!p) return 0;
    return Math.max(1, r * p.scale);
  }
}
