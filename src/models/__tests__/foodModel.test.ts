import { filterKitchens, formatDeliveryFee, formatEta, formatRatingCount, priceLevelLabel } from '../foodModel';
import type { Kitchen } from '../../types/food';

const k = (over: Partial<Kitchen>): Kitchen => ({
  id: 'k',
  name: 'Smash Street',
  kind: 'cloud_kitchen',
  cuisines: ['Burgers'],
  area: 'Gulberg',
  rating: 4.8,
  ratingCount: 3420,
  etaMin: 20,
  etaMax: 30,
  deliveryFee: 0,
  minOrder: 500,
  priceLevel: 2,
  distanceKm: 1.4,
  deal: null,
  isNew: false,
  imageUrl: null,
  ...over,
});

describe('filterKitchens', () => {
  const list = [k({ id: 'a' }), k({ id: 'b', name: 'Karahi House', cuisines: ['Pakistani', 'BBQ'], area: 'Model Town' })];
  it('matches name, cuisine or area, case-insensitively', () => {
    expect(filterKitchens(list, { query: 'karahi', cuisine: null }).map(x => x.id)).toEqual(['b']);
    expect(filterKitchens(list, { query: 'bbq', cuisine: null }).map(x => x.id)).toEqual(['b']);
    expect(filterKitchens(list, { query: 'gulberg', cuisine: null }).map(x => x.id)).toEqual(['a']);
  });
  it('the cuisine chip narrows, and combines with search', () => {
    expect(filterKitchens(list, { query: '', cuisine: 'Burgers' }).map(x => x.id)).toEqual(['a']);
    expect(filterKitchens(list, { query: 'karahi', cuisine: 'Burgers' })).toEqual([]);
  });
  it('no filters returns everything', () => {
    expect(filterKitchens(list, { query: '  ', cuisine: null })).toHaveLength(2);
  });
});

describe('food formatting', () => {
  it('formats eta, fee, price band and counts', () => {
    expect(formatEta({ etaMin: 20, etaMax: 30 })).toBe('20–30 min');
    expect(formatEta({ etaMin: 25, etaMax: 25 })).toBe('25 min');
    expect(formatDeliveryFee(0)).toBe('Free delivery');
    expect(formatDeliveryFee(49)).toBe('Rs 49 delivery');
    expect(priceLevelLabel(3)).toBe('Rs Rs Rs');
    expect(priceLevelLabel(9)).toBe('Rs Rs Rs');
    expect(formatRatingCount(3420)).toBe('3.4k');
    expect(formatRatingCount(2000)).toBe('2k');
    expect(formatRatingCount(412)).toBe('412');
  });
});
