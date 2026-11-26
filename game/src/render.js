// Skyline Courier — everything the pilot sees that is not ground.
// The sky gradient, the sun, the distant ridge line, the courier
// aircraft itself (drawn in chase view, banking with the plane), its
// shadow on the ground below, and the speed streaks that sell the wind.
import { COLOURS } from './config.js';
import { heightAt } from './terrain.js';

export function renderSky(ctx, camera, time) {
  const w = camera.width;
  const h = camera.height;
  const horizon = camera.horizonY();
  const grad = ctx.createLinearGradient(0, 0, 0, Math.max(horizon + 4, h));
  grad.addColorStop(0, COLOURS.skyTop);
  grad.addColorStop(0.55, COLOURS.skyMid);
  grad.addColorStop(1, COLOURS.skyLow);
  ctx.fillStyle = grad;
  // Fill the whole canvas, not just down to the horizon: any pixel the
  // terrain does not paint (a gap near the camera, a steep pitch) would
  // otherwise keep the previous frame's colour and smear.
  ctx.fillRect(0, 0, w, h);
  // Sun: fixed in the south-west sky so the light never moves.
  const sunX = w * 0.2;
  const sunY = Math.min(horizon - 120, h * 0.16);
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 150);
  glow.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
  glow.addColorStop(0.25, 'rgba(255, 236, 170, 0.45)');
  glow.addColorStop(1, 'rgba(255, 236, 170, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 150, sunY - 150, 300, 300);
  ctx.fillStyle = COLOURS.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
  ctx.fill();
  // Distant ridge silhouettes: two low layered ranges that sit on the
  // horizon and make the valley feel enclosed without walling it in.
  drawRidge(ctx, camera, horizon, 0.07, '#8ba8c4', 55);
  drawRidge(ctx, camera, horizon, 0.11, '#6f8ba8', 80);
  void time;
}

function drawRidge(ctx, camera, horizon, amp, colour, base) {
  const w = camera.width;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(0, horizon + 2);
  for (let x = 0; x <= w; x += 16) {
    const t = x / w;
    const y =
      horizon -
      base * amp * 10 -
      Math.sin(t * 9 + 1.3) * 34 * amp * 10 -
      Math.sin(t * 23 + 4.0) * 14 * amp * 10;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, horizon + 2);
  ctx.closePath();
  ctx.fill();
}

// The courier aircraft, drawn in chase view just below the centre of the
// screen: a high-wing prop plane with a cream fuselage, red trim and a
// spinning prop disc. It banks with the roll and dips with the pitch, so
// the pilot reads the attitude from the plane itself as well as the HUD.
export function renderAircraft(ctx, camera, plane, time) {
  const w = camera.width;
  const h = camera.height;
  const cx = w / 2;
  const cy = h * 0.58 + plane.pitch * 260;
  const s = Math.min(w, h) / 760; // scale with the window
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.roll * 0.9);
  ctx.scale(s, s);
  // Propeller disc, blurred by speed.
  const propAlpha = 0.10 + plane.throttle * 0.10;
  ctx.fillStyle = `rgba(210, 220, 230, ${propAlpha})`;
  ctx.beginPath();
  ctx.ellipse(0, -2, 52, 52, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tailplane and fin.
  ctx.fillStyle = '#b03a2e';
  ctx.beginPath();
  ctx.moveTo(-6, 96);
  ctx.lineTo(-64, 128);
  ctx.lineTo(-58, 140);
  ctx.lineTo(0, 112);
  ctx.lineTo(58, 140);
  ctx.lineTo(64, 128);
  ctx.lineTo(6, 96);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b03a2e';
  ctx.beginPath();
  ctx.moveTo(0, 96);
  ctx.lineTo(-4, 58);
  ctx.lineTo(10, 74);
  ctx.lineTo(12, 100);
  ctx.closePath();
  ctx.fill();
  // Wings: high wing, slightly swept, red tips.
  ctx.fillStyle = '#e8e0cc';
  ctx.beginPath();
  ctx.moveTo(-14, 18);
  ctx.lineTo(-168, 46);
  ctx.lineTo(-172, 62);
  ctx.lineTo(-10, 44);
  ctx.lineTo(10, 44);
  ctx.lineTo(172, 62);
  ctx.lineTo(168, 46);
  ctx.lineTo(14, 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b03a2e';
  ctx.fillRect(-172, 46, 22, 16);
  ctx.fillRect(150, 46, 22, 16);
  // Fuselage: cream, tapering to the tail, red cheatline.
  ctx.fillStyle = '#f2ead6';
  ctx.beginPath();
  ctx.moveTo(0, -46);
  ctx.quadraticCurveTo(20, -30, 18, 10);
  ctx.quadraticCurveTo(16, 60, 8, 104);
  ctx.lineTo(-8, 104);
  ctx.quadraticCurveTo(-16, 60, -18, 10);
  ctx.quadraticCurveTo(-20, -30, 0, -46);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b03a2e';
  ctx.fillRect(-17, 6, 34, 7);
  // Cockpit windows, lit from inside.
  ctx.fillStyle = '#9fd4e8';
  ctx.beginPath();
  ctx.moveTo(-10, -34);
  ctx.lineTo(10, -34);
  ctx.lineTo(13, -12);
  ctx.lineTo(-13, -12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#8a6d3b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(0, -12);
  ctx.stroke();
  // Spinner and prop blades.
  ctx.fillStyle = '#b03a2e';
  ctx.beginPath();
  ctx.arc(0, -46, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 60, 60, 0.55)';
  ctx.lineWidth = 5;
  const bladeAngle = time * (4 + plane.throttle * 26);
  ctx.beginPath();
  ctx.moveTo(0, -46);
  ctx.lineTo(Math.cos(bladeAngle) * 50, -46 + Math.sin(bladeAngle) * 50);
  ctx.moveTo(0, -46);
  ctx.lineTo(-Math.cos(bladeAngle) * 50, -46 - Math.sin(bladeAngle) * 50);
  ctx.stroke();
  ctx.restore();

  // Ground shadow: a soft ellipse projected under the plane, so the
  // pilot can judge height over the ground at a glance.
  const ground = heightAt(plane.x, plane.z);
  const heightAbove = Math.max(0, plane.y - ground);
  if (heightAbove < 320) {
    const shadow = camera.project(plane.x, ground + 1, plane.z);
    if (shadow) {
      const r = Math.max(6, 2600 / (heightAbove + 40));
      const alpha = Math.max(0.04, 0.30 - heightAbove / 1400);
      ctx.fillStyle = `rgba(20, 30, 20, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(shadow.x, shadow.y, r, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Wind streaks at speed: faint short lines that rush past the edges of
// the screen when the plane is fast, and fade out when it slows. Kept
// to the lower two-thirds, where the ground rushes, so they never read
// as rain in the sky.
export function renderSpeedLines(ctx, camera, plane, time) {
  if (plane.speed < 45) return;
  const w = camera.width;
  const h = camera.height;
  const strength = Math.min(0.22, (plane.speed - 45) / 220);
  ctx.strokeStyle = `rgba(255, 255, 255, ${strength})`;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 10; i++) {
    const seed = i * 137.5;
    const x = ((seed * 7.3 + time * plane.speed * 2.1) % (w + 200)) - 100;
    const y = h * 0.35 + ((seed * 3.1) % (h * 0.6));
    const len = 14 + plane.speed * 0.35;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len * 0.3, y + len);
    ctx.stroke();
  }
}
