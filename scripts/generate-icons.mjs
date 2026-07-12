import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../client/public/icons');
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function createPng(size, draw) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y, size);
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function dist(x, y, cx, cy) {
  return Math.hypot(x - cx, y - cy);
}

function drawIcon(x, y, size, { maskable = false } = {}) {
  const bg = [10, 10, 11, 255];
  const panel = [17, 18, 20, 255];
  const accent = [124, 255, 178, 255];

  const pad = maskable ? size * 0.12 : size * 0.08;
  const radius = size * (maskable ? 0.22 : 0.18);
  const left = pad;
  const top = pad;
  const right = size - pad;
  const bottom = size - pad;

  const inRoundedRect =
    x >= left &&
    x <= right &&
    y >= top &&
    y <= bottom &&
    (x >= left + radius && x <= right - radius ||
      y >= top + radius && y <= bottom - radius ||
      dist(x, y, left + radius, top + radius) <= radius ||
      dist(x, y, right - radius, top + radius) <= radius ||
      dist(x, y, left + radius, bottom - radius) <= radius ||
      dist(x, y, right - radius, bottom - radius) <= radius);

  if (!inRoundedRect) {
    return maskable ? bg : [0, 0, 0, 0];
  }

  const innerPad = pad + size * 0.06;
  const innerRadius = radius * 0.75;
  const inInner =
    x >= innerPad &&
    x <= size - innerPad &&
    y >= innerPad &&
    y <= size - innerPad &&
    (x >= innerPad + innerRadius && x <= size - innerPad - innerRadius ||
      y >= innerPad + innerRadius && y <= size - innerPad - innerRadius ||
      dist(x, y, innerPad + innerRadius, innerPad + innerRadius) <= innerRadius ||
      dist(x, y, size - innerPad - innerRadius, innerPad + innerRadius) <= innerRadius ||
      dist(x, y, innerPad + innerRadius, size - innerPad - innerRadius) <= innerRadius ||
      dist(x, y, size - innerPad - innerRadius, size - innerPad - innerRadius) <= innerRadius);

  let color = inInner ? panel : [42, 45, 51, 255];

  // chevron >
  const cx = size * 0.38;
  const cy = size * 0.46;
  const arm = size * 0.11;
  const thickness = size * 0.035;
  const onChevron =
    (Math.abs(y - (cy - (x - cx))) < thickness && x >= cx - arm * 0.2 && x <= cx + arm) ||
    (Math.abs(y - (cy + (x - cx))) < thickness && x >= cx - arm * 0.2 && x <= cx + arm);

  // underscore
  const ux1 = size * 0.48;
  const ux2 = size * 0.72;
  const uy = size * 0.64;
  const onUnderscore = x >= ux1 && x <= ux2 && Math.abs(y - uy) < thickness;

  if (onChevron || onUnderscore) color = accent;
  if (!inInner && !onChevron && !onUnderscore) color = [42, 45, 51, 255];

  return color;
}

const files = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-512-maskable.png', 512, true],
  ['apple-touch-icon.png', 180, false],
];

for (const [name, size, maskable] of files) {
  const png = createPng(size, (x, y, s) => drawIcon(x, y, s, { maskable }));
  writeFileSync(join(outDir, name), png);
  console.log('Wrote', name);
}
