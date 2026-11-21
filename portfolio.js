const canvas = document.querySelector('#desk-cloud');
const toggle = document.querySelector('#motion');
const context = canvas.getContext('2d');

if (context) {
  const points = [];
  let seed = 23;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function box(x, y, z, width, height, depth, color, count) {
    const dimensions = [width, height, depth];
    for (let i = 0; i < count; i++) {
      const axis = i % 3;
      const offset = dimensions.map(size => (random() - .5) * size);
      offset[axis] = dimensions[axis] * (i % 2 ? -.5 : .5);
      points.push([x + offset[0], y + offset[1], z + offset[2], color, .6 + random() * .8]);
    }
  }

  box(0, .55, 0, 4.8, .13, 2.45, '#d2d2d2', 670);
  for (const x of [-2.09, 2.09]) {
    for (const z of [-.95, .95]) box(x, -.04, z, .13, 1.14, .13, '#8b8b8b', 79);
  }
  box(-.64, .65, -.10, 1.6, .08, 1.13, '#f2f2f2', 245);
  box(-.64, 1.24, .43, 1.6, 1.12, .08, '#eeeeee', 360);
  box(-.64, 1.24, .37, 1.44, .96, .015, '#aaaaaa', 290);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 10; x++) box(-1.23 + x * .127, .707, -.33 + y * .116, .085, .016, .075, '#b5b5b5', 7);
  }
  box(.91, .64, -.5, .99, .035, .71, '#d5d5d5', 190);
  box(1.13, .70, -.59, .59, .027, .027, '#ffffff', 41);
  box(1.48, .78, .57, .42, .35, .42, '#a3a3a3', 120);
  for (let i = 0; i < 125; i++) {
    const angle = random() * Math.PI * 2;
    const radius = .15 + random() * .4;
    points.push([1.48 + Math.cos(angle) * radius, 1.02 + random() * .4, .57 + Math.sin(angle) * radius, '#d8d8d8', .9]);
  }

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let rotating = !reducedMotion.matches;
  let visible = true;
  let frame;
  let previous;
  let drag;
  let yaw = -.50;
  let pitch = .54;

  function draw() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    if (width === 0 || height === 0) return;
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const up = Math.cos(pitch), tilt = Math.sin(pitch);
    const scale = width / 6.65;

    function project(x, y, z) {
      y -= .46;
      const depth = z * cos - x * sin;
      const distance = y * tilt - depth * up;
      const magnify = 9 / (9 - distance);
      return [width / 2 + (x * cos + z * sin) * scale * magnify,
              height * .52 - (y * up + depth * tilt) * scale * magnify, distance];
    }

    context.strokeStyle = '#bbbbbb2c';
    context.lineWidth = 1;
    context.beginPath();
    for (let i = -4; i <= 4; i++) {
      const [a, b] = project(i, -.65, -3);
      const [c, d] = project(i, -.65, 3);
      const [e, f] = project(-4, -.65, i * .75);
      const [g, h] = project(4, -.65, i * .75);
      context.moveTo(a, b);
      context.lineTo(c, d);
      context.moveTo(e, f);
      context.lineTo(g, h);
    }
    context.stroke();

    const projected = points.map(([x, y, z, color, size]) => [...project(x, y, z), color, size]);
    projected.sort((a, b) => a[2] - b[2]);
    for (const [x, y, distance, color, size] of projected) {
      const radius = Math.max(.5, width / 435 * size);
      context.globalAlpha = Math.min(.92, .65 + distance * .085);
      context.fillStyle = color;
      context.fillRect(x - radius / 2, y - radius / 2, radius, radius);
    }
    context.globalAlpha = 1;
  }

  function tick(time) {
    frame = undefined;
    if (!visible || !rotating || drag) return;
    if (previous !== undefined) yaw += Math.min(time - previous, 40) * .00022;
    previous = time;
    draw();
    frame = requestAnimationFrame(tick);
  }

  function updateMotion() {
    toggle.textContent = rotating ? 'Pause rotation' : 'Play rotation';
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    previous = undefined;
    if (rotating && visible && !drag && !document.hidden) frame = requestAnimationFrame(tick);
  }

  toggle.hidden = false;
  toggle.addEventListener('click', () => { rotating = !rotating; updateMotion(); });
  document.addEventListener('visibilitychange', updateMotion);
  reducedMotion.addEventListener('change', event => { rotating = !event.matches; updateMotion(); });
  new ResizeObserver(draw).observe(canvas);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; updateMotion(); }).observe(canvas);
  canvas.addEventListener('keydown', event => {
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction) return;
    event.preventDefault();
    yaw += direction[0] * .15;
    pitch = Math.max(.12, Math.min(1, pitch + direction[1] * .10));
    draw();
  });
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    updateMotion();
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== drag?.id) return;
    yaw += (event.clientX - drag.x) * .012;
    pitch = Math.max(.12, Math.min(1, pitch + (event.clientY - drag.y) * .007));
    drag.x = event.clientX;
    drag.y = event.clientY;
    draw();
  });
  canvas.addEventListener('lostpointercapture', event => {
    if (event.pointerId !== drag?.id) return;
    drag = undefined;
    updateMotion();
  });
  draw();
  updateMotion();
}
