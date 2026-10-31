// The dummy Food API, driven through the REAL Food networks — a vendor's own
// setup and riders, as the API answers them: the go-live checklist and its
// two refusals, the open state, hours overlaps, fee bands, brand contrast,
// all-or-nothing writes, and riders (username once, sign-in by username,
// deactivation and resets ending sessions).

import { getVendorSetupAPI, goLiveAPI } from '../../../food/vendor/setupNetwork';
import { getCuisinesAPI, getVendorProfileAPI, pauseOrdersAPI, resumeOrdersAPI, setBusyAPI, updateVendorProfileAPI } from '../../../food/vendor/profileNetwork';
import {
  addClosureAPI,
  createVendorPaymentAccountAPI,
  getClosuresAPI,
  getHoursAPI,
  getVendorSettingsAPI,
  saveFeeBandsAPI,
  saveHoursAPI,
  updateVendorSettingsAPI,
} from '../../../food/vendor/settingsNetwork';
import { createRiderAPI, getRidersAPI, resetRiderPasswordAPI, setRiderStatusAPI, updateRiderAPI } from '../../../food/vendor/ridersNetwork';
import { getVendorPlanAPI } from '../../../food/vendor/planNetwork';
import { getRiderHomeAPI } from '../../../food/rider/riderNetwork';
import { ApiError, required } from '../../apiHelpers';
import { clearTokens } from '../../../../utils/storage_utils/storageUtils';
import { getDb, resetMockDb } from '../mockDb';
import { currentSession, signInAs, installDummyApi } from '../testing';
import { vendorSetupSerializer, vendorProfileSerializer, foodCuisinesSerializer, hoursSerializer, feeBandsSerializer, closuresSerializer, closureResponseSerializer, vendorPaymentAccountSerializer, vendorSettingsSerializer, vendorPlanSerializer } from '../../../../serializers/food/vendorSerializer';
import { createdRiderSerializer, foodRidersSerializer, riderHomeSerializer, foodRiderSerializer, riderCredentialSerializer } from '../../../../serializers/food/riderSerializer';

installDummyApi();

// Thursday 15 October 2026, 3 PM in Pakistan.
const T0 = new Date('2026-10-15T10:00:00Z').getTime();

const failure = async (p: Promise<unknown>): Promise<ApiError> => {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected the call to fail');
};

const signInVendor = async (email: string) => {
  await clearTokens();
  await signInAs(email);
};

// Passwords and wrong-door answers are the real API's (its sign-in); here a
// rider is simply signed in by username.
const signInRider = async (username: string) => {
  await clearTokens();
  return signInAs(username);
};

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());

beforeEach(async () => {
  jest.setSystemTime(T0);
  await resetMockDb();
});

describe('the session', () => {
  it("says which brand a vendor is and whether it is live", async () => {
    await signInVendor('restaurant@metromatrix.app');
    const me = await currentSession();
    expect(me.business?.food).toMatchObject({ brandSlug: 'biryani-bazaar', isLive: true, setupComplete: true });
    await signInVendor('homekitchen@metromatrix.app');
    expect((await currentSession()).business?.food).toMatchObject({ isLive: false, setupComplete: false });
  });

  it('refuses a vendor route to a partner of another service', async () => {
    await clearTokens();
    await signInAs('derm@metromatrix.app');
    expect((await failure(getVendorSetupAPI().then(raw => required(vendorSetupSerializer(raw))))).code).toBe('WRONG_SERVICE');
  });
});

describe('going live', () => {
  it('a home kitchen that is set up waits for the food-safety check', async () => {
    await signInVendor('homekitchen@metromatrix.app');
    const s = required(vendorSetupSerializer(await getVendorSetupAPI()));
    expect(s.kind).toBe('home_kitchen');
    expect(s.missing).toEqual(['food_safety']);
    expect((await failure(goLiveAPI().then(() => true as const))).code).toBe('FOOD_SAFETY_CHECK_REQUIRED');
  });

  it('a kitchen missing a step is told which, then goes live once it is done', async () => {
    const db = await getDb();
    const v = db.food.vendors.find(x => x.slug === 'smash-lab')!;
    v.status = 'draft';
    v.hours = [];
    await signInVendor('cloudkitchen@metromatrix.app');
    const e = await failure(goLiveAPI().then(() => true as const));
    expect(e.code).toBe('PROFILE_INCOMPLETE');
    expect(e.details?.missing).toEqual(['hours']);
    await saveHoursAPI([{ weekday: 5, opensAt: '18:00', closesAt: '02:00' }]);
    await goLiveAPI();
    expect((required(vendorSetupSerializer(await getVendorSetupAPI()))).isLive).toBe(true);
    expect((await currentSession()).business?.food?.isLive).toBe(true);
  });

  it('zones are not required when the kitchen only does pick-up', async () => {
    await signInVendor('restaurant@metromatrix.app');
    await updateVendorSettingsAPI({ acceptsDelivery: false, acceptsPickup: true });
    const s = required(vendorSetupSerializer(await getVendorSetupAPI()));
    expect(s.items.find(i => i.key === 'zones')).toMatchObject({ required: false });
    expect(s.items.some(i => i.key === 'food_safety')).toBe(false);
  });
});

describe('profile, open state, pause and busy', () => {
  it("is open by the week's hours, overnight included, and closed when paused", async () => {
    await signInVendor('restaurant@metromatrix.app');
    // 3 PM: lunch runs 12:00–15:30.
    expect((required(vendorProfileSerializer(await getVendorProfileAPI()))).branch.openState).toMatchObject({ open: true, label: 'Open until 3:30 PM' });
    // 4 PM: dinner opens at 6.
    jest.setSystemTime(T0 + 3_600_000);
    expect((required(vendorProfileSerializer(await getVendorProfileAPI()))).branch.openState).toMatchObject({ open: false, label: 'Opens 6:00 PM' });
    // 1 AM on Friday: Thursday's dinner runs past midnight.
    jest.setSystemTime(new Date('2026-10-15T20:00:00Z').getTime());
    expect((required(vendorProfileSerializer(await getVendorProfileAPI()))).branch.openState).toMatchObject({ open: true, label: 'Open until 2:00 AM' });
    const paused = required(vendorProfileSerializer(await pauseOrdersAPI('Back after Jumma')));
    expect(paused.branch.openState).toMatchObject({ open: false, paused: true, label: 'Back after Jumma' });
    expect((required(vendorProfileSerializer(await resumeOrdersAPI()))).branch.isPaused).toBe(false);
  });

  it('busy mode adds minutes for up to 6 hours, and 0 clears it', async () => {
    await signInVendor('restaurant@metromatrix.app');
    const busy = required(vendorProfileSerializer(await setBusyAPI(15, null)));
    expect(busy.branch.busy).toMatchObject({ extraMinutes: 15, label: 'Busy until 4:00 PM (+15 min)' });
    expect((await failure(setBusyAPI(15, new Date(T0 + 7 * 3_600_000).toISOString()).then(raw => required(vendorProfileSerializer(raw))))).code).toBe('VALIDATION_FAILED');
    expect((required(vendorProfileSerializer(await setBusyAPI(0, null)))).branch.busy).toBeNull();
  });

  it('refuses a brand colour text cannot be read on, and more than three cuisines', async () => {
    await signInVendor('restaurant@metromatrix.app');
    expect((await failure(updateVendorProfileAPI({ brandColor: '#7A7A7A' }).then(raw => required(vendorProfileSerializer(raw))))).details?.fields).toHaveProperty('brandColor');
    const ids = (required(foodCuisinesSerializer(await getCuisinesAPI()))).slice(0, 4).map(c => c.id);
    expect((await failure(updateVendorProfileAPI({ cuisineIds: ids }).then(raw => required(vendorProfileSerializer(raw))))).code).toBe('VALIDATION_FAILED');
    const p = required(vendorProfileSerializer(await updateVendorProfileAPI({ brandColor: '#7c2d12', cuisineIds: ids.slice(0, 2) })));
    expect(p).toMatchObject({ brandColor: '#7C2D12', onBrandColor: '#FFFFFF' });
    expect(p.cuisines.map(c => c.id)).toEqual(ids.slice(0, 2));
  });
});

describe('hours, zones, closures and accounts', () => {
  it('refuses overlapping ranges, naming the clash, and changes nothing', async () => {
    await signInVendor('restaurant@metromatrix.app');
    const before = required(hoursSerializer(await getHoursAPI()));
    const e = await failure(
      saveHoursAPI([
        { weekday: 1, opensAt: '12:00', closesAt: '16:00' },
        { weekday: 1, opensAt: '15:00', closesAt: '23:00' },
      ]).then(raw => required(hoursSerializer(raw))),
    );
    expect(e.code).toBe('VALIDATION_FAILED');
    expect(e.details?.conflict).toEqual([
      { weekday: 1, opens: 720, closes: 960 },
      { weekday: 1, opens: 900, closes: 1380 },
    ]);
    expect(required(hoursSerializer(await getHoursAPI()))).toEqual(before);
    // Saturday night into Sunday morning clashes with an early Sunday range.
    expect(
      (await failure(saveHoursAPI([{ weekday: 6, opensAt: '20:00', closesAt: '03:00' }, { weekday: 0, opensAt: '02:00', closesAt: '05:00' }]).then(raw => required(hoursSerializer(raw))))).code,
    ).toBe('VALIDATION_FAILED');
  });

  it('takes fee bands only from 0 km, back to back', async () => {
    await signInVendor('restaurant@metromatrix.app');
    expect((await failure(saveFeeBandsAPI([{ fromKm: 1, toKm: 3, fee: 99, minOrder: 0 }]).then(raw => required(feeBandsSerializer(raw))))).message).toBe('The first band starts at 0 km.');
    expect(
      (await failure(saveFeeBandsAPI([{ fromKm: 0, toKm: 2, fee: 99, minOrder: 0 }, { fromKm: 3, toKm: 5, fee: 149, minOrder: 0 }]).then(raw => required(feeBandsSerializer(raw))))).message,
    ).toBe('Bands must follow on from each other with no gaps.');
    expect(required(feeBandsSerializer(await saveFeeBandsAPI([{ fromKm: 0, toKm: 2, fee: 50, minOrder: 300 }])))).toHaveLength(1);
  });

  it('keeps upcoming closures only, and refuses one that is over', async () => {
    await signInVendor('restaurant@metromatrix.app');
    await addClosureAPI({ startsAt: '2026-12-24T19:00:00.000Z', endsAt: '2026-12-25T19:00:00.000Z', reason: 'Family wedding' });
    expect((required(closuresSerializer(await getClosuresAPI()))).map(c => c.reason)).toEqual(['Family wedding']);
    expect((await failure(addClosureAPI({ startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-10-02T00:00:00.000Z', reason: null }).then(raw => required(closureResponseSerializer(raw))))).code).toBe(
      'VALIDATION_FAILED',
    );
  });

  it('normalises a wallet number and refuses the same account twice', async () => {
    await signInVendor('cloudkitchen@metromatrix.app');
    const a = required(vendorPaymentAccountSerializer(await createVendorPaymentAccountAPI({ kind: 'easypaisa', title: 'Faraz Ahmed', number: '0300 1110003', bankName: null, isActive: true })));
    expect(a.number).toBe('+923001110003');
    expect((await failure(createVendorPaymentAccountAPI({ kind: 'easypaisa', title: 'Faraz', number: '+923001110003', bankName: null, isActive: true }).then(raw => required(vendorPaymentAccountSerializer(raw))))).code).toBe('CONFLICT');
    expect((await failure(createVendorPaymentAccountAPI({ kind: 'bank', title: 'Faraz', number: 'PK36SCBL0000001123456703', bankName: 'SCB', isActive: true }).then(raw => required(vendorPaymentAccountSerializer(raw))))).message).toMatch(
      /check digits/,
    );
  });

  it('saves the pin with the address', async () => {
    await signInVendor('restaurant@metromatrix.app');
    const s = required(vendorSettingsSerializer(await updateVendorSettingsAPI({ lat: 31.52, lng: 74.35, phone: '042 35761234' })));
    expect(s.location).toMatchObject({ lat: 31.52, lng: 74.35, phone: '+924235761234' });
    expect((await failure(updateVendorSettingsAPI({ lat: 31.5 } as never).then(raw => required(vendorSettingsSerializer(raw))))).code).toBe('VALIDATION_FAILED');
    expect((required(vendorSettingsSerializer(await getVendorSettingsAPI()))).location.lat).toBe(31.52);
  });
});

describe('riders', () => {
  it("issues a username and a password once; the rider's app then works", async () => {
    await signInVendor('restaurant@metromatrix.app');
    const { rider, credential } = required(createdRiderSerializer(await createRiderAPI({ fullName: 'Kamran Shah', phone: '0301 2345678', vehicle: 'bike' })));
    expect(credential.username).toBe('biryani-bazaar.kamran');
    expect(credential.password).toMatch(/^[A-Za-z2-9]{10}$/);
    expect(rider).toMatchObject({ phone: '+923012345678', status: 'active', onDuty: false });
    expect((required(foodRidersSerializer(await getRidersAPI()))).map(r => r.username)).toContain('biryani-bazaar.kamran');
    // A second Kamran gets the next free name.
    expect((required(createdRiderSerializer(await createRiderAPI({ fullName: 'Kamran Ali', phone: null, vehicle: null })))).credential.username).toBe('biryani-bazaar.kamran2');
    expect((required(vendorPlanSerializer(await getVendorPlanAPI()))).usage.riders).toBe(3);

    await signInRider(credential.username);
    const home = required(riderHomeSerializer(await getRiderHomeAPI()));
    expect(home.rider.fullName).toBe('Kamran Shah');
    expect(home.vendor).toMatchObject({ name: 'Biryani Bazaar', area: 'Gulberg III' });
  });

  it('a rider on leave is signed out and cannot use rider routes; reactivating lets them back', async () => {
    await signInRider('biryani-bazaar.ali');
    expect((required(riderHomeSerializer(await getRiderHomeAPI()))).rider.username).toBe('biryani-bazaar.ali');
    await signInVendor('restaurant@metromatrix.app');
    expect((required(foodRiderSerializer(await setRiderStatusAPI('rd_ali', 'on_leave')))).status).toBe('on_leave');
    const db = await getDb();
    expect(Object.values(db.access).some(s => s.userId === 'u_rider_ali')).toBe(false);
    await signInRider('biryani-bazaar.ali');
    expect((await failure(getRiderHomeAPI().then(raw => required(riderHomeSerializer(raw))))).code).toBe('RIDER_INACTIVE');
    await signInVendor('restaurant@metromatrix.app');
    await setRiderStatusAPI('rd_ali', 'active');
    await signInRider('biryani-bazaar.ali');
    expect((required(riderHomeSerializer(await getRiderHomeAPI()))).rider.status).toBe('active');
  });

  it('a reset gives a new password and signs the rider out', async () => {
    await signInRider('biryani-bazaar.ali');
    await signInVendor('restaurant@metromatrix.app');
    const c = required(riderCredentialSerializer(await resetRiderPasswordAPI('rd_ali')));
    expect(c.username).toBe('biryani-bazaar.ali');
    expect(c.password).toMatch(/^[A-Za-z2-9]{10}$/);
    const db = await getDb();
    expect(Object.values(db.access).some(s => s.userId === 'u_rider_ali')).toBe(false);
  });

  it("edits a rider's vehicle and phone, and hides another vendor's riders", async () => {
    await signInVendor('restaurant@metromatrix.app');
    expect((required(foodRiderSerializer(await updateRiderAPI('rd_ali', { vehicle: 'car', phone: '03009998877' })))).vehicle).toBe('car');
    await signInVendor('cloudkitchen@metromatrix.app');
    expect(required(foodRidersSerializer(await getRidersAPI()))).toEqual([]);
    expect((await failure(updateRiderAPI('rd_ali', { vehicle: 'bike' }).then(raw => required(foodRiderSerializer(raw))))).code).toBe('NOT_FOUND');
  });
});
