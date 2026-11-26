// Skyline Courier — keyboard and mouse input.
// Keeps one snapshot of what the pilot is holding, so the flight model
// never reads the DOM directly and the title screen can reuse the same keys.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false, moved: false };
    this.pressed = new Set(); // keys hit since the last consume
    this.canvas = canvas;

    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
        event.preventDefault();
      }
      if (!event.repeat) this.pressed.add(event.key.toLowerCase());
      this.keys.add(event.key.toLowerCase());
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.key.toLowerCase());
    });
    canvas.addEventListener('pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = (event.clientX - rect.left) / rect.width;
      this.mouse.y = (event.clientY - rect.top) / rect.height;
      this.mouse.moved = true;
    });
    canvas.addEventListener('pointerdown', (event) => {
      this.mouse.down = true;
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = (event.clientX - rect.left) / rect.width;
      this.mouse.y = (event.clientY - rect.top) / rect.height;
    });
    window.addEventListener('pointerup', () => {
      this.mouse.down = false;
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });
  }

  down(key) {
    return this.keys.has(key.toLowerCase());
  }

  // True once per physical press; callers consume it each frame.
  wasPressed(key) {
    return this.pressed.has(key.toLowerCase());
  }

  endFrame() {
    this.pressed.clear();
  }

  // Steering intent in [-1, 1] for each axis, keyboard first, then mouse.
  // Mouse steers only while held down, so a resting pointer never fights
  // the keyboard.
  steer() {
    let roll = 0;
    let pitch = 0;
    if (this.down('arrowleft') || this.down('a')) roll -= 1;
    if (this.down('arrowright') || this.down('d')) roll += 1;
    if (this.down('arrowup') || this.down('w')) pitch -= 1;
    if (this.down('arrowdown') || this.down('s')) pitch += 1;
    if (roll === 0 && pitch === 0 && this.mouse.down && this.mouse.moved) {
      roll = (this.mouse.x - 0.5) * 2;
      pitch = (this.mouse.y - 0.5) * 2;
    }
    return { roll, pitch };
  }

  throttleDelta() {
    let delta = 0;
    if (this.down('shift')) delta += 1;
    if (this.down('control')) delta -= 1;
    if (this.down('=')) delta += 1;
    if (this.down('-')) delta -= 1;
    return delta;
  }
}
