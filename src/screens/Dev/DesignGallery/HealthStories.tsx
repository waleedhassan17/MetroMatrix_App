// ═══════════════════════════════════════════════════════
// MetroMatrix — Design Gallery: the Health components
// ═══════════════════════════════════════════════════════
// Every Health component on demo values (local on purpose: nothing here is
// app data), in the clinical scale, at 100% and at 150% text — the size an
// older patient sets on their phone.

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ServiceScope, ThemeScope, getTheme, useStyles, withTextScale, type Theme } from '@theme/index';
import {
  AppText,
  AppointmentCard,
  AvailabilityChip,
  ConditionChip,
  DateStrip,
  DoctorBadges,
  DoctorCard,
  DoctorReviewItem,
  EmergencyBanner,
  LocationRow,
  PatientPicker,
  PrescriptionSheet,
  ReviewSummary,
  SegmentTabs,
  SlotGrid,
  SpecialtyTile,
  StatTrio,
} from '@custom/index';
import type { AppointmentSummary, DayAvailability, DoctorCardData, DoctorReview, FamilyMember, PracticeLocation, Slot } from '@/types';
import type { PrescriptionDoc } from '@custom/health/PrescriptionSheet';
import { addDays, todayInZone, zonedToIso } from '@utils/healthTime';

const TZ = 'Asia/Karachi';
const TODAY = todayInZone(TZ);

const DOCTOR: DoctorCardData = {
  id: 'demo',
  name: 'Dr. Ayesha Siddiqui',
  photoUrl: null,
  gender: 'female',
  specialty: { slug: 'dermatologist', name: 'Dermatologist' },
  qualifications: 'MBBS, FCPS (Dermatology)',
  yearsExperience: 13,
  rating: 4.9,
  reviewCount: 2782,
  waitMinutes: 2,
  badges: ['pmdc_verified', 'top_booked'],
  offersVideo: true,
  offersClinic: true,
  fromFee: 1000,
  availability: { label: 'Available today, 6:00 PM', today: true, nextAt: null },
  city: 'Lahore',
};

const LOCATIONS: PracticeLocation[] = [
  {
    id: 'v',
    kind: 'video',
    name: 'Video consultation',
    area: '',
    city: 'Lahore',
    address: null,
    lat: null,
    lng: null,
    phone: null,
    fee: 1000,
    slotMinutes: 15,
    instructions: null,
    timezone: TZ,
    availability: { label: 'Available today, 6:00 PM', today: true, nextAt: null },
    timings: [{ days: 'Mon – Sun', hours: '8:00 AM – 12:00 PM, 9:30 PM – 11:30 PM' }],
    requiresPrepay: true,
  },
  {
    id: 'c',
    kind: 'clinic',
    name: 'Skin and Laser Clinic',
    area: 'DHA Phase 6',
    city: 'Lahore',
    address: '7-C Commercial Area, DHA Phase 6',
    lat: 31.4697,
    lng: 74.4513,
    phone: null,
    fee: 3000,
    slotMinutes: 20,
    instructions: null,
    timezone: TZ,
    availability: { label: 'Available tomorrow, 4:00 PM', today: false, nextAt: null },
    timings: [{ days: 'Mon – Sat', hours: '4:00 PM – 8:00 PM' }],
    requiresPrepay: false,
  },
];

const DAYS: DayAvailability[] = Array.from({ length: 14 }, (_, i) => ({ date: addDays(TODAY, i), slotCount: i % 7 === 6 ? 0 : 6 + (i % 3) }));

const SLOTS: Slot[] = ['09:00', '09:15', '09:45', '14:30', '18:00', '18:15', '18:30', '21:45'].map(t => {
  const h = Number(t.slice(0, 2));
  return { startAt: zonedToIso(addDays(TODAY, 1), t, TZ), period: h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night' };
});

const FAMILY: FamilyMember[] = [
  { id: 'f1', name: 'Hassan Khan', relation: 'spouse', gender: 'male', dateOfBirth: '1990-08-21', phone: null },
  { id: 'f2', name: 'Zara Khan', relation: 'child', gender: 'female', dateOfBirth: '2019-03-14', phone: null },
];

const REVIEW: DoctorReview = {
  id: 'r',
  authorName: 'A. K.',
  rating: 5,
  kind: 'clinic',
  tags: ['No waiting time', 'Explained clearly'],
  text: 'The doctor listened carefully and explained everything in simple words.',
  recommend: true,
  createdAt: new Date().toISOString(),
  reply: { text: 'Thank you. Please book a follow-up if anything changes.', createdAt: new Date().toISOString() },
  isHidden: false,
  replyEditableUntil: null,
  doctorName: null,
};

const APPOINTMENT: AppointmentSummary = {
  id: 'a',
  code: 'HC-7KQ2MZ',
  status: 'confirmed',
  kind: 'video',
  startAt: new Date(Date.now() + (2 * 60 + 15) * 60_000).toISOString(),
  endAt: new Date(Date.now() + (2 * 60 + 30) * 60_000).toISOString(),
  timezone: TZ,
  doctor: { id: 'demo', name: DOCTOR.name, photoUrl: null, specialty: DOCTOR.specialty },
  location: { id: 'v', kind: 'video', name: 'Video consultation', area: '', city: 'Lahore', address: null, lat: null, lng: null, phone: null, instructions: null },
  patientName: 'Zara Khan',
  fee: 1000,
  paymentStatus: 'paid',
  canJoinVideo: false,
  canPay: false,
  canReview: false,
  joinOpensAt: null,
};

// A completed visit nine days ago (fixed when the gallery loads).
const PAST_START = new Date(Date.now() - 9 * 86_400_000).toISOString();
const PAST_END = new Date(Date.now() - 9 * 86_400_000 + 900_000).toISOString();

const RX: PrescriptionDoc = {
  doctor: { name: DOCTOR.name, specialtyName: 'Dermatologist', qualifications: 'MBBS, FCPS (Dermatology)', pmdcNumber: '38417-P', place: 'Skin and Laser Clinic, DHA Phase 6, Lahore', phone: null },
  patient: { name: 'Ayesha Khan', age: 31, gender: 'female' },
  issuedAt: new Date().toISOString(),
  diagnosis: 'Acne vulgaris (moderate)',
  medicines: [
    { name: 'Adapalene', strength: '0.1%', form: 'cream', dose: '0+0+1', timing: 'bedtime', days: 42, instructions: 'A pea-sized amount on the whole face.' },
    { name: 'Doxycycline', strength: '100 mg', form: 'capsule', dose: '1+0+0', timing: 'after_meal', days: 30, instructions: null },
  ],
  tests: [],
  advice: 'Use a gentle face wash twice a day and a non-oily sunscreen.',
  followUpInDays: 42,
};

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    section: { gap: space.s12 },
    row: { flexDirection: 'row', gap: space.s8, flexWrap: 'wrap' },
    rail: { gap: space.s12 },
    tiles: { flexDirection: 'row', gap: space.s8 },
  });

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.section}>
      <AppText variant="micro" tone="muted">
        {title}
      </AppText>
      {children}
    </View>
  );
};

const Stories: React.FC = () => {
  const styles = useStyles(makeStyles);
  const [location, setLocation] = useState('v');
  const [day, setDay] = useState(addDays(TODAY, 1));
  const [slot, setSlot] = useState<string | null>(SLOTS[4].startAt);
  const [who, setWho] = useState<string | null>('f2');
  return (
    <>
      <Section title="Health · DoctorCard">
        <DoctorCard doctor={DOCTOR} onPress={() => undefined} onVideo={() => undefined} onVisit={() => undefined} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          <DoctorCard doctor={DOCTOR} onPress={() => undefined} compact />
          <DoctorCard doctor={{ ...DOCTOR, name: 'Dr. Bilal Ahmed', badges: [], availability: { label: 'Available tomorrow, 2:00 PM', today: false, nextAt: null } }} onPress={() => undefined} compact />
        </ScrollView>
      </Section>
      <Section title="Health · Availability, badges, stats">
        <AvailabilityChip availability={DOCTOR.availability} />
        <AvailabilityChip availability={{ label: 'Available Fri 17 Oct, 5:00 PM', today: false, nextAt: null }} />
        <DoctorBadges badges={['pmdc_verified', 'top_booked']} />
        <StatTrio stats={{ satisfactionPct: 98, waitMinutes: 2, timeWithPatientMinutes: 12, reviewCount: 2782 }} />
        <StatTrio stats={{ satisfactionPct: null, waitMinutes: null, timeWithPatientMinutes: null, reviewCount: 2 }} />
      </Section>
      <Section title="Health · LocationRow, DateStrip, SlotGrid">
        {LOCATIONS.map(l => (
          <LocationRow key={l.id} location={l} selected={location === l.id} onSelect={() => setLocation(l.id)} />
        ))}
      </Section>
      <DateStrip days={DAYS} selected={day} onSelect={setDay} />
      <Section title="Slots">
        <SlotGrid slots={SLOTS} timezone={TZ} selected={slot} onSelect={setSlot} />
        <SlotGrid slots={[]} timezone={TZ} selected={null} onSelect={() => undefined} nextAvailable={{ date: addDays(TODAY, 2) }} onNextAvailable={() => undefined} />
      </Section>
      <Section title="Health · PatientPicker, tiles, chips">
        <PatientPicker family={FAMILY} selected={who} onSelect={setWho} onAdd={() => undefined} />
        <View style={styles.tiles}>
          <SpecialtyTile specialty={{ id: '1', slug: 'dermatologist', name: 'Dermatologist', icon: 'body-outline', doctorCount: 12 }} onPress={() => undefined} />
          <SpecialtyTile specialty={{ id: '2', slug: 'gynecologist', name: 'Gynecologist', icon: 'woman-outline', doctorCount: 8 }} onPress={() => undefined} />
          <SpecialtyTile specialty={{ id: '3', slug: 'pediatrician', name: 'Pediatrician', icon: 'happy-outline', doctorCount: 9 }} onPress={() => undefined} />
        </View>
        <View style={styles.row}>
          {['Acne', 'Fever', 'Diabetes', 'Back pain'].map(n => (
            <ConditionChip key={n} condition={{ name: n }} onPress={() => undefined} />
          ))}
        </View>
      </Section>
      <Section title="Health · Reviews">
        <ReviewSummary
          summary={{
            average: 4.8,
            count: 2782,
            recommendPct: 97,
            distribution: [12, 20, 61, 410, 2279],
            dimensions: [
              { key: 'diagnosis', label: 'Diagnosis', score: 4.9 },
              { key: 'staff', label: 'Staff', score: 4.6 },
              { key: 'environment', label: 'Clinic environment', score: 4.5 },
            ],
            tags: [
              { label: 'No waiting time', count: 812 },
              { label: 'Great experience', count: 640 },
            ],
          }}
        />
        <DoctorReviewItem review={REVIEW} doctorName={DOCTOR.name} />
      </Section>
      <Section title="Health · AppointmentCard">
        <AppointmentCard appointment={APPOINTMENT} onPress={() => undefined} action={{ label: 'Join', icon: 'videocam-outline', onPress: () => undefined, primary: true }} />
        <AppointmentCard
          appointment={{ ...APPOINTMENT, kind: 'clinic', status: 'completed', location: { ...APPOINTMENT.location, kind: 'clinic', name: 'Skin and Laser Clinic', area: 'DHA Phase 6' }, startAt: PAST_START, endAt: PAST_END }}
          onPress={() => undefined}
          action={{ label: 'Rate visit', icon: 'star-outline', onPress: () => undefined }}
        />
      </Section>
      <Section title="Health · PrescriptionSheet">
        <PrescriptionSheet prescription={RX} />
      </Section>
      <Section title="Health · EmergencyBanner">
        <EmergencyBanner variant="quiet" numbers={[{ label: 'Rescue 1122', number: '1122' }]} onOpen={() => undefined} />
        <EmergencyBanner
          numbers={[
            { label: 'Rescue 1122', number: '1122' },
            { label: 'Edhi ambulance', number: '115' },
          ]}
        />
      </Section>
    </>
  );
};

export const HealthStories: React.FC = () => {
  const [scale, setScale] = useState<'100' | '150'>('100');
  const large = useMemo(() => withTextScale(getTheme('healthcare'), 1.5), []);
  return (
    <ServiceScope service="healthcare">
      <SegmentTabs
        options={[
          { key: '100', label: 'Health · 100%' },
          { key: '150', label: 'Health · 150%' },
        ]}
        value={scale}
        onChange={setScale}
        accessibilityLabel="Health text size"
      />
      {scale === '150' ? (
        <ThemeScope theme={large}>
          <Stories />
        </ThemeScope>
      ) : (
        <Stories />
      )}
    </ServiceScope>
  );
};

export default HealthStories;
