// ═══════════════════════════════════════════════════════
// MetroMatrix — Business Serializer
// ═══════════════════════════════════════════════════════
// Defensive backend → app mapping for partner businesses, their documents,
// admin queue rows and status polls, by the API's names (MetroMatrix_Backend
// businesses.service.ts BusinessView / BusinessDetail / DocumentView). The
// required / missing document lists are evaluated on the device when the
// server omits them.

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
  RequirementStatus,
  ServiceType,
  SubType,
} from '../types/auth';
import { SUBTYPE_SERVICE, evaluateDocuments } from '../models/businessModel';
import { arr, bool, isObject, num, oneOf, str, strOrNull } from './serializerUtils';
import { foodVendorSessionSerializer } from './food/vendorSerializer';

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
  'cnic_front',
  'cnic_back',
  'pmdc_certificate',
  'degree_certificate',
  'ntn_certificate',
  'shop_photo',
  'pfa_licence',
  'storefront_photo',
  'kitchen_photo',
];
const DOCUMENT_STATUSES: readonly DocumentStatus[] = ['pending', 'accepted', 'rejected'];

/** The API's `lat` / `lng` (top level), or a `location` object. */
const location = (raw: Record<string, unknown>): GeoPoint | null => {
  const src = isObject(raw.location) ? raw.location : raw;
  const lat = num(src.lat ?? src.latitude, NaN);
  const lng = num(src.lng ?? src.lon ?? src.longitude, NaN);
  return src.lat !== null && src.lng !== null && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

/** Returns null for an entry that cannot be a document (no kind or URL). */
export const documentSerializer = (raw: unknown): BusinessDocument | null => {
  if (!isObject(raw)) return null;
  const kind = oneOf(raw.kind, DOCUMENT_KINDS, null);
  const url = str(raw.url ?? raw.secureUrl);
  if (!kind || !url) return null;
  return {
    id: str(raw.id ?? raw._id),
    kind,
    url,
    publicId: str(raw.publicId),
    // The API doesn't send it; the URL says (PDFs are the only non-images).
    mimeType: str(raw.mimeType, url.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
    status: oneOf(raw.status, DOCUMENT_STATUSES, 'pending'),
    reviewerNote: strOrNull(raw.reviewNote ?? raw.reviewerNote),
    uploadedAt: str(raw.createdAt ?? raw.uploadedAt),
  };
};

/** The API's `requiredDocuments` (RequirementStatus[]); kinds it doesn't know are dropped. */
const requirementStatuses = (v: unknown): RequirementStatus[] =>
  arr(v)
    .filter(isObject)
    .map((r): RequirementStatus => {
      const kind = oneOf(r.kind, DOCUMENT_KINDS, null);
      const anyOf = arr(r.anyOf).filter((k): k is DocumentKind => DOCUMENT_KINDS.includes(k as DocumentKind));
      const min = Math.max(1, num(r.min, 1));
      const have = Math.max(0, num(r.have, 0));
      return {
        ...(kind ? { kind } : { anyOf }),
        min,
        have,
        satisfied: bool(r.satisfied, have >= min),
      };
    })
    .filter(r => r.kind || (r.anyOf && r.anyOf.length));

export const businessSerializer = (raw: unknown): Business | null => {
  if (!isObject(raw)) return null;
  const subType = oneOf(raw.subType, SUB_TYPES, null);
  if (!subType) return null;
  const documents = arr(raw.documents)
    .map(documentSerializer)
    .filter((d): d is BusinessDocument => d !== null);
  const fromServer = requirementStatuses(raw.requiredDocuments);
  const local = evaluateDocuments(subType, documents);
  return {
    id: str(raw.id ?? raw._id),
    ownerId: str(raw.ownerId),
    serviceType: oneOf(raw.serviceType, SERVICE_TYPES, SUBTYPE_SERVICE[subType]),
    subType,
    name: str(raw.name),
    phone: str(raw.phone),
    city: str(raw.city),
    address: str(raw.addressLine ?? raw.address),
    location: location(raw),
    pmdcNumber: subType === 'doctor' ? strOrNull(raw.pmdcNumber) : null,
    status: oneOf(raw.status, BUSINESS_STATUSES, 'draft'),
    documents,
    requiredDocuments: fromServer.length ? fromServer : local.requirements,
    missingDocuments: Array.isArray(raw.missingDocuments)
      ? raw.missingDocuments.filter((k): k is string => typeof k === 'string' && k.length > 0)
      : local.missing,
    rejectionReason: strOrNull(raw.rejectionReason),
    suspensionReason: strOrNull(raw.suspensionReason),
    submittedAt: strOrNull(raw.submittedAt),
    reviewedAt: strOrNull(raw.reviewedAt),
    createdAt: str(raw.createdAt),
    updatedAt: str(raw.updatedAt),
    // Doctors only: listed for patients, and the PMDC check (MetroMatrix-API docs/API_AUTH.md, A1).
    isListed: subType === 'doctor' ? bool(raw.isListed) : null,
    pmdcVerified: subType === 'doctor' ? bool(raw.pmdcVerified) : null,
    food: foodVendorSessionSerializer(raw.food),
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
      name: str(owner.displayName ?? owner.name),
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
    owner: { name: str(owner.displayName ?? owner.name), email: str(owner.email) },
  };
};

/**
 * The API's Paged `{ items, total, page, pageSize }`; `nextCursor` is the next
 * page number while rows remain (a `nextCursor` the server sends wins).
 */
export const businessPageSerializer = (raw: unknown): { items: BusinessSummary[]; nextCursor: string | null } => {
  const body = isObject(raw) ? raw : {};
  const items = arr(Array.isArray(raw) ? raw : body.items)
    .map(businessSummarySerializer)
    .filter((b): b is BusinessSummary => b !== null);
  if (body.nextCursor !== undefined) return { items, nextCursor: strOrNull(body.nextCursor) };
  const page = Math.max(1, num(body.page, 1));
  const pageSize = Math.max(1, num(body.pageSize, items.length || 1));
  const total = num(body.total, 0);
  return { items, nextCursor: page * pageSize < total ? String(page + 1) : null };
};

export const businessStatusSerializer = (raw: unknown): BusinessStatusInfo | null => {
  if (!isObject(raw)) return null;
  const status = oneOf(raw.status, BUSINESS_STATUSES, null);
  if (!status) return null;
  return {
    status,
    rejectionReason: strOrNull(raw.rejectionReason),
    suspensionReason: strOrNull(raw.suspensionReason),
    // The API's status poll carries no documents (GET /businesses/me has them).
    documents: arr(raw.documents)
      .filter(isObject)
      .map(d => ({
        id: str(d.id ?? d._id),
        kind: oneOf(d.kind, DOCUMENT_KINDS, null),
        status: oneOf(d.status, DOCUMENT_STATUSES, 'pending'),
        reviewerNote: strOrNull(d.reviewNote ?? d.reviewerNote),
      }))
      .filter((d): d is BusinessStatusInfo['documents'][number] => d.kind !== null),
  };
};
