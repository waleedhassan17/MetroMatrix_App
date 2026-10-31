import { PALETTES } from '../tokens';
import { SERVICE_PALETTES, SERVICE_NAMES, BRAND_GRADIENT } from '../services';
import { GOOGLE_BUTTON } from '../brandMarks';
import { headerGradient } from '../theme';
import { AA_BODY, AA_LARGE, contrastRatio, mix, parseHex } from '../contrast';

// ============================================================================
// Every text/background pair the components paint, measured (light only).
//
// A palette fails silently: nothing throws when a label is 2.6:1 against its
// card. This keeps the numbers true after the next person edits a hex.
//
//   AA_BODY  (4.5:1) — any text in body/small/caption.
//   AA_LARGE (3:1)   — non-text UI (WCAG 1.4.11: checkbox outlines, icons
//                      that carry meaning, progress fills).
// `inkFaint` is the FYP's placeholder / decorative-icon grey (2.5:1). It is
// never used for body copy, and the test pins that it cannot be.
// ============================================================================

const p = PALETTES.light;

const over = (rgba: string, backdrop: string): string => {
  const m = rgba.match(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\s*\)/);
  const bg = parseHex(backdrop);
  if (!m || !bg) throw new Error(`Cannot composite ${rgba} over ${backdrop}`);
  const a = Number(m[4]);
  const hex = (c: number, b: number) => Math.round(c * a + b * (1 - a)).toString(16).padStart(2, '0');
  return `#${hex(+m[1], bg.r)}${hex(+m[2], bg.g)}${hex(+m[3], bg.b)}`;
};

const grounds = [
  ['canvas', p.canvas],
  ['surface', p.surface],
  ['surfaceSunk', p.surfaceSunk],
] as const;

describe('the FYP look', () => {
  it('paints the page white and keeps the FYP slate ramp (no warm beige anywhere)', () => {
    expect(p).toMatchObject({
      canvas: '#FFFFFF',
      surface: '#FFFFFF',
      surfaceSunk: '#F1F5F9',
      ink: '#0F172A',
      inkMuted: '#475569',
      inkFaint: '#94A3B8',
      line: '#E2E8F0',
      disabled: '#CBD5E1',
      brand: '#047857',
      danger: '#B91C1C',
      success: '#047857',
      warning: '#B45309',
    });
  });

  it('keeps the FYP brand emerald and the healthcare / shopping hues', () => {
    expect(SERVICE_PALETTES.light.neutral).toMatchObject({ accent: '#047857', accentSoft: '#ECFDF5', highlight: '#10B981' });
    expect(SERVICE_PALETTES.light.healthcare.highlight).toBe('#2A7FFF');
    expect(SERVICE_PALETTES.light.shopping.highlight).toBe('#E67E22');
    expect(BRAND_GRADIENT).toEqual(['#047857', '#0F766E']);
    // Food: Foodpanda's pink, slightly shifted.
    expect(SERVICE_PALETTES.light.food.accent).toBe('#D90F66');
  });
});

describe('base palette', () => {
  it.each(grounds)('ink and inkMuted are body-legible on %s', (_name, ground) => {
    expect(contrastRatio(p.ink, ground)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(p.inkMuted, ground)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it.each(grounds)('lineStrong (checkbox / radio outlines) reaches the non-text bar on %s', (_name, ground) => {
    expect(contrastRatio(p.lineStrong, ground)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('inkFaint is placeholder-only: never body-legible', () => {
    expect(contrastRatio(p.inkFaint, p.surface)).toBeLessThan(AA_BODY);
    expect(contrastRatio(p.inkFaint, p.surface)).toBeGreaterThan(2);
  });

  it('semantic colours are body-legible on surface and their soft tint', () => {
    for (const [fg, soft] of [
      [p.danger, p.dangerSoft],
      [p.success, p.successSoft],
      [p.warning, p.warningSoft],
      [p.info, p.infoSoft],
    ]) {
      expect(contrastRatio(fg, p.surface)).toBeGreaterThanOrEqual(AA_BODY);
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

  it('the Google button label is legible', () => {
    expect(contrastRatio(GOOGLE_BUTTON.text, GOOGLE_BUTTON.surface)).toBeGreaterThanOrEqual(AA_BODY);
  });
});

describe.each(SERVICE_NAMES)('%s accent', name => {
  const s = SERVICE_PALETTES.light[name];

  it('onAccent is body-legible on accent (button fills)', () => {
    expect(contrastRatio(s.onAccent, s.accent)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('accentDeep is body-legible on surface and accentSoft (links, selected text)', () => {
    expect(contrastRatio(s.accentDeep, p.surface)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(s.accentDeep, s.accentSoft)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('accent reaches the non-text bar on white (icons, focus rings, active tabs)', () => {
    expect(contrastRatio(s.accent, p.surface)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('the onboarding card header carries a white label on both gradient stops', () => {
    for (const stop of headerGradient(name)) {
      expect(contrastRatio('#FFFFFF', stop)).toBeGreaterThanOrEqual(AA_BODY);
    }
  });
});

describe('brand gradient and helpers', () => {
  it('the overview card sweep carries a white label on both stops', () => {
    for (const stop of BRAND_GRADIENT) expect(contrastRatio('#FFFFFF', stop)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('mix blends in sRGB and clamps', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mix('#123456', '#123456', 0.3)).toBe('#123456');
    expect(mix('not-a-colour', '#FFFFFF', 0.5)).toBe('not-a-colour');
  });
});

// Kitchen Intelligence (Chunk 5, QA 53): light only, so the dark-mode row is
// this check. Every chart mark and bar carries meaning, so each reaches the
// non-text bar against what it sits on.
describe('Kitchen Intelligence charts and bars', () => {
  const food = SERVICE_PALETTES.light.food;

  it('a stock level bar shows on its track in every state', () => {
    for (const fg of [p.success, p.warning, p.danger, p.inkMuted, food.accent]) expect(contrastRatio(fg, p.surfaceSunk)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('a forecast’s expected mark and the cook’s own number stand out from the range band', () => {
    expect(contrastRatio(food.accent, food.accentSoft)).toBeGreaterThanOrEqual(AA_LARGE);
    expect(contrastRatio(food.accent, p.surfaceSunk)).toBeGreaterThanOrEqual(AA_LARGE);
    expect(contrastRatio(p.ink, food.accentSoft)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('the hour curve’s kitchen line reads over the area it is drawn on', () => {
    expect(contrastRatio(food.accentDeep, food.accentSoft)).toBeGreaterThanOrEqual(AA_LARGE);
    expect(contrastRatio(food.accentDeep, p.surface)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('the demand map’s "most found nothing" outline and the quadrant dots read on white', () => {
    for (const s of [food, SERVICE_PALETTES.light.neutral]) {
      expect(contrastRatio(s.accentDeep, p.surface)).toBeGreaterThanOrEqual(AA_LARGE);
      expect(contrastRatio(s.accent, p.surface)).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });
});
