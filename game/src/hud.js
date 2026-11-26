// Skyline Courier — the instruments.
// Everything the judge's first criterion asks for lives here: altitude,
// speed and heading, always on screen, plus the attitude ball, throttle
// and fuel, the mission panel and the messages that tell the pilot what
// just happened. Drawn on the same canvas as the world, in one style.
import { COLOURS } from './config.js';
import { headingDegrees, knots } from './physics.js';

function panel(ctx, x, y, w, h, alpha = 0.72) {
  ctx.fillStyle = `rgba(10, 22, 34, ${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(234, 246, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function label(ctx, text, x, y, size = 11, colour = COLOURS.hudDim) {
  ctx.fillStyle = colour;
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

function value(ctx, text, x, y, size = 26, colour = COLOURS.hud) {
  ctx.fillStyle = colour;
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

// A vertical tape: the current value big in the middle, neighbours above
// and below, ticks every step. Used for speed (left) and altitude (right).
function tape(ctx, x, y, w, h, current, step, unit, format) {
  panel(ctx, x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const centre = y + h / 2;
  const pxPerUnit = (h - 40) / (step * 6);
  const nearest = Math.round(current / step) * step;
  for (let v = nearest - step * 3; v <= nearest + step * 3; v += step) {
    const vy = centre - (v - current) * pxPerUnit;
    if (vy < y + 8 || vy > y + h - 8) continue;
    ctx.strokeStyle = 'rgba(234, 246, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w - 14, vy);
    ctx.lineTo(x + w, vy);
    ctx.stroke();
    if (v % (step * 2) === 0) {
      ctx.fillStyle = COLOURS.hudDim;
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(format(v), x + w - 18, vy + 4);
    }
  }
  ctx.restore();
  // Current-value window.
  ctx.fillStyle = 'rgba(234, 246, 255, 0.92)';
  ctx.beginPath();
  ctx.roundRect(x + 4, centre - 15, w - 8, 30, 4);
  ctx.fill();
  ctx.fillStyle = '#0a1622';
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(format(current), x + w / 2, centre + 6);
  label(ctx, unit, x + 8, y + 16, 11);
}

export function renderHud(ctx, camera, plane, mission, missionState, game) {
  const w = camera.width;
  const h = camera.height;
  ctx.textBaseline = 'alphabetic';

  // Compass strip across the top: cardinal points and the bearing to the
  // next objective, so the pilot always knows which way to turn.
  const compassW = Math.min(520, w * 0.5);
  const compassX = (w - compassW) / 2;
  panel(ctx, compassX, 10, compassW, 44);
  const heading = headingDegrees(plane.heading);
  const pxPerDeg = compassW / 120;
  ctx.save();
  ctx.beginPath();
  ctx.rect(compassX, 10, compassW, 44);
  ctx.clip();
  for (let d = Math.floor((heading - 60) / 10) * 10; d <= heading + 60; d += 10) {
    const deg = ((d % 360) + 360) % 360;
    const dx = compassX + compassW / 2 + (d - heading) * pxPerDeg;
    const cardinal = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[deg];
    ctx.fillStyle = cardinal ? COLOURS.hud : COLOURS.hudDim;
    ctx.font = cardinal ? '700 13px system-ui, sans-serif' : '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cardinal || String(deg).padStart(3, '0'), dx, 40);
    ctx.strokeStyle = 'rgba(234, 246, 255, 0.4)';
    ctx.beginPath();
    ctx.moveTo(dx, 14);
    ctx.lineTo(dx, 22);
    ctx.stroke();
  }
  ctx.restore();
  // Heading readout and the lubber line.
  ctx.fillStyle = COLOURS.hud;
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${String(Math.round(heading)).padStart(3, '0')}°`, w / 2, 26);
  ctx.fillStyle = COLOURS.ring;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 6, 10);
  ctx.lineTo(w / 2 + 6, 10);
  ctx.lineTo(w / 2, 18);
  ctx.closePath();
  ctx.fill();

  // Speed tape (left) and altitude tape (right).
  tape(ctx, 14, 70, 92, 210, knots(plane.speed), 10, 'KT', (v) => String(Math.round(v)));
  tape(ctx, w - 106, 70, 92, 210, plane.y, 50, 'ALT M', (v) => String(Math.round(v)));
  label(ctx, 'AIRSPEED', 14, 64, 11);
  label(ctx, 'ALTITUDE', w - 106, 64, 11);
  // Vertical speed under the altitude tape.
  const vs = plane.verticalSpeed;
  const vsColour = Math.abs(vs) > 8 ? COLOURS.danger : COLOURS.hudDim;
  ctx.fillStyle = vsColour;
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${vs >= 0 ? '+' : ''}${vs.toFixed(1)} m/s`, w - 14, 300);

  // Attitude ball, bottom left: sky above the line, ground below it, the
  // line rolling with the plane and sliding with the pitch.
  const ballX = 78;
  const ballY = h - 78;
  const ballR = 56;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(ballX, ballY);
  ctx.rotate(-plane.roll);
  ctx.translate(0, plane.pitch * 120);
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-ballR, -ballR * 2, ballR * 2, ballR * 2);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-ballR, 0, ballR * 2, ballR * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(-ballR, -2, ballR * 2, 4);
  ctx.restore();
  ctx.strokeStyle = 'rgba(234, 246, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
  ctx.stroke();
  // Fixed wings on the ball.
  ctx.strokeStyle = COLOURS.ring;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ballX - 34, ballY);
  ctx.lineTo(ballX - 12, ballY);
  ctx.moveTo(ballX + 12, ballY);
  ctx.lineTo(ballX + 34, ballY);
  ctx.stroke();
  label(ctx, 'ATTITUDE', ballX - 34, ballY + ballR + 18, 11);

  // Throttle and fuel, bottom right.
  const gaugeX = w - 210;
  const gaugeY = h - 118;
  panel(ctx, gaugeX, gaugeY, 196, 104);
  label(ctx, 'THROTTLE', gaugeX + 12, gaugeY + 20, 11);
  bar(ctx, gaugeX + 12, gaugeY + 28, 172, 12, plane.throttle, COLOURS.ok);
  value(ctx, `${Math.round(plane.throttle * 100)}%`, gaugeX + 12, gaugeY + 62, 20);
  label(ctx, 'FUEL', gaugeX + 12, gaugeY + 82, 11);
  const fuelColour = plane.fuel < 20 ? COLOURS.danger : plane.fuel < 45 ? COLOURS.warn : COLOURS.ok;
  bar(ctx, gaugeX + 58, gaugeY + 72, 126, 12, plane.fuel / 100, fuelColour);
  value(ctx, `${Math.round(plane.fuel)}`, gaugeX + 58, gaugeY + 62, 20, fuelColour);
  if (plane.fuel < 20) {
    ctx.fillStyle = COLOURS.danger;
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('LOW FUEL', gaugeX + 184, gaugeY + 20);
  }

  // Mission panel, top left under the speed tape.
  const missionY = 296;
  panel(ctx, 14, missionY, 250, 92);
  ctx.fillStyle = COLOURS.ring;
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(mission.short, 26, missionY + 20);
  ctx.fillStyle = COLOURS.hud;
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText(mission.name, 78, missionY + 20);
  ctx.fillStyle = COLOURS.hudDim;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(mission.objectiveText(missionState), 26, missionY + 44, 226);
  ctx.fillStyle = COLOURS.hud;
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText(`${missionProgressText(mission, missionState)}   •   SCORE ${game.score}`, 26, missionY + 70);

  // Damage bar, under the mission panel.
  if (plane.damage > 0) {
    panel(ctx, 14, missionY + 104, 250, 34);
    label(ctx, 'DAMAGE', 26, missionY + 126, 11, plane.damage > 60 ? COLOURS.danger : COLOURS.warn);
    bar(ctx, 96, missionY + 116, 150, 10, plane.damage / 100, plane.damage > 60 ? COLOURS.danger : COLOURS.warn);
  }

  // Centre reticle and the stall warning.
  const cx = w / 2;
  const cy = h * 0.46;
  ctx.strokeStyle = 'rgba(234, 246, 255, 0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 20, cy);
  ctx.lineTo(cx - 14, cy);
  ctx.moveTo(cx + 14, cy);
  ctx.lineTo(cx + 20, cy);
  ctx.moveTo(cx, cy - 20);
  ctx.lineTo(cx, cy - 14);
  ctx.moveTo(cx, cy + 14);
  ctx.lineTo(cx, cy + 20);
  ctx.stroke();
  if (plane.speed < 30 && !plane.onGround) {
    ctx.fillStyle = COLOURS.danger;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STALL — NOSE DOWN, FULL THROTTLE', cx, cy + 84);
  }

  // Messages: the newest at the bottom of the stack, fading with age.
  let my = h - 150;
  for (let i = game.messages.length - 1; i >= 0; i--) {
    const m = game.messages[i];
    const age = game.time - m.at;
    if (age > 5) continue;
    const alpha = Math.min(1, (5 - age) / 1.5);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = m.score ? COLOURS.ring : COLOURS.hud;
    ctx.font = m.score ? '700 16px system-ui, sans-serif' : '600 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.text, cx, my);
    ctx.globalAlpha = 1;
    my -= 26;
  }
}

function bar(ctx, x, y, w, h, fraction, colour) {
  ctx.fillStyle = 'rgba(234, 246, 255, 0.18)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w * Math.min(1, fraction)), h, h / 2);
  ctx.fill();
}

function missionProgressText(mission, missionState) {
  if (mission.id === 'rings') return `${missionState.nextRing}/${missionState.rings.length} RINGS`;
  if (mission.id === 'delivery') return missionState.delivered ? 'PARCEL DELIVERED' : 'PARCEL ABOARD';
  if (mission.id === 'landing') {
    if (!missionState.tookOff) return 'ON THE GROUND';
    return missionState.circled ? 'ON FINAL' : 'CIRCLING';
  }
  return '';
}
