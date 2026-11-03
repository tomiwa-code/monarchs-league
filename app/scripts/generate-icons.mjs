/**
 * Generates the PWA icon set (PNG) + favicon SVG with no external deps.
 * A tiny rasteriser: filled rects, rect outlines, a shield polygon and a
 * generated bitmap font for the "LA" monogram.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons');
mkdirSync(OUT, { recursive: true });

const BG = [0x0b, 0x11, 0x20];
const CARD = [0x1e, 0x29, 0x3b];
const BLUE = [0x60, 0xa5, 0xfa];
const LIGHT = [0xf1, 0xf5, 0xf9];

/* ── minimal 5x7 bitmap font (only the glyphs we need) ─────────────────── */
const GLYPHS = {
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
};

function drawBitmap(buf, size, text, originX, originY, scale, color) {
  let penX = originX;
  for (const ch of text) {
    const glyph = GLYPHS[ch];
    if (!glyph) continue;
    for (let gy = 0; gy < 7; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        if (glyph[gy][gx] !== '1') continue;
        fillRect(buf, size, penX + gx * scale, originY + gy * scale, scale, scale, color);
      }
    }
    penX += 6 * scale;
  }
}

/* ── primitives ───────────────────────────────────────────────────────── */
function fillRect(buf, size, x, y, w, h, color) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(size, Math.round(x + w));
  const y1 = Math.min(size, Math.round(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const i = (py * size + px) * 4;
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = 255;
    }
  }
}

function fillRoundRect(buf, size, x, y, w, h, r, color) {
  for (let py = Math.round(y); py < Math.round(y + h); py++) {
    for (let px = Math.round(x); px < Math.round(x + w); px++) {
      const dx = Math.min(px - x, x + w - 1 - px);
      const dy = Math.min(py - y, y + h - 1 - py);
      if (dx < r && dy < r) {
        const cx = px - x < r ? x + r : x + w - r;
        const cy = py - y < r ? y + r : y + h - r;
        if ((px - cx) ** 2 + (py - cy) ** 2 > r * r) continue;
      }
      const i = (py * size + px) * 4;
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = 255;
    }
  }
}

/**
 * Heraldic shield: square-ish shoulders, near-straight sides that ease inward
 * and a soft point at the base.
 */
function fillShield(buf, size, cx, top, width, height, color) {
  const halfW = width / 2;
  for (let py = Math.round(top); py < Math.round(top + height); py++) {
    const t = (py - top) / height; // 0 = top, 1 = point
    let w = halfW;

    if (t < 0.1) {
      // slightly rounded top corners
      const k = 1 - t / 0.1;
      w = halfW * (1 - 0.12 * k * k);
    } else if (t > 0.55) {
      // taper into the point, starting from the side width so it stays smooth
      const k = Math.min(1, (t - 0.55) / 0.45);
      w = halfW * 0.94 * Math.pow(1 - Math.pow(k, 1.6), 0.62);
    } else {
      // straight sides with a very slight inward slope
      w = halfW * (1 - 0.06 * ((t - 0.1) / 0.45));
    }

    for (let px = Math.round(cx - w); px <= Math.round(cx + w); px++) {
      if (px < 0 || px >= size || py < 0 || py >= size) continue;
      const i = (py * size + px) * 4;
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = 255;
    }
  }
}

/* ── icon composition ─────────────────────────────────────────────────── */
function buildIcon(size, { maskable = false } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const u = size / 512; // design units scaled from a 512 grid

  // full-bleed background (required for maskable icons)
  fillRect(buf, size, 0, 0, size, size, BG);

  // rounded "card" behind the mark
  const pad = (maskable ? 96 : 40) * u;
  const card = size - pad * 2;
  fillRoundRect(buf, size, pad, pad, card, card, 108 * u, CARD);

  // shield mark
  const shieldW = card * 0.48;
  const shieldH = card * 0.56;
  const shieldX = size / 2;
  const shieldY = pad + card * 0.2;
  fillShield(buf, size, shieldX, shieldY, shieldW, shieldH, BLUE);

  // monogram inside the shield (inverse — dark letters on blue)
  const glyphScale = Math.max(2, Math.round(shieldW / 19));
  const textW = 2 * 5 * glyphScale + glyphScale; // two glyphs + gap
  const textH = 7 * glyphScale;
  drawBitmap(
    buf,
    size,
    'LA',
    Math.round(shieldX - textW / 2),
    Math.round(shieldY + shieldH * 0.3 - textH / 2),
    glyphScale,
    BG,
  );

  // small underline chip beneath the shield
  fillRoundRect(buf, size, size / 2 - card * 0.09, shieldY + shieldH + card * 0.07, card * 0.18, 10 * u, 5 * u, LIGHT);

  return encodePng(buf, size);
}

function encodePng(rgba, size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

writeFileSync(resolve(OUT, 'icon-192.png'), buildIcon(192));
writeFileSync(resolve(OUT, 'icon-512.png'), buildIcon(512));
writeFileSync(resolve(OUT, 'icon-maskable-512.png'), buildIcon(512, { maskable: true }));

writeFileSync(
  resolve(OUT, '../favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0b1120"/>
  <rect x="40" y="40" width="432" height="432" rx="96" fill="#1e293b"/>
  <path d="M256 122c48 22 76 26 100 28v106c0 74-44 116-100 142-56-26-100-68-100-142V150c24-2 52-6 100-28Z" fill="#60a5fa"/>
  <path d="M214 196h16v84h44v16h-60zm72 0h78l26 100h-18l-5-22h-32l-5 22h-18zm10 62h26l-13-56z" fill="#0b1120"/>
</svg>
`,
);

console.log('icons written to', OUT);
