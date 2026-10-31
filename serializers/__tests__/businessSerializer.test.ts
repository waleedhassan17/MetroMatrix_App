import {
  businessPageSerializer,
  businessSerializer,
  businessStatusSerializer,
  businessSummarySerializer,
  businessWithOwnerSerializer,
  documentSerializer,
} from '../businessSerializer';

const doc = (kind: string, status = 'pending', extra: Record<string, unknown> = {}) => ({
  id: `d-${kind}`,
  kind,
  url: `https://res.cloudinary.com/x/${kind}.jpg`,
  publicId: `x/${kind}`,
  status,
  reviewNote: null,
  createdAt: '2026-10-01T00:00:00Z',
  ...extra,
});

// The API's BusinessDetail (businesses.service.ts), without the requirement lists.
const rawBusiness = {
  id: 'b1',
  serviceType: 'healthcare',
  subType: 'doctor',
  name: 'Dr. Ayesha Clinic',
  slug: 'dr-ayesha-clinic',
  phone: '+924235761234',
  city: 'Lahore',
  addressLine: '12 Main Boulevard, Gulberg',
  lat: 31.5,
  lng: 74.35,
  pmdcNumber: '12345-P',
  status: 'draft',
  documents: [doc('cnic_front')],
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-02T00:00:00Z',
};

describe('documentSerializer', () => {
  it("maps the API's DocumentView and infers a PDF mime type from the URL", () => {
    expect(
      documentSerializer(doc('pmdc_certificate', 'rejected', { url: 'https://x/a.PDF', reviewNote: 'Blurry' })),
    ).toMatchObject({
      kind: 'pmdc_certificate',
      status: 'rejected',
      mimeType: 'application/pdf',
      reviewerNote: 'Blurry',
      uploadedAt: '2026-10-01T00:00:00Z',
    });
  });

  it.each([null, {}, { kind: 'cnic_front' }, { url: 'https://x' }, { kind: 'cnic', url: 'https://x' }])(
    'returns null for %p',
    raw => {
      expect(documentSerializer(raw)).toBeNull();
    },
  );

  it('defaults an unknown status to pending', () => {
    expect(documentSerializer(doc('cnic_back', 'weird'))?.status).toBe('pending');
  });
});

describe('businessSerializer', () => {
  it("maps the API's names: addressLine, lat / lng, pmdcNumber", () => {
    const b = businessSerializer(rawBusiness)!;
    expect(b.subType).toBe('doctor');
    expect(b.address).toBe('12 Main Boulevard, Gulberg');
    expect(b.location).toEqual({ lat: 31.5, lng: 74.35 });
    expect(b.pmdcNumber).toBe('12345-P');
    expect(b.documents).toHaveLength(1);
  });

  it('keeps a PMDC number for doctors only, and reads no pin from null coordinates', () => {
    const b = businessSerializer({ ...rawBusiness, subType: 'store', serviceType: 'shopping', lat: null, lng: null })!;
    expect(b.pmdcNumber).toBeNull();
    expect(b.location).toBeNull();
  });

  it('evaluates the requirements on the device when the server omits them', () => {
    const b = businessSerializer(rawBusiness)!;
    expect(b.requiredDocuments).toEqual([
      { kind: 'cnic_front', min: 1, have: 1, satisfied: true },
      { kind: 'cnic_back', min: 1, have: 0, satisfied: false },
      { kind: 'pmdc_certificate', min: 1, have: 0, satisfied: false },
      { kind: 'degree_certificate', min: 1, have: 0, satisfied: false },
    ]);
    expect(b.missingDocuments).toEqual(['cnic_back', 'pmdc_certificate', 'degree_certificate']);
  });

  it('counts a rejected document as missing', () => {
    const b = businessSerializer({ ...rawBusiness, documents: [doc('cnic_front', 'rejected')] })!;
    expect(b.missingDocuments).toContain('cnic_front');
  });

  it("prefers the server's lists when present, any-of keys included", () => {
    const b = businessSerializer({
      ...rawBusiness,
      subType: 'store',
      requiredDocuments: [
        { anyOf: ['ntn_certificate', 'shop_photo'], min: 1, have: 0, satisfied: false },
        { kind: 'passport', min: 1, have: 0, satisfied: false },
      ],
      missingDocuments: ['ntn_certificate|shop_photo', '', 3],
    })!;
    expect(b.requiredDocuments).toEqual([{ anyOf: ['ntn_certificate', 'shop_photo'], min: 1, have: 0, satisfied: false }]);
    expect(b.missingDocuments).toEqual(['ntn_certificate|shop_photo']);
  });

  it('still reads the older names (address, location)', () => {
    const b = businessSerializer({ subType: 'store', address: 'Old Road', location: { lat: 1, lng: 2 } })!;
    expect(b.address).toBe('Old Road');
    expect(b.location).toEqual({ lat: 1, lng: 2 });
  });

  it('derives serviceType from subType when missing or invalid', () => {
    expect(businessSerializer({ ...rawBusiness, serviceType: undefined })?.serviceType).toBe('healthcare');
    expect(businessSerializer({ ...rawBusiness, subType: 'home_kitchen', serviceType: 'cars' })?.serviceType).toBe('food');
  });

  it.each([null, 'b', [], {}, { subType: 'spaceship' }])('returns null for %p', raw => {
    expect(businessSerializer(raw)).toBeNull();
  });

  it('survives garbage in every optional field', () => {
    const b = businessSerializer({
      subType: 'store',
      documents: 'nope',
      lat: 'x',
      requiredDocuments: 'nope',
      status: 'flying',
      name: 12,
    })!;
    expect(b.documents).toEqual([]);
    expect(b.location).toBeNull();
    expect(b.requiredDocuments).toHaveLength(3);
    expect(b.status).toBe('draft');
    expect(b.name).toBe('12');
  });
});

describe('admin serializers', () => {
  it("attaches the API's owner (displayName), defaulting missing fields", () => {
    const b = businessWithOwnerSerializer({ ...rawBusiness, owner: { id: 'u1', displayName: 'Ayesha', email: 'a@x.com' } })!;
    expect(b.owner).toEqual({ id: 'u1', name: 'Ayesha', email: 'a@x.com', phone: null });
    expect(businessWithOwnerSerializer({ ...rawBusiness, owner: null })?.owner.name).toBe('');
  });

  it("reads the API's Paged list and skips malformed rows", () => {
    const page = businessPageSerializer({
      items: [
        { id: 'b1', subType: 'store', name: 'Shop', submittedAt: '2026-10-10', owner: { displayName: 'A', email: 'a@x' } },
        { id: '', subType: 'store' },
        { id: 'b3', subType: 'unknown' },
        'junk',
      ],
      total: 45,
      page: 2,
      pageSize: 20,
    });
    expect(page.items.map(i => i.id)).toEqual(['b1']);
    expect(page.items[0].serviceType).toBe('shopping');
    expect(page.items[0].owner.name).toBe('A');
    expect(page.nextCursor).toBe('3');
    expect(businessPageSerializer({ items: [], total: 45, page: 3, pageSize: 20 }).nextCursor).toBeNull();
  });

  it('accepts a bare array page and a missing cursor', () => {
    const page = businessPageSerializer([{ id: 'b1', subType: 'doctor' }]);
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
    expect(businessSummarySerializer({ id: 'b1', subType: 'doctor' })?.name).toBe('Unnamed business');
  });

  it('reads a status poll; null without a valid status', () => {
    const info = businessStatusSerializer({
      status: 'rejected',
      rejectionReason: 'PMDC expired',
      documents: [{ id: 'd1', kind: 'pmdc_certificate', status: 'rejected', reviewNote: 'Expired in 2024' }, 'x', { kind: 'cnic' }],
    });
    expect(info).toEqual({
      status: 'rejected',
      rejectionReason: 'PMDC expired',
      suspensionReason: null,
      documents: [{ id: 'd1', kind: 'pmdc_certificate', status: 'rejected', reviewerNote: 'Expired in 2024' }],
    });
    expect(businessStatusSerializer({ status: 'gone' })).toBeNull();
  });
});
