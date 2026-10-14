// ═══════════════════════════════════════════════════════
// MetroMatrix — Business (partner) model
// ═══════════════════════════════════════════════════════
// Which services offer which sub-types, which form fields each sub-type
// shows, which documents it must upload (mirroring the API's
// required-documents.ts), and the human labels for all of it.
// TODO(API_AUTH): confirm REQUIRED_DOCUMENTS and the `details` keys.

import type { Business, BusinessDocument, DocumentKind, GeoPoint, ServiceType, SubType } from '../types/auth';
import { isValidPkPhone, PK_PHONE_MESSAGE } from '../utils/phone';
import { toPkPhone, type ValidationErrors } from './authModel';

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
    partnerTitle: 'Shopping store',
    description: 'Sell your products to customers across your city.',
  },
  healthcare: {
    title: 'Healthcare',
    partnerTitle: 'Healthcare doctor',
    description: 'Offer consultations and manage your appointments.',
  },
  food: {
    title: 'Food',
    partnerTitle: 'Food',
    description: 'Take orders from a restaurant, your home or a delivery kitchen.',
  },
};

export const SUBTYPE_LABELS: Record<SubType, { title: string; description: string }> = {
  store: { title: 'Store', description: 'A shop with products to sell.' },
  doctor: { title: 'Doctor', description: 'A PMDC-registered practitioner.' },
  restaurant: { title: 'Restaurant', description: 'Dine-in or takeaway with a public address.' },
  home_kitchen: { title: 'Home kitchen', description: 'Home-cooked food from your own kitchen.' },
  cloud_kitchen: { title: 'Cloud kitchen', description: 'A delivery-only commercial kitchen.' },
};

// ─── Documents ───────────────────────────────────────
export const REQUIRED_DOCUMENTS: Record<SubType, DocumentKind[]> = {
  store: ['cnic_front', 'cnic_back', 'storefront_photo'],
  doctor: ['cnic_front', 'cnic_back', 'pmdc_certificate', 'medical_degree'],
  restaurant: ['cnic_front', 'cnic_back', 'food_license', 'storefront_photo'],
  home_kitchen: ['cnic_front', 'cnic_back', 'kitchen_photo'],
  cloud_kitchen: ['cnic_front', 'cnic_back', 'food_license', 'kitchen_photo'],
};

export const DOCUMENT_LABELS: Record<DocumentKind, { label: string; hint: string }> = {
  cnic_front: { label: 'CNIC — front', hint: 'A clear photo of the front of your CNIC.' },
  cnic_back: { label: 'CNIC — back', hint: 'The back of the same CNIC.' },
  storefront_photo: { label: 'Storefront photo', hint: 'Your shop front with the signboard visible.' },
  pmdc_certificate: {
    label: 'PMDC registration certificate',
    hint: 'Your current Pakistan Medical and Dental Council certificate.',
  },
  medical_degree: { label: 'Medical degree', hint: 'MBBS, BDS or equivalent.' },
  food_license: { label: 'Food authority licence', hint: 'Your provincial food authority licence.' },
  kitchen_photo: { label: 'Kitchen photo', hint: 'A clear photo of the kitchen you cook in.' },
};

/** Required kinds with no uploaded document that is still standing. */
export const missingDocuments = (subType: SubType, documents: Pick<BusinessDocument, 'kind' | 'status'>[]): DocumentKind[] => {
  const present = new Set(documents.filter(d => d.status !== 'rejected').map(d => d.kind));
  return REQUIRED_DOCUMENTS[subType].filter(kind => !present.has(kind));
};

// ─── Profile form ────────────────────────────────────
export const CITIES = [
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
].map(c => ({ value: c, label: c }));

export const STORE_CATEGORIES = ['Grocery', 'Fashion', 'Electronics', 'Home and living', 'Beauty', 'Pharmacy', 'Other'].map(
  c => ({ value: c, label: c }),
);

export const SPECIALTIES = [
  'General physician',
  'Paediatrics',
  'Gynaecology',
  'Dermatology',
  'Cardiology',
  'Orthopaedics',
  'Psychiatry',
  'Dentistry',
  'ENT',
  'Other',
].map(c => ({ value: c, label: c }));

export const CUISINES = ['Pakistani', 'BBQ', 'Chinese', 'Fast food', 'Desi home food', 'Bakery', 'Healthy', 'Other'].map(c => ({
  value: c,
  label: c,
}));

export type DetailKey = 'storeCategory' | 'specialty' | 'pmdcNumber' | 'cuisine' | 'dailyCapacity';

export interface DetailFieldSpec {
  key: DetailKey;
  label: string;
  kind: 'text' | 'number' | 'picker';
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
  details: DetailFieldSpec[];
}

const cuisine: DetailFieldSpec = {
  key: 'cuisine',
  label: 'Cuisine',
  kind: 'picker',
  placeholder: 'Choose a cuisine',
  options: CUISINES,
  required: true,
};

export const BUSINESS_FORM_SCHEMA: Record<SubType, BusinessFormSchema> = {
  store: {
    nameLabel: 'Store name',
    namePlaceholder: 'Al-Noor General Store',
    addressLabel: 'Store address',
    details: [
      {
        key: 'storeCategory',
        label: 'What do you sell?',
        kind: 'picker',
        placeholder: 'Choose a category',
        options: STORE_CATEGORIES,
        required: true,
      },
    ],
  },
  doctor: {
    nameLabel: 'Clinic or practice name',
    namePlaceholder: 'Dr. Ayesha Khan Clinic',
    addressLabel: 'Clinic address',
    details: [
      {
        key: 'specialty',
        label: 'Specialty',
        kind: 'picker',
        placeholder: 'Choose your specialty',
        options: SPECIALTIES,
        required: true,
      },
      {
        key: 'pmdcNumber',
        label: 'PMDC registration number',
        kind: 'text',
        placeholder: '12345-P',
        helper: 'As printed on your PMDC certificate.',
        required: true,
      },
    ],
  },
  restaurant: {
    nameLabel: 'Restaurant name',
    namePlaceholder: 'Butt Karahi',
    addressLabel: 'Restaurant address',
    details: [cuisine],
  },
  home_kitchen: {
    nameLabel: 'Kitchen name',
    namePlaceholder: "Ammi's Kitchen",
    addressLabel: 'Pickup area',
    addressHelper: 'Your area and street. Customers see only the area until they order.',
    details: [
      cuisine,
      {
        key: 'dailyCapacity',
        label: 'Meals you can cook a day',
        kind: 'number',
        placeholder: '20',
        helper: 'Orders stop for the day when you reach it.',
        required: true,
      },
    ],
  },
  cloud_kitchen: {
    nameLabel: 'Kitchen name',
    namePlaceholder: 'Late Night Bites',
    addressLabel: 'Kitchen address',
    details: [cuisine],
  },
};

export interface BusinessProfileForm {
  name: string;
  /** National part only (the field shows +92). Mobile or landline. */
  phone: string;
  city: string;
  address: string;
  location: GeoPoint | null;
  details: Partial<Record<DetailKey, string>>;
}

export const emptyBusinessProfile = (): BusinessProfileForm => ({
  name: '',
  phone: '',
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

  const phone = toPkPhone(form.phone);
  if (!phone) errors.phone = 'Business phone is required';
  else if (!isValidPkPhone(phone)) errors.phone = PK_PHONE_MESSAGE;

  if (!form.city) errors.city = 'Choose a city';
  if (!form.address.trim()) errors.address = `${schema.addressLabel} is required`;
  else if (form.address.trim().length < 5) errors.address = 'Add the street and area';

  for (const field of schema.details) {
    const value = (form.details[field.key] ?? '').trim();
    if (field.required && !value) {
      errors[field.key] = `${field.label} is required`;
    } else if (field.kind === 'number' && value && !/^\d{1,4}$/.test(value)) {
      errors[field.key] = 'Enter a whole number';
    } else if (field.kind === 'number' && value && Number(value) < 1) {
      errors[field.key] = 'Enter at least 1';
    }
  }
  return errors;
};

/** Form → the create/PATCH body. Only the sub-type's own detail keys are sent. */
export const businessProfileToPayload = (serviceType: ServiceType, subType: SubType, form: BusinessProfileForm) => {
  const details: Record<string, string> = {};
  for (const field of BUSINESS_FORM_SCHEMA[subType].details) {
    const value = form.details[field.key]?.trim();
    if (value) details[field.key] = value;
  }
  return {
    serviceType,
    subType,
    name: form.name.trim(),
    phone: toPkPhone(form.phone) ?? '',
    city: form.city,
    address: form.address.trim(),
    location: form.location,
    details,
  };
};

/** Business → form values (resume a draft, edit after rejection). */
export const businessToProfileForm = (business: Business): BusinessProfileForm => ({
  name: business.name,
  phone: business.phone.startsWith('+92') ? business.phone.slice(3) : business.phone.replace(/\D/g, ''),
  city: business.city,
  address: business.address,
  location: business.location,
  details: { ...business.details },
});

/** Has the partner saved a complete profile (so setup can resume past it)? */
export const isProfileComplete = (business: Business | null): boolean =>
  !!business && !!business.name && !!business.phone && !!business.city && !!business.address;

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
