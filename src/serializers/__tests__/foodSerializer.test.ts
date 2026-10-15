import { foodHomeSerializer, kitchenSerializer } from '../foodSerializer';

describe('foodSerializer', () => {
  it('drops kitchens with no id or name and defaults the rest', () => {
    const home = foodHomeSerializer({
      area: 'Gulberg, Lahore',
      promos: [{ id: 'p', title: 'Free delivery' }, { title: 'no id' }],
      cuisines: [{ slug: 'burgers', name: 'Burgers' }, { name: 'no slug' }],
      kitchens: [{ id: 'k1', name: 'Smash Street' }, { id: 'k2' }, null],
    });
    expect(home.promos).toHaveLength(1);
    expect(home.cuisines).toEqual([{ slug: 'burgers', name: 'Burgers' }]);
    expect(home.kitchens).toHaveLength(1);
    expect(home.kitchens[0]).toMatchObject({ kind: 'restaurant', etaMin: 30, etaMax: 40, priceLevel: 1, deal: null });
  });

  it('clamps out-of-range values and reads numbers sent as strings', () => {
    const kitchen = kitchenSerializer({
      _id: 'k',
      name: 'X',
      subType: 'home_kitchen',
      rating: '7',
      etaMin: '30',
      etaMax: 10,
      priceLevel: 5,
      deliveryFee: -5,
    });
    expect(kitchen).toMatchObject({ id: 'k', kind: 'home_kitchen', rating: 5, etaMin: 30, etaMax: 30, priceLevel: 3, deliveryFee: 0 });
  });

  it('tolerates garbage', () => {
    expect(foodHomeSerializer(null)).toEqual({ area: '', promos: [], cuisines: [], kitchens: [] });
  });
});
