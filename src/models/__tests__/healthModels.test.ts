// Health form rules and the one status map.

import { APPOINTMENT_PAYMENT_STATUS, APPOINTMENT_STATUS, appointmentTimeline } from '../health/appointmentStatusModel';
import { defaultPaymentFor, paymentOptionsFor, validateBooking, validateCancel } from '../health/bookingModel';
import { copyToWeekdays, crossLocationOverlaps, emptyWeek, formatHHmm, overlapMessage, validateTimeOff, validateWeek } from '../health/availabilityModel';
import {
  doseSentence,
  doseSlots,
  emptyPrescription,
  formatDose,
  moveMedicine,
  parseDose,
  prescriptionToSave,
  validatePrescription,
} from '../health/prescriptionModel';
import { activeFilterCount, baseQuery, clearFilters, isQuickOn, queryKey, toggleQuick } from '../health/filterModel';
import { emptyFamilyMember, validateFamilyMember } from '../health/familyMemberModel';
import { validateRecord } from '../health/recordModel';
import { dimensionsFor, validateDoctorReview, validateReply } from '../health/reviewFormModel';
import { ownProfilePatch, validateDoctorProfile } from '../health/doctorProfileModel';
import {
  conditionForm,
  conditionInput,
  parseAliases,
  specialtyForm,
  specialtyInput,
  validateCondition,
  validateHideReason,
  validatePmdcNote,
  validateSpecialty,
} from '../health/adminHealthModel';
import { APPOINTMENT_PAYMENT_STATUSES, APPOINTMENT_STATUSES } from '../../serializers/health/appointmentSerializer';
import type { DoctorOwnProfile, Medicine } from '../../types/health';

describe('appointmentStatusModel', () => {
  it('has a label for every status, and red is kept for emergencies', () => {
    for (const s of APPOINTMENT_STATUSES) {
      expect(APPOINTMENT_STATUS[s].label).toBeTruthy();
      expect(APPOINTMENT_STATUS[s].tone).not.toBe('danger');
    }
    for (const s of APPOINTMENT_PAYMENT_STATUSES) {
      expect(APPOINTMENT_PAYMENT_STATUS[s].label).toBeTruthy();
      expect(APPOINTMENT_PAYMENT_STATUS[s].tone).not.toBe('danger');
    }
  });

  it('draws the path to where the visit is, without a red failure step', () => {
    const steps = appointmentTimeline('checked_in', 'clinic', false);
    expect(steps.map(s => s.label)).toEqual(['Booked', 'Confirmed', 'Checked in', 'In consultation', 'Completed']);
    expect(steps.map(s => s.state)).toEqual(['done', 'done', 'current', 'upcoming', 'upcoming']);
    const video = appointmentTimeline('awaiting_payment', 'video', true);
    expect(video.map(s => s.label)).toEqual(['Booked', 'Payment', 'Confirmed', 'In consultation', 'Completed']);
    expect(video[1].state).toBe('current');
    const cancelled = appointmentTimeline('cancelled', 'clinic', false);
    expect(cancelled.every(s => s.state !== 'failed')).toBe(true);
    expect(appointmentTimeline('completed', 'clinic', false).every(s => s.state === 'done')).toBe(true);
  });
});

describe('bookingModel', () => {
  it('pays for a clinic at the clinic, and a prepaid video by transfer only', () => {
    expect(paymentOptionsFor({ kind: 'clinic', requiresPrepay: false })).toEqual(['pay_at_visit']);
    expect(paymentOptionsFor({ kind: 'video', requiresPrepay: false })).toEqual(['pay_at_visit', 'transfer']);
    expect(paymentOptionsFor({ kind: 'video', requiresPrepay: true })).toEqual(['transfer']);
    expect(defaultPaymentFor({ kind: 'video', requiresPrepay: true })).toBe('transfer');
  });

  it('validates booking and cancelling', () => {
    expect(validateBooking({ startAt: '', reason: null, recordIds: [] })).toHaveProperty('startAt');
    expect(validateBooking({ startAt: '2026-10-15T13:15:00Z', reason: 'x'.repeat(301), recordIds: [] })).toHaveProperty('reason');
    expect(validateCancel(null, '')).toHaveProperty('reason');
    expect(validateCancel('other', '')).toHaveProperty('note');
    expect(validateCancel('feeling_better', '')).toEqual({});
  });
});

describe('prescriptionModel', () => {
  it('reads and writes dose patterns', () => {
    expect(parseDose('1+0+1')).toEqual([1, 0, 1]);
    expect(parseDose(' 0.5 + 0 + 0.5 ')).toEqual([0.5, 0, 0.5]);
    expect(parseDose('½+0+½')).toEqual([0.5, 0, 0.5]);
    expect(parseDose('0+0+0')).toBeNull();
    expect(parseDose('1+1')).toBeNull();
    expect(parseDose('two')).toBeNull();
    expect(formatDose('0.5+0+1')).toBe('½ + 0 + 1');
    expect(doseSlots('1+0+1').map(s => s.amount)).toEqual([1, 0, 1]);
  });

  it('says a dose in words', () => {
    const m: Medicine = { name: 'Paracetamol', strength: '500 mg', form: 'tablet', dose: '1+0+1', timing: 'after_meal', days: 5, instructions: null };
    expect(doseSentence(m)).toBe('1 tablet in the morning and at night, after meal, for 5 days');
  });

  it('validates rows and drops empty ones before saving', () => {
    const p = emptyPrescription();
    expect(validatePrescription(p)).toHaveProperty('diagnosis');
    const filled = { ...p, diagnosis: 'Viral fever', medicines: [{ ...p.medicines[0], name: 'Paracetamol', dose: '1+x+1' }] };
    expect(Object.keys(validatePrescription(filled))).toContain('medicine.0.dose');
    const ok = { ...filled, medicines: [{ ...filled.medicines[0], dose: '1+1+1' }, { ...p.medicines[0], name: '' }] };
    expect(Object.keys(validatePrescription(ok))).toContain('medicine.1.name');
    expect(prescriptionToSave(ok).medicines).toHaveLength(1);
    expect(moveMedicine(ok.medicines, 1, 0)[0].name).toBe('');
  });
});

describe('availabilityModel', () => {
  it('catches bad and overlapping ranges within a day', () => {
    const week = emptyWeek();
    week[0].ranges = [
      { from: '09:00', to: '12:00' },
      { from: '11:30', to: '13:00' },
    ];
    week[1].ranges = [{ from: '18:00', to: '17:00' }];
    const e = validateWeek(week);
    expect(e['day.1.0']).toMatch(/Overlaps/);
    expect(e['day.2.0']).toMatch(/before the start/);
  });

  it('names the other location when hours clash across clinics', () => {
    const mine = emptyWeek();
    mine[3].ranges = [{ from: '17:00', to: '21:00' }];
    const other = emptyWeek();
    other[3].ranges = [{ from: '20:00', to: '22:00' }];
    const clashes = crossLocationOverlaps('a', mine, [{ id: 'b', name: 'Gulberg Heart Clinic', hours: other }]);
    expect(clashes).toEqual([{ day: 4, otherLocationName: 'Gulberg Heart Clinic' }]);
    expect(overlapMessage(clashes[0])).toBe('Overlaps Thursday hours at Gulberg Heart Clinic');
  });

  it('copies a day to the weekdays, not Sunday', () => {
    const w = emptyWeek();
    w[0].ranges = [{ from: '17:00', to: '21:00' }];
    const copied = copyToWeekdays(w, 1);
    expect(copied.filter(d => d.ranges.length).map(d => d.day)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(formatHHmm('17:30')).toBe('5:30 PM');
    expect(formatHHmm('00:15')).toBe('12:15 AM');
  });

  it('validates time off', () => {
    expect(validateTimeOff({ from: '2026-10-14', to: '2026-10-16', locationId: null, reason: null }, '2026-10-15')).toHaveProperty('from');
    expect(validateTimeOff({ from: '2026-10-20', to: '2026-10-19', locationId: null, reason: null }, '2026-10-15')).toHaveProperty('to');
    expect(validateTimeOff({ from: '2026-10-20', to: '2026-10-22', locationId: null, reason: 'Conference' }, '2026-10-15')).toEqual({});
  });
});

describe('filterModel', () => {
  it('toggles quick chips and counts sheet filters', () => {
    let q = baseQuery('Lahore', { specialty: 'dermatologist' });
    q = toggleQuick(q, 'video');
    q = toggleQuick(q, 'availableToday');
    expect(isQuickOn(q, 'video')).toBe(true);
    expect(activeFilterCount(q)).toBe(2);
    const cleared = clearFilters({ ...q, sort: 'fee_low', maxFee: 1500 });
    expect(cleared.specialty).toBe('dermatologist');
    expect(activeFilterCount(cleared)).toBe(0);
    expect(queryKey(q)).not.toBe(queryKey(cleared));
  });
});

describe('family, records, reviews, profile', () => {
  it('validates a family member', () => {
    expect(validateFamilyMember(emptyFamilyMember(), '2026-10-15')).toEqual({ name: 'Enter their full name', dateOfBirth: 'Choose their date of birth' });
    expect(validateFamilyMember({ ...emptyFamilyMember(), name: 'Zara Khan', dateOfBirth: '2030-01-01' }, '2026-10-15')).toHaveProperty('dateOfBirth');
    expect(validateFamilyMember({ ...emptyFamilyMember(), name: 'Zara Khan', dateOfBirth: '2019-03-14', phone: '12' }, '2026-10-15')).toHaveProperty('phone');
  });

  it('validates a record upload', () => {
    expect(validateRecord({ title: '', type: 'lab_report', recordedOn: '', memberId: null, files: [] }, '2026-10-15')).toEqual({
      title: 'Give the record a title',
      recordedOn: 'Choose the date on the record',
      files: 'Add at least one page',
    });
  });

  it('asks clinic visits about staff and the clinic, video only about diagnosis', () => {
    expect(dimensionsFor('video').map(d => d.key)).toEqual(['diagnosis']);
    expect(dimensionsFor('clinic')).toHaveLength(3);
    expect(validateDoctorReview({ rating: 0, recommend: true, dimensions: {}, tags: [], text: null, anonymous: true })).toHaveProperty('rating');
    expect(validateReply(' ')).toHaveProperty('reply');
  });

  it('validates the doctor profile tables', () => {
    const p: DoctorOwnProfile = {
      title: 'Dr.',
      name: 'Hamza Rauf',
      gender: 'male',
      photoUrl: null,
      specialtySlug: 'general-physician',
      specialtyName: 'General physician',
      secondarySpecialtySlug: 'general-physician',
      practisingSince: 2019,
      languages: [],
      about: '',
      qualifications: [{ degree: '', institute: 'X', year: 2015 }],
      experience: [{ role: 'Physician', place: 'Clinic', from: 2020, to: 2018 }],
      services: [],
      conditionSlugs: [],
      bookingRules: { windowDays: 14, minNoticeMinutes: 60, cancelCutoffHours: 4, videoPrepay: false },
      pmdcNumber: '1',
      isListed: false,
    };
    const e = validateDoctorProfile(p, 2026);
    expect(Object.keys(e).sort()).toEqual(['experience.0.to', 'languages', 'qualification.0.degree', 'secondarySpecialtySlug']);

    // What goes to the server: never the read-only fields, never blank rows.
    const patch = ownProfilePatch(p);
    expect(Object.keys(patch)).not.toContain('pmdcNumber');
    expect(Object.keys(patch)).not.toContain('isListed');
    expect(Object.keys(patch)).not.toContain('specialtyName');
    expect(patch.qualifications).toEqual([]);
    expect(patch.experience).toHaveLength(1);
  });
});

describe('adminHealthModel', () => {
  it('reads other names for a condition', () => {
    expect(parseAliases(' Pimples, breakouts ,, pimples\nzits ')).toEqual(['pimples', 'breakouts', 'zits']);
    expect(parseAliases(Array.from({ length: 20 }, (_, i) => `a${i}`).join(','))).toHaveLength(12);
  });

  it('validates a specialty and sends clean values', () => {
    const f = specialtyForm(null, 17);
    expect(f.sort).toBe('17');
    expect(Object.keys(validateSpecialty(f)).sort()).toEqual(['name']);
    const ok = { ...f, name: ' Rheumatologist ', sort: '5' };
    expect(validateSpecialty(ok)).toEqual({});
    expect(validateSpecialty({ ...ok, sort: '5.5' })).toHaveProperty('sort');
    expect(specialtyInput(ok)).toEqual({ name: 'Rheumatologist', icon: 'medkit-outline', sort: 5 });
  });

  it('round-trips a condition through the form', () => {
    const c = { id: 'cn_acne', slug: 'acne', name: 'Acne', nameUr: null, specialtySlug: 'dermatologist', isCommon: true, aliases: ['pimples', 'breakouts'] };
    const f = conditionForm(c);
    expect(f.aliases).toBe('pimples, breakouts');
    expect(conditionInput(f)).toEqual({ name: 'Acne', specialtySlug: 'dermatologist', isCommon: true, aliases: ['pimples', 'breakouts'] });
    expect(validateCondition({ ...f, name: 'A' })).toHaveProperty('name');
  });

  it('asks for a note and a reason', () => {
    expect(validatePmdcNote('ok')).toHaveProperty('note');
    expect(validatePmdcNote('Matched on the register')).toEqual({});
    expect(validateHideReason('  ')).toHaveProperty('reason');
  });
});
