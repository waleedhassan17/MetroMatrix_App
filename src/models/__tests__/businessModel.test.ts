import {
  BUSINESS_FORM_SCHEMA,
  DOCUMENT_LABELS,
  REQUIRED_DOCUMENTS,
  SERVICE_SUBTYPES,
  SUBTYPE_SERVICE,
  allDetailFields,
  businessProfileToPayload,
  businessToProfileForm,
  cleanDocumentNotes,
  emptyBusinessProfile,
  isProfileComplete,
  missingDocuments,
  providerTypeLabel,
  validateBusinessProfile,
  validateDecisionReason,
  type BusinessProfileForm,
} from '../businessModel';
import type { Business, SubType } from '../../types/auth';

const SUB_TYPES: SubType[] = ['store', 'doctor', 'restaurant', 'home_kitchen', 'cloud_kitchen'];

const filled = (overrides: Partial<BusinessProfileForm> = {}): BusinessProfileForm => ({
  name: 'Karahi House',
  city: 'Lahore',
  address: '12 Main Boulevard, Gulberg',
  location: null,
  details: {
    cuisine: 'BBQ',
    dailyCapacity: '20',
    specialty: 'Dermatologist',
    pmdcNumber: '12345-P',
    storeCategory: 'Grocery',
    experience: '6',
    briefDescription: 'Fresh food made to order every single day.',
  },
  ...overrides,
});

describe('services and sub-types (Provider Selection)', () => {
  it('every sub-type belongs to exactly one service, and back', () => {
    for (const [service, subs] of Object.entries(SERVICE_SUBTYPES)) {
      for (const sub of subs) expect(SUBTYPE_SERVICE[sub]).toBe(service);
    }
    expect(Object.keys(SUBTYPE_SERVICE).sort()).toEqual([...SUB_TYPES].sort());
  });

  it('Food expands to restaurant, home kitchen and cloud kitchen', () => {
    expect(SERVICE_SUBTYPES.food).toEqual(['restaurant', 'home_kitchen', 'cloud_kitchen']);
  });

  it('labels the provider badge', () => {
    expect(providerTypeLabel('doctor')).toBe('Doctor');
    expect(providerTypeLabel('store')).toBe('Vendor');
    expect(providerTypeLabel('home_kitchen')).toBe('Home Kitchen');
    expect(providerTypeLabel(null)).toBe('Service Provider');
  });
});

describe('REQUIRED_DOCUMENTS (the FYP list)', () => {
  it.each(SUB_TYPES)('%s requires the CNIC, each document labelled', sub => {
    expect(REQUIRED_DOCUMENTS[sub][0]).toBe('cnic');
    for (const kind of REQUIRED_DOCUMENTS[sub]) expect(DOCUMENT_LABELS[kind].label).toBeTruthy();
  });

  it('doctors upload a medical license and degree; vendors a business license', () => {
    expect(REQUIRED_DOCUMENTS.doctor).toEqual(['cnic', 'medical_license', 'degree_certificate']);
    expect(REQUIRED_DOCUMENTS.store).toEqual(['cnic', 'business_license']);
    expect(REQUIRED_DOCUMENTS.home_kitchen).toEqual(['cnic', 'kitchen_photo']);
    expect(DOCUMENT_LABELS.cnic.label).toBe('National ID Card (CNIC)');
  });
});

describe('missingDocuments', () => {
  it('lists required kinds without a standing upload', () => {
    expect(missingDocuments('doctor', [{ kind: 'cnic', status: 'pending' }])).toEqual([
      'medical_license',
      'degree_certificate',
    ]);
  });
  it('counts rejected uploads as missing and ignores extras', () => {
    expect(
      missingDocuments('home_kitchen', [
        { kind: 'cnic', status: 'rejected' },
        { kind: 'kitchen_photo', status: 'accepted' },
        { kind: 'medical_license', status: 'pending' },
      ]),
    ).toEqual(['cnic']);
  });
});

describe('BUSINESS_FORM_SCHEMA (PersonalInfo step 2)', () => {
  it('doctors: specialty first, then PMDC no., experience, description', () => {
    expect(allDetailFields('doctor').map(d => d.key)).toEqual(['specialty', 'pmdcNumber', 'experience', 'briefDescription']);
    expect(BUSINESS_FORM_SCHEMA.doctor.nameLabel).toBe('Professional/Clinic Name');
  });
  it('home kitchens show kitchen fields', () => {
    expect(allDetailFields('home_kitchen').map(d => d.key)).toEqual(['cuisine', 'dailyCapacity', 'experience', 'briefDescription']);
    expect(BUSINESS_FORM_SCHEMA.home_kitchen.nameLabel).toBe('Kitchen Name');
  });
  it('vendors pick a category and name their business', () => {
    expect(allDetailFields('store').map(d => d.key)).toEqual(['storeCategory', 'experience', 'briefDescription']);
    expect(BUSINESS_FORM_SCHEMA.store.nameLabel).toBe('Business Name');
  });
});

describe('validateBusinessProfile', () => {
  it.each(SUB_TYPES)('accepts a complete %s profile', sub => {
    expect(validateBusinessProfile(sub, filled())).toEqual({});
  });

  it('reports every core field on an empty form', () => {
    const errors = validateBusinessProfile('restaurant', emptyBusinessProfile());
    expect(Object.keys(errors).sort()).toEqual(['address', 'briefDescription', 'city', 'cuisine', 'experience', 'name']);
    expect(errors.name).toBe('Restaurant Name is required');
  });

  it('checks numbers and the description length', () => {
    expect(validateBusinessProfile('home_kitchen', filled({ details: { ...filled().details, dailyCapacity: 'ten' } })).dailyCapacity).toBe(
      'Enter a whole number',
    );
    expect(validateBusinessProfile('home_kitchen', filled({ details: { ...filled().details, dailyCapacity: '0' } })).dailyCapacity).toBe(
      'Enter at least 1',
    );
    expect(validateBusinessProfile('doctor', filled({ details: { ...filled().details, briefDescription: 'Short' } })).briefDescription).toBe(
      'Write at least 20 characters',
    );
  });

  it('asks for a real address', () => {
    expect(validateBusinessProfile('store', filled({ address: 'abc' })).address).toBe('Add the street and area');
  });
});

describe('payload and form mapping', () => {
  it("uses the provider's phone and only the sub-type's detail keys", () => {
    const payload = businessProfileToPayload('food', 'restaurant', filled(), '+924235761234');
    expect(payload.phone).toBe('+924235761234');
    expect(payload.details).toEqual({
      cuisine: 'BBQ',
      experience: '6',
      briefDescription: 'Fresh food made to order every single day.',
    });
    expect(payload.serviceType).toBe('food');
  });

  it('round-trips a saved business into the form', () => {
    const business = {
      name: 'Shop',
      city: 'Karachi',
      address: 'Block 5, Clifton',
      location: { lat: 1, lng: 2 },
      details: { storeCategory: 'Fashion' },
    } as unknown as Business;
    expect(businessToProfileForm(business)).toEqual({
      name: 'Shop',
      city: 'Karachi',
      address: 'Block 5, Clifton',
      location: { lat: 1, lng: 2 },
      details: { storeCategory: 'Fashion' },
    });
  });

  it('knows when the professional info has been saved', () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete({ name: 'a', city: 'c', address: 'x' } as Business)).toBe(true);
    expect(isProfileComplete({ name: 'a', city: '', address: 'x' } as Business)).toBe(false);
  });
});

describe('admin decisions', () => {
  it('requires a reason the partner can act on', () => {
    expect(validateDecisionReason('').reason).toBe('Give the partner a reason');
    expect(validateDecisionReason('  short  ').reason).toMatch(/at least 10/);
    expect(validateDecisionReason('The PMDC certificate has expired.')).toEqual({});
  });

  it('sends only non-empty, trimmed document notes', () => {
    expect(cleanDocumentNotes({ d1: '  Blurry  ', d2: '   ', d3: '' })).toEqual({ d1: 'Blurry' });
  });
});
