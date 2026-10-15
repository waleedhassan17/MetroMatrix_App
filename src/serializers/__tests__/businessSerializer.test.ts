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
  ...extra,
});

const rawBusiness = {
  id: 'b1',
  ownerId: 'u1',
  serviceType: 'healthcare',
  subType: 'doctor',
  name: 'Dr. Ayesha Clinic',
  phone: '+924235761234',
  city: 'Lahore',
  address: '12 Main Boulevard, Gulberg',
  location: { lat: 31.5, lng: 74.35 },
  details: { specialty: 'Dermatology', pmdcNumber: '12345-P', junk: 7 },
  status: 'draft',
  documents: [doc('cnic')],
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-02T00:00:00Z',
};

describe('documentSerializer', () => {
  it('maps a document and infers a PDF mime type from the URL', () => {
    expect(documentSerializer(doc('medical_license', 'rejected', { url: 'https://x/a.PDF', note: 'Blurry' }))).toMatchObject({
      kind: 'medical_license',
      status: 'rejected',
      mimeType: 'application/pdf',
      reviewerNote: 'Blurry',
    });
  });

  it.each([null, {}, { kind: 'cnic' }, { url: 'https://x' }, { kind: 'passport', url: 'https://x' }])(
    'returns null for %p',
    raw => {
      expect(documentSerializer(raw)).toBeNull();
    },
  );

  it('defaults an unknown status to pending', () => {
    expect(documentSerializer(doc('cnic', 'weird'))?.status).toBe('pending');
  });
});

describe('businessSerializer', () => {
  it('maps a full business, keeping only string details', () => {
    const b = businessSerializer(rawBusiness)!;
    expect(b.subType).toBe('doctor');
    expect(b.location).toEqual({ lat: 31.5, lng: 74.35 });
    expect(b.details).toEqual({ specialty: 'Dermatology', pmdcNumber: '12345-P', junk: '7' });
    expect(b.documents).toHaveLength(1);
  });

  it('computes required and missing documents when the server omits them', () => {
    const b = businessSerializer(rawBusiness)!;
    expect(b.requiredDocuments).toEqual(['cnic', 'medical_license', 'degree_certificate']);
    expect(b.missingDocuments).toEqual(['medical_license', 'degree_certificate']);
  });

  it('counts a rejected document as missing', () => {
    const b = businessSerializer({ ...rawBusiness, documents: [doc('cnic', 'rejected'), doc('medical_license')] })!;
    expect(b.missingDocuments).toContain('cnic');
  });

  it("prefers the server's lists when present", () => {
    const b = businessSerializer({ ...rawBusiness, missingDocuments: ['degree_certificate', 'nonsense'] })!;
    expect(b.missingDocuments).toEqual(['degree_certificate']);
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
      location: { lat: 'x' },
      details: null,
      status: 'flying',
      name: 12,
    })!;
    expect(b.documents).toEqual([]);
    expect(b.location).toBeNull();
    expect(b.details).toEqual({});
    expect(b.status).toBe('draft');
    expect(b.name).toBe('12');
  });
});

describe('admin serializers', () => {
  it('attaches an owner, defaulting missing owner fields', () => {
    const b = businessWithOwnerSerializer({ ...rawBusiness, owner: { id: 'u1', name: 'Ayesha', email: 'a@x.com' } })!;
    expect(b.owner).toEqual({ id: 'u1', name: 'Ayesha', email: 'a@x.com', phone: null });
    expect(businessWithOwnerSerializer({ ...rawBusiness, owner: null })?.owner.name).toBe('');
  });

  it('reads a page and skips malformed rows', () => {
    const page = businessPageSerializer({
      items: [
        { id: 'b1', subType: 'store', name: 'Shop', submittedAt: '2026-10-10', owner: { name: 'A', email: 'a@x' } },
        { id: '', subType: 'store' },
        { id: 'b3', subType: 'unknown' },
        'junk',
      ],
      nextCursor: 'c2',
    });
    expect(page.items.map(i => i.id)).toEqual(['b1']);
    expect(page.items[0].serviceType).toBe('shopping');
    expect(page.nextCursor).toBe('c2');
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
      documents: [{ id: 'd1', kind: 'medical_license', status: 'rejected', reviewerNote: 'Expired in 2024' }, 'x'],
    });
    expect(info).toEqual({
      status: 'rejected',
      rejectionReason: 'PMDC expired',
      suspensionReason: null,
      documents: [{ id: 'd1', kind: 'medical_license', status: 'rejected', reviewerNote: 'Expired in 2024' }],
    });
    expect(businessStatusSerializer({ status: 'gone' })).toBeNull();
  });
});
