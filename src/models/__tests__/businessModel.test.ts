import {
  BUSINESS_FORM_SCHEMA,
  DOCUMENT_LABELS,
  REQUIRED_DOCUMENTS,
  SERVICE_SUBTYPES,
  SUBTYPE_SERVICE,
  businessProfileToPayload,
  businessToProfileForm,
  cleanDocumentNotes,
  emptyBusinessProfile,
  isProfileComplete,
  missingDocuments,
  validateBusinessProfile,
  validateDecisionReason,
  type BusinessProfileForm,
} from '../businessModel';
import type { Business, SubType } from '../../types/auth';

const SUB_TYPES: SubType[] = ['store', 'doctor', 'restaurant', 'home_kitchen', 'cloud_kitchen'];

const filled = (overrides: Partial<BusinessProfileForm> = {}): BusinessProfileForm => ({
  name: 'Butt Karahi',
  phone: '4235761234',
  city: 'Lahore',
  address: '12 Main Boulevard, Gulberg',
  location: null,
  details: { cuisine: 'BBQ', dailyCapacity: '20', specialty: 'Dermatology', pmdcNumber: '12345-P', storeCategory: 'Grocery' },
  ...overrides,
});

describe('service and sub-type maps', () => {
  it('every sub-type belongs to exactly one service, and back', () => {
    for (const [service, subs] of Object.entries(SERVICE_SUBTYPES)) {
      for (const sub of subs) expect(SUBTYPE_SERVICE[sub]).toBe(service);
    }
    expect(Object.keys(SUBTYPE_SERVICE).sort()).toEqual([...SUB_TYPES].sort());
  });

  it('food offers restaurant, home kitchen and cloud kitchen', () => {
    expect(SERVICE_SUBTYPES.food).toEqual(['restaurant', 'home_kitchen', 'cloud_kitchen']);
  });
});

describe('REQUIRED_DOCUMENTS', () => {
  it.each(SUB_TYPES)('%s requires both sides of the CNIC, each with a human label', sub => {
    expect(REQUIRED_DOCUMENTS[sub]).toEqual(expect.arrayContaining(['cnic_front', 'cnic_back']));
    for (const kind of REQUIRED_DOCUMENTS[sub]) expect(DOCUMENT_LABELS[kind].label).toBeTruthy();
  });

  it('doctors must upload the PMDC certificate', () => {
    expect(REQUIRED_DOCUMENTS.doctor).toContain('pmdc_certificate');
    expect(DOCUMENT_LABELS.pmdc_certificate.label).toBe('PMDC registration certificate');
    expect(DOCUMENT_LABELS.cnic_front.label).toBe('CNIC — front');
  });
});

describe('missingDocuments', () => {
  it('lists required kinds without a standing upload', () => {
    expect(missingDocuments('doctor', [{ kind: 'cnic_front', status: 'pending' }])).toEqual([
      'cnic_back',
      'pmdc_certificate',
      'medical_degree',
    ]);
  });
  it('counts rejected uploads as missing and ignores extras', () => {
    expect(
      missingDocuments('home_kitchen', [
        { kind: 'cnic_front', status: 'rejected' },
        { kind: 'cnic_back', status: 'accepted' },
        { kind: 'kitchen_photo', status: 'pending' },
        { kind: 'pmdc_certificate', status: 'pending' },
      ]),
    ).toEqual(['cnic_front']);
  });
});

describe('BUSINESS_FORM_SCHEMA', () => {
  it('home kitchens show kitchen fields (QA 14)', () => {
    const keys = BUSINESS_FORM_SCHEMA.home_kitchen.details.map(d => d.key);
    expect(keys).toEqual(['cuisine', 'dailyCapacity']);
    expect(BUSINESS_FORM_SCHEMA.home_kitchen.nameLabel).toBe('Kitchen name');
  });
  it('doctors show specialty and PMDC number; stores show a category', () => {
    expect(BUSINESS_FORM_SCHEMA.doctor.details.map(d => d.key)).toEqual(['specialty', 'pmdcNumber']);
    expect(BUSINESS_FORM_SCHEMA.store.details.map(d => d.key)).toEqual(['storeCategory']);
  });
});

describe('validateBusinessProfile', () => {
  it.each(SUB_TYPES)('accepts a complete %s profile', sub => {
    expect(validateBusinessProfile(sub, filled())).toEqual({});
  });

  it('reports every core field on an empty form', () => {
    const errors = validateBusinessProfile('restaurant', emptyBusinessProfile());
    expect(Object.keys(errors).sort()).toEqual(['address', 'city', 'cuisine', 'name', 'phone']);
    expect(errors.name).toBe('Restaurant name is required');
  });

  it('accepts a landline but not a malformed phone', () => {
    expect(validateBusinessProfile('store', filled({ phone: '3124890176' })).phone).toBeUndefined();
    expect(validateBusinessProfile('store', filled({ phone: '123' })).phone).toMatch(/valid Pakistani phone/);
  });

  it('requires sub-type details and checks numbers', () => {
    expect(validateBusinessProfile('doctor', filled({ details: { specialty: 'ENT' } })).pmdcNumber).toBeDefined();
    expect(validateBusinessProfile('home_kitchen', filled({ details: { cuisine: 'BBQ', dailyCapacity: 'ten' } })).dailyCapacity).toBe(
      'Enter a whole number',
    );
    expect(validateBusinessProfile('home_kitchen', filled({ details: { cuisine: 'BBQ', dailyCapacity: '0' } })).dailyCapacity).toBe(
      'Enter at least 1',
    );
  });

  it('asks for a real address', () => {
    expect(validateBusinessProfile('store', filled({ address: 'abc' })).address).toBe('Add the street and area');
  });
});

describe('payload and form mapping', () => {
  it('sends canonical phone and only the sub-type detail keys', () => {
    const payload = businessProfileToPayload('food', 'restaurant', filled());
    expect(payload.phone).toBe('+924235761234');
    expect(payload.details).toEqual({ cuisine: 'BBQ' });
    expect(payload.serviceType).toBe('food');
  });

  it('round-trips a saved business into the form', () => {
    const business = {
      name: 'Shop',
      phone: '+923124890176',
      city: 'Karachi',
      address: 'Block 5, Clifton',
      location: { lat: 1, lng: 2 },
      details: { storeCategory: 'Fashion' },
    } as unknown as Business;
    expect(businessToProfileForm(business)).toEqual({
      name: 'Shop',
      phone: '3124890176',
      city: 'Karachi',
      address: 'Block 5, Clifton',
      location: { lat: 1, lng: 2 },
      details: { storeCategory: 'Fashion' },
    });
  });

  it('knows when a saved profile is complete', () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete({ name: 'a', phone: 'p', city: 'c', address: 'x' } as Business)).toBe(true);
    expect(isProfileComplete({ name: 'a', phone: '', city: 'c', address: 'x' } as Business)).toBe(false);
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
