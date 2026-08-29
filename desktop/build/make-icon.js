// Generates icon.ico + icon.png — Angry Bird God icon.
// Uses canvas-like approach: builds a PNG pixel-by-pixel in pure Node.js (no deps).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------- PNG encoder (lossless, no dependencies) ----------
function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeData = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeData));
  return Buffer.concat([len, typeData, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // Add filter byte (0) to each row
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, makeChunk('IHDR', ihdr), makeChunk('IDAT', compressed), makeChunk('IEND', Buffer.alloc(0))]);
}

// ---------- Drawing primitives ----------
function createCanvas(w, h) {
  const data = Buffer.alloc(w * h * 4, 0); // RGBA
  return { w, h, data };
}

function setPixel(c, x, y, r, g, b, a = 255) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= c.w || y < 0 || y >= c.h) return;
  const i = (y * c.w + x) * 4;
  if (a >= 255) { c.data[i] = r; c.data[i+1] = g; c.data[i+2] = b; c.data[i+3] = 255; }
  else {
    const alpha = a / 255;
    c.data[i]   = Math.round(r * alpha + c.data[i] * (1 - alpha));
    c.data[i+1] = Math.round(g * alpha + c.data[i+1] * (1 - alpha));
    c.data[i+2] = Math.round(b * alpha + c.data[i+2] * (1 - alpha));
    c.data[i+3] = Math.min(255, c.data[i+3] + a);
  }
}

function fillCircle(c, cx, cy, radius, r, g, b, a = 255) {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(c.w - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(c.h - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPixel(c, x, y, r, g, b, a);
    }
  }
}

function fillRing(c, cx, cy, outerR, innerR, r, g, b, a = 255) {
  const outerR2 = outerR * outerR;
  const innerR2 = innerR * innerR;
  const x0 = Math.max(0, Math.floor(cx - outerR));
  const x1 = Math.min(c.w - 1, Math.ceil(cx + outerR));
  const y0 = Math.max(0, Math.floor(cy - outerR));
  const y1 = Math.min(c.h - 1, Math.ceil(cy + outerR));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= outerR2 && d2 >= innerR2) setPixel(c, x, y, r, g, b, a);
    }
  }
}

function fillEllipse(c, cx, cy, rx, ry, r, g, b, a = 255) {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(c.w - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(c.h - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1.0) setPixel(c, x, y, r, g, b, a);
    }
  }
}

function fillTriangle(c, x1, y1, x2, y2, x3, y3, r, g, b, a = 255) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2, x3)));
  const maxX = Math.min(c.w - 1, Math.ceil(Math.max(x1, x2, x3)));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2, y3)));
  const maxY = Math.min(c.h - 1, Math.ceil(Math.max(y1, y2, y3)));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointInTriangle(x, y, x1, y1, x2, y2, x3, y3)) setPixel(c, x, y, r, g, b, a);
    }
  }
}

function pointInTriangle(px, py, x1, y1, x2, y2, x3, y3) {
  const d1 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  const d2 = (px - x3) * (y2 - y3) - (x2 - x3) * (py - y3);
  const d3 = (px - x1) * (y3 - y1) - (x3 - x1) * (py - y1);
  const neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(neg && pos);
}

function drawLine(c, x0, y0, x1, y1, thickness, r, g, b, a = 255) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;
  const steps = Math.ceil(len);
  const nx = -dy / len * thickness / 2;
  const ny = dx / len * thickness / 2;
  const corners = [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]];
  fillTriangle(c, corners[0][0], corners[0][1], corners[1][0], corners[1][1], corners[2][0], corners[2][1], r, g, b, a);
  fillTriangle(c, corners[0][0], corners[0][1], corners[2][0], corners[2][1], corners[3][0], corners[3][1], r, g, b, a);
}

// ---------- Draw the Angry Bird God ----------
function drawAngryBirdGod(size) {
  const c = createCanvas(size, size);
  const s = size;
  const cx = s / 2, cy = s / 2;

  // Background: dark warm disc
  fillCircle(c, cx, cy, s * 0.5, 26, 21, 16);

  // Subtle rim
  fillRing(c, cx, cy, s * 0.49, s * 0.465, 64, 52, 38);

  const bodyR = s * 0.33;
  const bodyCy = cy + s * 0.04;

  // Divine glow behind body
  fillCircle(c, cx, bodyCy, bodyR + s * 0.04, 200, 40, 20, 30);

  // Bird body (red)
  fillCircle(c, cx, bodyCy, bodyR, 210, 45, 35);

  // Lighter highlight (upper-left area)
  fillCircle(c, cx - s * 0.08, bodyCy - s * 0.08, bodyR * 0.6, 240, 80, 60, 70);

  // Belly (lighter orange)
  fillEllipse(c, cx, bodyCy + s * 0.10, bodyR * 0.5, bodyR * 0.35, 235, 140, 90);

  // Eyes (white)
  const eyeR = s * 0.11;
  const eyeOffsetX = s * 0.10;
  const eyeCy = bodyCy - s * 0.06;
  fillCircle(c, cx - eyeOffsetX, eyeCy, eyeR, 255, 255, 255);
  fillCircle(c, cx + eyeOffsetX, eyeCy, eyeR, 255, 255, 255);

  // Pupils (black, slightly inward for anger)
  const pupilR = s * 0.04;
  const pupilOff = s * 0.02;
  fillCircle(c, cx - eyeOffsetX + pupilOff, eyeCy + s * 0.01, pupilR, 20, 20, 20);
  fillCircle(c, cx + eyeOffsetX - pupilOff, eyeCy + s * 0.01, pupilR, 20, 20, 20);

  // Angry eyebrows (thick dark lines angled toward center)
  const browW = s / 14;
  drawLine(c,
    cx - eyeOffsetX - eyeR * 0.8, eyeCy - eyeR - s * 0.02,
    cx - s * 0.02, eyeCy - eyeR + s * 0.05,
    browW, 50, 25, 15);
  drawLine(c,
    cx + eyeOffsetX + eyeR * 0.8, eyeCy - eyeR - s * 0.02,
    cx + s * 0.02, eyeCy - eyeR + s * 0.05,
    browW, 50, 25, 15);

  // Beak (yellow triangle)
  fillTriangle(c,
    cx, cy + s * 0.14,
    cx - s * 0.07, eyeCy + s * 0.07,
    cx + s * 0.07, eyeCy + s * 0.07,
    240, 170, 40);

  // Beak center line
  drawLine(c, cx, eyeCy + s * 0.07, cx, cy + s * 0.13, 1, 200, 130, 20);

  // Head feather tufts (red spiky lines)
  const featherW = s / 20;
  drawLine(c, cx, bodyCy - bodyR + s * 0.02, cx - s * 0.01, bodyCy - bodyR - s * 0.12, featherW, 180, 30, 20);
  drawLine(c, cx - s * 0.06, bodyCy - bodyR + s * 0.04, cx - s * 0.10, bodyCy - bodyR - s * 0.08, featherW, 180, 30, 20);
  drawLine(c, cx + s * 0.06, bodyCy - bodyR + s * 0.04, cx + s * 0.10, bodyCy - bodyR - s * 0.08, featherW, 180, 30, 20);

  // Crown (golden spikes above head)
  const crownBaseY = bodyCy - bodyR - s * 0.01;
  const crownW = s * 0.04;
  const crownH = s * 0.07;
  for (let i = -1; i <= 1; i++) {
    const bx = cx + i * s * 0.06;
    fillTriangle(c,
      bx, crownBaseY - crownH,
      bx - crownW / 2, crownBaseY,
      bx + crownW / 2, crownBaseY,
      255, 210, 50);
  }

  // Divine halo (golden ring)
  const haloCy = cy - s * 0.32;
  const haloRw = s * 0.22;
  const haloRh = s * 0.07;
  // Glow
  fillRing(c, cx, haloCy, haloRw + s * 0.02, haloRw - s * 0.01, 255, 210, 60, 40);
  // Ring (approximate with filled ellipse outline)
  fillEllipse(c, cx, haloCy, haloRw + s * 0.015, haloRh + s * 0.01, 255, 210, 50);
  fillEllipse(c, cx, haloCy, haloRw - s * 0.015, haloRh - s * 0.01, 26, 21, 16);

  return c;
}

// ---------- ICO encoder ----------
function encodeICO(images) {
  const bufs = [];
  let dataOffset = 6 + 16 * images.length;
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  for (let i = 0; i < images.length; i++) {
    const { w, h, png } = images[i];
    const entry = header.subarray(6 + i * 16, 6 + (i + 1) * 16);
    entry[0] = w >= 256 ? 0 : w;
    entry[1] = h >= 256 ? 0 : h;
    entry[2] = 0; // palette
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(dataOffset, 12);
    dataOffset += png.length;
    bufs.push(png);
  }
  return Buffer.concat([header, ...bufs]);
}

// ---------- Main ----------
const outDir = __dirname;
const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = [];

for (const s of sizes) {
  const c = drawAngryBirdGod(s);
  const png = encodePNG(s, s, c.data);
  images.push({ w: s, h: s, png });
}

// Write icon.png (256x256)
fs.writeFileSync(path.join(outDir, 'icon.png'), images[images.length - 1].png);

// Write icon.ico
fs.writeFileSync(path.join(outDir, 'icon.ico'), encodeICO(images));

console.log(`Angry Bird God icons written to ${outDir}`);
console.log(`  icon.png: ${(images[images.length - 1].png.length / 1024).toFixed(1)} KB`);
console.log(`  icon.ico: ${(fs.statSync(path.join(outDir, 'icon.ico')).size / 1024).toFixed(1)} KB`);
