// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy database
// ═══════════════════════════════════════════════════════
// In-memory, persisted to AsyncStorage after every write, so dummy data
// survives an app restart (kill and reopen keeps you signed in, an
// application stays submitted). Records are stored in the API's WIRE shape —
// the same JSON a real backend would send — so serializers are exercised
// exactly as they will be in production.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { REQUIRED_DOCUMENTS } from '../../../models/businessModel';
import type { DocumentKind, ServiceType, SubType } from '../../../types/auth';
import { MOCK, SEED_PASSWORD, STAFF_PASSWORD } from './mockConfig';
import { SHOP_SEED_SHOPPER, SHOP_SEED_USERS, seedShop } from './shop/shopSeed';
import type { MockShop } from './shop/shopTypes';
import { HEALTH_SEED_USERS, seedHealth } from './health/healthSeed';
import type { MockHealth } from './health/healthTypes';

export interface MockUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: 'customer' | 'partner' | 'admin' | 'super_admin';
  avatarUrl: string | null;
  isEmailVerified: boolean;
  hasPassword: boolean;
  providers: ('password' | 'google')[];
  createdAt: string;
  profileComplete: boolean;
  dateOfBirth: string | null;
  gender: string | null;
  streetAddress: string | null;
  city: string | null;
  postalCode: string | null;
  providerServiceType: ServiceType | null;
  providerSubType: SubType | null;
  // ── private (never sent) ──
  password: string | null;
  verificationSentAt: number;
  totpEnrolled: boolean;
  recoveryCodes: string[];
}

export interface MockDocument {
  id: string;
  kind: DocumentKind;
  url: string;
  publicId: string;
  mimeType: string;
  status: 'pending' | 'accepted' | 'rejected';
  reviewerNote: string | null;
  uploadedAt: string;
}

export interface MockBusiness {
  id: string;
  ownerId: string;
  serviceType: ServiceType;
  subType: SubType;
  name: string;
  phone: string;
  city: string;
  address: string;
  location: { lat: number; lng: number } | null;
  details: Record<string, string>;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'suspended';
  documents: MockDocument[];
  rejectionReason: string | null;
  suspensionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Seeded applications stay put; ones submitted in the app auto-approve. */
  autoApprove: boolean;
  /** Doctors: listed for patients (Practice setup published), and staff's PMDC check. */
  isListed?: boolean;
  pmdcVerified?: boolean;
}

export interface MockDb {
  users: MockUser[];
  businesses: MockBusiness[];
  /** accessToken → session */
  access: Record<string, { userId: string; expiresAt: number }>;
  /** refreshToken → userId */
  refresh: Record<string, string>;
  /** email → pending password reset */
  resets: Record<string, { code: string; attemptsLeft: number; sentAt: number; resetToken: string | null }>;
  /** staff sign-in challenge → user */
  challenges: Record<string, { userId: string; expiresAt: number }>;
  devices: { userId: string; token: string }[];
  /** Shopping (stores, catalogue, bags, orders …) — see ./shop/. */
  shop: MockShop;
  /** Healthcare (doctors, availability, appointments …) — see ./health/. */
  health: MockHealth;
}

export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const iso = (msAgo = 0) => new Date(Date.now() - msAgo).toISOString();
const DAY = 24 * 60 * 60 * 1000;

const baseUser = (over: Partial<MockUser> & Pick<MockUser, 'id' | 'email' | 'name' | 'role'>): MockUser => ({
  phone: '+923001234567',
  avatarUrl: null,
  isEmailVerified: true,
  hasPassword: true,
  providers: ['password'],
  createdAt: iso(30 * DAY),
  profileComplete: true,
  dateOfBirth: '1995-04-12',
  gender: 'female',
  streetAddress: '12 Main Boulevard, Gulberg III',
  city: 'Lahore',
  postalCode: '54000',
  providerServiceType: null,
  providerSubType: null,
  password: SEED_PASSWORD,
  verificationSentAt: 0,
  totpEnrolled: false,
  recoveryCodes: [],
  ...over,
});

const placeholderDoc = (kind: DocumentKind, status: MockDocument['status'] = 'accepted', note: string | null = null): MockDocument => ({
  id: newId('doc'),
  kind,
  url: `https://placehold.co/900x600/png?text=${encodeURIComponent(kind.replace(/_/g, ' '))}`,
  publicId: `mock/${kind}`,
  mimeType: 'image/png',
  status,
  reviewerNote: note,
  uploadedAt: iso(3 * DAY),
});

const seedBusiness = (
  over: Partial<MockBusiness> & Pick<MockBusiness, 'id' | 'ownerId' | 'serviceType' | 'subType' | 'name' | 'status'>,
): MockBusiness => ({
  phone: '+923001234567',
  city: 'Lahore',
  address: '45 MM Alam Road, Gulberg',
  location: null,
  details: {},
  documents: REQUIRED_DOCUMENTS[over.subType].map(kind => placeholderDoc(kind)),
  rejectionReason: null,
  suspensionReason: null,
  submittedAt: iso(2 * DAY),
  reviewedAt: null,
  createdAt: iso(4 * DAY),
  updatedAt: iso(2 * DAY),
  autoApprove: false,
  ...over,
});

/** The accounts a tester can sign in with straight away (all: Metro2026). */
export const seedDb = (): MockDb => ({
  users: [
    baseUser({ id: 'u_customer', email: 'customer@metromatrix.app', name: 'Ayesha Khan', role: 'customer' }),
    baseUser({
      id: 'u_doctor',
      email: 'doctor@metromatrix.app',
      name: 'Dr. Bilal Ahmed',
      role: 'partner',
      gender: 'male',
      providerServiceType: 'healthcare',
      providerSubType: 'doctor',
    }),
    baseUser({
      id: 'u_kitchen',
      email: 'kitchen@metromatrix.app',
      name: 'Sana Tariq',
      role: 'partner',
      providerServiceType: 'food',
      providerSubType: 'home_kitchen',
    }),
    baseUser({
      id: 'u_vendor',
      email: 'vendor@metromatrix.app',
      name: 'Usman Ali',
      role: 'partner',
      gender: 'male',
      providerServiceType: 'shopping',
      providerSubType: 'store',
    }),
    baseUser({
      id: 'u_admin',
      email: 'admin@metromatrix.app',
      name: 'MetroMatrix Admin',
      role: 'super_admin',
      password: STAFF_PASSWORD,
      totpEnrolled: true,
      recoveryCodes: ['MM7K-Q2PX', 'MM4D-8LNA', 'MM9R-3VWE', 'MM2H-6TZC'],
    }),
    ...SHOP_SEED_USERS.map(u =>
      baseUser({
        id: u.id,
        email: u.email,
        name: u.name,
        role: 'partner',
        city: u.city,
        providerServiceType: 'shopping',
        providerSubType: 'store',
      }),
    ),
    baseUser({
      id: SHOP_SEED_SHOPPER.id,
      email: SHOP_SEED_SHOPPER.email,
      name: SHOP_SEED_SHOPPER.name,
      role: 'customer',
      gender: 'male',
      phone: '+923451234567',
      streetAddress: 'House 88, Street 9, DHA Phase 5',
    }),
    ...HEALTH_SEED_USERS.map(u =>
      baseUser({
        id: u.id,
        email: u.email,
        name: u.name,
        role: 'partner',
        gender: u.gender,
        providerServiceType: 'healthcare',
        providerSubType: 'doctor',
      }),
    ),
    baseUser({
      id: 'u_newadmin',
      email: 'newadmin@metromatrix.app',
      name: 'New Staff Member',
      role: 'admin',
      password: STAFF_PASSWORD,
      totpEnrolled: false,
    }),
  ],
  businesses: [
    seedBusiness({
      id: 'b_doctor',
      ownerId: 'u_doctor',
      serviceType: 'healthcare',
      subType: 'doctor',
      name: 'Dr. Bilal Ahmed Clinic',
      status: 'approved',
      reviewedAt: iso(DAY),
      isListed: true,
      pmdcVerified: true,
      details: {
        specialty: 'Cardiologist',
        pmdcNumber: '45821-P',
        experience: '12',
        briefDescription: 'Consultant cardiologist with twelve years of practice in Lahore.',
      },
    }),
    seedBusiness({
      id: 'b_kitchen',
      ownerId: 'u_kitchen',
      serviceType: 'food',
      subType: 'home_kitchen',
      name: "Sana's Kitchen",
      status: 'pending_approval',
      details: {
        cuisine: 'Desi Home Food',
        dailyCapacity: '25',
        experience: '6',
        briefDescription: 'Fresh home-cooked desi meals, made to order every day.',
      },
    }),
    seedBusiness({
      id: 'b_vendor',
      ownerId: 'u_vendor',
      serviceType: 'shopping',
      subType: 'store',
      name: 'Usman Electronics',
      status: 'rejected',
      reviewedAt: iso(DAY),
      rejectionReason: 'The business licence has expired. Upload the renewed licence and resubmit.',
      details: {
        storeCategory: 'Electronics',
        experience: '8',
        briefDescription: 'Phones, accessories and home electronics with warranty.',
      },
      documents: [
        placeholderDoc('cnic'),
        placeholderDoc('business_license', 'rejected', 'This licence expired in March 2026.'),
      ],
    }),
    ...SHOP_SEED_USERS.map(u =>
      seedBusiness({
        id: u.businessId,
        ownerId: u.id,
        serviceType: 'shopping',
        subType: 'store',
        name: { s_lawn: 'Lawn & Loom', s_urban: 'Urban Thread', s_volt: 'Volt Gadgets' }[u.storeId],
        city: u.city,
        status: 'approved',
        reviewedAt: iso(60 * DAY),
        details: { storeCategory: u.storeId === 's_volt' ? 'Electronics' : 'Fashion', experience: '5', briefDescription: 'Seeded demo store.' },
      }),
    ),
    ...HEALTH_SEED_USERS.map(u =>
      seedBusiness({
        id: u.businessId,
        ownerId: u.id,
        serviceType: 'healthcare',
        subType: 'doctor',
        name: u.businessName,
        status: u.status,
        reviewedAt: u.status === 'approved' ? iso(30 * DAY) : null,
        submittedAt: iso(u.status === 'approved' ? 32 * DAY : 2 * DAY),
        isListed: u.listed,
        pmdcVerified: u.status === 'approved',
        details: { specialty: u.specialty, pmdcNumber: u.pmdc, experience: '8', briefDescription: 'Seeded demo doctor.' },
      }),
    ),
  ],
  access: {},
  refresh: {},
  resets: {},
  challenges: {},
  devices: [],
  shop: seedShop(),
  health: seedHealth(),
});

/**
 * Old installs saved a DB from before a feature existed. Fill in anything
 * missing from the seed — new collections, and seed accounts that weren't
 * there yet — without touching what the tester created.
 */
const ensureCollections = (loaded: Partial<MockDb>): MockDb => {
  const seed = seedDb();
  const out = { ...seed, ...loaded } as MockDb;
  for (const u of seed.users) if (!out.users.some(x => x.id === u.id || x.email === u.email)) out.users.push(u);
  for (const b of seed.businesses) if (!out.businesses.some(x => x.id === b.id)) out.businesses.push(b);
  if (!loaded.shop) out.shop = seed.shop;
  else for (const k of Object.keys(seed.shop) as (keyof MockShop)[]) if (out.shop[k] === undefined) (out.shop as any)[k] = seed.shop[k];
  if (!loaded.health) out.health = seed.health;
  else for (const k of Object.keys(seed.health) as (keyof MockHealth)[]) if (out.health[k] === undefined) (out.health as any)[k] = seed.health[k];
  // Businesses saved before doctors could be listed: the seed's own doctors keep their state.
  for (const b of out.businesses) {
    const s = seed.businesses.find(x => x.id === b.id);
    if (s && b.isListed === undefined) b.isListed = s.isListed;
    if (s && b.pmdcVerified === undefined) b.pmdcVerified = s.pmdcVerified;
  }
  return out;
};

// ─── Persistence ─────────────────────────────────────
let db: MockDb | null = null;
let loading: Promise<MockDb> | null = null;

export const getDb = async (): Promise<MockDb> => {
  if (db) return db;
  if (!loading) {
    loading = (async () => {
      try {
        const raw = await AsyncStorage.getItem(MOCK.STORAGE_KEY);
        db = raw ? ensureCollections(JSON.parse(raw) as Partial<MockDb>) : seedDb();
      } catch {
        db = seedDb();
      }
      return db;
    })();
  }
  return loading;
};

export const saveDb = async (): Promise<void> => {
  if (!db) return;
  try {
    await AsyncStorage.setItem(MOCK.STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* storage full / unavailable — the session still works in memory */
  }
};

/** Back to the seeded accounts (tests, and a fresh demo). */
export const resetMockDb = async (): Promise<void> => {
  db = seedDb();
  loading = Promise.resolve(db);
  await saveDb();
};
