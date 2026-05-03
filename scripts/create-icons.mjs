import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

// Blend two RGB colors by alpha [0..1]
function blend(a, b, alpha) {
  return [
    Math.round(a[0] * (1 - alpha) + b[0] * alpha),
    Math.round(a[1] * (1 - alpha) + b[1] * alpha),
    Math.round(a[2] * (1 - alpha) + b[2] * alpha),
  ];
}

// Anti-aliased circle coverage: returns 0..1
function circleCoverage(dist, r, feather = 1.2) {
  return Math.max(0, Math.min(1, (r + feather - dist) / (2 * feather)));
}

function createPNG(size) {
  const bg    = [0x0F, 0x0F, 0x0F];
  const olive = [0x6B, 0x7C, 0x3F];
  const khaki = [0xC8, 0xB8, 0x7A];

  const cx = size / 2, cy = size / 2;

  // Ring: olive annulus
  const outerR = size * 0.43;
  const innerR = size * 0.27;

  // Khaki marker dot: centred on the ring at the top
  const ringMid  = (outerR + innerR) / 2;
  const markerCx = cx;
  const markerCy = cy - ringMid;
  const markerR  = size * 0.085;

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; ihdrData[9] = 2;
  const ihdr = pngChunk('IHDR', ihdrData);

  const rowSize = 1 + size * 3;
  const raw = Buffer.alloc(size * rowSize);

  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * rowSize + 1 + x * 3;

      const dx   = x - cx,        dy   = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const mdx   = x - markerCx, mdy   = y - markerCy;
      const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

      // Layer bottom-up, blending with anti-aliasing

      // Start with bg
      let color = bg;

      // Olive ring
      const outerA = circleCoverage(dist, outerR);
      const innerA = circleCoverage(dist, innerR);
      const ringA  = outerA * (1 - innerA);
      if (ringA > 0) color = blend(color, olive, ringA);

      // Khaki marker dot (renders on top of ring)
      const dotA = circleCoverage(mdist, markerR);
      if (dotA > 0) color = blend(color, khaki, dotA);

      raw[i] = color[0]; raw[i + 1] = color[1]; raw[i + 2] = color[2];
    }
  }

  const idat = pngChunk('IDAT', deflateSync(raw));
  const iend = pngChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

mkdirSync('public', { recursive: true });

writeFileSync('public/icon-192.png',        createPNG(192));
writeFileSync('public/icon-512.png',        createPNG(512));
writeFileSync('public/apple-touch-icon.png', createPNG(180));
console.log('Icons generated.');
