// The owner's rule: every screen sits on pure white — in every service, inside
// a store, and behind the navigators (no grey default between screens).

import { SERVICE_NAMES } from '../services';
import { getTheme, navigationTheme, withGradientHeader, headerGradient } from '../theme';
import { storeTheme } from '../StoreBrandScope';

const WHITE = '#FFFFFF';

describe('screen ground', () => {
  it.each(SERVICE_NAMES)('%s screens are pure white', name => {
    const t = getTheme(name);
    expect(t.colors.canvas.toUpperCase()).toBe(WHITE);
    expect(t.colors.surface.toUpperCase()).toBe(WHITE);
    expect(navigationTheme(t).colors.background.toUpperCase()).toBe(WHITE);
  });

  it('a store page is pure white whatever its brand colour', () => {
    expect(storeTheme('#1C1917', '#FFFFFF').colors.canvas.toUpperCase()).toBe(WHITE);
  });

  it('only Shopping and Health wear the gradient page header; inside a store it is white', () => {
    const tones = Object.fromEntries(SERVICE_NAMES.map(n => [n, getTheme(n).header.tone]));
    expect(tones).toEqual({ shopping: 'gradient', healthcare: 'gradient', food: 'surface', neutral: 'surface' });
    expect(storeTheme('#C25100', '#FFFFFF').header.tone).toBe('surface');
  });

  it('Orders and the account pages wear the gradient header in their scope colour, on the same white', () => {
    const neutral = withGradientHeader(getTheme('neutral'));
    expect(neutral.header).toEqual({ tone: 'gradient', gradient: headerGradient('neutral') });
    expect(neutral.colors.canvas.toUpperCase()).toBe(WHITE);
    // Cached, so styles memoise; a gradient theme is returned as it is.
    expect(withGradientHeader(getTheme('neutral'))).toBe(neutral);
    expect(withGradientHeader(getTheme('shopping'))).toBe(getTheme('shopping'));
  });

  it('Health is the clinical scale: body 15, touch 48, text to 150%', () => {
    const h = getTheme('healthcare');
    expect(h.type.body.fontSize).toBeGreaterThanOrEqual(15);
    expect(h.type.small.fontSize).toBeGreaterThanOrEqual(14);
    expect(h.size.touch).toBeGreaterThanOrEqual(48);
    expect(h.maxFontScale).toBe(1.5);
    expect(getTheme('shopping').maxFontScale).toBe(1.3);
  });
});
