// The dummy Food API, driven through the REAL Food networks — a vendor's own
// setup and riders, as the API answers them: the go-live checklist and its
// two refusals, the open state, hours overlaps, fee bands, brand contrast,
// all-or-nothing writes, and riders (username once, sign-in by username,
// deactivation and resets ending sessions).

import { authMe, authSignin } from '../../../auth/authNetwork';
import { getVendorSetup, goLive } from '../../../food/vendor/setupNetwork';
import { getCuisines, getVendorProfile, pauseOrders, resumeOrders, setBusy, updateVendorProfile } from '../../../food/vendor/profileNetwork';
import {
  addClosure,
  createVendorPaymentAccount,
  getClosures,
  getHours,
  getVendorSettings,
  saveFeeBands,
  saveHours,
  updateVendorSettings,
} from '../../../food/vendor/settingsNetwork';
import { createRider, listRiders, resetRiderPassword, setRiderStatus, updateRider } from '../../../food/vendor/ridersNetwork';
import { getVendorPlan } from '../../../food/vendor/planNetwork';
import { getRiderHome } from '../../../food/rider/riderNetwork';
import { AuthError } from '../../apiHelpers';
import { clearTokens } from '../../../../utils/storageUtils';
import { SEED_PASSWORD } from '../mockConfig';
import { getDb, resetMockDb } from '../mockDb';

// Thursday 15 October 2026, 3 PM in Pakistan.
const T0 = new Date('2026-10-15T10:00:00Z').getTime();

const failure = async (p: Promise<unknown>): Promise<AuthError> => {
  try {
    await p;
  } catch (e) {
    return e as AuthError;
  }
  throw new Error('expected the call to fail');
};

const signInVendor = async (email: string) => {
  await clearTokens();
  await authSignin({ email, password: SEED_PASSWORD, portal: 'partner' });
};

const signInRider = async (username: string, password = SEED_PASSWORD) => {
  await clearTokens();
  return authSignin({ username, password, portal: 'partner' });
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
    const me = await authMe();
    expect(me.business?.food).toMatchObject({ brandSlug: 'biryani-bazaar', isLive: true, setupComplete: true });
    await signInVendor('homekitchen@metromatrix.app');
    expect((await authMe()).business?.food).toMatchObject({ isLive: false, setupComplete: false });
  });

  it('refuses a vendor route to a partner of another service', async () => {
    await clearTokens();
    await authSignin({ email: 'derm@metromatrix.app', password: SEED_PASSWORD, portal: 'partner' });
    expect((await failure(getVendorSetup())).code).toBe('WRONG_SERVICE');
  });
});

describe('going live', () => {
  it('a home kitchen that is set up waits for the food-safety check', async () => {
    await signInVendor('homekitchen@metromatrix.app');
    const s = await getVendorSetup();
    expect(s.kind).toBe('home_kitchen');
    expect(s.missing).toEqual(['food_safety']);
    expect((await failure(goLive())).code).toBe('FOOD_SAFETY_CHECK_REQUIRED');
  });

  it('a kitchen missing a step is told which, then goes live once it is done', async () => {
    const db = await getDb();
    const v = db.food.vendors.find(x => x.slug === 'smash-lab')!;
    v.status = 'draft';
    v.hours = [];
    await signInVendor('cloudkitchen@metromatrix.app');
    const e = await failure(goLive());
    expect(e.code).toBe('PROFILE_INCOMPLETE');
    expect(e.details?.missing).toEqual(['hours']);
    await saveHours([{ weekday: 5, opensAt: '18:00', closesAt: '02:00' }]);
    await goLive();
    expect((await getVendorSetup()).isLive).toBe(true);
    expect((await authMe()).business?.food?.isLive).toBe(true);
  });

  it('zones are not required when the kitchen only does pick-up', async () => {
    await signInVendor('restaurant@metromatrix.app');
    await updateVendorSettings({ acceptsDelivery: false, acceptsPickup: true });
    const s = await getVendorSetup();
    expect(s.items.find(i => i.key === 'zones')).toMatchObject({ required: false });
    expect(s.items.some(i => i.key === 'food_safety')).toBe(false);
  });
});

describe('profile, open state, pause and busy', () => {
  it("is open by the week's hours, overnight included, and closed when paused", async () => {
    await signInVendor('restaurant@metromatrix.app');
    // 3 PM: lunch runs 12:00–15:30.
    expect((await getVendorProfile()).branch.openState).toMatchObject({ open: true, label: 'Open until 3:30 PM' });
    // 4 PM: dinner opens at 6.
    jest.setSystemTime(T0 + 3_600_000);
    expect((await getVendorProfile()).branch.openState).toMatchObject({ open: false, label: 'Opens 6:00 PM' });
    // 1 AM on Friday: Thursday's dinner runs past midnight.
    jest.setSystemTime(new Date('2026-10-15T20:00:00Z').getTime());
    expect((await getVendorProfile()).branch.openState).toMatchObject({ open: true, label: 'Open until 2:00 AM' });
    const paused = await pauseOrders('Back after Jumma');
    expect(paused.branch.openState).toMatchObject({ open: false, paused: true, label: 'Back after Jumma' });
    expect((await resumeOrders()).branch.isPaused).toBe(false);
  });

  it('busy mode adds minutes for up to 6 hours, and 0 clears it', async () => {
    await signInVendor('restaurant@metromatrix.app');
    const busy = await setBusy(15, null);
    expect(busy.branch.busy).toMatchObject({ extraMinutes: 15, label: 'Busy until 4:00 PM (+15 min)' });
    expect((await failure(setBusy(15, new Date(T0 + 7 * 3_600_000).toISOString()))).code).toBe('VALIDATION_FAILED');
    expect((await setBusy(0, null)).branch.busy).toBeNull();
  });

  it('refuses a brand colour text cannot be read on, and more than three cuisines', async () => {
    await signInVendor('restaurant@metromatrix.app');
    expect((await failure(updateVendorProfile({ brandColor: '#7A7A7A' }))).details?.fields).toHaveProperty('brandColor');
    const ids = (await getCuisines()).slice(0, 4).map(c => c.id);
    expect((await failure(updateVendorProfile({ cuisineIds: ids }))).code).toBe('VALIDATION_FAILED');
    const p = await updateVendorProfile({ brandColor: '#7c2d12', cuisineIds: ids.slice(0, 2) });
    expect(p).toMatchObject({ brandColor: '#7C2D12', onBrandColor: '#FFFFFF' });
    expect(p.cuisines.map(c => c.id)).toEqual(ids.slice(0, 2));
  });
});

describe('hours, zones, closures and accounts', () => {
  it('refuses overlapping ranges, naming the clash, and changes nothing', async () => {
    await signInVendor('restaurant@metromatrix.app');
    const before = await getHours();
    const e = await failure(
      saveHours([
        { weekday: 1, opensAt: '12:00', closesAt: '16:00' },
        { weekday: 1, opensAt: '15:00', closesAt: '23:00' },
      ]),
    );
    expect(e.code).toBe('VALIDATION_FAILED');
    expect(e.details?.conflict).toEqual([
      { weekday: 1, opens: 720, closes: 960 },
      { weekday: 1, opens: 900, closes: 1380 },
    ]);
    expect(await getHours()).toEqual(before);
    // Saturday night into Sunday morning clashes with an early Sunday range.
    expect(
      (await failure(saveHours([{ weekday: 6, opensAt: '20:00', closesAt: '03:00' }, { weekday: 0, opensAt: '02:00', closesAt: '05:00' }]))).code,
    ).toBe('VALIDATION_FAILED');
  });

  it('takes fee bands only from 0 km, back to back', async () => {
    await signInVendor('restaurant@metromatrix.app');
    expect((await failure(saveFeeBands([{ fromKm: 1, toKm: 3, fee: 99, minOrder: 0 }]))).message).toBe('The first band starts at 0 km.');
    expect(
      (await failure(saveFeeBands([{ fromKm: 0, toKm: 2, fee: 99, minOrder: 0 }, { fromKm: 3, toKm: 5, fee: 149, minOrder: 0 }]))).message,
    ).toBe('Bands must follow on from each other with no gaps.');
    expect(await saveFeeBands([{ fromKm: 0, toKm: 2, fee: 50, minOrder: 300 }])).toHaveLength(1);
  });

  it('keeps upcoming closures only, and refuses one that is over', async () => {
    await signInVendor('restaurant@metromatrix.app');
    await addClosure({ startsAt: '2026-12-24T19:00:00.000Z', endsAt: '2026-12-25T19:00:00.000Z', reason: 'Family wedding' });
    expect((await getClosures()).map(c => c.reason)).toEqual(['Family wedding']);
    expect((await failure(addClosure({ startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-10-02T00:00:00.000Z', reason: null }))).code).toBe(
      'VALIDATION_FAILED',
    );
  });

  it('normalises a wallet number and refuses the same account twice', async () => {
    await signInVendor('cloudkitchen@metromatrix.app');
    const a = await createVendorPaymentAccount({ kind: 'easypaisa', title: 'Faraz Ahmed', number: '0300 1110003', bankName: null, isActive: true });
    expect(a.number).toBe('+923001110003');
    expect((await failure(createVendorPaymentAccount({ kind: 'easypaisa', title: 'Faraz', number: '+923001110003', bankName: null, isActive: true }))).code).toBe('CONFLICT');
    expect((await failure(createVendorPaymentAccount({ kind: 'bank', title: 'Faraz', number: 'PK36SCBL0000001123456703', bankName: 'SCB', isActive: true }))).message).toMatch(
      /check digits/,
    );
  });

  it('saves the pin with the address', async () => {
    await signInVendor('restaurant@metromatrix.app');
    const s = await updateVendorSettings({ lat: 31.52, lng: 74.35, phone: '042 35761234' });
    expect(s.location).toMatchObject({ lat: 31.52, lng: 74.35, phone: '+924235761234' });
    expect((await failure(updateVendorSettings({ lat: 31.5 } as never))).code).toBe('VALIDATION_FAILED');
    expect((await getVendorSettings()).location.lat).toBe(31.52);
  });
});

describe('riders', () => {
  it('issues a username and a password once; the rider signs in with them', async () => {
    await signInVendor('restaurant@metromatrix.app');
    const { rider, credential } = await createRider({ fullName: 'Kamran Shah', phone: '0301 2345678', vehicle: 'bike' });
    expect(credential.username).toBe('biryani-bazaar.kamran');
    expect(credential.password).toMatch(/^[A-Za-z2-9]{10}$/);
    expect(rider).toMatchObject({ phone: '+923012345678', status: 'active', onDuty: false });
    expect((await listRiders()).map(r => r.username)).toContain('biryani-bazaar.kamran');
    // A second Kamran gets the next free name.
    expect((await createRider({ fullName: 'Kamran Ali', phone: null, vehicle: null })).credential.username).toBe('biryani-bazaar.kamran2');
    expect((await getVendorPlan()).usage.riders).toBe(3);

    const outcome = await signInRider(credential.username, credential.password);
    expect(outcome.kind).toBe('session');
    const home = await getRiderHome();
    expect(home.rider.fullName).toBe('Kamran Shah');
    expect(home.vendor).toMatchObject({ name: 'Biryani Bazaar', area: 'Gulberg III' });
  });

  it("refuses a rider on the customer side, and a wrong password by username", async () => {
    await clearTokens();
    expect((await failure(authSignin({ username: 'biryani-bazaar.ali', password: SEED_PASSWORD, portal: 'customer' }))).code).toBe('WRONG_PORTAL');
    expect((await failure(signInRider('biryani-bazaar.ali', 'Wrong2026'))).message).toBe('Incorrect username or password.');
  });

  it('a rider on leave is signed out and cannot use rider routes; reactivating lets them back', async () => {
    await signInRider('biryani-bazaar.ali');
    expect((await getRiderHome()).rider.username).toBe('biryani-bazaar.ali');
    await signInVendor('restaurant@metromatrix.app');
    expect((await setRiderStatus('rd_ali', 'on_leave')).status).toBe('on_leave');
    const db = await getDb();
    expect(Object.values(db.access).some(s => s.userId === 'u_rider_ali')).toBe(false);
    await signInRider('biryani-bazaar.ali');
    expect((await failure(getRiderHome())).code).toBe('RIDER_INACTIVE');
    await signInVendor('restaurant@metromatrix.app');
    await setRiderStatus('rd_ali', 'active');
    await signInRider('biryani-bazaar.ali');
    expect((await getRiderHome()).rider.status).toBe('active');
  });

  it('a reset gives a new password and ends the old one', async () => {
    await signInVendor('restaurant@metromatrix.app');
    const c = await resetRiderPassword('rd_ali');
    expect(c.username).toBe('biryani-bazaar.ali');
    await clearTokens();
    expect((await failure(signInRider('biryani-bazaar.ali'))).code).toBe('INVALID_CREDENTIALS');
    expect((await signInRider('biryani-bazaar.ali', c.password)).kind).toBe('session');
  });

  it("edits a rider's vehicle and phone, and hides another vendor's riders", async () => {
    await signInVendor('restaurant@metromatrix.app');
    expect((await updateRider('rd_ali', { vehicle: 'car', phone: '03009998877' })).vehicle).toBe('car');
    await signInVendor('cloudkitchen@metromatrix.app');
    expect(await listRiders()).toEqual([]);
    expect((await failure(updateRider('rd_ali', { vehicle: 'bike' }))).code).toBe('NOT_FOUND');
  });
});
