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

function createPNG(size, fg, bg) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; ihdrData[9] = 2;
  const ihdr = pngChunk('IHDR', ihdrData);

  const rowSize = 1 + size * 3;
  const raw = Buffer.alloc(size * rowSize);
  const cx = size / 2, cy = size / 2, cr = size * 0.44;

  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * rowSize + 1 + x * 3;
      const dx = x - cx, dy = y - cy;
      const inside = dx * dx + dy * dy <= cr * cr;
      const color = inside ? fg : bg;
      raw[i] = color[0]; raw[i + 1] = color[1]; raw[i + 2] = color[2];
    }
  }

  const idat = pngChunk('IDAT', deflateSync(raw));
  const iend = pngChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

mkdirSync('public', { recursive: true });
const olive = [0x6B, 0x7C, 0x3F];
const dark  = [0x0F, 0x0F, 0x0F];

writeFileSync('public/icon-192.png', createPNG(192, olive, dark));
writeFileSync('public/icon-512.png', createPNG(512, olive, dark));
writeFileSync('public/apple-touch-icon.png', createPNG(180, olive, dark));
console.log('Icons generated.');
