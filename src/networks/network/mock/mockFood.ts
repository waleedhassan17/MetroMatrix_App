// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Food catalogue (customer Food home)
// ═══════════════════════════════════════════════════════
// Static and fictional — any likeness to a real brand is accidental. Food
// Court launches with local fast-food brands first, then restaurants and
// home kitchens. Replaced wholesale by GET /food/home once the backend serves it.

export const MOCK_CUISINES = [
  { slug: 'burgers', name: 'Burgers' },
  { slug: 'pizza', name: 'Pizza' },
  { slug: 'fried-chicken', name: 'Fried Chicken' },
  { slug: 'shawarma', name: 'Shawarma' },
  { slug: 'bbq', name: 'BBQ' },
  { slug: 'pakistani', name: 'Pakistani' },
  { slug: 'desi-home', name: 'Home Food' },
  { slug: 'desserts', name: 'Desserts' },
];

export const MOCK_PROMOS = [
  { id: 'p1', title: '20% off your first order', subtitle: 'At any vendor in the Food Court.', code: 'METRO20' },
  { id: 'p2', title: 'Smash burger Fridays', subtitle: 'Up to 30% off at local burger brands.', code: null },
];

export const MOCK_KITCHENS = [
  {
    id: 'k1', name: 'Smash Street', kind: 'cloud_kitchen', cuisines: ['Burgers', 'Fried Chicken'], area: 'Gulberg',
    rating: 4.8, ratingCount: 3420, etaMin: 20, etaMax: 30, deliveryFee: 0, minOrder: 500, priceLevel: 2,
    distanceKm: 1.4, deal: '30% off', isNew: false,
  },
  {
    id: 'k2', name: 'Crunch Co.', kind: 'restaurant', cuisines: ['Fried Chicken', 'Burgers'], area: 'MM Alam Road',
    rating: 4.6, ratingCount: 2180, etaMin: 25, etaMax: 35, deliveryFee: 49, minOrder: 600, priceLevel: 2,
    distanceKm: 2.1, deal: 'Free fries', isNew: false,
  },
  {
    id: 'k3', name: 'Slice Republic', kind: 'cloud_kitchen', cuisines: ['Pizza'], area: 'DHA Phase 5',
    rating: 4.5, ratingCount: 1290, etaMin: 25, etaMax: 40, deliveryFee: 0, minOrder: 900, priceLevel: 2,
    distanceKm: 3.0, deal: 'Buy 1 get 1', isNew: false,
  },
  {
    id: 'k4', name: 'Shawarma Junction', kind: 'restaurant', cuisines: ['Shawarma'], area: 'Johar Town',
    rating: 4.4, ratingCount: 980, etaMin: 20, etaMax: 30, deliveryFee: 39, minOrder: 300, priceLevel: 1,
    distanceKm: 3.6, deal: null, isNew: true,
  },
  {
    id: 'k5', name: 'Karahi House', kind: 'restaurant', cuisines: ['Pakistani', 'BBQ'], area: 'Gulberg',
    rating: 4.7, ratingCount: 2310, etaMin: 30, etaMax: 40, deliveryFee: 0, minOrder: 600, priceLevel: 2,
    distanceKm: 1.8, deal: '20% off', isNew: false,
  },
  {
    id: 'k6', name: "Ammi's Kitchen", kind: 'home_kitchen', cuisines: ['Home Food', 'Pakistani'], area: 'Model Town',
    rating: 4.9, ratingCount: 412, etaMin: 35, etaMax: 50, deliveryFee: 79, minOrder: 400, priceLevel: 1,
    distanceKm: 3.2, deal: null, isNew: false,
  },
  {
    id: 'k7', name: 'Midnight Grill', kind: 'cloud_kitchen', cuisines: ['BBQ', 'Burgers'], area: 'Cantt',
    rating: 4.5, ratingCount: 760, etaMin: 25, etaMax: 35, deliveryFee: 49, minOrder: 500, priceLevel: 2,
    distanceKm: 4.4, deal: null, isNew: false,
  },
  {
    id: 'k8', name: "Nani's Daal Chawal", kind: 'home_kitchen', cuisines: ['Home Food'], area: 'Johar Town',
    rating: 4.8, ratingCount: 156, etaMin: 30, etaMax: 45, deliveryFee: 59, minOrder: 300, priceLevel: 1,
    distanceKm: 4.1, deal: '10% off', isNew: true,
  },
  {
    id: 'k9', name: 'Sweet Crumbs', kind: 'home_kitchen', cuisines: ['Desserts'], area: 'Garden Town',
    rating: 4.9, ratingCount: 238, etaMin: 40, etaMax: 60, deliveryFee: 99, minOrder: 600, priceLevel: 2,
    distanceKm: 4.8, deal: null, isNew: false,
  },
].map(k => ({ ...k, imageUrl: null }));
