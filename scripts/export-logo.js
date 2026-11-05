#!/usr/bin/env node
// Exports the app's icons from assets/images/logo.svg (the owner's logo.png traced to vector), so every size is
// drawn fresh and never stretched from pixels:
//   npm run export:logo                    (needs Google Chrome and Node 20.15+; CHROME=/path/to/chrome)
//
//   icon.png           1024 opaque, full bleed (iOS and Android round it themselves)
//   adaptive-icon.png  1024 transparent, the tile left out (app.json's backgroundColor is the tile's colour) and
//                      the logo at 2/3 size: Android shows the middle 72 of 108 dp, so it reads as icon.png does
//                      and the squares stay inside the 66 dp safe circle
//   splash-mark.png    1024 transparent, the tile as drawn (app.json's splash, and BrandMark in the app)
//   favicon.png        48 transparent, the tile as drawn (web)
//
// logo.png itself is never written: it stays exactly as the owner gave it.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const DIR = path.join(__dirname, '..', 'assets', 'images');
const SOURCE = fs.readFileSync(path.join(DIR, 'logo.svg'), 'utf8');
const CHROME = process.env.CHROME || 'google-chrome';
const TILE = '#FAFBF6';

const EXPORTS = [
  { file: 'icon.png', size: 1024, background: TILE, css: '#tile { rx: 0; }' },
  { file: 'adaptive-icon.png', size: 1024, css: '#tile { display: none; }', viewBox: '-256 -256 1536 1536' },
  { file: 'splash-mark.png', size: 1024 },
  { file: 'favicon.png', size: 48 },
];

// Headless Chrome paints a viewport shorter than its window, so each icon is drawn in a taller window and the
// screenshot cut back to the icon's own rows.
const EXTRA_ROWS = 256;

// Keeps the first `height` rows of an 8-bit, non-interlaced PNG. A scanline's filter reads only the row above it,
// so dropping rows from the bottom needs no decoding: inflate, cut, deflate (lossless both ways).
function keepTopRows(png, height) {
  const chunks = [];
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    chunks.push({ type: png.toString('latin1', at + 4, at + 8), data: png.subarray(at + 8, at + 8 + length) });
    at += 12 + length;
  }
  const ihdr = Buffer.from(chunks.find(c => c.type === 'IHDR').data);
  const [depth, colour, interlace] = [ihdr[8], ihdr[9], ihdr[12]];
  if (depth !== 8 || interlace !== 0 || (colour !== 2 && colour !== 6)) throw new Error('unexpected PNG from Chrome');
  const stride = 1 + ihdr.readUInt32BE(0) * (colour === 6 ? 4 : 3);
  const pixels = zlib.inflateSync(Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data)));
  if (pixels.length < stride * height) throw new Error('the screenshot is shorter than the icon');
  ihdr.writeUInt32BE(height, 4);
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  return Buffer.concat([
    png.subarray(0, 8),
    chunk('IHDR', ihdr),
    ...chunks.filter(c => !['IHDR', 'IDAT', 'IEND'].includes(c.type)).map(c => chunk(c.type, c.data)),
    chunk('IDAT', zlib.deflateSync(pixels.subarray(0, stride * height), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'metromatrix-logo-'));
try {
  for (const e of EXPORTS) {
    let svg = SOURCE.replace(/ width="1024" height="1024"/, ` width="${e.size}" height="${e.size}"`);
    if (e.viewBox) svg = svg.replace('viewBox="0 0 1024 1024"', `viewBox="${e.viewBox}"`);
    const background = e.background || 'transparent';
    const page = path.join(work, `${e.file}.html`);
    fs.writeFileSync(
      page,
      `<!doctype html><html><head><style>html,body{margin:0;padding:0;overflow:hidden;` +
        `background:${background}}svg{display:block}${e.css || ''}</style></head><body>${svg}</body></html>`,
    );
    const shot = path.join(work, e.file);
    execFileSync(
      CHROME,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        `--window-size=${e.size},${e.size + EXTRA_ROWS}`,
        ...(e.background ? [] : ['--default-background-color=00000000']),
        `--screenshot=${shot}`,
        `file://${page}`,
      ],
      { stdio: 'pipe' },
    );
    fs.writeFileSync(path.join(DIR, e.file), keepTopRows(fs.readFileSync(shot), e.size));
    console.log(`${e.file}  ${e.size}×${e.size}`);
  }
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
