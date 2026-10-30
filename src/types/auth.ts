// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth & business domain types
// ═══════════════════════════════════════════════════════
// App-side shapes, produced ONLY by serializers, which map the API's wire
// names (MetroMatrix_Backend docs/API_AUTH.md, businesses.service.ts) onto
// these. docs/API_CONTRACT_ASSUMED.md lists both sides.

import type { FoodVendorSession } from './food';

export type UserRole = 'customer' | 'partner' | 'rider' | 'admin' | 'super_admin';
export type Portal = 'customer' | 'partner' | 'admin';
export type ServiceType = 'shopping' | 'healthcare' | 'food';
export type SubType = 'store' | 'doctor' | 'restaurant' | 'home_kitchen' | 'cloud_kitchen';
export type BusinessStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'suspended';
export type AuthProvider = 'password' | 'google';

/**
 * Verification documents, by the API's names (MetroMatrix_Backend
 * businesses/business-types.ts DOCUMENT_KINDS). Which ones each sub-type needs
 * is in businessModel.DOCUMENT_REQUIREMENTS.
 */
export type DocumentKind =
  | 'cnic_front'
  | 'cnic_back'
  | 'pmdc_certificate'
  | 'degree_certificate'
  | 'ntn_certificate'
  | 'shop_photo'
  | 'pfa_licence'
  | 'storefront_photo'
  | 'kitchen_photo';

/**
 * One rule a business's documents must meet (the API's DocumentRequirement):
 * at least `min` of one kind, or one of any of several kinds.
 */
export type DocumentRequirement = { kind: DocumentKind; min?: number } | { anyOf: DocumentKind[] };

/** How one requirement stands against the documents on file (the API's RequirementStatus). */
export interface RequirementStatus {
  kind?: DocumentKind;
  anyOf?: DocumentKind[];
  min: number;
  have: number;
  satisfied: boolean;
}

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
  /** Customers: CompleteProfile has been finished. Always true for other roles. */
  profileComplete: boolean;
  /**
   * Customers who signed up before CompleteProfile existed: the gate asks
   * once and offers "Skip for now" (remembered on the device).
   */
  profileSkippable: boolean;
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
  /** The API's `addressLine`. */
  address: string;
  /** The API's `lat` / `lng`; null when no pin was dropped. */
  location: GeoPoint | null;
  /** Doctors only: the PMDC registration number (required before submitting). */
  pmdcNumber: string | null;
  status: BusinessStatus;
  documents: BusinessDocument[];
  /** Each rule and how it stands (the API's `requiredDocuments`). */
  requiredDocuments: RequirementStatus[];
  /** Unmet rules, by key: a kind, or an any-of group written `a|b` (the API's `missingDocuments`). */
  missingDocuments: string[];
  rejectionReason: string | null;
  suspensionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Doctors only: patients can find and book them (Practice setup published).
   * null for every other service (API_AUTH.md, A1).
   */
  isListed: boolean | null;
  /** Doctors only: staff have checked the PMDC number (API_AUTH.md, A1). */
  pmdcVerified: boolean | null;
  /** Food vendors only: their brand and whether they are live (session `business.food`). */
  food: FoodVendorSession | null;
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
  /** The API's PNG of the same URI (the app draws its own QR from otpauthUrl). */
  qrDataUrl: string | null;
}

/** POST /media/sign-upload: every field but the file and api_key is signed. */
export interface SignedUpload {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  uploadUrl: string;
  /** Signed: sent as `allowed_formats` (e.g. "jpg,jpeg,png,webp,heic,pdf"). */
  allowedFormats: string;
  /** Checked on the device before uploading; 0 = no limit known. */
  maxBytes: number;
  /** Signed when present: sent as `type` (private uploads). */
  type: 'authenticated' | null;
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
