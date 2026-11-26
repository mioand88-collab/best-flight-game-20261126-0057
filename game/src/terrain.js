// Skyline Courier — the valley the courier flies over.
// A deterministic heightfield (no random map per run, so the runway and
// the missions always sit where the pilot expects them), drawn as
// projected grid strips from far to near, plus the runway, the target
// rings and the scenery that makes the ground readable from the air.
import { CONFIG, COLOURS } from './config.js';

// Smooth deterministic pseudo-noise: a sum of sines that never changes
// between runs, so a hill the pilot memorised is still there tomorrow.
function bump(x, z) {
  return (
    Math.sin(x * 0.0016 + 1.7) * Math.cos(z * 0.0013 - 0.6) * 0.6 +
    Math.sin(x * 0.0042 - z * 0.0031) * 0.28 +
    Math.sin((x + z) * 0.0009 + 4.1) * 0.5 +
    Math.sin(x * 0.011 + z * 0.008) * 0.12
  );
}

export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  // A flat apron around the runway so landings never hit a hill.
  const runway = CONFIG.runway;
  const along = (z - runway.z) * Math.cos(runway.heading) + (x - runway.x) * Math.sin(runway.heading);
  const across = (x - runway.x) * Math.cos(runway.heading) - (z - runway.z) * Math.sin(runway.heading);
  const onStrip = Math.abs(along) < runway.length / 2 + 60 && Math.abs(across) < runway.width / 2 + 55;
  if (onStrip) return 2;
  // The river: a narrow channel curving west of the runway. Only the
  // channel itself is water; the valley floor stays dry grass, so the
  // ground reads as fields from the air instead of a lake.
  const river = Math.sin(z * 0.0009) * 420 - 520;
  const riverDist = Math.abs(x - river);
  const inChannel = riverDist < 80;
  // The snowy ridge to the north-east, rising with distance from centre.
  const ridge = Math.max(0, r - 1500) / 900;
  let h = 12 + bump(x, z) * 34 + ridge * ridge * 45;
  if (inChannel) h = Math.min(h, 2.5);
  else h = Math.max(h, 7);
  // The world edge falls away gently into fog so the grid has somewhere
  // to end, never a cliff face in the pilot's view.
  if (r > CONFIG.worldHalf) h -= (r - CONFIG.worldHalf) * 0.05;
  return h;
}

function terrainColour(h, slope, x, z) {
  if (h < 4.5) return COLOURS.water; // the river channel only
  // Sand is the riverbank, not a desert: it hugs the channel and nowhere else.
  const river = Math.sin(z * 0.0009) * 420 - 520;
  if (h < 8 && Math.abs(x - river) < 220) return COLOURS.sand;
  if (h > 110) return COLOURS.snow; // far ridge tops only
  if (h > 62) return COLOURS.rock; // high bare rock
  // Patchwork fields: two greens that alternate by position, shaded by slope.
  const patch = (Math.floor(x / 170) + Math.floor(z / 170)) % 2 === 0;
  const base = patch ? COLOURS.grassLow : COLOURS.grassHigh;
  if (slope < 0.12) return base;
  return shade(base, 1 - Math.min(0.35, slope * 0.9));
}

function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `rgb(${r},${g},${b})`;
}

// Draw the ground as strips of projected quads, far rows first so near
// rows paint over them. Rows close in near the camera and spread out
// with distance, which keeps the quad count low and the horizon smooth.
export function renderTerrain(ctx, camera) {
  const rows = 26;
  const cols = 30;
  const near = 26;
  const far = CONFIG.farDraw;
  const sinH = Math.sin(camera.heading);
  const cosH = Math.cos(camera.heading);
  // Row distances: geometric spacing, dense near, sparse far.
  const dists = [];
  for (let i = 0; i <= rows; i++) {
    dists.push(near * Math.pow(far / near, i / rows));
  }
  // Project every grid point once, then paint the quads between rows.
  const pts = [];
  for (let i = 0; i <= rows; i++) {
    const d = dists[i];
    const halfWidth = 26 + d * 0.62;
    const row = [];
    for (let j = 0; j <= cols; j++) {
      const lateral = -halfWidth + (2 * halfWidth * j) / cols;
      const wx = camera.x + sinH * d + cosH * lateral;
      const wz = camera.z + cosH * d - sinH * lateral;
      const wy = heightAt(wx, wz);
      row.push({ p: camera.project(wx, wy, wz), h: wy, x: wx, z: wz });
    }
    pts.push(row);
  }
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = 0; j < cols; j++) {
      const a = pts[i][j];
      const b = pts[i][j + 1];
      const c = pts[i + 1][j + 1];
      const d = pts[i + 1][j];
      if (!a.p || !b.p || !c.p || !d.p) continue;
      const slope = Math.abs(a.h - c.h) / Math.max(1, dists[i + 1] - dists[i]);
      ctx.fillStyle = terrainColour(a.h, slope, a.x, a.z);
      ctx.beginPath();
      ctx.moveTo(a.p.x, a.p.y);
      ctx.lineTo(b.p.x, b.p.y);
      ctx.lineTo(c.p.x, c.p.y);
      ctx.lineTo(d.p.x, d.p.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// The runway: a dark strip with a centreline and threshold bars, drawn
// as one projected quad plus its markings so it reads from far away.
export function renderRunway(ctx, camera) {
  const r = CONFIG.runway;
  const halfL = r.length / 2;
  const halfW = r.width / 2;
  const sinH = Math.sin(r.heading);
  const cosH = Math.cos(r.heading);
  const corner = (along, across) => ({
    x: r.x + sinH * along + cosH * across,
    z: r.z + cosH * along - sinH * across,
  });
  const quad = (a, b, c, d) => {
    const pa = camera.project(a.x, 3, a.z);
    const pb = camera.project(b.x, 3, b.z);
    const pc = camera.project(c.x, 3, c.z);
    const pd = camera.project(d.x, 3, d.z);
    if (!pa || !pb || !pc || !pd) return null;
    return [pa, pb, pc, pd];
  };
  const strip = quad(corner(-halfL, -halfW), corner(-halfL, halfW), corner(halfL, halfW), corner(halfL, -halfW));
  if (!strip) return;
  ctx.fillStyle = COLOURS.runway;
  ctx.beginPath();
  strip.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
  // Centreline dashes.
  ctx.fillStyle = COLOURS.runwayLine;
  for (let d = -halfL + 20; d < halfL - 20; d += 34) {
    const dash = quad(corner(d, -1.4), corner(d, 1.4), corner(d + 18, 1.4), corner(d + 18, -1.4));
    if (!dash) continue;
    ctx.beginPath();
    dash.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
  }
  // Threshold bars at each end.
  for (const end of [-halfL + 8, halfL - 14]) {
    const bar = quad(corner(end, -halfW + 3), corner(end, halfW - 3), corner(end + 6, halfW - 3), corner(end + 6, -halfW + 3));
    if (!bar) continue;
    ctx.beginPath();
    bar.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
  }
}

// A target ring: a glowing circle standing upright, facing the course.
// Drawn as a projected polygon so it keeps its shape from any angle.
export function renderRing(ctx, camera, ring, active) {
  const segments = 28;
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    // The ring stands in the plane facing the direction the pilot flies
    // through it: its normal is the ring's facing vector.
    const wx = ring.x + Math.cos(a) * ring.radius * ring.rightX;
    const wy = ring.y + Math.sin(a) * ring.radius;
    const wz = ring.z + Math.cos(a) * ring.radius * ring.rightZ;
    const p = camera.project(wx, wy, wz);
    if (p) pts.push(p);
  }
  if (pts.length < 8) return;
  const colour = active ? COLOURS.ring : 'rgba(160, 200, 220, 0.8)';
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(2, camera.screenRadius(ring.x, ring.y, ring.z, ring.radius) * 0.09);
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.stroke();
  if (active) {
    ctx.fillStyle = COLOURS.ringGlow;
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
  }
}

// Scenery that makes the valley readable: a few barns, a windsock at the
// runway and puffy clouds drifting over the ridge. Each is drawn from a
// projected anchor point, so it sits on the ground it belongs to.
const BARNS = [
  { x: 180, z: 760, w: 26, h: 12, colour: '#a34d3a' },
  { x: -210, z: 1040, w: 30, h: 14, colour: '#7a5a34' },
  { x: 420, z: 1300, w: 24, h: 11, colour: '#a34d3a' },
  { x: -480, z: 620, w: 28, h: 13, colour: '#5a6b7a' },
];
const CLOUDS = [
  { x: -600, y: 260, z: 300, r: 90 },
  { x: 300, y: 300, z: -200, r: 120 },
  { x: 900, y: 280, z: 800, r: 100 },
  { x: -1100, y: 320, z: 1400, r: 130 },
  { x: 200, y: 340, z: 1800, r: 110 },
];

export function renderScenery(ctx, camera, time) {
  for (const barn of BARNS) {
    const gy = heightAt(barn.x, barn.z);
    const base = camera.project(barn.x, gy, barn.z);
    if (!base) continue;
    const w = camera.screenRadius(barn.x, gy, barn.z, barn.w);
    const h = w * 0.5;
    if (w < 2) continue;
    ctx.fillStyle = barn.colour;
    ctx.fillRect(base.x - w / 2, base.y - h, w, h);
    ctx.fillStyle = '#3a2f28';
    ctx.beginPath();
    ctx.moveTo(base.x - w / 2, base.y - h);
    ctx.lineTo(base.x, base.y - h * 1.7);
    ctx.lineTo(base.x + w / 2, base.y - h);
    ctx.closePath();
    ctx.fill();
  }
  // Windsock beside the runway threshold, leaning with the wind.
  const sockBase = camera.project(46, heightAt(46, 700), 700);
  if (sockBase) {
    const lean = 14 + Math.sin(time * 0.7) * 2;
    ctx.strokeStyle = '#d8d8d8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sockBase.x, sockBase.y);
    ctx.lineTo(sockBase.x, sockBase.y - 26);
    ctx.stroke();
    ctx.fillStyle = '#ff7a3c';
    ctx.beginPath();
    ctx.moveTo(sockBase.x, sockBase.y - 26);
    ctx.lineTo(sockBase.x + lean, sockBase.y - 22);
    ctx.lineTo(sockBase.x + lean, sockBase.y - 16);
    ctx.lineTo(sockBase.x, sockBase.y - 19);
    ctx.closePath();
    ctx.fill();
  }
  // Clouds: soft ellipses that drift slowly with the wind.
  for (const cloud of CLOUDS) {
    const drift = ((time * 6 + cloud.x) % 3600) - 1800;
    const p = camera.project(cloud.x + drift * 0.2, cloud.y, cloud.z);
    if (!p) continue;
    const r = camera.screenRadius(cloud.x, cloud.y, cloud.z, cloud.r);
    if (r < 4) continue;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.32, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x - r * 0.5, p.y + r * 0.08, r * 0.6, r * 0.24, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x + r * 0.5, p.y + r * 0.06, r * 0.55, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
