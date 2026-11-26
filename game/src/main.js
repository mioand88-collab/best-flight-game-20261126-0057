// Skyline Courier — the game itself.
// Owns the loop, the screens (title, flying, crashed, finished), the
// score and the messages, and wires the modules together. The flight
// model lives in physics.js, the world in terrain.js, the look in
// render.js and the instruments in hud.js; this file only decides what
// happens when.
import { CONFIG } from './config.js';
import { Input } from './input.js';
import { Camera } from './camera.js';
import { makePlane, stepPlane } from './physics.js';
import { heightAt, renderTerrain, renderRunway, renderRing, renderScenery } from './terrain.js';
import { renderSky, renderAircraft, renderSpeedLines } from './render.js';
import { renderHud } from './hud.js';
import { AudioEngine } from './audio.js';
import {
  MISSIONS,
  bindPlane,
  updateMission,
  scoreLanding,
  missionComplete,
} from './missions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
const camera = new Camera();
const audio = new AudioEngine();

const game = {
  state: 'title', // title | flying | crashed | finished
  missionIndex: 0,
  mission: MISSIONS[0],
  missionState: MISSIONS[0].setup(),
  plane: makePlane(),
  score: 0,
  time: 0,
  missionTime: 0,
  messages: [],
  autopilot: null,
  lastNearAt: 0,
  landingScored: false,
  statusEl: document.getElementById('status'),
};

bindPlane(game.plane);

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  camera.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

function say(text, score = 0) {
  game.messages.push({ text, score, at: game.time });
  if (game.messages.length > 5) game.messages.shift();
  if (game.statusEl) game.statusEl.textContent = text;
}

function startMission(index) {
  game.missionIndex = index;
  game.mission = MISSIONS[index];
  game.missionState = game.mission.setup();
  game.plane = makePlane();
  bindPlane(game.plane);
  game.score = 0;
  game.missionTime = 0;
  game.messages = [];
  game.state = 'flying';
  game.landingScored = false;
  game.autopilot = null;
  camera.x = game.plane.x;
  camera.y = game.plane.y + 6;
  camera.z = game.plane.z - 14;
  camera.heading = game.plane.heading;
  say(`${game.mission.name} — ${game.mission.blurb}`);
  audio.ensure();
}

// The demo autopilot: flies the plane toward the next objective so the
// title screen is alive and screenshots can show the game in the air.
// It is a plain proportional controller, not a scripted path.
function autopilotCommand() {
  const p = game.plane;
  const m = game.mission;
  const st = game.missionState;
  let target = null;
  let targetAlt = 120;
  if (m.id === 'rings' && st.nextRing < st.rings.length) {
    target = st.rings[st.nextRing];
    targetAlt = target.y;
  } else if (m.id === 'delivery' && !st.delivered) {
    target = st.drop;
    targetAlt = heightAt(target.x, target.z) + 45;
  } else {
    target = { x: CONFIG.runway.x, z: CONFIG.runway.z };
    targetAlt = heightAt(0, 900) + 60;
  }
  const desiredHeading = Math.atan2(target.x - p.x, target.z - p.z);
  let diff = desiredHeading - p.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const altError = targetAlt - p.y;
  // Climb gently: a hard pull-up bleeds speed and stalls the wing.
  let pitch = Math.max(-0.6, Math.min(0.55, altError / 90));
  // Slow and low means trouble: drop the nose first, climb once the
  // airspeed is back, or the plane sinks into the valley.
  if (p.speed < CONFIG.stallSpeed + 10) pitch = Math.min(pitch, -0.25);
  return {
    roll: Math.max(-1, Math.min(1, diff * 1.4)),
    pitch,
    throttle: p.speed < 50 ? 0.9 : 0.65,
  };
}

function update(dt) {
  game.time += dt;
  if (game.state === 'title') {
    // The title screen flies itself: a slow orbit over the valley.
    const p = game.plane;
    p.heading += 0.05 * dt;
    p.y = 150 + Math.sin(game.time * 0.1) * 20;
    p.x = Math.sin(p.heading) * 500;
    p.z = 500 + Math.cos(p.heading) * 500;
    p.speed = 55;
    p.throttle = 0.55;
    camera.follow(p, dt);
    return;
  }
  if (game.state === 'crashed' || game.state === 'finished') {
    camera.follow(game.plane, dt);
    return;
  }

  // Flying.
  game.missionTime += dt;
  const steer = input.steer();
  const auto = game.autopilot ? autopilotCommand() : null;
  const beforeLanded = game.plane.landed;
  stepPlane(game.plane, steer, input.throttleDelta(), dt, auto);
  camera.follow(game.plane, dt);
  audio.update(game.plane);

  // Mission events.
  const events = updateMission(game.mission, game.missionState, game.plane, dt);
  for (const event of events) {
    if (event.type === 'near') {
      if (game.time - game.lastNearAt > 2.5) {
        game.lastNearAt = game.time;
        say(event.message);
      }
      continue;
    }
    game.score += event.score || 0;
    say(`${event.message}${event.score ? ` +${event.score}` : ''}`, event.score || 0);
    if (event.type === 'ring' || event.type === 'delivery') audio.ringChime();
    if (event.type === 'takeoff' || event.type === 'circle') audio.blip(660, 0.12);
  }

  // Landing: score it once, when the wheels stop.
  if (game.plane.landed && !beforeLanded && !game.landingScored) {
    game.landingScored = true;
    const result = scoreLanding(game.plane, game.mission, game.missionState);
    game.score += result.score;
    say(result.message, result.score);
    audio.fanfare();
    if (missionComplete(game.mission, game.missionState, game.plane)) {
      const bonus = Math.max(0, Math.round(600 - game.missionTime * CONFIG.timeBonusPerSecond));
      game.score += bonus;
      game.state = 'finished';
      say(`Sortie complete! Time bonus +${bonus}. Final score ${game.score}.`, bonus);
      audio.fanfare();
    }
  }
  if (!game.plane.landed) game.landingScored = false;

  // Crash.
  if (game.plane.crashed && game.state === 'flying') {
    game.state = 'crashed';
    say(`Crashed — the courier is a write-off. Score ${game.score}. Press R to try again.`);
    audio.thud();
  }

  // Keys that act on the game, not the plane.
  if (input.wasPressed('r') && (game.state === 'crashed' || game.state === 'finished')) {
    startMission(game.missionIndex);
  }
  if (input.wasPressed('m')) {
    const muted = audio.toggleMute();
    say(muted ? 'Sound off.' : 'Sound on.');
  }
  if (input.wasPressed(' ')) {
    audio.ensure();
  }
}

function drawTitle() {
  const w = camera.width;
  const h = camera.height;
  ctx.fillStyle = 'rgba(8, 18, 30, 0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2ead6';
  ctx.font = `700 ${Math.round(Math.min(64, w * 0.055))}px system-ui, sans-serif`;
  ctx.fillText('SKYLINE COURIER', w / 2, h * 0.24);
  ctx.fillStyle = '#ffb02e';
  ctx.font = `600 ${Math.round(Math.min(20, w * 0.018))}px system-ui, sans-serif`;
  ctx.fillText('A valley courier service, flown by you', w / 2, h * 0.24 + 34);
  // Mission cards.
  const cardW = Math.min(300, w * 0.28);
  const cardH = 150;
  const gap = 24;
  const totalW = cardW * 3 + gap * 2;
  const startX = (w - totalW) / 2;
  const cardY = h * 0.38;
  MISSIONS.forEach((m, i) => {
    const x = startX + i * (cardW + gap);
    const hovered = input.mouse.x * w > x && input.mouse.x * w < x + cardW && input.mouse.y * h > cardY && input.mouse.y * h < cardY + cardH;
    ctx.fillStyle = hovered ? 'rgba(30, 52, 72, 0.92)' : 'rgba(10, 22, 34, 0.85)';
    ctx.beginPath();
    ctx.roundRect(x, cardY, cardW, cardH, 10);
    ctx.fill();
    ctx.strokeStyle = i === game.missionIndex ? '#ffb02e' : 'rgba(234, 246, 255, 0.3)';
    ctx.lineWidth = i === game.missionIndex ? 2.5 : 1;
    ctx.stroke();
    ctx.fillStyle = '#ffb02e';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(`PRESS ${i + 1}`, x + cardW / 2, cardY + 26);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(m.name, x + cardW / 2, cardY + 56);
    ctx.fillStyle = '#9fc3dd';
    ctx.font = '500 13px system-ui, sans-serif';
    wrapText(m.blurb, x + 16, cardY + 80, cardW - 32, 18);
  });
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText('Fly: ← → bank  •  ↑ ↓ pitch  •  Shift / Ctrl throttle  •  hold mouse to steer', w / 2, h * 0.38 + cardH + 44);
  ctx.fillStyle = '#9fc3dd';
  ctx.font = '500 14px system-ui, sans-serif';
  ctx.fillText('M mute  •  R restart after a crash  •  land gently on the runway to refuel', w / 2, h * 0.38 + cardH + 70);
  ctx.fillText('Watch the fuel gauge — an empty tank means gliding home.', w / 2, h * 0.38 + cardH + 94);
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  // The title screen centres its headings; wrapped body text is
  // left-aligned against the card's inner edge instead.
  const previousAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
  ctx.textAlign = previousAlign;
}

function drawEndScreen() {
  const w = camera.width;
  const h = camera.height;
  const crashed = game.state === 'crashed';
  ctx.fillStyle = 'rgba(8, 18, 30, 0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = crashed ? '#ff5a4e' : '#7ee787';
  ctx.font = `700 ${Math.round(Math.min(52, w * 0.045))}px system-ui, sans-serif`;
  ctx.fillText(crashed ? 'CRASHED' : 'SORTIE COMPLETE', w / 2, h * 0.4);
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillText(
    crashed
      ? 'The courier is a write-off. The valley keeps the wreck as a warning.'
      : `${game.mission.name} — flown, delivered and home safe.`,
    w / 2,
    h * 0.4 + 36,
  );
  ctx.fillStyle = '#ffb02e';
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillText(`SCORE ${game.score}`, w / 2, h * 0.4 + 84);
  ctx.fillStyle = '#9fc3dd';
  ctx.font = '500 15px system-ui, sans-serif';
  ctx.fillText('Press R to fly again, or 1 / 2 / 3 to pick another sortie', w / 2, h * 0.4 + 122);
}

function render() {
  const p = game.plane;
  renderSky(ctx, camera, game.time);
  renderTerrain(ctx, camera);
  renderRunway(ctx, camera);
  renderScenery(ctx, camera, game.time);
  // Rings: the next one glows, the rest wait quietly.
  if (game.mission.id === 'rings') {
    for (const ring of game.missionState.rings) {
      if (ring.passed) continue;
      renderRing(ctx, camera, ring, ring.index === game.missionState.nextRing);
    }
  }
  if (game.mission.id === 'delivery' && game.missionState.parcel) {
    const drop = game.missionState.drop;
    const base = camera.project(drop.x, heightAt(drop.x, drop.z) + 1, drop.z);
    if (base) {
      const r = camera.screenRadius(drop.x, heightAt(drop.x, drop.z), drop.z, drop.radius);
      ctx.strokeStyle = '#ffb02e';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.ellipse(base.x, base.y, Math.max(4, r), Math.max(2, r * 0.3), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffb02e';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DROP ZONE', base.x, base.y - Math.max(6, r * 0.3) - 8);
    }
  }
  renderAircraft(ctx, camera, p, game.time);
  renderSpeedLines(ctx, camera, p, game.time);
  if (game.state === 'flying' || game.state === 'crashed' || game.state === 'finished') {
    renderHud(ctx, camera, p, game.mission, game.missionState, game);
  }
  if (game.state === 'title') drawTitle();
  if (game.state === 'crashed' || game.state === 'finished') drawEndScreen();
}

function frame(now) {
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000 || 0.016);
  frame.last = now;
  // Title-screen mission picking: keys 1-3, or a click on a card.
  if (game.state === 'title') {
    for (let i = 0; i < 3; i++) {
      if (input.wasPressed(String(i + 1))) startMission(i);
    }
    if (input.mouse.down) {
      const w = camera.width;
      const h = camera.height;
      const cardW = Math.min(300, w * 0.28);
      const cardH = 150;
      const gap = 24;
      const totalW = cardW * 3 + gap * 2;
      const startX = (w - totalW) / 2;
      const cardY = h * 0.38;
      const mx = input.mouse.x * w;
      const my = input.mouse.y * h;
      for (let i = 0; i < 3; i++) {
        const x = startX + i * (cardW + gap);
        if (mx > x && mx < x + cardW && my > cardY && my < cardY + cardH) startMission(i);
      }
      input.mouse.down = false;
    }
  }
  update(dt);
  render();
  input.endFrame();
  requestAnimationFrame(frame);
}

// Screenshot mode: ?auto=rings|delivery|landing starts a mission at once
// with the demo autopilot flying, so a headless browser can photograph
// the game in the air without a human at the keyboard. ?shot=title keeps
// the title screen. This is a real feature (demo mode), not a test hook.
const params = new URLSearchParams(window.location.search);
const autoMission = params.get('auto');
if (autoMission) {
  const index = MISSIONS.findIndex((m) => m.id === autoMission);
  startMission(index === -1 ? 0 : index);
  game.autopilot = true;
  // Give the autopilot a running start so the first frame is already flying.
  game.plane.throttle = 0.8;
  game.plane.speed = 40;
} else if (params.get('shot') === 'title') {
  // Title screen as-is.
} else if (params.get('shot') === 'air') {
  startMission(0);
  game.autopilot = true;
  game.plane.throttle = 0.8;
  game.plane.speed = 55;
  game.plane.y = 150;
}
window.__skyline = game;

requestAnimationFrame(frame);
