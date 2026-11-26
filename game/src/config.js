// Skyline Courier — shared tuning constants.
// One place for every number the other modules agree on, so a balance
// tweak never means hunting the same literal through five files.
export const CONFIG = {
  // World size (metres). The flyable valley is centred on the runway.
  worldHalf: 2400,
  // Terrain height: rolling hills, one river valley, one snowy ridge.
  hillAmp: 46,
  ridgeAmp: 120,
  // Flight model.
  maxSpeed: 96, // m/s at full throttle, level flight
  stallSpeed: 26, // below this the wing stops flying
  cruiseSpeed: 62,
  climbRate: 12, // m/s of climb at full power, level pitch
  turnRate: 0.55, // rad/s of heading change at full bank
  maxBank: 0.9, // rad
  maxPitch: 0.45, // rad
  gravitySink: 10, // m/s^2 sink when stalled
  // Fuel: full tank lasts about 6 minutes at cruise throttle.
  fuelCapacity: 100,
  fuelBurn: 0.28, // units per second at full throttle
  // Damage: 100 is a write-off.
  crashDamage: 100,
  hardLandingDamage: 34,
  // Runway: a flat strip the courier flies out of.
  runway: { x: 0, z: 900, length: 420, width: 34, heading: 0 },
  // Camera / projection.
  focal: 620, // pixels of focal length at 1280x720
  nearClip: 6,
  farDraw: 800, // metres of terrain drawn ahead
  // Missions.
  ringRadius: 26,
  ringCount: 8,
  dropZoneRadius: 30,
  // Scoring.
  ringScore: 150,
  landingScore: 400,
  deliveryScore: 500,
  timeBonusPerSecond: 2,
};

export const COLOURS = {
  skyTop: '#2f6fb4',
  skyMid: '#7fb2dd',
  skyLow: '#cfe4f2',
  sun: '#fff3c4',
  grassLow: '#5d8a3c',
  grassHigh: '#7fae4e',
  rock: '#8d8578',
  snow: '#eef3f6',
  water: '#3f7fb5',
  sand: '#c9b078',
  runway: '#3a3f46',
  runwayLine: '#f2e9c9',
  ring: '#ffb02e',
  ringGlow: 'rgba(255, 176, 46, 0.35)',
  hud: '#eaf6ff',
  hudDim: '#9fc3dd',
  warn: '#ffb02e',
  danger: '#ff5a4e',
  ok: '#7ee787',
};
