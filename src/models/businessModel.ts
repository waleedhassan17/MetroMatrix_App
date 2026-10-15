// ═══════════════════════════════════════════════════════
// MetroMatrix — Provider (business) model
// ═══════════════════════════════════════════════════════
// Provider Selection's choices, the professional fields PersonalInfo shows
// for each sub-type, and the documents each must upload — the FYP app's
// provider-info flow, mapped onto MetroMatrix's services:
//
//   Doctor (healthcare)  specialty, clinic name, PMDC no., experience, about
//                        docs: CNIC, medical licence, degree certificate
//   Food                 restaurant / home kitchen / cloud kitchen
//                        cuisine (+ daily capacity for home kitchens)
//                        docs: CNIC + food licence (home kitchen: kitchen photo)
//   Vendor (shopping)    category, store name, experience, about
//                        docs: CNIC, business licence
// TODO(API_AUTH): confirm REQUIRED_DOCUMENTS and the `details` keys.

import type { Business, BusinessDocument, DocumentKind, GeoPoint, ServiceType, SubType } from '../types/auth';
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
    title: 'Food',
    partnerTitle: 'Food Partner',
    description: 'Cook and deliver meals to customers near you',
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
export const REQUIRED_DOCUMENTS: Record<SubType, DocumentKind[]> = {
  doctor: ['cnic', 'medical_license', 'degree_certificate'],
  store: ['cnic', 'business_license'],
  restaurant: ['cnic', 'food_license'],
  cloud_kitchen: ['cnic', 'food_license'],
  home_kitchen: ['cnic', 'kitchen_photo'],
};

export const DOCUMENT_LABELS: Record<DocumentKind, { label: string; hint: string }> = {
  cnic: { label: 'National ID Card (CNIC)', hint: 'Both sides of your CNIC in one clear photo or PDF.' },
  medical_license: { label: 'Medical License', hint: 'Your current PMDC registration certificate.' },
  degree_certificate: { label: 'Degree Certificate', hint: 'MBBS, BDS or equivalent.' },
  business_license: { label: 'Business License', hint: 'Trade licence or NTN certificate for your store.' },
  food_license: { label: 'Food Authority License', hint: 'Your provincial food authority licence.' },
  kitchen_photo: { label: 'Kitchen Photo', hint: 'A clear photo of the kitchen you cook in.' },
};

/** Required kinds with no uploaded document that is still standing. */
export const missingDocuments = (subType: SubType, documents: Pick<BusinessDocument, 'kind' | 'status'>[]): DocumentKind[] => {
  const present = new Set(documents.filter(d => d.status !== 'rejected').map(d => d.kind));
  return REQUIRED_DOCUMENTS[subType].filter(kind => !present.has(kind));
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
export type DetailKey =
  | 'storeCategory'
  | 'specialty'
  | 'pmdcNumber'
  | 'cuisine'
  | 'dailyCapacity'
  | 'experience'
  | 'briefDescription';

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

const experience: DetailFieldSpec = {
  key: 'experience',
  label: 'Experience',
  kind: 'number',
  placeholder: '5',
  helper: 'Years in this work.',
  required: true,
};

const about: DetailFieldSpec = {
  key: 'briefDescription',
  label: 'Brief Description',
  kind: 'multiline',
  placeholder: 'Tell us about your services...',
  required: true,
};

const cuisine: DetailFieldSpec = {
  key: 'cuisine',
  label: 'Cuisine',
  kind: 'picker',
  placeholder: 'Choose a cuisine',
  options: CUISINES,
  required: true,
};

export const BUSINESS_FORM_SCHEMA: Record<SubType, BusinessFormSchema> = {
  doctor: {
    nameLabel: 'Professional/Clinic Name',
    namePlaceholder: 'Your practice name',
    addressLabel: 'Clinic address',
    lead: [
      { key: 'specialty', label: 'Specialty', kind: 'picker', placeholder: 'Select your specialty', options: SPECIALTIES, required: true },
    ],
    details: [
      {
        key: 'pmdcNumber',
        label: 'PMDC Registration Number',
        kind: 'text',
        placeholder: '12345-P',
        helper: 'As printed on your medical license.',
        required: true,
      },
      experience,
      about,
    ],
  },
  store: {
    nameLabel: 'Business Name',
    namePlaceholder: 'Your store name',
    addressLabel: 'Store address',
    lead: [
      { key: 'storeCategory', label: 'Category', kind: 'picker', placeholder: 'Select a category', options: STORE_CATEGORIES, required: true },
    ],
    details: [experience, about],
  },
  restaurant: {
    nameLabel: 'Restaurant Name',
    namePlaceholder: 'Karahi House',
    addressLabel: 'Restaurant address',
    lead: [cuisine],
    details: [experience, about],
  },
  home_kitchen: {
    nameLabel: 'Kitchen Name',
    namePlaceholder: "Ammi's Kitchen",
    addressLabel: 'Pickup area',
    addressHelper: 'Your area and street. Customers see only the area until they order.',
    lead: [cuisine],
    details: [
      {
        key: 'dailyCapacity',
        label: 'Meals you can cook a day',
        kind: 'number',
        placeholder: '20',
        helper: 'Orders stop for the day when you reach it.',
        required: true,
      },
      experience,
      about,
    ],
  },
  cloud_kitchen: {
    nameLabel: 'Kitchen Name',
    namePlaceholder: 'Late Night Bites',
    addressLabel: 'Kitchen address',
    lead: [cuisine],
    details: [experience, about],
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
    } else if (field.kind === 'number' && value && !/^\d{1,4}$/.test(value)) {
      errors[field.key] = 'Enter a whole number';
    } else if (field.key === 'dailyCapacity' && value && Number(value) < 1) {
      errors[field.key] = 'Enter at least 1';
    } else if (field.key === 'briefDescription' && value && value.length < 20) {
      errors[field.key] = 'Write at least 20 characters';
    }
  }
  return errors;
};

/** Form → the create/PATCH body. The business phone is the provider's own. */
export const businessProfileToPayload = (
  serviceType: ServiceType,
  subType: SubType,
  form: BusinessProfileForm,
  phone: string,
) => {
  const details: Record<string, string> = {};
  for (const field of allDetailFields(subType)) {
    const value = form.details[field.key]?.trim();
    if (value) details[field.key] = value;
  }
  return {
    serviceType,
    subType,
    name: form.name.trim(),
    phone,
    city: form.city,
    address: form.address.trim(),
    location: form.location,
    details,
  };
};

/** Business → form values (resume a draft, edit after rejection). */
export const businessToProfileForm = (business: Business): BusinessProfileForm => ({
  name: business.name,
  city: business.city,
  address: business.address,
  location: business.location,
  details: { ...business.details },
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

/** Only notes with text are sent: { [documentId]: note }. */
export const cleanDocumentNotes = (notes: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(notes)
      .map(([id, note]) => [id, note.trim()] as const)
      .filter(([, note]) => note.length > 0),
  );
