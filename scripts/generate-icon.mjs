/**
 * Generates a 44x44 PNG icon for the macOS menu bar tray.
 * Uses pure Node.js — no external dependencies required.
 * Output: resources/trayIconTemplate.png
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const W = 44;
const H = 44;

// RGBA pixel grid — all transparent initially
const pixels = new Uint8Array(W * H * 4); // all zeros = transparent

function setPixel(x, y, alpha = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  pixels[i]     = 255; // R
  pixels[i + 1] = 255; // G
  pixels[i + 2] = 255; // B
  pixels[i + 3] = alpha;
}

// Anti-aliased line helper (Xiaolin Wu)
function drawLine(x0, y0, x1, y1, width = 2) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0, y = y0;
  while (true) {
    for (let ox = -Math.floor(width/2); ox <= Math.floor(width/2); ox++) {
      for (let oy = -Math.floor(width/2); oy <= Math.floor(width/2); oy++) {
        setPixel(x + ox, y + oy, 255);
      }
    }
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx)  { err += dx; y += sy; }
  }
}

// === Draw the icon ===
// 44x44 icon (displayed at 22x22 on normal, or Retina halves it to 22pt)
// Corner bracket size
const M = 5;        // margin from edge
const L = 12;       // arm length of each corner bracket
const T = 2;        // thickness (pixel width)

// Top-left corner
drawLine(M, M + L, M, M, T);           // vertical arm
drawLine(M, M, M + L, M, T);           // horizontal arm

// Top-right corner
drawLine(W-1-M, M + L, W-1-M, M, T);  // vertical arm
drawLine(W-1-M, M, W-1-M-L, M, T);    // horizontal arm

// Bottom-left corner
drawLine(M, H-1-M-L, M, H-1-M, T);    // vertical arm
drawLine(M, H-1-M, M+L, H-1-M, T);    // horizontal arm

// Bottom-right corner
drawLine(W-1-M, H-1-M-L, W-1-M, H-1-M, T); // vertical arm
drawLine(W-1-M, H-1-M, W-1-M-L, H-1-M, T); // horizontal arm

// Center crosshair
const cx = Math.floor(W / 2);
const cy = Math.floor(H / 2);
drawLine(cx, cy - 5, cx, cy + 5, T);   // vertical
drawLine(cx - 5, cy, cx + 5, cy, T);   // horizontal

// === PNG encoding ===

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  for (const b of buf) crc = table[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crcData = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// IHDR
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // color type: RGBA
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

// IDAT: build raw scanlines (filter byte 0 = None per row)
const rawRows = [];
for (let y = 0; y < H; y++) {
  const row = Buffer.alloc(1 + W * 4);
  row[0] = 0; // filter: None
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    row[1 + x * 4]     = pixels[i];
    row[1 + x * 4 + 1] = pixels[i + 1];
    row[1 + x * 4 + 2] = pixels[i + 2];
    row[1 + x * 4 + 3] = pixels[i + 3];
  }
  rawRows.push(row);
}
const rawData = Buffer.concat(rawRows);
const compressed = zlib.deflateSync(rawData);

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const png = Buffer.concat([
  PNG_SIG,
  chunk('IHDR', ihdr),
  chunk('IDAT', compressed),
  chunk('IEND', Buffer.alloc(0))
]);

mkdirSync(join(ROOT, 'resources'), { recursive: true });
const outPath = join(ROOT, 'resources', 'trayIconTemplate.png');
writeFileSync(outPath, png);
console.log(`✅ Icon written to: ${outPath} (${W}x${H} RGBA PNG)`);
