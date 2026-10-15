import { PixelRatio } from 'react-native';
import { cdn } from '../cdn';
import { discountPercent, formatPKR, parseRupees } from '../money';

describe('formatPKR', () => {
  it('groups thousands and never shows decimals', () => {
    expect(formatPKR(0)).toBe('Rs 0');
    expect(formatPKR(1250)).toBe('Rs 1,250');
    expect(formatPKR(1234567)).toBe('Rs 1,234,567');
    expect(formatPKR(999.6)).toBe('Rs 1,000');
    expect(formatPKR(-200)).toBe('−Rs 200');
    expect(formatPKR(Number.NaN)).toBe('Rs 0');
  });

  it('works out discounts and reads typed amounts', () => {
    expect(discountPercent(7190, 8990)).toBe(20);
    expect(discountPercent(8990, null)).toBe(0);
    expect(discountPercent(9000, 8990)).toBe(0);
    expect(parseRupees('Rs 2,500')).toBe(2500);
    expect(parseRupees('')).toBeNull();
  });
});

describe('cdn', () => {
  beforeEach(() => jest.spyOn(PixelRatio, 'get').mockReturnValue(2));
  afterEach(() => jest.restoreAllMocks());

  it('asks Cloudinary for the rendered size at the screen density', () => {
    expect(cdn('https://res.cloudinary.com/mm/image/upload/v1/products/a.jpg', { w: 160, h: 200 })).toBe(
      'https://res.cloudinary.com/mm/image/upload/f_auto,q_auto,w_320,h_400,c_fill,g_auto/v1/products/a.jpg',
    );
  });

  it('sizes Unsplash photos and leaves local files alone', () => {
    expect(cdn('https://images.unsplash.com/photo-1?ixid=abc', { w: 100, fit: 'fit' })).toBe(
      'https://images.unsplash.com/photo-1?w=200&fit=max&auto=format&q=70',
    );
    expect(cdn('file:///tmp/a.jpg', { w: 100 })).toBe('file:///tmp/a.jpg');
    expect(cdn(null, { w: 100 })).toBeNull();
  });

  it('caps the density at 3×', () => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(4);
    expect(cdn('https://images.unsplash.com/photo-1', { w: 100 })).toContain('w=300');
  });
});
