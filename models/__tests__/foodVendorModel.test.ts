import {
  bandsFromForm,
  brandPatch,
  rangeLabel,
  riderStatusLabel,
  riderVehicleLabel,
  settingsPatch,
  setupRoute,
  time12,
  validateFeeBands,
  validateHours,
  validateRider,
  validateVendorBrand,
  validateVendorSettings,
  type VendorBrandForm,
  type VendorSettingsForm,
} from '../food/vendorModel';
import { validateRiderSignIn } from '../authModel';

const brand = (over: Partial<VendorBrandForm> = {}): VendorBrandForm => ({
  name: 'Biryani Bazaar',
  tagline: '',
  logoUrl: 'https://res.cloudinary.com/x/logo.png',
  coverUrl: null,
  cuisineIds: ['cu_biryani'],
  priceLevel: 2,
  brandColor: '#B45309',
  ...over,
});

const settings = (over: Partial<VendorSettingsForm> = {}): VendorSettingsForm => ({
  acceptsDelivery: true,
  acceptsPickup: true,
  acceptsCod: true,
  codLimit: '5000',
  transferConfirmBeforePrep: true,
  autoRejectMinutes: 5,
  prepMinutes: '20',
  maxRadiusKm: '6',
  freeDeliveryOver: '',
  preorderOnly: false,
  addressLine: '12-C Main Boulevard',
  area: 'Gulberg III',
  city: 'Lahore',
  phone: '0300 1110001',
  lat: 31.51,
  lng: 74.34,
  ...over,
});

describe('the brand', () => {
  it('needs a logo, a cuisine (up to three) and a readable colour', () => {
    expect(validateVendorBrand(brand())).toEqual({});
    expect(validateVendorBrand(brand({ logoUrl: null }))).toHaveProperty('logoUrl');
    expect(validateVendorBrand(brand({ cuisineIds: [] }))).toHaveProperty('cuisineIds');
    expect(validateVendorBrand(brand({ cuisineIds: ['a', 'b', 'c', 'd'] }))).toHaveProperty('cuisineIds');
    expect(validateVendorBrand(brand({ brandColor: 'orange' }))).toHaveProperty('brandColor');
    expect(validateVendorBrand(brand({ brandColor: '#7A7A7A' }))).toHaveProperty('brandColor');
  });

  it('sends an empty tagline as null and the colour in capitals', () => {
    expect(brandPatch(brand({ tagline: '  ', brandColor: '#b45309' }))).toMatchObject({ tagline: null, brandColor: '#B45309' });
  });
});

describe('settings', () => {
  it('needs delivery or pick-up, sane minutes and a pin', () => {
    expect(validateVendorSettings(settings())).toEqual({});
    expect(validateVendorSettings(settings({ acceptsDelivery: false, acceptsPickup: false }))).toHaveProperty('fulfilment');
    expect(validateVendorSettings(settings({ prepMinutes: '2' }))).toHaveProperty('prepMinutes');
    expect(validateVendorSettings(settings({ maxRadiusKm: '60' }))).toHaveProperty('maxRadiusKm');
    expect(validateVendorSettings(settings({ lat: null }))).toHaveProperty('pin');
    expect(validateVendorSettings(settings({ phone: '12345' }))).toHaveProperty('phone');
  });

  it('sends numbers, an empty free-delivery threshold as null, and the pin rounded', () => {
    const p = settingsPatch(settings({ lat: 31.5102345678, lng: 74.3441987654 }));
    expect(p).toMatchObject({ codLimit: 5000, prepMinutes: 20, maxRadiusKm: 6, freeDeliveryOver: null, lat: 31.510235, lng: 74.344199 });
    expect(settingsPatch(settings({ acceptsCod: false }))).not.toHaveProperty('codLimit');
  });
});

describe('opening hours', () => {
  it('reads times the way people say them', () => {
    expect(time12('18:00')).toBe('6:00 PM');
    expect(time12('00:30')).toBe('12:30 AM');
    expect(time12('24:00')).toBe('midnight');
    expect(rangeLabel({ opensAt: '18:00', closesAt: '02:00' })).toBe('6:00 PM – 2:00 AM (next day)');
    expect(rangeLabel({ opensAt: '12:00', closesAt: '24:00' })).toBe('12:00 PM – midnight');
  });

  it('finds overlaps across the week, overnight ranges included', () => {
    expect(validateHours([{ weekday: 1, opensAt: '12:00', closesAt: '15:30' }, { weekday: 1, opensAt: '18:00', closesAt: '02:00' }])).toEqual({});
    expect(validateHours([{ weekday: 1, opensAt: '12:00', closesAt: '16:00' }, { weekday: 1, opensAt: '15:00', closesAt: '23:00' }])).toHaveProperty('overlap');
    // Monday night spills into Tuesday morning.
    expect(validateHours([{ weekday: 1, opensAt: '20:00', closesAt: '03:00' }, { weekday: 2, opensAt: '02:00', closesAt: '05:00' }])).toHaveProperty('overlap');
    // Saturday night wraps into Sunday.
    expect(validateHours([{ weekday: 6, opensAt: '20:00', closesAt: '03:00' }, { weekday: 0, opensAt: '02:00', closesAt: '05:00' }])).toHaveProperty('overlap');
    expect(validateHours([{ weekday: 3, opensAt: '12:00', closesAt: '12:00' }])).toHaveProperty(['3.0.closesAt']);
  });
});

describe('delivery fee bands', () => {
  it('starts at 0 km and follows on, within the delivery radius', () => {
    const rows = [
      { toKm: '3', fee: '99', minOrder: '500' },
      { toKm: '6', fee: '149', minOrder: '800' },
    ];
    expect(bandsFromForm(rows)).toEqual([
      { fromKm: 0, toKm: 3, fee: 99, minOrder: 500 },
      { fromKm: 3, toKm: 6, fee: 149, minOrder: 800 },
    ]);
    expect(validateFeeBands(rows, 6)).toEqual({});
    expect(validateFeeBands(rows, 5)).toHaveProperty(['1.toKm']);
    expect(validateFeeBands([{ toKm: '3', fee: '99', minOrder: '0' }, { toKm: '2', fee: '99', minOrder: '0' }], 6)).toHaveProperty(['1.toKm']);
    expect(validateFeeBands([], 6)).toHaveProperty('bands');
  });
});

describe('setup and riders', () => {
  it('sends each checklist step to its editor; the food-safety check is MetroMatrix’s', () => {
    expect(setupRoute('profile')).toEqual({ name: 'VendorBrand' });
    expect(setupRoute('zones')).toEqual({ name: 'VendorZones' });
    expect(setupRoute('menu')).toEqual({ name: 'VendorTabs', params: { screen: 'MenuTab' } });
    expect(setupRoute('food_safety')).toBeNull();
  });

  it('names riders’ vehicles and statuses, and checks a new rider', () => {
    expect(riderVehicleLabel('on_foot')).toBe('On foot');
    expect(riderVehicleLabel(null)).toBe('Motorbike');
    expect(riderStatusLabel('plan_locked')).toBe('Over your plan');
    expect(validateRider({ fullName: 'A', phone: null, vehicle: 'bike' })).toHaveProperty('fullName');
    expect(validateRider({ fullName: 'Ali Raza', phone: '0300 1234567', vehicle: 'bike' })).toEqual({});
    expect(validateRider({ fullName: 'Ali Raza', phone: '042 35761234', vehicle: 'bike' })).toHaveProperty('phone');
  });

  it('checks a rider’s sign-in: a username, not an email', () => {
    expect(validateRiderSignIn({ username: 'biryani-bazaar.ali', password: 'Metro2026' })).toEqual({});
    expect(validateRiderSignIn({ username: 'ali@x.com', password: 'Metro2026' })).toHaveProperty('username');
    expect(validateRiderSignIn({ username: 'biryani-bazaar.ali', password: '' })).toHaveProperty('password');
  });
});
