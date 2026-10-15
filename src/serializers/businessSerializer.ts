// ═══════════════════════════════════════════════════════
// MetroMatrix — Business Serializer
// ═══════════════════════════════════════════════════════
// Defensive backend → app mapping for partner businesses, their documents,
// admin queue rows and status polls. Required / missing document lists fall
// back to the client's REQUIRED_DOCUMENTS when the server omits them.
// TODO(API_AUTH): field names per docs/API_CONTRACT_ASSUMED.md.

import type {
  Business,
  BusinessDocument,
  BusinessStatus,
  BusinessStatusInfo,
  BusinessSummary,
  BusinessWithOwner,
  DocumentKind,
  DocumentStatus,
  GeoPoint,
  ServiceType,
  SubType,
} from '../types/auth';
import { REQUIRED_DOCUMENTS, SUBTYPE_SERVICE, missingDocuments } from '../models/businessModel';
import { arr, enumList, isObject, num, oneOf, str, strOrNull } from './serializerUtils';

export const SERVICE_TYPES: readonly ServiceType[] = ['shopping', 'healthcare', 'food'];
export const SUB_TYPES: readonly SubType[] = ['store', 'doctor', 'restaurant', 'home_kitchen', 'cloud_kitchen'];
export const BUSINESS_STATUSES: readonly BusinessStatus[] = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'suspended',
];
export const DOCUMENT_KINDS: readonly DocumentKind[] = [
  'cnic',
  'medical_license',
  'degree_certificate',
  'business_license',
  'food_license',
  'kitchen_photo',
];
const DOCUMENT_STATUSES: readonly DocumentStatus[] = ['pending', 'accepted', 'rejected'];

const location = (v: unknown): GeoPoint | null => {
  if (!isObject(v)) return null;
  const lat = num(v.lat ?? v.latitude, NaN);
  const lng = num(v.lng ?? v.lon ?? v.longitude, NaN);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

const details = (v: unknown): Record<string, string> => {
  if (!isObject(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, value] of Object.entries(v)) {
    const s = str(value);
    if (s) out[k] = s;
  }
  return out;
};

/** Returns null for an entry that cannot be a document (no kind or URL). */
export const documentSerializer = (raw: unknown): BusinessDocument | null => {
  if (!isObject(raw)) return null;
  const kind = oneOf(raw.kind ?? raw.type, DOCUMENT_KINDS, null);
  const url = str(raw.url ?? raw.secureUrl);
  if (!kind || !url) return null;
  return {
    id: str(raw.id ?? raw._id),
    kind,
    url,
    publicId: str(raw.publicId),
    mimeType: str(raw.mimeType, url.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
    status: oneOf(raw.status, DOCUMENT_STATUSES, 'pending'),
    reviewerNote: strOrNull(raw.reviewerNote ?? raw.note),
    uploadedAt: str(raw.uploadedAt ?? raw.createdAt),
  };
};

export const businessSerializer = (raw: unknown): Business | null => {
  if (!isObject(raw)) return null;
  const subType = oneOf(raw.subType, SUB_TYPES, null);
  if (!subType) return null;
  const documents = arr(raw.documents)
    .map(documentSerializer)
    .filter((d): d is BusinessDocument => d !== null);
  const required = enumList(raw.requiredDocuments, DOCUMENT_KINDS);
  const missing = Array.isArray(raw.missingDocuments)
    ? enumList(raw.missingDocuments, DOCUMENT_KINDS)
    : missingDocuments(subType, documents);
  return {
    id: str(raw.id ?? raw._id),
    ownerId: str(raw.ownerId),
    serviceType: oneOf(raw.serviceType, SERVICE_TYPES, SUBTYPE_SERVICE[subType]),
    subType,
    name: str(raw.name),
    phone: str(raw.phone),
    city: str(raw.city),
    address: str(raw.address),
    location: location(raw.location),
    details: details(raw.details),
    status: oneOf(raw.status, BUSINESS_STATUSES, 'draft'),
    documents,
    requiredDocuments: required.length ? required : REQUIRED_DOCUMENTS[subType],
    missingDocuments: missing,
    rejectionReason: strOrNull(raw.rejectionReason),
    suspensionReason: strOrNull(raw.suspensionReason),
    submittedAt: strOrNull(raw.submittedAt),
    reviewedAt: strOrNull(raw.reviewedAt),
    createdAt: str(raw.createdAt),
    updatedAt: str(raw.updatedAt),
  };
};

export const businessWithOwnerSerializer = (raw: unknown): BusinessWithOwner | null => {
  const business = businessSerializer(raw);
  if (!business || !isObject(raw)) return null;
  const owner = isObject(raw.owner) ? raw.owner : {};
  return {
    ...business,
    owner: {
      id: str(owner.id ?? owner._id),
      name: str(owner.name),
      email: str(owner.email),
      phone: strOrNull(owner.phone),
    },
  };
};

export const businessSummarySerializer = (raw: unknown): BusinessSummary | null => {
  if (!isObject(raw)) return null;
  const subType = oneOf(raw.subType, SUB_TYPES, null);
  const id = str(raw.id ?? raw._id);
  if (!subType || !id) return null;
  const owner = isObject(raw.owner) ? raw.owner : {};
  return {
    id,
    name: str(raw.name, 'Unnamed business'),
    serviceType: oneOf(raw.serviceType, SERVICE_TYPES, SUBTYPE_SERVICE[subType]),
    subType,
    city: str(raw.city),
    status: oneOf(raw.status, BUSINESS_STATUSES, 'pending_approval'),
    submittedAt: strOrNull(raw.submittedAt),
    owner: { name: str(owner.name), email: str(owner.email) },
  };
};

export const businessPageSerializer = (raw: unknown): { items: BusinessSummary[]; nextCursor: string | null } => {
  const body = isObject(raw) ? raw : {};
  const items = arr(Array.isArray(raw) ? raw : body.items)
    .map(businessSummarySerializer)
    .filter((b): b is BusinessSummary => b !== null);
  return { items, nextCursor: strOrNull(body.nextCursor) };
};

export const businessStatusSerializer = (raw: unknown): BusinessStatusInfo | null => {
  if (!isObject(raw)) return null;
  const status = oneOf(raw.status, BUSINESS_STATUSES, null);
  if (!status) return null;
  return {
    status,
    rejectionReason: strOrNull(raw.rejectionReason),
    suspensionReason: strOrNull(raw.suspensionReason),
    documents: arr(raw.documents)
      .filter(isObject)
      .map(d => ({
        id: str(d.id ?? d._id),
        kind: oneOf(d.kind, DOCUMENT_KINDS, 'cnic'),
        status: oneOf(d.status, DOCUMENT_STATUSES, 'pending'),
        reviewerNote: strOrNull(d.reviewerNote ?? d.note),
      })),
  };
};
