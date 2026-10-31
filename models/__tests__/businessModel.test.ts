import {
  BUSINESS_FORM_SCHEMA,
  DOCUMENT_LABELS,
  DOCUMENT_REQUIREMENTS,
  SERVICE_SUBTYPES,
  SUBTYPE_SERVICE,
  allDetailFields,
  businessProfileToPayload,
  businessToProfileForm,
  cleanDocumentNotes,
  documentSlots,
  emptyBusinessProfile,
  evaluateDocuments,
  isProfileComplete,
  missingDocuments,
  providerTypeLabel,
  requirementLabel,
  validateBusinessProfile,
  validateDecisionReason,
  type BusinessProfileForm,
} from '../businessModel';
import type { Business, BusinessDocument, DocumentKind, SubType } from '../auth';

const SUB_TYPES: SubType[] = ['store', 'doctor', 'restaurant', 'home_kitchen', 'cloud_kitchen'];

const filled = (overrides: Partial<BusinessProfileForm> = {}): BusinessProfileForm => ({
  name: 'Karahi House',
  city: 'Lahore',
  address: '12 Main Boulevard, Gulberg',
  location: null,
  details: { pmdcNumber: '12345-P' },
  ...overrides,
});

let seq = 0;
const doc = (kind: DocumentKind, status: BusinessDocument['status'] = 'pending'): BusinessDocument => ({
  id: `d${++seq}`,
  kind,
  url: `https://res.cloudinary.com/x/${kind}.jpg`,
  publicId: kind,
  mimeType: 'image/jpeg',
  status,
  reviewerNote: null,
  uploadedAt: '',
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

describe("DOCUMENT_REQUIREMENTS (the API's required-documents.ts)", () => {
  it.each(SUB_TYPES)('%s requires both sides of the CNIC, each kind labelled', sub => {
    expect(DOCUMENT_REQUIREMENTS[sub].slice(0, 2)).toEqual([{ kind: 'cnic_front' }, { kind: 'cnic_back' }]);
    for (const r of DOCUMENT_REQUIREMENTS[sub]) {
      for (const kind of 'anyOf' in r ? r.anyOf : [r.kind]) expect(DOCUMENT_LABELS[kind].label).toBeTruthy();
    }
  });

  it('matches the API per sub-type', () => {
    expect(DOCUMENT_REQUIREMENTS.doctor.slice(2)).toEqual([{ kind: 'pmdc_certificate' }, { kind: 'degree_certificate' }]);
    expect(DOCUMENT_REQUIREMENTS.store.slice(2)).toEqual([{ anyOf: ['ntn_certificate', 'shop_photo'] }]);
    expect(DOCUMENT_REQUIREMENTS.restaurant.slice(2)).toEqual([{ kind: 'pfa_licence' }, { kind: 'storefront_photo' }]);
    expect(DOCUMENT_REQUIREMENTS.cloud_kitchen.slice(2)).toEqual([{ kind: 'pfa_licence' }]);
    expect(DOCUMENT_REQUIREMENTS.home_kitchen.slice(2)).toEqual([{ kind: 'kitchen_photo', min: 2 }]);
  });

  it('labels a requirement key, any-of included', () => {
    expect(requirementLabel('cnic_front')).toBe('CNIC (front)');
    expect(requirementLabel('ntn_certificate|shop_photo')).toBe('NTN certificate or Shop photo');
  });
});

describe('evaluateDocuments / missingDocuments', () => {
  it('lists the keys of requirements not yet met, as the API names them', () => {
    expect(missingDocuments('doctor', [doc('cnic_front')])).toEqual(['cnic_back', 'pmdc_certificate', 'degree_certificate']);
    expect(missingDocuments('store', [doc('cnic_front'), doc('cnic_back')])).toEqual(['ntn_certificate|shop_photo']);
  });

  it('either kind meets an any-of', () => {
    expect(missingDocuments('store', [doc('cnic_front'), doc('cnic_back'), doc('shop_photo')])).toEqual([]);
  });

  it('counts copies against a minimum, and rejected ones not at all', () => {
    const one = [doc('cnic_front'), doc('cnic_back'), doc('kitchen_photo'), doc('kitchen_photo', 'rejected')];
    const { requirements, missing } = evaluateDocuments('home_kitchen', one);
    expect(missing).toEqual(['kitchen_photo']);
    expect(requirements[2]).toEqual({ kind: 'kitchen_photo', min: 2, have: 1, satisfied: false });
    expect(missingDocuments('home_kitchen', [...one, doc('kitchen_photo')])).toEqual([]);
  });

  it('ignores kinds the sub-type does not need', () => {
    expect(
      missingDocuments('cloud_kitchen', [doc('cnic_front', 'rejected'), doc('cnic_back'), doc('pfa_licence'), doc('pmdc_certificate')]),
    ).toEqual(['cnic_front']);
  });
});

describe('documentSlots (PersonalInfo step 3 tiles)', () => {
  it('a minimum of two is two tiles, filled in order', () => {
    const photo = doc('kitchen_photo');
    const slots = documentSlots('home_kitchen', [photo]);
    expect(slots.map(x => x.key)).toEqual(['cnic_front', 'cnic_back', 'kitchen_photo', 'kitchen_photo#2']);
    expect(slots.map(x => x.label).slice(2)).toEqual(['Kitchen photo 1', 'Kitchen photo 2']);
    expect(slots[2].doc).toBe(photo);
    expect(slots[3].doc).toBeNull();
    expect(slots.every(x => x.requirement === x.key.split('#')[0])).toBe(true);
  });

  it('an any-of is one tile offering both kinds', () => {
    const shop = doc('shop_photo');
    const slot = documentSlots('store', [shop])[2];
    expect(slot).toMatchObject({ key: 'ntn_certificate|shop_photo', kinds: ['ntn_certificate', 'shop_photo'], doc: shop });
    expect(slot.label).toBe('NTN certificate or Shop photo');
  });

  it('a standing document fills the tile before a rejected one', () => {
    const rejected = doc('cnic_front', 'rejected');
    const fresh = doc('cnic_front');
    expect(documentSlots('doctor', [rejected, fresh])[0].doc).toBe(fresh);
    expect(documentSlots('doctor', [rejected])[0].doc).toBe(rejected);
  });
});

describe('BUSINESS_FORM_SCHEMA (PersonalInfo step 2: only what the API stores)', () => {
  it('doctors add their PMDC number after the address', () => {
    expect(allDetailFields('doctor').map(d => d.key)).toEqual(['pmdcNumber']);
    expect(BUSINESS_FORM_SCHEMA.doctor.nameLabel).toBe('Professional/Clinic Name');
  });
  it.each(['store', 'restaurant', 'home_kitchen', 'cloud_kitchen'] as SubType[])('%s asks only name, city and address', sub => {
    expect(allDetailFields(sub)).toEqual([]);
  });
  it('names the business per sub-type', () => {
    expect(BUSINESS_FORM_SCHEMA.home_kitchen.nameLabel).toBe('Kitchen Name');
    expect(BUSINESS_FORM_SCHEMA.store.nameLabel).toBe('Business Name');
  });
});

describe('validateBusinessProfile', () => {
  it.each(SUB_TYPES)('accepts a complete %s profile', sub => {
    expect(validateBusinessProfile(sub, filled())).toEqual({});
  });

  it('reports every core field on an empty form', () => {
    const errors = validateBusinessProfile('restaurant', emptyBusinessProfile());
    expect(Object.keys(errors).sort()).toEqual(['address', 'city', 'name']);
    expect(errors.name).toBe('Restaurant Name is required');
  });

  it("a doctor needs a PMDC number in the API's format", () => {
    expect(validateBusinessProfile('doctor', filled({ details: {} })).pmdcNumber).toBe('PMDC Registration Number is required');
    expect(validateBusinessProfile('doctor', filled({ details: { pmdcNumber: '12 34' } })).pmdcNumber).toMatch(/e\.g\. 12345-P/);
    expect(validateBusinessProfile('doctor', filled({ details: { pmdcNumber: '12345-p' } }))).toEqual({});
    expect(validateBusinessProfile('store', filled({ details: {} }))).toEqual({});
  });

  it('asks for a real address', () => {
    expect(validateBusinessProfile('store', filled({ address: 'abc' })).address).toBe('Add the street and area');
  });
});

describe('payload and form mapping', () => {
  it("sends the API's CreateBusinessDto: addressLine, no PMDC for a non-doctor", () => {
    expect(businessProfileToPayload('food', 'restaurant', filled(), '+924235761234')).toEqual({
      serviceType: 'food',
      subType: 'restaurant',
      name: 'Karahi House',
      phone: '+924235761234',
      city: 'Lahore',
      addressLine: '12 Main Boulevard, Gulberg',
    });
  });

  it('a doctor sends the PMDC number upper-cased, and a pin as lat / lng to 6 places', () => {
    const payload = businessProfileToPayload(
      'healthcare',
      'doctor',
      filled({ details: { pmdcNumber: ' 12345-p ' }, location: { lat: 31.5203696123, lng: 74.3587473987 } }),
      '+923001234567',
    );
    expect(payload).toMatchObject({ pmdcNumber: '12345-P', lat: 31.52037, lng: 74.358747 });
  });

  it('round-trips a saved business into the form', () => {
    const business = {
      name: 'Shop',
      city: 'Karachi',
      address: 'Block 5, Clifton',
      location: { lat: 1, lng: 2 },
      pmdcNumber: '777-P',
    } as unknown as Business;
    expect(businessToProfileForm(business)).toEqual({
      name: 'Shop',
      city: 'Karachi',
      address: 'Block 5, Clifton',
      location: { lat: 1, lng: 2 },
      details: { pmdcNumber: '777-P' },
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

  it("sends the API's [{ documentId, note }]: trimmed, 2–500 characters", () => {
    expect(cleanDocumentNotes({ d1: '  Blurry  ', d2: '   ', d3: '', d4: 'x', d5: 'y'.repeat(600) })).toEqual([
      { documentId: 'd1', note: 'Blurry' },
      { documentId: 'd5', note: 'y'.repeat(500) },
    ]);
  });
});
