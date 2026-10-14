import { PALETTES, type ColorMode, type Palette } from '../tokens';
import { SERVICE_PALETTES, SERVICE_NAMES } from '../services';
import { GOOGLE_BUTTON } from '../brandMarks';
import { AA_BODY, AA_LARGE, contrastRatio, parseHex } from '../contrast';

// ============================================================================
// Every text/background pair the components paint, measured, in both modes.
//
// WHY THIS IS A TEST AND NOT A COMMENT
// A dark ramp fails silently: nothing throws when a label is 2.6:1 against its
// card. The screenshot looks fine at a glance and the bug arrives as "I can't
// read this" from one user on one screen. This keeps the numbers true after
// the next person edits a hex.
//
// Two bars:
//   AA_BODY  (4.5:1) — any text set in body/small/micro.
//   AA_LARGE (3:1)   — non-text UI (WCAG 1.4.11: input borders, icons,
//                      progress fills) and inkFaint, which is ONLY allowed
//                      for placeholders, disabled text and decorative icons.
// ============================================================================

const MODES: ColorMode[] = ['light', 'dark'];

/** Composite an rgba() colour over an opaque hex backdrop → hex. */
const over = (rgba: string, backdrop: string): string => {
  const m = rgba.match(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\s*\)/);
  const bg = parseHex(backdrop);
  if (!m || !bg) throw new Error(`Cannot composite ${rgba} over ${backdrop}`);
  const a = Number(m[4]);
  const mix = (c: number, b: number) => Math.round(c * a + b * (1 - a));
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(mix(+m[1], bg.r))}${hex(mix(+m[2], bg.g))}${hex(mix(+m[3], bg.b))}`;
};

const grounds = (p: Palette) =>
  [
    ['canvas', p.canvas],
    ['surface', p.surface],
    ['surfaceSunk', p.surfaceSunk],
  ] as const;

describe('palette shape', () => {
  it('dark carries every key light does, and no extras', () => {
    expect(Object.keys(PALETTES.dark).sort()).toEqual(Object.keys(PALETTES.light).sort());
  });

  it('dark grounds are dark and dark ink is light', () => {
    expect(contrastRatio(PALETTES.dark.canvas, '#000000')).toBeLessThan(2);
    expect(contrastRatio(PALETTES.dark.ink, '#FFFFFF')).toBeLessThan(2);
  });

  it('matches the brief exactly where the brief gives a value', () => {
    expect(PALETTES.light).toMatchObject({
      canvas: '#F7F5F1',
      surface: '#FFFFFF',
      surfaceSunk: '#EFECE6',
      ink: '#16151A',
      inkMuted: '#5C5862',
      inkFaint: '#8C8792',
      line: '#E4DFD7',
      brand: '#1B2A41',
      onBrand: '#FFFFFF',
      danger: '#B42318',
      success: '#067647',
      warning: '#B54708',
    });
    expect(PALETTES.dark).toMatchObject({
      canvas: '#0E0E10',
      surface: '#17171A',
      surfaceSunk: '#1F1F23',
      ink: '#F4F2EE',
      inkMuted: '#A9A5AE',
      inkFaint: '#77737C',
      line: '#2A2A2F',
      brand: '#C9D4E6',
      onBrand: '#0E0E10',
    });
  });
});

describe.each(MODES)('%s mode — base palette', mode => {
  const p = PALETTES[mode];

  it.each(grounds(p))('ink and inkMuted are body-legible on %s', (_name, ground) => {
    expect(contrastRatio(p.ink, ground)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(p.inkMuted, ground)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it.each(grounds(p))('lineStrong (input borders) reaches the non-text bar on %s', (_name, ground) => {
    expect(contrastRatio(p.lineStrong, ground)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('inkFaint reaches the non-text bar on the grounds it is used on (canvas, surface)', () => {
    // Not on surfaceSunk: the brief's light inkFaint is 2.97:1 there, so
    // components put inkMuted, never inkFaint, inside sunk wells.
    expect(contrastRatio(p.inkFaint, p.canvas)).toBeGreaterThanOrEqual(AA_LARGE);
    expect(contrastRatio(p.inkFaint, p.surface)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('inkFaint is NOT body-legible on surface — it must never carry body copy', () => {
    // Documents why the restriction exists. If a future palette makes this
    // pass, inkFaint may be promoted; until then components keep it to
    // placeholders, disabled text and icons.
    expect(contrastRatio(p.inkFaint, p.surface)).toBeLessThan(AA_BODY);
  });

  it('semantic colours are body-legible on surface, canvas and their soft tint', () => {
    for (const [fg, soft] of [
      [p.danger, p.dangerSoft],
      [p.success, p.successSoft],
      [p.warning, p.warningSoft],
    ]) {
      expect(contrastRatio(fg, p.surface)).toBeGreaterThanOrEqual(AA_BODY);
      expect(contrastRatio(fg, p.canvas)).toBeGreaterThanOrEqual(AA_BODY);
      expect(contrastRatio(fg, soft)).toBeGreaterThanOrEqual(AA_BODY);
    }
  });

  it('on-colours are body-legible on their fills', () => {
    expect(contrastRatio(p.onBrand, p.brand)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(p.onDanger, p.danger)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('text on the photo scrim stays legible even over a white photo', () => {
    expect(contrastRatio(p.onScrim, over(p.scrim, '#FFFFFF'))).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('the Google button meets its own contrast', () => {
    const g = GOOGLE_BUTTON[mode];
    expect(contrastRatio(g.text, g.surface)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(g.border, g.surface)).toBeGreaterThanOrEqual(AA_LARGE);
  });
});

describe.each(MODES)('%s mode — service accents', mode => {
  const p = PALETTES[mode];

  it.each(SERVICE_NAMES)('%s: onAccent is body-legible on accent (buttons)', name => {
    const s = SERVICE_PALETTES[mode][name];
    expect(contrastRatio(s.onAccent, s.accent)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it.each(SERVICE_NAMES)('%s: accentDeep is body-legible on surface, canvas and accentSoft', name => {
    const s = SERVICE_PALETTES[mode][name];
    expect(contrastRatio(s.accentDeep, p.surface)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(s.accentDeep, p.canvas)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(s.accentDeep, s.accentSoft)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it.each(SERVICE_NAMES)('%s: accent reaches the non-text bar on surface and canvas', name => {
    const s = SERVICE_PALETTES[mode][name];
    expect(contrastRatio(s.accent, p.surface)).toBeGreaterThanOrEqual(AA_LARGE);
    expect(contrastRatio(s.accent, p.canvas)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it.each(SERVICE_NAMES)('%s: highlight reaches the non-text bar on surface', name => {
    const s = SERVICE_PALETTES[mode][name];
    expect(contrastRatio(s.highlight, p.surface)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('the brief\'s light accents are kept exactly', () => {
    if (mode !== 'light') return;
    expect(SERVICE_PALETTES.light.shopping).toMatchObject({ accent: '#1C1917', highlight: '#B08D57', accentSoft: '#F3EDE3' });
    expect(SERVICE_PALETTES.light.healthcare).toMatchObject({ accent: '#0B6E6E', accentSoft: '#E3F1F0' });
    expect(SERVICE_PALETTES.light.food).toMatchObject({ accent: '#C2410C', accentSoft: '#FBEDE5' });
    expect(SERVICE_PALETTES.light.neutral.accent).toBe(PALETTES.light.brand);
  });
});
