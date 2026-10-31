// Real MetroMatrix-API responses for a Food vendor's own setup and riders
// (captured from a local backend with three demo vendors, then scrubbed:
// tokens and passwords say "redacted") through the Food serializers.

import real from './fixtures/food/vendor.json';
import {
  closuresSerializer,
  feeBandsSerializer,
  foodCuisinesSerializer,
  foodVendorSessionSerializer,
  hoursSerializer,
  vendorPaymentAccountSerializer,
  vendorPlanSerializer,
  vendorProfileSerializer,
  vendorSettingsSerializer,
  vendorSetupSerializer,
} from '../food/vendorSerializer';
import { createdRiderSerializer, foodRiderSerializer, foodRidersSerializer, riderCredentialSerializer, riderHomeSerializer } from '../food/riderSerializer';
import { businessSerializer } from '../businessSerializer';
import { userSerializer } from '../authSerializer';

type Captured = Record<string, { status: number; body: { success: boolean; data?: any; error?: any } }>;
const R = real as unknown as Captured;
const data = (k: string) => R[k].body.data;
const error = (k: string) => R[k].body.error;

describe('the session', () => {
  it("reads a food vendor's business.food block", () => {
    expect(foodVendorSessionSerializer(data('resto.meAfter').business.food)).toEqual({
      brandId: 'c2a85152-5e67-4475-9f83-f6b0754afaa3',
      brandSlug: 'karachi-biryani-house-demo',
      branchStatus: 'draft',
      isLive: false,
      setupComplete: false,
    });
    expect(businessSerializer(data('resto.meAfter').business)?.food?.isLive).toBe(false);
  });

  it('reads a rider (no business, a placeholder email)', () => {
    const u = userSerializer(data('rider.signin').user);
    expect(u.role).toBe('rider');
    expect(data('rider.signin').business).toBeNull();
  });
});

describe('setup', () => {
  it('reads the checklist: required items, percent, what is missing', () => {
    const s = vendorSetupSerializer(data('resto.setupAfter'))!;
    expect(s.kind).toBe('restaurant');
    expect(s.items.map(i => i.key)).toEqual(['profile', 'location', 'hours', 'zones', 'payment']);
    expect(s).toMatchObject({ percent: 80, missing: ['profile'], ready: false, isLive: false });
  });

  it('adds the food-safety check for a home kitchen', () => {
    const s = vendorSetupSerializer(data('homek.setup'))!;
    expect(s.kind).toBe('home_kitchen');
    expect(s.items.map(i => i.key)).toContain('food_safety');
  });

  it('keeps the missing keys of a refused go-live', () => {
    expect(R['resto.goLive'].status).toBe(422);
    expect(error('resto.goLive')).toMatchObject({ code: 'PROFILE_INCOMPLETE', details: { missing: ['profile'] } });
  });
});

describe('profile and settings', () => {
  it('reads the brand, its cuisines and its branch', () => {
    const p = vendorProfileSerializer(data('resto.profilePatch'))!;
    expect(p).toMatchObject({ kind: 'restaurant', name: 'Karachi Biryani House (demo)', brandColor: '#B45309', onBrandColor: '#FFFFFF', priceLevel: 2 });
    expect(p.cuisines.map(c => c.slug)).toEqual(['pakistani', 'bbq']);
    expect(p.branch).toMatchObject({ status: 'draft', isLive: false, isPaused: false, busy: null });
    expect(p.branch.openState.label).toBe('Closed');
  });

  it('reads busy mode and the open state', () => {
    const p = vendorProfileSerializer(data('resto.busy'))!;
    expect(p.branch.busy).toMatchObject({ extraMinutes: 15, label: 'Busy until 10:07 PM (+15 min)' });
    expect(p.branch.openState).toMatchObject({ open: true, label: 'Open until 2:00 AM' });
    expect(vendorProfileSerializer(data('resto.pause'))!.branch.isPaused).toBe(true);
  });

  it('reads settings with the location', () => {
    const s = vendorSettingsSerializer(data('resto.settingsPatch'))!;
    expect(s).toMatchObject({ codLimit: 5000, maxRadiusKm: 6, freeDeliveryOver: 2500, acceptsPickup: true });
    expect(s.location).toMatchObject({ area: 'Gulberg III', lat: 31.5102, lng: 74.3441, timezone: 'Asia/Karachi' });
    expect(vendorSettingsSerializer(data('cloud.settings'))!.acceptsPickup).toBe(false);
  });

  it('reads cuisines', () => {
    const list = foodCuisinesSerializer(data('cuisines'));
    expect(list.length).toBeGreaterThanOrEqual(18);
    expect(list[0]).toMatchObject({ name: 'Pakistani', slug: 'pakistani', icon: 'pakistani' });
  });
});

describe('hours, zones, closures, accounts, plan', () => {
  it('reads hours with overnight ranges', () => {
    const h = hoursSerializer(data('resto.hoursPut'));
    expect(h[0]).toEqual({ weekday: 0, opensAt: '12:00', closesAt: '15:30', overnight: false });
    expect(h[1]).toEqual({ weekday: 0, opensAt: '18:00', closesAt: '02:00', overnight: true });
  });

  it('keeps the clash of an overlapping week', () => {
    expect(error('resto.hoursOverlap')).toMatchObject({ code: 'VALIDATION_FAILED', details: { conflict: [{ weekday: 1 }, { weekday: 1 }] } });
  });

  it('reads fee bands and a closure', () => {
    expect(feeBandsSerializer(data('resto.feeBandsPut'))).toEqual([
      { fromKm: 0, toKm: 3, fee: 99, minOrder: 500 },
      { fromKm: 3, toKm: 6, fee: 149, minOrder: 800 },
    ]);
    expect(closuresSerializer([data('resto.closurePost')])[0]).toMatchObject({ reason: 'Family wedding' });
  });

  it('reads a payment account in the app’s words', () => {
    expect(vendorPaymentAccountSerializer(data('resto.accountPost'))).toMatchObject({ kind: 'jazzcash', title: 'Imran Qureshi', number: '+923001110001', isActive: true });
  });

  it('reads the Community plan in rupees', () => {
    const p = vendorPlanSerializer(data('resto.plan'))!;
    expect(p).toMatchObject({ key: 'community', label: 'Community', price: 0 });
    expect(p.limits.riders).toBe(25);
    expect(p.usage.riders).toBe(0);
  });
});

describe('riders', () => {
  it('reads a new rider and the credential shown once', () => {
    const c = createdRiderSerializer(data('resto.riderCreate'))!;
    expect(c.rider).toMatchObject({ fullName: 'Ali Raza', vehicle: 'bike', status: 'active', onDuty: false, username: 'karachi-biryani-house-de.ali', lastPosition: null, locationLive: false });
    expect(c.credential.username).toBe('karachi-biryani-house-de.ali');
    expect(riderCredentialSerializer(data('resto.riderReset'))?.username).toBe('karachi-biryani-house-de.ali');
  });

  it('reads the list, a status change and an edit', () => {
    expect(foodRidersSerializer(data('resto.ridersAfter'))).toHaveLength(1);
    expect(foodRiderSerializer(data('resto.riderStatus'))?.status).toBe('on_leave');
    expect(foodRiderSerializer(data('resto.riderPatch'))?.vehicle).toBe('car');
  });

  it("reads the rider's own view: who they are and whom they deliver for", () => {
    const h = riderHomeSerializer(data('rider.me'))!;
    expect(h.rider.username).toBe('karachi-biryani-house-de.ali');
    expect(h.vendor).toMatchObject({ name: 'Karachi Biryani House (demo)', phone: '+923001110001', area: 'Gulberg III', city: 'Lahore' });
  });
});
