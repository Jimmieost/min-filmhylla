// Optional development utility. Generates PNGs using only Node's standard library.
// The app itself needs neither Node nor this file. Glyph matches assets/icons/icon.svg.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
const gold = [245, 196, 81];
const background = [16, 17, 20];
const strokes = [
  [[112, 120], [180, 120], [180, 382], [112, 382], [112, 120]],
  [[202, 120], [270, 120], [270, 382], [202, 382], [202, 120]],
  [[301, 128], [365, 115], [414, 370], [350, 383], [301, 128]],
  [[112, 173], [180, 173]], [[202, 173], [270, 173]],
  [[112, 327], [180, 327]], [[202, 327], [270, 327]],
  [[312, 179], [376, 167]], [[340, 318], [404, 306]],
  [[96, 399], [422, 399]],
];
function distance(px, py, a, b) {
  const dx = b[0] - a[0]; const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
}
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const type = Buffer.from(name); const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0); type.copy(result, 4); data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([type, data])), data.length + 8); return result;
}
function generate(size, maskable = false) {
  const rows = Buffer.alloc(size * (size * 4 + 1));
  const scale = maskable ? .8 : 1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let cover = 0;
    for (const oy of [.25, .75]) for (const ox of [.25, .75]) {
      const px = ((x + ox) * 512 / size - 256) / scale + 256;
      const py = ((y + oy) * 512 / size - 256) / scale + 256;
      if (strokes.some(points => points.some((point, i) => i > 0 && distance(px, py, points[i - 1], point) <= 8))) cover += .25;
    }
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    for (let i = 0; i < 3; i++) rows[offset + i] = Math.round(background[i] + (gold[i] - background[i]) * cover);
    rows[offset + 3] = 255;
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
for (const [name, size, maskable] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true], ['apple-touch-icon.png', 180, false]]) {
  writeFileSync(new URL(`../assets/icons/${name}`, import.meta.url), generate(size, maskable));
  console.log(`Created ${name} (${size} × ${size})`);
}
