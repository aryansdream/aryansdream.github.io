const canvas = document.querySelector('#face-cloud');
const context = canvas.getContext('2d');
const motion = document.querySelector('#motion');
const replay = document.querySelector('#replay-face');

const assemblyDuration = 3800;
const sequenceDuration = 8000;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function sampleFace(mesh) {
  const vertices = [];
  const triangles = [];
  let area = 0;
  for (const line of mesh.split('\n')) {
    const [type, ...values] = line.trim().split(/\s+/);
    if (type === 'v') vertices.push(values.map(Number));
    if (type !== 'f') continue;
    const [origin, second, third] = values.map(index => vertices[Number(index) - 1]);
    const [ax, ay, az] = second.map((value, index) => value - origin[index]);
    const [bx, by, bz] = third.map((value, index) => value - origin[index]);
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const magnitude = Math.hypot(nx, ny, nz);
    if (!magnitude) continue;
    area += magnitude / 2;
    triangles.push({ origin, ax, ay, az, bx, by, bz, nx: nx / magnitude, ny: ny / magnitude, nz: nz / magnitude, area });
  }

  let seed = 23;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  const points = [];
  function addPoint(x, y, z, nx, ny, nz, highlight = 0) {
    const index = points.length;
    const right = index % 2 === 1;
    const bottom = index % 4 >= 2;
    const offsetX = .025 + random() * .14;
    const offsetY = .028 + random() * .14;
    points.push({
      x, y: y + .57, z: z - 2.5,
      nx, ny, nz, highlight,
      fromX: right ? 1 - offsetX : offsetX,
      fromY: bottom ? 1 - offsetY : offsetY,
      bend: (right === bottom ? 1 : -1) * (.25 + random() * .7),
      delay: random() * 1540,
      travel: 1220 + random() * 1020,
      size: .75 + random() * .75,
      shade: random() * 28,
      trail: index % 23 === 0,
    });
  }

  const count = 4200;
  let triangleIndex = 0;
  for (let index = 0; index < count; index++) {
    const sampleArea = area * (index + random()) / count;
    while (triangles[triangleIndex].area < sampleArea) triangleIndex++;
    const { origin, ax, ay, az, bx, by, bz, nx, ny, nz } = triangles[triangleIndex];
    const root = Math.sqrt(random());
    const u = root * random();
    const v = root - u;
    addPoint(origin[0] + ax * u + bx * v, origin[1] + ay * u + by * v, origin[2] + az * u + bz * v, nx, ny, nz);
  }

  // Reinforce small facial features that sparse area sampling can miss.
  const contours = [
    [70, [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7, 33]],
    [70, [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249, 263]],
    [43, [46, 53, 52, 65, 55]],
    [43, [276, 283, 282, 295, 285]],
    [50, [98, 97, 2, 326, 327]],
    [24, [168, 6, 197, 195, 5, 4, 1]],
    [57, [61, 40, 37, 0, 267, 270, 291]],
    [39, [61, 91, 84, 17, 314, 321, 291]],
  ];
  for (const [highlight, landmarks] of contours) {
    for (let index = 1; index < landmarks.length; index++) {
      const [x, y, z] = vertices[landmarks[index - 1]];
      const [toX, toY, toZ] = vertices[landmarks[index]];
      const samples = Math.ceil(Math.hypot(toX - x, toY - y) * 14);
      for (let sample = 0; sample < samples; sample++) {
        const fraction = (sample + random()) / samples;
        addPoint(x + (toX - x) * fraction + (random() - .5) * .18,
          y + (toY - y) * fraction + (random() - .5) * .18,
          z + (toZ - z) * fraction + .025, 0, 0, 1, highlight);
      }
    }
  }
  return points;
}

function startFaceStudy(points) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const directionKeys = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const shades = Array.from({ length: 18 }, (_, index) => {
    const gray = 63 + index * 11;
    return 'rgb(' + gray + ',' + gray + ',' + gray + ')';
  });
  let elapsed = reducedMotion.matches ? sequenceDuration : 0;
  let running = !reducedMotion.matches;
  let visible = true;
  let frame;
  let previous;
  let drag;
  let yaw = 0;
  let pitch = -.05;

  function draw() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const assembling = elapsed < assemblyDuration;
    const reveal = clamp((elapsed - assemblyDuration) / (sequenceDuration - assemblyDuration), 0, 1);
    const turn = yaw + .28 * Math.sin(reveal * Math.PI * 2) * Math.sin(reveal * Math.PI);
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const up = Math.cos(pitch);
    const tilt = Math.sin(pitch);
    const scale = Math.min(width / 25, height / 22);
    const dotSize = clamp(height / 260, .9, 1.8);

    context.strokeStyle = '#eeeeee17';
    context.beginPath();
    context.moveTo(width / 2, 28);
    context.lineTo(width / 2, height - 28);
    context.moveTo(28, height / 2);
    context.lineTo(width - 28, height / 2);
    context.stroke();

    context.strokeStyle = assembling ? '#ffffff70' : '#ffffff2d';
    context.beginPath();
    for (const horizontal of [1, -1]) {
      for (const vertical of [1, -1]) {
        const x = horizontal > 0 ? 19 : width - 19;
        const y = vertical > 0 ? 19 : height - 19;
        context.moveTo(x, y + vertical * 14);
        context.lineTo(x, y);
        context.lineTo(x + horizontal * 14, y);
      }
    }
    context.stroke();

    for (const point of points) {
      const progress = clamp((elapsed - point.delay) / point.travel, 0, 1);
      if (progress === 0) continue;
      const depth = point.z * cos - point.x * sin;
      const distance = depth * up - point.y * tilt;
      const lens = 36 / (36 - distance);
      const targetX = width / 2 + (point.x * cos + point.z * sin) * scale * lens;
      const targetY = height * .5 - (point.y * up + depth * tilt) * scale * lens;
      const eased = progress * progress * (3 - 2 * progress);
      const fromX = point.fromX * width;
      const fromY = point.fromY * height;
      const arc = Math.sin(progress * Math.PI) * point.bend * height * .27;
      const x = fromX + (targetX - fromX) * eased + arc;
      const y = fromY + (targetY - fromY) * eased - arc * .45;
      const normalX = point.nx * cos + point.nz * sin;
      const normalZ = point.nz * cos - point.nx * sin;
      const light = clamp(-normalX * .35 + point.ny * .4 + normalZ * .8, 0, 1);
      const shadeIndex = clamp(Math.round((108 * light + 26 + point.shade + distance * 2 + point.highlight) / 11), 0, shades.length - 1);

      if (point.trail && progress < .88) {
        const streak = .09 * Math.sin(progress * Math.PI);
        context.strokeStyle = '#eeeeee37';
        context.beginPath();
        context.moveTo(x - (targetX - fromX) * streak, y - (targetY - fromY) * streak);
        context.lineTo(x, y);
        context.stroke();
      }
      const radius = dotSize * point.size * lens * .54;
      context.fillStyle = shades[shadeIndex];
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  function tick(time) {
    frame = undefined;
    if (previous !== undefined) elapsed = Math.min(sequenceDuration, elapsed + Math.min(50, time - previous));
    previous = time;
    draw();
    if (elapsed < sequenceDuration) {
      frame = requestAnimationFrame(tick);
    } else {
      running = false;
      updateMotion();
    }
  }

  function updateMotion() {
    motion.textContent = running ? 'Pause' : 'Resume';
    motion.hidden = elapsed >= sequenceDuration;
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    previous = undefined;
    if (running && visible && !drag && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function rotate(horizontal, vertical) {
    yaw = clamp(yaw + horizontal, -.66, .66);
    pitch = clamp(pitch + vertical, -.38, .38);
    draw();
  }

  replay.hidden = false;
  replay.addEventListener('click', () => {
    elapsed = 0;
    yaw = 0;
    pitch = -.05;
    running = true;
    draw();
    updateMotion();
  });
  motion.addEventListener('click', () => {
    running = !running;
    updateMotion();
  });
  document.addEventListener('visibilitychange', updateMotion);
  reducedMotion.addEventListener('change', event => {
    if (!event.matches) return;
    running = false;
    elapsed = sequenceDuration;
    draw();
    updateMotion();
  });
  new ResizeObserver(draw).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updateMotion();
  }).observe(canvas);
  canvas.addEventListener('keydown', event => {
    const direction = directionKeys[event.key];
    if (!direction) return;
    event.preventDefault();
    rotate(direction[0] * .14, direction[1] * .09);
  });
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    updateMotion();
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== drag?.id) return;
    rotate((event.clientX - drag.x) * .009, (event.clientY - drag.y) * .006);
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  canvas.addEventListener('lostpointercapture', event => {
    if (event.pointerId !== drag?.id) return;
    drag = undefined;
    updateMotion();
  });

  draw();
  updateMotion();
}

async function loadFaceStudy() {
  try {
    const response = await fetch('assets/face-mesh.txt');
    if (!response.ok) throw new Error('Face model could not be loaded');
    startFaceStudy(sampleFace(await response.text()));
  } catch {
    canvas.hidden = true;
    document.querySelector('#face-instructions').textContent = 'Face reconstruction is unavailable.';
  }
}

if (context) loadFaceStudy();
