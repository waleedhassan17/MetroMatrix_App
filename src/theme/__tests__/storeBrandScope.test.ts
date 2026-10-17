import { contrastRatio, AA_BODY } from '../contrast';
import { SERVICE_PALETTES } from '../services';
import { storePalette } from '../StoreBrandScope';

const WHITE = '#FFFFFF';

describe('storePalette', () => {
  const BRANDS = ['#7A1F3D', '#111827', '#0F766E', '#F5D90A', '#FFFFFF', '#FF69B4', '#00FF00', '#1E3A8A', '#C0C0C0', '#E11D48'];

  it.each(BRANDS)('%s: every pairing the UI paints passes AA', brand => {
    for (const onBrand of ['#FFFFFF', '#1C1917', '#FF0000']) {
      const p = storePalette(brand, onBrand);
      expect(contrastRatio(p.accent, p.onAccent)).toBeGreaterThanOrEqual(AA_BODY);
      expect(contrastRatio(p.accentDeep, WHITE)).toBeGreaterThanOrEqual(AA_BODY);
      expect(contrastRatio(p.accentDeep, p.accentSoft)).toBeGreaterThanOrEqual(AA_BODY);
    }
  });

  it("keeps the store's own text colour when it reads", () => {
    expect(storePalette('#7A1F3D', '#ffffff')).toMatchObject({ accent: '#7A1F3D', onAccent: '#FFFFFF' });
    expect(storePalette('#F5D90A', '#FFFFFF').onAccent).toBe('#0F172A');
  });

  it('darkens a white brand until its buttons show on the page', () => {
    expect(contrastRatio(storePalette('#FFFFFF', '#1C1917').accent, WHITE)).toBeGreaterThanOrEqual(3);
  });

  it('falls back to the Shopping accent for a colour that is not a hex', () => {
    expect(storePalette('tomato', '#FFFFFF')).toEqual(SERVICE_PALETTES.light.shopping);
    expect(storePalette(null, null)).toEqual(SERVICE_PALETTES.light.shopping);
  });
});
