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
  ],
  access: {},
  refresh: {},
  resets: {},
  challenges: {},
  devices: [],
});

// ─── Persistence ─────────────────────────────────────
let db: MockDb | null = null;
let loading: Promise<MockDb> | null = null;

export const getDb = async (): Promise<MockDb> => {
  if (db) return db;
  if (!loading) {
    loading = (async () => {
      try {
        const raw = await AsyncStorage.getItem(MOCK.STORAGE_KEY);
        db = raw ? (JSON.parse(raw) as MockDb) : seedDb();
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
