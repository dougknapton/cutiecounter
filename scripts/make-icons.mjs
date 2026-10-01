// Renders the neutral "Tasks" checkmark icon to PNG without any dependencies.
// Mirrors public/icon.svg. Run with: npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const BG = [0x11, 0x11, 0x11];
const FG = [0xff, 0xff, 0xff];

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function insideRoundedRect(x, y, size, r) {
  const cx = Math.min(Math.max(x, r), size - r);
  const cy = Math.min(Math.max(y, r), size - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

// Coordinates are in the 512-unit design space of icon.svg.
// `inset` shrinks the glyph (for maskable icons); `rounded` toggles corner radius.
function sample(u, v, { rounded, inset }) {
  if (rounded && !insideRoundedRect(u, v, 512, 112)) return null;
  const s = inset, c = 256;
  const x = c + (u - c) / s, y = c + (v - c) / s;
  const ring = Math.abs(Math.hypot(x - 256, y - 256) - 150) <= 14;
  const check =
    distToSegment(x, y, 190, 262, 236, 308) <= 16 ||
    distToSegment(x, y, 236, 308, 326, 208) <= 16;
  return ring || check ? FG : BG;
}

function render(size, opts) {
  const SS = 4; // supersampling per axis
  const rows = [];
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = ((px + (sx + 0.5) / SS) / size) * 512;
          const v = ((py + (sy + 0.5) / SS) / size) * 512;
          const col = sample(u, v, opts);
          if (col) { r += col[0]; g += col[1]; b += col[2]; a += 255; }
        }
      }
      const n = SS * SS, cov = a / 255;
      const o = 1 + px * 4;
      row[o] = cov ? Math.round(r / cov) : 0;
      row[o + 1] = cov ? Math.round(g / cov) : 0;
      row[o + 2] = cov ? Math.round(b / cov) : 0;
      row[o + 3] = Math.round(a / n);
    }
    rows.push(row);
  }
  return encodePng(size, size, Buffer.concat(rows));
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../public/', import.meta.url);
// iOS applies its own mask, so the touch icon is a full square.
writeFileSync(new URL('apple-touch-icon.png', out), render(180, { rounded: false, inset: 1 }));
writeFileSync(new URL('icon-192.png', out), render(192, { rounded: true, inset: 1 }));
writeFileSync(new URL('icon-512.png', out), render(512, { rounded: true, inset: 1 }));
writeFileSync(new URL('icon-maskable-512.png', out), render(512, { rounded: false, inset: 0.8 }));
console.log('Icons written to public/');
