// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth & business domain types
// ═══════════════════════════════════════════════════════
// App-side shapes, produced ONLY by serializers. TODO(API_AUTH): mirrors
// docs/API_CONTRACT_ASSUMED.md until MetroMatrix-API docs/API_AUTH.md is
// available.

export type UserRole = 'customer' | 'partner' | 'rider' | 'admin' | 'super_admin';
export type Portal = 'customer' | 'partner' | 'admin';
export type ServiceType = 'shopping' | 'healthcare' | 'food';
export type SubType = 'store' | 'doctor' | 'restaurant' | 'home_kitchen' | 'cloud_kitchen';
export type BusinessStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'suspended';
export type AuthProvider = 'password' | 'google';

/** Verification documents — the FYP's list, mapped to MetroMatrix's sub-types. */
export type DocumentKind =
  | 'cnic'
  | 'medical_license'
  | 'degree_certificate'
  | 'business_license'
  | 'food_license'
  | 'kitchen_photo';

export type Gender = 'male' | 'female' | 'other';

export type DocumentStatus = 'pending' | 'accepted' | 'rejected';

export interface User {
  id: string;
  email: string;
  name: string;
  /** Canonical +92XXXXXXXXXX, or null. */
  phone: string | null;
  role: UserRole;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  /** False for Google-only accounts: they set a first password, not change one. */
  hasPassword: boolean;
  providers: AuthProvider[];
  createdAt: string;
  /** Customers: CompleteProfile has been finished (or skipped past). */
  profileComplete: boolean;
  dateOfBirth: string | null;
  gender: Gender | null;
  streetAddress: string | null;
  city: string | null;
  postalCode: string | null;
  /** Partners: the type picked on Provider Selection at sign-up. */
  providerServiceType: ServiceType | null;
  providerSubType: SubType | null;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface BusinessDocument {
  id: string;
  kind: DocumentKind;
  url: string;
  publicId: string;
  mimeType: string;
  status: DocumentStatus;
  reviewerNote: string | null;
  uploadedAt: string;
}

export interface Business {
  id: string;
  ownerId: string;
  serviceType: ServiceType;
  subType: SubType;
  name: string;
  phone: string;
  city: string;
  address: string;
  location: GeoPoint | null;
  /** Sub-type specific fields (specialty, cuisine, …) — see businessModel. */
  details: Record<string, string>;
  status: BusinessStatus;
  documents: BusinessDocument[];
  requiredDocuments: DocumentKind[];
  missingDocuments: DocumentKind[];
  rejectionReason: string | null;
  suspensionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Doctors only: patients can find and book them (Practice setup published).
   * null for every other service. TODO(API_HEALTH)
   */
  isListed: boolean | null;
  /** Doctors only: staff have checked the PMDC number. TODO(API_HEALTH) */
  pmdcVerified: boolean | null;
}

export interface BusinessOwner {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

/** Admin review: a business with its owner. */
export interface BusinessWithOwner extends Business {
  owner: BusinessOwner;
}

/** Admin queue row. */
export interface BusinessSummary {
  id: string;
  name: string;
  serviceType: ServiceType;
  subType: SubType;
  city: string;
  status: BusinessStatus;
  submittedAt: string | null;
  owner: { name: string; email: string };
}

export interface BusinessStatusInfo {
  status: BusinessStatus;
  rejectionReason: string | null;
  suspensionReason: string | null;
  documents: Pick<BusinessDocument, 'id' | 'kind' | 'status' | 'reviewerNote'>[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: User;
  business: Business | null;
  tokens: AuthTokens;
}

/** Admin sign-in step 1: no tokens until the TOTP step. */
export interface TotpChallenge {
  challengeToken: string;
  totpEnrolled: boolean;
}

export interface TotpEnrolment {
  secret: string;
  otpauthUrl: string;
}

export interface SignedUpload {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  uploadUrl: string;
}

export interface UploadedFile {
  url: string;
  publicId: string;
  mimeType: string;
}

/** A file picked on the device (camera, library, documents). */
export interface LocalFile {
  uri: string;
  name: string;
  mimeType: string;
  /** Web only: the picked File/Blob. */
  file?: Blob;
}
