// The owner's logo stays exactly as given, and every app icon is a full-size export of its vector
// (assets/images/README.md, `npm run export:logo`), so no icon is ever a stretched or shrunken copy.
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { size } from '../tokens';

const IMAGES = join(__dirname, '..', '..', 'assets', 'images');
const read = (file: string) => readFileSync(join(IMAGES, file));

/** Width, height and PNG colour type (2 = RGB, 6 = RGBA) from the IHDR chunk. */
const pngHeader = (file: string) => {
  const png = read(file);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20), colourType: png[25] };
};

describe('the MetroMatrix logo', () => {
  it('keeps logo.png byte for byte as the owner gave it', () => {
    expect(createHash('sha256').update(read('logo.png')).digest('hex')).toBe(
      'd7584c311f7b798bef87042e29da5f83f8ff5a092d72dc4a23684c160bd38fb4',
    );
    expect(pngHeader('logo.png')).toEqual({ width: 512, height: 512, colourType: 2 });
  });

  it('exports every icon at its full size, transparent where Expo needs it', () => {
    expect(pngHeader('icon.png')).toEqual({ width: 1024, height: 1024, colourType: 2 });
    expect(pngHeader('adaptive-icon.png')).toEqual({ width: 1024, height: 1024, colourType: 6 });
    expect(pngHeader('splash-mark.png')).toEqual({ width: 1024, height: 1024, colourType: 6 });
    expect(pngHeader('favicon.png')).toEqual({ width: 48, height: 48, colourType: 6 });
  });

  it('wires app.json to those files, with the tile colour behind the Android foreground', () => {
    const { expo } = JSON.parse(readFileSync(join(IMAGES, '..', '..', 'app.json'), 'utf8'));
    const tile = /<rect id="tile"[^>]* fill="(#[0-9A-F]{6})"/.exec(read('logo.svg').toString('utf8'))?.[1];
    expect(expo.icon).toBe('./assets/images/icon.png');
    expect(expo.android.adaptiveIcon).toEqual({ foregroundImage: './assets/images/adaptive-icon.png', backgroundColor: tile });
    expect(expo.web.favicon).toBe('./assets/images/favicon.png');
    const splash = expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];
    expect(splash.image).toBe('./assets/images/splash-mark.png');
    // BrandMark paints the same file at the same width, so native → JS doesn't move the mark.
    expect(splash.imageWidth).toBe(size.splashMark);
  });
});
