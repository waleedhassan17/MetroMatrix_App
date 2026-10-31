// ═══════════════════════════════════════════════════════
// MetroMatrix — Provider (business) model
// ═══════════════════════════════════════════════════════
// Provider Selection's choices, the fields PersonalInfo asks for, and the
// documents each sub-type must upload — the FYP app's provider-info flow on
// MetroMatrix's API (MetroMatrix_Backend businesses/: business.dto.ts and
// required-documents.ts). PersonalInfo asks only for what the API stores:
// name, city, address (+ map pin), and the PMDC number for doctors. A
// doctor's specialty, fees and the rest are set later in Practice setup.
//
//   Doctor        CNIC front + back, PMDC certificate, degree certificate
//   Vendor        CNIC front + back, NTN certificate OR a shop photo
//   Restaurant    CNIC front + back, PFA licence, storefront photo
//   Cloud kitchen CNIC front + back, PFA licence
//   Home kitchen  CNIC front + back, 2 kitchen photos

import type {
  Business,
  BusinessDocument,
  DocumentKind,
  DocumentRequirement,
  GeoPoint,
  RequirementStatus,
  ServiceType,
  SubType,
} from './auth';
import type { ValidationErrors } from './authModel';

// ─── Services and sub-types ──────────────────────────
export const SERVICE_SUBTYPES: Record<ServiceType, SubType[]> = {
  shopping: ['store'],
  healthcare: ['doctor'],
  food: ['restaurant', 'home_kitchen', 'cloud_kitchen'],
};

export const SUBTYPE_SERVICE: Record<SubType, ServiceType> = {
  store: 'shopping',
  doctor: 'healthcare',
  restaurant: 'food',
  home_kitchen: 'food',
  cloud_kitchen: 'food',
};

export const SERVICE_LABELS: Record<ServiceType, { title: string; partnerTitle: string; description: string }> = {
  shopping: {
    title: 'Shopping',
    partnerTitle: 'Vendor Registration',
    description: 'Sell products and manage your online store',
  },
  healthcare: {
    title: 'Healthcare',
    partnerTitle: 'Doctor',
    description: 'Provide healthcare consultations and medical services',
  },
  food: {
    title: 'Food Court',
    partnerTitle: 'Food Court Vendor',
    description: 'List your restaurant, cloud kitchen or home kitchen in the Food Court',
  },
};

export const SUBTYPE_LABELS: Record<SubType, { title: string; description: string }> = {
  store: { title: 'Vendor', description: 'A shop with products to sell.' },
  doctor: { title: 'Doctor', description: 'A PMDC-registered practitioner.' },
  restaurant: { title: 'Restaurant', description: 'Dine-in or takeaway with a public address.' },
  home_kitchen: { title: 'Home Kitchen', description: 'Home-cooked food from your own kitchen.' },
  cloud_kitchen: { title: 'Cloud Kitchen', description: 'A delivery-only commercial kitchen.' },
};

/** "Doctor", "Vendor", "Home Kitchen" — the provider badge on sign-in / sign-up. */
export const providerTypeLabel = (subType: SubType | null | undefined): string =>
  subType ? SUBTYPE_LABELS[subType].title : 'Service Provider';

// ─── Documents ───────────────────────────────────────
/** The API's rules (required-documents.ts REQUIRED_DOCUMENTS), word for word. */
export const DOCUMENT_REQUIREMENTS: Record<SubType, DocumentRequirement[]> = {
  store: [{ kind: 'cnic_front' }, { kind: 'cnic_back' }, { anyOf: ['ntn_certificate', 'shop_photo'] }],
  doctor: [{ kind: 'cnic_front' }, { kind: 'cnic_back' }, { kind: 'pmdc_certificate' }, { kind: 'degree_certificate' }],
  restaurant: [{ kind: 'cnic_front' }, { kind: 'cnic_back' }, { kind: 'pfa_licence' }, { kind: 'storefront_photo' }],
  cloud_kitchen: [{ kind: 'cnic_front' }, { kind: 'cnic_back' }, { kind: 'pfa_licence' }],
  home_kitchen: [{ kind: 'cnic_front' }, { kind: 'cnic_back' }, { kind: 'kitchen_photo', min: 2 }],
};

export const DOCUMENT_LABELS: Record<DocumentKind, { label: string; hint: string }> = {
  cnic_front: { label: 'CNIC (front)', hint: 'The front of your CNIC, every corner visible.' },
  cnic_back: { label: 'CNIC (back)', hint: 'The back of your CNIC, every corner visible.' },
  pmdc_certificate: { label: 'PMDC certificate', hint: 'Your current PMDC registration certificate.' },
  degree_certificate: { label: 'Degree certificate', hint: 'MBBS, BDS or equivalent.' },
  ntn_certificate: { label: 'NTN certificate', hint: 'Your store’s National Tax Number certificate.' },
  shop_photo: { label: 'Shop photo', hint: 'A clear photo of your shop with its sign.' },
  pfa_licence: { label: 'PFA licence', hint: 'Your Punjab Food Authority (or provincial) licence.' },
  storefront_photo: { label: 'Storefront photo', hint: 'The front of the restaurant, sign visible.' },
  kitchen_photo: { label: 'Kitchen photo', hint: 'A clear photo of the kitchen you cook in.' },
};

/** A requirement as the API names it in `missing`: the kind, or `a|b` for any-of. */
export const requirementKey = (r: DocumentRequirement): string => ('anyOf' in r ? r.anyOf.join('|') : r.kind);

const kindsOf = (r: DocumentRequirement): DocumentKind[] => ('anyOf' in r ? r.anyOf : [r.kind]);

/** "CNIC (front)", or "NTN certificate or Shop photo" for an any-of key. */
export const requirementLabel = (key: string): string =>
  key
    .split('|')
    .map(k => DOCUMENT_LABELS[k as DocumentKind]?.label ?? k)
    .join(' or ');

/**
 * The API's evaluateDocuments, on the device: each rule and how it stands,
 * and the keys of those not yet met. A rejected document doesn't count.
 */
export const evaluateDocuments = (
  subType: SubType,
  documents: Pick<BusinessDocument, 'kind' | 'status'>[],
): { requirements: RequirementStatus[]; missing: string[] } => {
  const counts = new Map<DocumentKind, number>();
  for (const d of documents) {
    if (d.status !== 'rejected') counts.set(d.kind, (counts.get(d.kind) ?? 0) + 1);
  }
  const rules = DOCUMENT_REQUIREMENTS[subType];
  const requirements = rules.map(r => {
    const min = 'anyOf' in r ? 1 : (r.min ?? 1);
    const have = kindsOf(r).reduce((n, k) => n + (counts.get(k) ?? 0), 0);
    return { ...('anyOf' in r ? { anyOf: r.anyOf } : { kind: r.kind }), min, have, satisfied: have >= min };
  });
  return { requirements, missing: rules.filter((_, i) => !requirements[i].satisfied).map(requirementKey) };
};

/** Requirement keys with no standing document yet. */
export const missingDocuments = (subType: SubType, documents: Pick<BusinessDocument, 'kind' | 'status'>[]): string[] =>
  evaluateDocuments(subType, documents).missing;

/**
 * One upload tile. "At least 2 kitchen photos" is two slots; "NTN certificate
 * or shop photo" is one slot offering both kinds (the first is the default).
 */
export interface DocumentSlot {
  /** Stable per slot: `kitchen_photo`, `kitchen_photo#2`, `ntn_certificate|shop_photo`. */
  key: string;
  /** The requirement this slot helps meet (the API's `missing` key). */
  requirement: string;
  kinds: DocumentKind[];
  label: string;
  hint: string;
  /** The document filling it, if any (a rejected one shows so it can be replaced). */
  doc: BusinessDocument | null;
}

/** The tiles PersonalInfo shows, each filled with the document that meets it. */
export const documentSlots = (subType: SubType, documents: BusinessDocument[]): DocumentSlot[] => {
  // Standing documents first, so a replacement fills the slot over a rejected one.
  const pool = [...documents].sort((a, b) => Number(a.status === 'rejected') - Number(b.status === 'rejected'));
  const take = (kinds: DocumentKind[]): BusinessDocument | null => {
    const i = pool.findIndex(d => kinds.includes(d.kind));
    return i === -1 ? null : pool.splice(i, 1)[0];
  };
  const slots: DocumentSlot[] = [];
  for (const r of DOCUMENT_REQUIREMENTS[subType]) {
    const kinds = kindsOf(r);
    const requirement = requirementKey(r);
    const count = 'anyOf' in r ? 1 : (r.min ?? 1);
    for (let n = 1; n <= count; n++) {
      const first = DOCUMENT_LABELS[kinds[0]];
      slots.push({
        key: n === 1 ? requirement : `${requirement}#${n}`,
        requirement,
        kinds,
        label: kinds.length > 1 ? requirementLabel(requirement) : count > 1 ? `${first.label} ${n}` : first.label,
        hint: kinds.length > 1 ? 'Either one is enough.' : first.hint,
        doc: take(kinds),
      });
    }
  }
  return slots;
};

// ─── Pickers ─────────────────────────────────────────
const options = (values: string[]) => values.map(v => ({ value: v, label: v }));

export const CITIES = options([
  'Lahore',
  'Karachi',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Quetta',
  'Sialkot',
  'Gujranwala',
  'Hyderabad',
]);

export const STORE_CATEGORIES = options(['Grocery', 'Fashion', 'Electronics', 'Home and living', 'Beauty', 'Pharmacy', 'Other']);

export const SPECIALTIES = options([
  'General Physician',
  'Cardiologist',
  'Dermatologist',
  'Pediatrician',
  'Gynecologist',
  'Orthopedic Surgeon',
  'Psychiatrist',
  'Dentist',
  'ENT Specialist',
  'Other',
]);

export const CUISINES = options(['Pakistani', 'BBQ', 'Chinese', 'Fast Food', 'Desi Home Food', 'Bakery', 'Healthy', 'Other']);

// ─── Professional info (PersonalInfo step 2) ─────────
// Only what the API stores. (The FYP form also asked for specialty, category,
// cuisine, experience, a description and daily capacity; the API has nowhere
// to keep them, so they are not asked for here. Decision: Waleed, 30 Oct.)
export type DetailKey = 'pmdcNumber';

export interface DetailFieldSpec {
  key: DetailKey;
  label: string;
  kind: 'text' | 'number' | 'picker' | 'multiline';
  placeholder: string;
  helper?: string;
  options?: { value: string; label: string }[];
  required: boolean;
}

export interface BusinessFormSchema {
  nameLabel: string;
  namePlaceholder: string;
  addressLabel: string;
  addressHelper?: string;
  /** Fields above the name (specialty, category, cuisine — the FYP order). */
  lead: DetailFieldSpec[];
  /** Fields after the address (PMDC no., experience, about …). */
  details: DetailFieldSpec[];
}

/** The API's PMDC rule (business.dto.ts), after trimming and upper-casing. */
export const PMDC_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,19}$/;

export const BUSINESS_FORM_SCHEMA: Record<SubType, BusinessFormSchema> = {
  doctor: {
    nameLabel: 'Professional/Clinic Name',
    namePlaceholder: 'Your practice name',
    addressLabel: 'Clinic address',
    lead: [],
    details: [
      {
        key: 'pmdcNumber',
        label: 'PMDC Registration Number',
        kind: 'text',
        placeholder: '12345-P',
        helper: 'As printed on your PMDC certificate.',
        required: true,
      },
    ],
  },
  store: {
    nameLabel: 'Business Name',
    namePlaceholder: 'Your store name',
    addressLabel: 'Store address',
    lead: [],
    details: [],
  },
  restaurant: {
    nameLabel: 'Restaurant Name',
    namePlaceholder: 'Karahi House',
    addressLabel: 'Restaurant address',
    lead: [],
    details: [],
  },
  home_kitchen: {
    nameLabel: 'Kitchen Name',
    namePlaceholder: "Ammi's Kitchen",
    addressLabel: 'Pickup area',
    addressHelper: 'Your area and street. Customers see only the area until they order.',
    lead: [],
    details: [],
  },
  cloud_kitchen: {
    nameLabel: 'Kitchen Name',
    namePlaceholder: 'Late Night Bites',
    addressLabel: 'Kitchen address',
    lead: [],
    details: [],
  },
};

export const allDetailFields = (subType: SubType): DetailFieldSpec[] => [
  ...BUSINESS_FORM_SCHEMA[subType].lead,
  ...BUSINESS_FORM_SCHEMA[subType].details,
];

export interface BusinessProfileForm {
  name: string;
  city: string;
  address: string;
  location: GeoPoint | null;
  details: Partial<Record<DetailKey, string>>;
}

export const emptyBusinessProfile = (): BusinessProfileForm => ({
  name: '',
  city: '',
  address: '',
  location: null,
  details: {},
});

export const validateBusinessProfile = (subType: SubType, form: BusinessProfileForm): ValidationErrors => {
  const errors: ValidationErrors = {};
  const schema = BUSINESS_FORM_SCHEMA[subType];

  if (!form.name.trim()) errors.name = `${schema.nameLabel} is required`;
  else if (form.name.trim().length < 2) errors.name = 'Use at least 2 characters';

  if (!form.city) errors.city = 'Choose a city';
  if (!form.address.trim()) errors.address = `${schema.addressLabel} is required`;
  else if (form.address.trim().length < 5) errors.address = 'Add the street and area';

  for (const field of allDetailFields(subType)) {
    const value = (form.details[field.key] ?? '').trim();
    if (field.required && !value) {
      errors[field.key] = `${field.label} is required`;
    } else if (field.key === 'pmdcNumber' && value && !PMDC_PATTERN.test(value.toUpperCase())) {
      errors[field.key] = 'Enter your PMDC registration number, e.g. 12345-P';
    }
  }
  return errors;
};

/** The API keeps 6 decimal places of a coordinate (about 10 cm). */
const coord = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Form → the API's CreateBusinessDto / UpdateBusinessDto:
 * `{ serviceType, subType, name, phone, city, addressLine, lat?, lng?, pmdcNumber? }`.
 * The business phone is the provider's own; the PMDC number is sent for doctors only.
 */
export const businessProfileToPayload = (
  serviceType: ServiceType,
  subType: SubType,
  form: BusinessProfileForm,
  phone: string,
) => {
  const pmdc = form.details.pmdcNumber?.trim().toUpperCase();
  return {
    serviceType,
    subType,
    name: form.name.trim(),
    phone,
    city: form.city,
    addressLine: form.address.trim(),
    ...(form.location ? { lat: coord(form.location.lat), lng: coord(form.location.lng) } : null),
    ...(subType === 'doctor' && pmdc ? { pmdcNumber: pmdc } : null),
  };
};

/** Business → form values (resume a draft, edit after rejection). */
export const businessToProfileForm = (business: Business): BusinessProfileForm => ({
  name: business.name,
  city: business.city,
  address: business.address,
  location: business.location,
  details: business.pmdcNumber ? { pmdcNumber: business.pmdcNumber } : {},
});

/** Has the provider saved their professional info (so setup can resume past it)? */
export const isProfileComplete = (business: Business | null): boolean =>
  !!business && !!business.name && !!business.city && !!business.address;

// ─── Admin decisions ─────────────────────────────────
/** The partner reads this reason, so it must say something. */
export const MIN_REASON_LENGTH = 10;

export const validateDecisionReason = (reason: string): ValidationErrors => {
  const errors: ValidationErrors = {};
  const trimmed = reason.trim();
  if (!trimmed) errors.reason = 'Give the partner a reason';
  else if (trimmed.length < MIN_REASON_LENGTH) errors.reason = `Use at least ${MIN_REASON_LENGTH} characters`;
  return errors;
};

/**
 * The API's reject body: only notes with text, as
 * `[{ documentId, note }]` (RejectBusinessDto.documentNotes, note 2–500).
 */
export const cleanDocumentNotes = (notes: Record<string, string>): { documentId: string; note: string }[] =>
  Object.entries(notes)
    .map(([documentId, note]) => ({ documentId, note: note.trim().slice(0, 500) }))
    .filter(n => n.note.length >= 2);
