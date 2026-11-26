// Skyline Courier — the three sorties.
// Each mission is a different kind of flying: a ring course that rewards
// smooth turns, a parcel drop that rewards a steady low approach, and a
// landing that rewards throttle discipline. The mission owns its
// objectives, its rings and its scoring; the game loop only asks it what
// happened this frame.
import { CONFIG } from './config.js';
import { heightAt } from './terrain.js';
import { headingDegrees } from './physics.js';

function ringCourse() {
  // A loop out over the valley and back to the runway. It starts
  // straight ahead of the takeoff roll, so the first ring is in frame
  // the moment the wheels leave the ground, then climbs and turns east
  // and back south, so the pilot climbs, dives and turns. Heights stay
  // low enough that a plane climbing out of the runway can reach them.
  const centres = [
    { x: 0, z: 1350, y: 70 },
    { x: 320, z: 1620, y: 95 },
    { x: 640, z: 1280, y: 120 },
    { x: 560, z: 760, y: 105 },
    { x: 120, z: 420, y: 85 },
    { x: -400, z: 560, y: 110 },
    { x: -620, z: 1050, y: 130 },
    { x: -320, z: 1480, y: 90 },
  ];
  return centres.map((c, i) => {
    // Each ring faces the next one, so the pilot flies through it,
    // never across it.
    const next = centres[(i + 1) % centres.length];
    const dx = next.x - c.x;
    const dz = next.z - c.z;
    const len = Math.hypot(dx, dz) || 1;
    // "right" is the horizontal vector across the ring's face.
    return {
      x: c.x,
      y: c.y,
      z: c.z,
      radius: CONFIG.ringRadius,
      rightX: dz / len,
      rightZ: -dx / len,
      passed: false,
      index: i,
    };
  });
}

export const MISSIONS = [
  {
    id: 'rings',
    name: 'Ring Run',
    short: 'RINGS',
    blurb: 'Thread all 8 rings over the valley. Smooth turns win: every ring you clip costs time, every clean pass pays.',
    setup() {
      return { rings: ringCourse(), nextRing: 0, delivered: false };
    },
    objectiveText(state) {
      if (state.nextRing >= state.rings.length) return 'Course complete — land on the runway!';
      const ring = state.rings[state.nextRing];
      return `Ring ${state.nextRing + 1} of ${state.rings.length} — ${Math.round(distTo(plane, ring))} m`;
    },
  },
  {
    id: 'delivery',
    name: 'Parcel Drop',
    short: 'DROP',
    blurb: 'Carry the parcel to the barn at Miller Farm and drop it low and slow over the marked field. Then bring the plane home.',
    setup() {
      return {
        rings: [],
        nextRing: 0,
        delivered: false,
        drop: { x: -210, z: 1040, y: heightAt(-210, 1040) + 55, radius: CONFIG.dropZoneRadius },
        parcel: true,
      };
    },
    objectiveText(state) {
      if (state.delivered) return 'Parcel delivered — land on the runway!';
      return `Drop zone ${Math.round(distTo(plane, state.drop))} m — descend below 60 m and press Space`;
    },
  },
  {
    id: 'landing',
    name: 'Dawn Landing',
    short: 'LAND',
    blurb: 'Take off, circle the valley once, and put the courier down gently on the runway. The softer the touchdown, the bigger the pay.',
    setup() {
      return { rings: [], nextRing: 0, delivered: false, circled: false, tookOff: false };
    },
    objectiveText(state) {
      if (!state.tookOff) return 'Take off — full throttle, pull up gently';
      if (!state.circled) return 'Circle the valley, then line up with the runway';
      return 'On final — throttle low, nose level, aim for the numbers';
    },
  },
];

// Distance helper shared by the objective text. `plane` is bound by the
// caller through the module-level slot below (kept simple on purpose:
// the missions module never imports the game loop).
let plane = null;
export function bindPlane(p) {
  plane = p;
}
function distTo(p, target) {
  if (!p) return 0;
  return Math.hypot(target.x - p.x, target.y - p.y, target.z - p.z);
}

// Advance one mission by a frame. Returns an array of events for the
// game loop to announce and score: {type, score, message}.
export function updateMission(mission, state, p, dt, events) {
  const out = events || [];
  if (mission.id === 'rings') {
    const ring = state.rings[state.nextRing];
    if (ring && !ring.passed) {
      const d = Math.hypot(ring.x - p.x, ring.y - p.y, ring.z - p.z);
      // Flying through the ring means passing inside its circle.
      if (d < ring.radius) {
        ring.passed = true;
        state.nextRing += 1;
        out.push({
          type: 'ring',
          score: CONFIG.ringScore,
          message:
            state.nextRing >= state.rings.length
              ? 'Final ring! Course complete — land on the runway.'
              : `Ring ${state.nextRing} of ${state.rings.length} — clean pass!`,
        });
      } else if (d < ring.radius * 1.6 && p.speed > 10) {
        // Brushing the ring's edge: no score, a warning the pilot feels.
        out.push({ type: 'near', score: 0, message: 'Too wide — tighten the turn!' });
      }
    }
    return out;
  }
  if (mission.id === 'delivery') {
    const drop = state.drop;
    if (state.parcel && !state.delivered) {
      const horizontal = Math.hypot(drop.x - p.x, drop.z - p.z);
      const heightAbove = p.y - heightAt(p.x, p.z);
      if (horizontal < drop.radius && heightAbove < 60 && heightAbove > 8) {
        state.delivered = true;
        state.parcel = false;
        out.push({
          type: 'delivery',
          score: CONFIG.deliveryScore,
          message: 'Parcel away — right on the field!',
        });
      }
    }
    return out;
  }
  if (mission.id === 'landing') {
    if (!state.tookOff && !p.onGround && p.y > heightAt(p.x, p.z) + 12) {
      state.tookOff = true;
      out.push({ type: 'takeoff', score: 50, message: 'Airborne! Circle the valley once.' });
    }
    if (state.tookOff && !state.circled) {
      // Circled once the pilot has flown past the far side of the valley.
      if (p.z < 200) {
        state.circled = true;
        out.push({ type: 'circle', score: 100, message: 'Valley circled — line up with the runway.' });
      }
    }
    return out;
  }
  return out;
}

// Score a landing once the wheels stop: the gentler and straighter, the
// more the courier earns. Returns {score, message}.
export function scoreLanding(p, mission, state) {
  const vs = Math.abs(p.touchdownVs || 0);
  const aligned = Math.abs(((p.heading - CONFIG.runway.heading + Math.PI) % (Math.PI * 2)) - Math.PI);
  let score = CONFIG.landingScore;
  let note = 'Greased it — a textbook landing.';
  if (vs > 3) {
    score -= Math.round((vs - 3) * 90);
    note = 'A firm touchdown — the parcels felt that one.';
  }
  if (aligned > 0.2) {
    score -= Math.round((aligned - 0.2) * 400);
    note = 'Down, but crooked — line up earlier next time.';
  }
  score = Math.max(50, score);
  if (mission.id === 'landing' && state.tookOff && state.circled) score += 200;
  if (mission.id === 'rings' && state.nextRing >= state.rings.length) score += 200;
  if (mission.id === 'delivery' && state.delivered) score += 200;
  return { score, message: `${note} +${score}` };
}

// The mission is complete when its goal is done and the plane is parked
// on the runway.
export function missionComplete(mission, state, p) {
  if (!p.landed) return false;
  if (mission.id === 'rings') return state.nextRing >= state.rings.length;
  if (mission.id === 'delivery') return state.delivered;
  if (mission.id === 'landing') return state.tookOff && state.circled;
  return false;
}

export function missionProgress(mission, state) {
  if (mission.id === 'rings') return `${state.nextRing}/${state.rings.length} rings`;
  if (mission.id === 'delivery') return state.delivered ? 'Parcel delivered' : 'Parcel aboard';
  if (mission.id === 'landing') {
    if (!state.tookOff) return 'On the ground';
    return state.circled ? 'On final approach' : 'Circling the valley';
  }
  return '';
}

// Compass helper for the HUD's "next objective" arrow.
export function bearingTo(p, target) {
  const dx = target.x - p.x;
  const dz = target.z - p.z;
  return headingDegrees(Math.atan2(dx, dz));
}
