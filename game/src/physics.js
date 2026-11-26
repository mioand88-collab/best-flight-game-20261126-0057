// Skyline Courier — the flight model.
// A forgiving arcade model with real trade-offs: throttle sets the speed
// the plane wants, bank turns it, pitch trades speed for height, and
// below stall speed the wing gives up and the nose drops. Fuel and
// damage turn each sortie into decisions instead of a joyride.
import { CONFIG } from './config.js';
import { heightAt } from './terrain.js';

export function makePlane() {
  const r = CONFIG.runway;
  return {
    // Parked on the runway, facing north, engine off.
    x: r.x,
    y: heightAt(r.x, r.z) + 2,
    z: r.z - r.length / 2 + 40,
    heading: r.heading,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: CONFIG.fuelCapacity,
    damage: 0,
    verticalSpeed: 0,
    onGround: true,
    crashed: false,
    landed: false,
    // For the landing read-out: how gentle the touchdown was.
    touchdownVs: 0,
    touchdownSpeed: 0,
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// One simulation step. steer is {roll, pitch} in [-1, 1], throttleDelta
// is -1/0/1 from the throttle keys, dt is seconds.
export function stepPlane(plane, steer, throttleDelta, dt, autopilot) {
  if (plane.crashed) return;
  if (!(dt > 0)) return; // a zero or negative step moves nothing
  const c = CONFIG;

  // Throttle: the pilot's lever, or the autopilot's, and never below
  // empty — an empty tank means gliding, not flying.
  if (autopilot) {
    plane.throttle = autopilot.throttle;
  } else {
    plane.throttle += throttleDelta * 0.7 * dt;
  }
  if (plane.fuel <= 0) plane.throttle = 0;
  plane.throttle = clamp(plane.throttle, 0, 1);

  // Roll and pitch ease toward the pilot's command; the plane never
  // snaps, it banks.
  const targetRoll = (autopilot ? autopilot.roll : steer.roll) * c.maxBank;
  const targetPitch = (autopilot ? autopilot.pitch : steer.pitch) * c.maxPitch;
  const ease = 1 - Math.exp(-4.5 * dt);
  plane.roll += (targetRoll - plane.roll) * ease;
  plane.pitch += (targetPitch - plane.pitch) * ease;

  // Heading follows the bank: a level wing flies straight, a banked wing
  // turns, faster at higher speed.
  const turnAuthority = clamp(plane.speed / c.cruiseSpeed, 0.25, 1);
  plane.heading += -plane.roll * c.turnRate * turnAuthority * dt;

  // Speed chases the throttle's target, and pitch trades speed for
  // height: pull up and the plane slows, push down and it speeds up.
  // The trade is gentle on purpose: a courier plane should forgive a
  // steep climb, not punish it with an instant stall.
  const targetSpeed = plane.throttle * c.maxSpeed;
  const accel = plane.speed < targetSpeed ? 12 : 14;
  plane.speed += clamp(targetSpeed - plane.speed, -accel * dt, accel * dt);
  plane.speed -= Math.sin(plane.pitch) * 15 * dt;
  plane.speed = Math.max(0, plane.speed);
  // Rolling resistance: on the ground with the lever closed, the plane
  // slows to a stop instead of taxiing forever.
  if (plane.onGround && plane.throttle === 0) {
    plane.speed = Math.max(0, plane.speed - 7 * dt);
  }

  // Vertical speed: climb comes from lift above stall speed; below it
  // the wing quits and the plane sinks.
  const stalled = plane.speed < c.stallSpeed;
  if (stalled) {
    plane.verticalSpeed -= c.gravitySink * dt;
    plane.pitch *= 1 - Math.min(0.5, 1.5 * dt); // nose drops on its own
    // Stall recovery is a real manoeuvre, not a death sentence: push the
    // nose down and the falling plane trades height for airspeed.
    plane.speed += Math.max(0, -Math.sin(plane.pitch)) * 30 * dt;
  } else {
    const liftClimb = (plane.speed / c.cruiseSpeed) * c.climbRate;
    const targetVs = Math.sin(plane.pitch) * liftClimb * 2.4;
    plane.verticalSpeed += (targetVs - plane.verticalSpeed) * (1 - Math.exp(-2.5 * dt));
  }
  plane.verticalSpeed = clamp(plane.verticalSpeed, -28, 16);

  // Move.
  const fx = Math.sin(plane.heading);
  const fz = Math.cos(plane.heading);
  plane.x += fx * plane.speed * dt;
  plane.z += fz * plane.speed * dt;
  plane.y += plane.verticalSpeed * dt;

  // Fuel: the faster the lever, the faster the tank empties.
  plane.fuel = Math.max(0, plane.fuel - plane.throttle * c.fuelBurn * dt);

  // Soft world edge: the valley is ringed by rising ground, and the
  // plane is gently turned back rather than hitting an invisible wall.
  const r = Math.hypot(plane.x, plane.z);
  if (r > CONFIG.worldHalf - 60) {
    const back = Math.atan2(-plane.x, -plane.z);
    let diff = back - plane.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    plane.heading += clamp(diff, -1, 1) * 0.8 * dt;
  }

  // Ground contact.
  const ground = heightAt(plane.x, plane.z);
  if (plane.y <= ground + 1.6) {
    plane.y = ground + 1.6;
    const onRunway = onRunwayStrip(plane.x, plane.z);
    const vs = plane.verticalSpeed;
    const gentle = Math.abs(vs) < 4.5 && Math.abs(plane.roll) < 0.25 && plane.speed < 55;
    if (plane.speed < 6 && onRunway) {
      // Stopped on the runway: a landing. Refuel and repair, the
      // courier's reward for bringing the plane home.
      plane.onGround = true;
      plane.landed = true;
      plane.touchdownVs = vs;
      plane.touchdownSpeed = plane.speed;
      plane.fuel = CONFIG.fuelCapacity;
      plane.damage = Math.max(0, plane.damage - 20);
      plane.speed = 0;
      plane.verticalSpeed = 0;
      plane.pitch = 0;
      plane.roll = 0;
    } else if (onRunway && gentle && vs < 0) {
      // A wheels-down touchdown: roll it out, keep the speed.
      plane.onGround = true;
      plane.verticalSpeed = 0;
      plane.pitch = 0;
      if (plane.speed < 12) plane.speed = Math.max(0, plane.speed - 8 * dt);
    } else if (vs < -2.5 || plane.speed > 40) {
      // Hit the ground too hard, or hit it fast: the sortie is over.
      plane.crashed = true;
      plane.damage = c.crashDamage;
      plane.verticalSpeed = 0;
    } else {
      // A soft brush of rough ground at low speed: bounce, take damage.
      plane.damage += c.hardLandingDamage * dt * 4;
      plane.verticalSpeed = Math.abs(vs) * 0.3;
      plane.y = ground + 2.2;
      if (plane.damage >= 100) plane.crashed = true;
    }
  } else {
    plane.onGround = false;
    plane.landed = false;
  }
  if (plane.damage >= 100 && !plane.crashed) plane.crashed = true;
}

export function onRunwayStrip(x, z) {
  const r = CONFIG.runway;
  const along = (z - r.z) * Math.cos(r.heading) + (x - r.x) * Math.sin(r.heading);
  const across = (x - r.x) * Math.cos(r.heading) - (z - r.z) * Math.sin(r.heading);
  return Math.abs(along) < r.length / 2 && Math.abs(across) < r.width / 2;
}

// Heading as a compass bearing in degrees, 0 = north.
export function headingDegrees(heading) {
  return ((heading * 180) / Math.PI % 360 + 360) % 360;
}

// Knots, the unit a pilot reads on the dial.
export function knots(speed) {
  return Math.round(speed * 1.94384);
}
