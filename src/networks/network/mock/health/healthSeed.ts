// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Health seed
// ═══════════════════════════════════════════════════════
// Specialties and conditions (English + Urdu, with the words patients use),
// about two dozen fictional doctors in Lahore, Karachi and Islamabad (initials
// only — never stock photos of strangers presented as doctors), their clinics
// and video hours, reviews, and the demo patient's family, records,
// appointments and prescriptions. Seed doctors who can sign in:
//   doctor@metromatrix.app     Dr. Bilal Ahmed, cardiologist — 3 clinics + video
//   derm@metromatrix.app       Dr. Ayesha Siddiqui, dermatologist — video (prepaid) + clinic
//   newdoctor@metromatrix.app  Dr. Hamza Rauf — approved, not yet listed (Practice setup)
//   pmdc@metromatrix.app       Dr. Sana Iqbal — waiting for approval, PMDC not checked
// Times are relative to the moment the dummy database is created.

import type { MockAppointment, MockDoctor, MockDoctorReview, MockFormularyItem, MockHealth, MockHealthBanner, MockLocation } from './healthTypes';
import type { ConsultKind, ExperienceRow, Qualification, WeekDayHours } from '../../../../types/health';
import type { Gender } from '../../../../types/auth';
import { PKT, addDays, todayInZone, zonedToIso } from '../../../../utils/healthTime';
import { DAY, HOUR, MINUTE, appointmentCode, nextAvailable } from './healthLogic';

// ─── Catalogue ────────────────────────────────────────
// Icons are the API's keys (healthCommon.iconGlyph maps them to the app's glyphs).
const SPECIALTIES: [slug: string, name: string, nameUr: string, icon: string][] = [
  ['general-physician', 'General physician', 'جنرل فزیشن', 'stethoscope'],
  ['dermatologist', 'Dermatologist', 'ماہر امراض جلد', 'skin'],
  ['gynecologist', 'Gynecologist', 'ماہر امراض نسواں', 'female'],
  ['pediatrician', 'Pediatrician', 'ماہر امراض اطفال', 'child'],
  ['cardiologist', 'Cardiologist', 'ماہر امراض قلب', 'heart'],
  ['orthopedic-surgeon', 'Orthopedic surgeon', 'ماہر امراض ہڈی و جوڑ', 'bone'],
  ['ent-specialist', 'ENT specialist', 'ماہر ناک، کان، گلا', 'ear'],
  ['eye-specialist', 'Eye specialist', 'ماہر امراض چشم', 'eye'],
  ['neurologist', 'Neurologist', 'ماہر امراض دماغ و اعصاب', 'neuro'],
  ['psychiatrist', 'Psychiatrist', 'ماہر نفسیات', 'brain'],
  ['gastroenterologist', 'Gastroenterologist', 'ماہر امراض معدہ و جگر', 'stomach'],
  ['urologist', 'Urologist', 'ماہر امراض گردہ و مثانہ', 'kidney'],
  ['endocrinologist', 'Endocrinologist', 'ماہر امراض غدود', 'hormone'],
  ['dentist', 'Dentist', 'ماہر امراض دندان', 'tooth'],
  ['pulmonologist', 'Pulmonologist', 'ماہر امراض سینہ', 'lungs'],
  ['nutritionist', 'Nutritionist', 'ماہر غذائیت', 'apple'],
];

const CONDITIONS: [slug: string, name: string, nameUr: string, specialty: string, common: boolean, aliases: string[]][] = [
  ['acne', 'Acne', 'کیل مہاسے', 'dermatologist', true, ['pimples', 'pimple', 'breakouts', 'دانے']],
  ['eczema', 'Eczema', 'ایگزیما', 'dermatologist', false, ['itchy skin', 'rash', 'خارش']],
  ['hair-loss', 'Hair loss', 'بال گرنا', 'dermatologist', true, ['hair fall', 'baldness']],
  ['psoriasis', 'Psoriasis', 'چنبل', 'dermatologist', false, ['scaly skin']],
  ['fever', 'Fever', 'بخار', 'general-physician', true, ['temperature', 'high temperature']],
  ['flu-and-cold', 'Flu and cold', 'نزلہ زکام', 'general-physician', true, ['cold', 'flu', 'runny nose']],
  ['typhoid', 'Typhoid', 'ٹائیفائیڈ', 'general-physician', false, ['enteric fever']],
  ['dengue', 'Dengue', 'ڈینگی', 'general-physician', false, ['dengue fever']],
  ['vitamin-d-deficiency', 'Vitamin D deficiency', 'وٹامن ڈی کی کمی', 'general-physician', false, ['low vitamin d']],
  ['allergies', 'Allergies', 'الرجی', 'general-physician', false, ['sneezing', 'hay fever']],
  ['diabetes', 'Diabetes', 'شوگر', 'endocrinologist', true, ['sugar', 'high sugar', 'ذیابیطس']],
  ['thyroid-problems', 'Thyroid problems', 'تھائیرائیڈ', 'endocrinologist', false, ['thyroid', 'hypothyroidism']],
  ['high-blood-pressure', 'High blood pressure', 'بلڈ پریشر', 'cardiologist', true, ['hypertension', 'bp', 'blood pressure']],
  ['chest-pain', 'Chest pain', 'سینے میں درد', 'cardiologist', false, ['angina']],
  ['palpitations', 'Palpitations', 'دل کی دھڑکن تیز', 'cardiologist', false, ['fast heartbeat']],
  ['back-pain', 'Back pain', 'کمر درد', 'orthopedic-surgeon', true, ['backache', 'lower back pain']],
  ['joint-pain', 'Joint pain', 'جوڑوں کا درد', 'orthopedic-surgeon', true, ['arthritis', 'knee pain']],
  ['migraine', 'Migraine', 'درد شقیقہ', 'neurologist', true, ['headache', 'سر درد']],
  ['epilepsy', 'Epilepsy', 'مرگی', 'neurologist', false, ['fits', 'seizures']],
  ['anxiety', 'Anxiety', 'بے چینی', 'psychiatrist', true, ['stress', 'panic attacks']],
  ['depression', 'Depression', 'ڈپریشن', 'psychiatrist', false, ['low mood', 'sadness']],
  ['insomnia', 'Insomnia', 'بے خوابی', 'psychiatrist', false, ['sleeplessness', "can't sleep"]],
  ['pregnancy-care', 'Pregnancy care', 'حمل کی دیکھ بھال', 'gynecologist', true, ['pregnant', 'antenatal', 'حمل']],
  ['irregular-periods', 'Irregular periods', 'ماہواری کی بے قاعدگی', 'gynecologist', true, ['period problems', 'pcos', 'ماہواری']],
  ['child-fever', 'Fever in children', 'بچوں کا بخار', 'pediatrician', false, ['baby fever']],
  ['child-vaccination', 'Child vaccination', 'حفاظتی ٹیکے', 'pediatrician', true, ['vaccines', 'immunisation', 'vaccination']],
  ['sore-throat', 'Sore throat', 'گلے کی خرابی', 'ent-specialist', true, ['throat pain', 'tonsils', 'گلا']],
  ['ear-pain', 'Ear pain', 'کان کا درد', 'ent-specialist', false, ['earache']],
  ['sinusitis', 'Sinusitis', 'سائنس', 'ent-specialist', false, ['blocked nose', 'sinus']],
  ['weak-eyesight', 'Weak eyesight', 'نظر کی کمزوری', 'eye-specialist', false, ['blurred vision', 'glasses']],
  ['eye-infection', 'Eye infection', 'آنکھوں کا انفیکشن', 'eye-specialist', false, ['pink eye', 'red eyes']],
  ['acidity', 'Acidity', 'تیزابیت', 'gastroenterologist', true, ['heartburn', 'gas', 'acid reflux']],
  ['diarrhoea', 'Diarrhoea', 'اسہال', 'gastroenterologist', false, ['loose motions', 'dysentery']],
  ['stomach-pain', 'Stomach pain', 'پیٹ درد', 'gastroenterologist', true, ['abdominal pain', 'tummy ache']],
  ['kidney-stones', 'Kidney stones', 'گردے کی پتھری', 'urologist', false, ['renal stones']],
  ['urine-infection', 'Urine infection', 'پیشاب کا انفیکشن', 'urologist', false, ['uti', 'burning urine']],
  ['toothache', 'Toothache', 'دانت کا درد', 'dentist', true, ['tooth pain', 'cavity']],
  ['asthma', 'Asthma', 'دمہ', 'pulmonologist', false, ['wheezing', 'breathlessness']],
  ['chronic-cough', 'Chronic cough', 'پرانی کھانسی', 'pulmonologist', false, ['long cough']],
  ['weight-management', 'Weight management', 'وزن میں کمی', 'nutritionist', true, ['weight loss', 'obesity', 'diet plan']],
];

/** The common concerns' own icon keys, so a row of them reads at a glance. */
const CONDITION_ICONS: Record<string, string> = {
  acne: 'sparkles',
  'hair-loss': 'skin',
  fever: 'thermometer',
  'flu-and-cold': 'snowflake',
  diabetes: 'drop',
  'high-blood-pressure': 'heart-pulse',
  'back-pain': 'bone',
  'joint-pain': 'walk',
  migraine: 'flash',
  anxiety: 'cloud',
  'pregnancy-care': 'female',
  'irregular-periods': 'calendar',
  'child-vaccination': 'shield',
  'sore-throat': 'mic',
  acidity: 'flame',
  'stomach-pain': 'restaurant',
  toothache: 'tooth',
  'weight-management': 'scale',
};

const FORMULARY: MockFormularyItem[] = [
  { name: 'Paracetamol', strength: '500 mg', form: 'tablet' },
  { name: 'Paracetamol', strength: '120 mg/5 ml', form: 'syrup' },
  { name: 'Ibuprofen', strength: '400 mg', form: 'tablet' },
  { name: 'Diclofenac', strength: '50 mg', form: 'tablet' },
  { name: 'Amoxicillin', strength: '500 mg', form: 'capsule' },
  { name: 'Amoxicillin', strength: '250 mg/5 ml', form: 'syrup' },
  { name: 'Azithromycin', strength: '500 mg', form: 'tablet' },
  { name: 'Doxycycline', strength: '100 mg', form: 'capsule' },
  { name: 'Metronidazole', strength: '400 mg', form: 'tablet' },
  { name: 'Cetirizine', strength: '10 mg', form: 'tablet' },
  { name: 'Loratadine', strength: '10 mg', form: 'tablet' },
  { name: 'Montelukast', strength: '10 mg', form: 'tablet' },
  { name: 'Salbutamol', strength: '100 mcg', form: 'other' },
  { name: 'Omeprazole', strength: '20 mg', form: 'capsule' },
  { name: 'Esomeprazole', strength: '40 mg', form: 'capsule' },
  { name: 'Domperidone', strength: '10 mg', form: 'tablet' },
  { name: 'Ondansetron', strength: '4 mg', form: 'tablet' },
  { name: 'Oral rehydration salts', strength: '1 sachet', form: 'other' },
  { name: 'Metformin', strength: '500 mg', form: 'tablet' },
  { name: 'Levothyroxine', strength: '50 mcg', form: 'tablet' },
  { name: 'Amlodipine', strength: '5 mg', form: 'tablet' },
  { name: 'Losartan', strength: '50 mg', form: 'tablet' },
  { name: 'Bisoprolol', strength: '5 mg', form: 'tablet' },
  { name: 'Atorvastatin', strength: '20 mg', form: 'tablet' },
  { name: 'Aspirin', strength: '75 mg', form: 'tablet' },
  { name: 'Clopidogrel', strength: '75 mg', form: 'tablet' },
  { name: 'Isotretinoin', strength: '20 mg', form: 'capsule' },
  { name: 'Clindamycin', strength: '1%', form: 'cream' },
  { name: 'Adapalene', strength: '0.1%', form: 'cream' },
  { name: 'Benzoyl peroxide', strength: '5%', form: 'cream' },
  { name: 'Hydrocortisone', strength: '1%', form: 'cream' },
  { name: 'Fluconazole', strength: '150 mg', form: 'capsule' },
  { name: 'Vitamin D3', strength: '50,000 IU', form: 'capsule' },
  { name: 'Calcium with vitamin D3', strength: '600 mg', form: 'tablet' },
  { name: 'Folic acid', strength: '5 mg', form: 'tablet' },
  { name: 'Ferrous sulfate', strength: '200 mg', form: 'tablet' },
  { name: 'Sertraline', strength: '50 mg', form: 'tablet' },
  { name: 'Escitalopram', strength: '10 mg', form: 'tablet' },
  { name: 'Chloramphenicol', strength: '0.5%', form: 'drops' },
  { name: 'Ciprofloxacin', strength: '0.3%', form: 'drops' },
];

const FAVOURITES: Record<string, string[]> = {
  d_ayesha: ['Isotretinoin', 'Clindamycin', 'Adapalene', 'Doxycycline', 'Cetirizine'],
  d_bilal: ['Aspirin', 'Atorvastatin', 'Bisoprolol', 'Amlodipine', 'Clopidogrel'],
  d_hamza: ['Paracetamol', 'Azithromycin', 'Cetirizine', 'Omeprazole'],
};

// ─── Hours ────────────────────────────────────────────
const week = (spec: Partial<Record<number, [string, string][]>>): WeekDayHours[] =>
  [1, 2, 3, 4, 5, 6, 7].map(day => ({ day, ranges: (spec[day] ?? []).map(([from, to]) => ({ from, to })) }));

const EVERY = (ranges: [string, string][]) => week({ 1: ranges, 2: ranges, 3: ranges, 4: ranges, 5: ranges, 6: ranges, 7: ranges });
const MON_SAT = (ranges: [string, string][]) => week({ 1: ranges, 2: ranges, 3: ranges, 4: ranges, 5: ranges, 6: ranges });
const VIDEO_HOURS = EVERY([
  ['08:00', '12:00'],
  ['21:30', '23:30'],
]);

// ─── Doctors ──────────────────────────────────────────
interface LocSeed {
  kind: ConsultKind;
  name: string;
  area: string;
  city: string;
  address?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  fee: number;
  slot?: number;
  hours: WeekDayHours[];
  prepay?: boolean;
  instructions?: string;
}

interface DoctorSeed {
  id: string;
  name: string;
  gender: Gender;
  specialty: string;
  secondary?: string;
  since: number;
  city: string;
  languages: string[];
  quals: [string, string, number][];
  exp: [string, string, number, number | null][];
  services: string[];
  conditions: string[];
  topBooked?: boolean;
  reviews: number;
  locs: LocSeed[];
  ownerId?: string;
  businessId?: string;
  pmdc: string;
  about?: string;
}

const KEMU = 'King Edward Medical University';
const AIMC = 'Allama Iqbal Medical College';
const DOW = 'Dow University of Health Sciences';
const AKU = 'Aga Khan University';
const RMU = 'Rawalpindi Medical University';
const CPSP = 'College of Physicians and Surgeons Pakistan';

const DOCTORS: DoctorSeed[] = [
  {
    id: 'd_bilal',
    ownerId: 'u_doctor',
    businessId: 'b_doctor',
    name: 'Bilal Ahmed',
    gender: 'male',
    specialty: 'cardiologist',
    since: 2014,
    city: 'Lahore',
    languages: ['Urdu', 'English', 'Punjabi'],
    quals: [
      ['MBBS', KEMU, 2012],
      ['FCPS (Cardiology)', CPSP, 2019],
    ],
    exp: [
      ['Consultant cardiologist', 'Gulberg Heart Clinic', 2019, null],
      ['Registrar, Cardiology', 'Punjab Institute of Cardiology', 2015, 2019],
    ],
    services: ['ECG review', 'Echocardiography', 'Blood pressure management', 'Cholesterol management', 'Heart check-up'],
    conditions: ['high-blood-pressure', 'chest-pain', 'palpitations'],
    topBooked: true,
    reviews: 46,
    pmdc: '45821-P',
    locs: [
      { kind: 'video', name: 'Video consultation', area: '', city: 'Lahore', fee: 1500, slot: 15, hours: VIDEO_HOURS },
      {
        kind: 'clinic',
        name: 'Gulberg Heart Clinic',
        area: 'Gulberg III',
        city: 'Lahore',
        address: '42-B Main Boulevard, Gulberg III, Lahore',
        lat: 31.5109,
        lng: 74.3443,
        phone: '+924235761234',
        fee: 2500,
        hours: week({ 1: [['17:00', '21:00']], 3: [['17:00', '21:00']], 5: [['17:00', '21:00']] }),
        instructions: 'Ground floor, next to the pharmacy. Bring your previous ECGs.',
      },
      {
        kind: 'clinic',
        name: 'Model Town Medical Centre',
        area: 'Model Town',
        city: 'Lahore',
        address: '18 Link Road, Model Town, Lahore',
        lat: 31.4834,
        lng: 74.3256,
        phone: '+924235881122',
        fee: 2000,
        hours: week({ 2: [['17:00', '21:00']], 4: [['17:00', '21:00']] }),
      },
      {
        kind: 'clinic',
        name: 'DHA Family Clinic',
        area: 'DHA Phase 5',
        city: 'Lahore',
        address: 'Plot 120, Sector CCA, DHA Phase 5, Lahore',
        lat: 31.4627,
        lng: 74.4087,
        fee: 3000,
        hours: week({ 6: [['13:00', '17:00']], 7: [['13:00', '16:00']] }),
      },
    ],
  },
  {
    id: 'd_ayesha',
    ownerId: 'u_derm',
    businessId: 'b_derm',
    name: 'Ayesha Siddiqui',
    gender: 'female',
    specialty: 'dermatologist',
    since: 2013,
    city: 'Lahore',
    languages: ['Urdu', 'English'],
    quals: [
      ['MBBS', AIMC, 2011],
      ['FCPS (Dermatology)', CPSP, 2017],
    ],
    exp: [
      ['Consultant dermatologist', 'Skin and Laser Clinic', 2018, null],
      ['Senior registrar, Dermatology', 'Services Hospital', 2015, 2018],
    ],
    services: ['Acne treatment', 'Acne scar treatment', 'Hair loss treatment', 'Eczema care', 'Skin allergy testing'],
    conditions: ['acne', 'eczema', 'hair-loss', 'psoriasis'],
    topBooked: true,
    reviews: 38,
    pmdc: '38417-P',
    locs: [
      { kind: 'video', name: 'Video consultation', area: '', city: 'Lahore', fee: 2000, slot: 15, hours: VIDEO_HOURS, prepay: true },
      {
        kind: 'clinic',
        name: 'Skin and Laser Clinic',
        area: 'DHA Phase 6',
        city: 'Lahore',
        address: '7-C Commercial Area, DHA Phase 6, Lahore',
        lat: 31.4697,
        lng: 74.4513,
        phone: '+924235790011',
        fee: 3000,
        slot: 20,
        hours: MON_SAT([['16:00', '20:00']]),
        instructions: 'First floor. Please arrive 10 minutes early for registration.',
      },
    ],
  },
  {
    id: 'd_mariam',
    name: 'Mariam Saleem',
    gender: 'female',
    specialty: 'dermatologist',
    since: 2016,
    city: 'Lahore',
    languages: ['Urdu', 'English', 'Punjabi'],
    quals: [
      ['MBBS', KEMU, 2014],
      ['MCPS (Dermatology)', CPSP, 2019],
    ],
    exp: [['Dermatologist', 'Johar Town Skin Centre', 2019, null]],
    services: ['Acne treatment', 'Pigmentation treatment', 'Hair loss treatment'],
    conditions: ['acne', 'hair-loss', 'eczema'],
    reviews: 14,
    pmdc: '51230-P',
    locs: [
      { kind: 'video', name: 'Video consultation', area: '', city: 'Lahore', fee: 1200, hours: VIDEO_HOURS },
      { kind: 'clinic', name: 'Johar Town Skin Centre', area: 'Johar Town', city: 'Lahore', fee: 1500, hours: MON_SAT([['15:00', '19:00']]) },
    ],
  },
  {
    id: 'd_farah',
    name: 'Farah Naz',
    gender: 'female',
    specialty: 'gynecologist',
    since: 2008,
    city: 'Lahore',
    languages: ['Urdu', 'English'],
    quals: [
      ['MBBS', 'Fatima Jinnah Medical University', 2006],
      ['FCPS (Obstetrics and Gynaecology)', CPSP, 2013],
    ],
    exp: [['Consultant gynaecologist', 'Garden Town Mother Care', 2013, null]],
    services: ['Pregnancy care', 'Ultrasound', 'PCOS management', 'Family planning'],
    conditions: ['pregnancy-care', 'irregular-periods'],
    topBooked: true,
    reviews: 31,
    pmdc: '29874-P',
    locs: [
      { kind: 'video', name: 'Video consultation', area: '', city: 'Lahore', fee: 2000, hours: VIDEO_HOURS },
      { kind: 'clinic', name: 'Garden Town Mother Care', area: 'Garden Town', city: 'Lahore', fee: 3000, hours: MON_SAT([['14:00', '19:00']]) },
    ],
  },
  {
    id: 'd_usman',
    name: 'Usman Tariq',
    gender: 'male',
    specialty: 'pediatrician',
    since: 2012,
    city: 'Lahore',
    languages: ['Urdu', 'English', 'Punjabi'],
    quals: [
      ['MBBS', AIMC, 2010],
      ['FCPS (Paediatrics)', CPSP, 2016],
    ],
    exp: [['Consultant paediatrician', 'Children Care Clinic', 2016, null]],
    services: ['Newborn care', 'Vaccination', 'Growth monitoring', 'Childhood asthma'],
    conditions: ['child-fever', 'child-vaccination'],
    reviews: 24,
    pmdc: '33190-P',
    locs: [{ kind: 'clinic', name: 'Children Care Clinic', area: 'Johar Town', city: 'Lahore', fee: 1800, hours: MON_SAT([['17:00', '21:00']]) }],
  },
  {
    id: 'd_kamran',
    name: 'Kamran Akhtar',
    gender: 'male',
    specialty: 'orthopedic-surgeon',
    since: 2009,
    city: 'Lahore',
    languages: ['Urdu', 'English'],
    quals: [
      ['MBBS', KEMU, 2007],
      ['FCPS (Orthopaedics)', CPSP, 2014],
    ],
    exp: [['Consultant orthopaedic surgeon', 'Bone and Joint Centre', 2014, null]],
    services: ['Joint pain treatment', 'Sports injuries', 'Back pain management', 'Fracture care'],
    conditions: ['back-pain', 'joint-pain'],
    reviews: 19,
    pmdc: '27711-P',
    locs: [
      { kind: 'clinic', name: 'Bone and Joint Centre', area: 'Gulberg II', city: 'Lahore', fee: 2500, hours: MON_SAT([['18:00', '21:00']]) },
      { kind: 'video', name: 'Video consultation', area: '', city: 'Lahore', fee: 1500, hours: VIDEO_HOURS },
    ],
  },
  {
    id: 'd_nida',
    name: 'Nida Hussain',
    gender: 'female',
    specialty: 'psychiatrist',
    since: 2015,
    city: 'Lahore',
    languages: ['Urdu', 'English'],
    quals: [
      ['MBBS', 'Services Institute of Medical Sciences', 2013],
      ['FCPS (Psychiatry)', CPSP, 2019],
    ],
    exp: [['Consultant psychiatrist', 'Mind Care Clinic', 2019, null]],
    services: ['Anxiety treatment', 'Depression treatment', 'Sleep problems', 'Counselling'],
    conditions: ['anxiety', 'depression', 'insomnia'],
    reviews: 17,
    pmdc: '41002-P',
    locs: [
      { kind: 'video', name: 'Video consultation', area: '', city: 'Lahore', fee: 2500, slot: 30, hours: EVERY([['10:00', '14:00']]) },
      { kind: 'clinic', name: 'Mind Care Clinic', area: 'Cantt', city: 'Lahore', fee: 3000, slot: 30, hours: week({ 2: [['17:00', '20:00']], 4: [['17:00', '20:00']] }) },
    ],
  },
  {
    id: 'd_imran',
    name: 'Imran Chaudhry',
    gender: 'male',
    specialty: 'general-physician',
    since: 2010,
    city: 'Lahore',
    languages: ['Urdu', 'English', 'Punjabi'],
    quals: [
      ['MBBS', 'Nishtar Medical University', 2008],
      ['FCPS (Medicine)', CPSP, 2015],
    ],
    exp: [['Consultant physician', 'Iqbal Town Medical Centre', 2015, null]],
    services: ['General check-up', 'Fever treatment', 'Diabetes care', 'Blood pressure care'],
    conditions: ['fever', 'flu-and-cold', 'typhoid', 'dengue', 'vitamin-d-deficiency', 'allergies'],
    topBooked: true,
    reviews: 42,
    pmdc: '30555-P',
    locs: [
      { kind: 'video', name: 'Video consultation', area: '', city: 'Lahore', fee: 1000, hours: VIDEO_HOURS },
      { kind: 'clinic', name: 'Iqbal Town Medical Centre', area: 'Allama Iqbal Town', city: 'Lahore', fee: 1200, hours: MON_SAT([['17:00', '22:00']]) },
    ],
  },
  {
    id: 'd_saima',
    name: 'Saima Rafiq',
    gender: 'female',
    specialty: 'ent-specialist',
    since: 2013,
    city: 'Lahore',
    languages: ['Urdu', 'English'],
    quals: [
      ['MBBS', AIMC, 2011],
      ['FCPS (ENT)', CPSP, 2017],
    ],
    exp: [['Consultant ENT surgeon', 'Ear Nose Throat Clinic', 2017, null]],
    services: ['Ear examination', 'Sinus treatment', 'Tonsil care', 'Hearing assessment'],
    conditions: ['sore-throat', 'ear-pain', 'sinusitis'],
    reviews: 12,
    pmdc: '36608-P',
    locs: [{ kind: 'clinic', name: 'Ear Nose Throat Clinic', area: 'Faisal Town', city: 'Lahore', fee: 2000, hours: MON_SAT([['16:00', '20:00']]) }],
  },
  {
    id: 'd_adeel',
    name: 'Adeel Raza',
    gender: 'male',
    specialty: 'gastroenterologist',
    since: 2011,
    city: 'Lahore',
    languages: ['Urdu', 'English'],
    quals: [
      ['MBBS', KEMU, 2009],
      ['FCPS (Gastroenterology)', CPSP, 2016],
    ],
    exp: [['Consultant gastroenterologist', 'Digestive Health Clinic', 2016, null]],
    services: ['Endoscopy advice', 'Acidity treatment', 'Liver care'],
    conditions: ['acidity', 'diarrhoea', 'stomach-pain'],
    reviews: 15,
    pmdc: '32214-P',
    locs: [
      { kind: 'video', name: 'Video consultation', area: '', city: 'Lahore', fee: 1800, hours: VIDEO_HOURS },
      { kind: 'clinic', name: 'Digestive Health Clinic', area: 'Shadman', city: 'Lahore', fee: 2500, hours: MON_SAT([['17:00', '20:00']]) },
    ],
  },
  {
    id: 'd_hina',
    name: 'Hina Shah',
    gender: 'female',
    specialty: 'dermatologist',
    since: 2012,
    city: 'Karachi',
    languages: ['Urdu', 'English', 'Sindhi'],
    quals: [
      ['MBBS', DOW, 2010],
      ['FCPS (Dermatology)', CPSP, 2016],
    ],
    exp: [['Consultant dermatologist', 'Clifton Skin Clinic', 2016, null]],
    services: ['Acne treatment', 'Hair loss treatment', 'Skin infections'],
    conditions: ['acne', 'hair-loss', 'eczema', 'psoriasis'],
    topBooked: true,
    reviews: 33,
    pmdc: '30981-S',
    locs: [
      { kind: 'video', name: 'Video consultation', area: '', city: 'Karachi', fee: 1500, hours: VIDEO_HOURS },
      { kind: 'clinic', name: 'Clifton Skin Clinic', area: 'Clifton', city: 'Karachi', fee: 2500, hours: MON_SAT([['17:00', '21:00']]) },
    ],
  },
  {
    id: 'd_faisal',
    name: 'Faisal Memon',
    gender: 'male',
    specialty: 'cardiologist',
    since: 2007,
    city: 'Karachi',
    languages: ['Urdu', 'English', 'Sindhi'],
    quals: [
      ['MBBS', DOW, 2005],
      ['FCPS (Cardiology)', CPSP, 2012],
    ],
    exp: [['Consultant cardiologist', 'PECHS Heart Centre', 2012, null]],
    services: ['ECG review', 'Heart check-up', 'Blood pressure management'],
    conditions: ['high-blood-pressure', 'chest-pain', 'palpitations'],
    reviews: 21,
    pmdc: '22410-S',
    locs: [{ kind: 'clinic', name: 'PECHS Heart Centre', area: 'PECHS', city: 'Karachi', fee: 3000, hours: MON_SAT([['18:00', '21:00']]) }],
  },
  {
    id: 'd_rabia',
    name: 'Rabia Qureshi',
    gender: 'female',
    specialty: 'gynecologist',
    since: 2010,
    city: 'Karachi',
    languages: ['Urdu', 'English'],
    quals: [
      ['MBBS', AKU, 2008],
      ['FCPS (Obstetrics and Gynaecology)', CPSP, 2015],
    ],
    exp: [['Consultant gynaecologist', 'Gulshan Women Care', 2015, null]],
    services: ['Pregnancy care', 'PCOS management', 'Ultrasound'],
    conditions: ['pregnancy-care', 'irregular-periods'],
    reviews: 27,
    pmdc: '28733-S',
    locs: [
      { kind: 'video', name: 'Video consultation', area: '', city: 'Karachi', fee: 1800, hours: VIDEO_HOURS },
      { kind: 'clinic', name: 'Gulshan Women Care', area: 'Gulshan-e-Iqbal', city: 'Karachi', fee: 2500, hours: MON_SAT([['15:00', '19:00']]) },
    ],
  },
  {
    id: 'd_zeeshan',
    name: 'Zeeshan Ali',
    gender: 'male',
    specialty: 'neurologist',
    since: 2011,
    city: 'Karachi',
    languages: ['Urdu', 'English'],
    quals: [
      ['MBBS', DOW, 2009],
      ['FCPS (Neurology)', CPSP, 2016],
    ],
    exp: [['Consultant neurologist', 'Neuro Clinic DHA', 2016, null]],
    services: ['Headache clinic', 'Epilepsy care', 'Nerve conduction review'],
    conditions: ['migraine', 'epilepsy'],
    reviews: 11,
    pmdc: '31544-S',
    locs: [
      { kind: 'video', name: 'Video consultation', area: '', city: 'Karachi', fee: 2000, hours: VIDEO_HOURS },
      { kind: 'clinic', name: 'Neuro Clinic DHA', area: 'DHA Phase 2', city: 'Karachi', fee: 3500, hours: week({ 1: [['18:00', '21:00']], 3: [['18:00', '21:00']], 6: [['11:00', '14:00']] }) },
    ],
  },
  {
    id: 'd_sana_m',
    name: 'Sana Mirza',
    gender: 'female',
    specialty: 'eye-specialist',
    since: 2014,
    city: 'Karachi',
    languages: ['Urdu', 'English'],
    quals: [
      ['MBBS', DOW, 2012],
      ['FCPS (Ophthalmology)', CPSP, 2018],
    ],
    exp: [['Consultant eye surgeon', 'Vision Eye Clinic', 2018, null]],
    services: ['Eye check-up', 'Glasses prescription', 'Eye infections'],
    conditions: ['weak-eyesight', 'eye-infection'],
    reviews: 9,
    pmdc: '42290-S',
    locs: [{ kind: 'clinic', name: 'Vision Eye Clinic', area: 'North Nazimabad', city: 'Karachi', fee: 2000, hours: MON_SAT([['16:00', '20:00']]) }],
  },
  {
    id: 'd_omar',
    name: 'Omar Siddiqui',
    gender: 'male',
    specialty: 'endocrinologist',
    since: 2012,
    city: 'Karachi',
    languages: ['Urdu', 'English'],
    quals: [
      ['MBBS', AKU, 2010],
      ['FCPS (Endocrinology)', CPSP, 2017],
    ],
    exp: [['Consultant endocrinologist', 'Diabetes and Thyroid Centre', 2017, null]],
    services: ['Diabetes care', 'Thyroid care', 'Insulin start'],
    conditions: ['diabetes', 'thyroid-problems'],
    topBooked: true,
    reviews: 26,
    pmdc: '35671-S',
    locs: [
      { kind: 'video', name: 'Video consultation', area: '', city: 'Karachi', fee: 1500, hours: VIDEO_HOURS },
      { kind: 'clinic', name: 'Diabetes and Thyroid Centre', area: 'Bahadurabad', city: 'Karachi', fee: 2500, hours: MON_SAT([['17:00', '21:00']]) },
    ],
  },
  {
    id: 'd_ahmed',
    name: 'Ahmed Khan',
    gender: 'male',
    specialty: 'general-physician',
    since: 2013,
    city: 'Islamabad',
    languages: ['Urdu', 'English', 'Pashto'],
    quals: [
      ['MBBS', RMU, 2011],
      ['MRCP (UK)', 'Royal College of Physicians', 2016],
    ],
    exp: [['Family physician', 'F-8 Family Clinic', 2016, null]],
    services: ['General check-up', 'Fever treatment', 'Diabetes care'],
    conditions: ['fever', 'flu-and-cold', 'typhoid', 'dengue', 'allergies'],
    reviews: 22,
    pmdc: '39005-P',
    locs: [
      { kind: 'video', name: 'Video consultation', area: '', city: 'Islamabad', fee: 1000, hours: VIDEO_HOURS },
      { kind: 'clinic', name: 'F-8 Family Clinic', area: 'F-8 Markaz', city: 'Islamabad', fee: 1500, hours: MON_SAT([['16:00', '21:00']]) },
    ],
  },
  {
    id: 'd_mehwish',
    name: 'Mehwish Abbasi',
    gender: 'female',
    specialty: 'pediatrician',
    since: 2015,
    city: 'Islamabad',
    languages: ['Urdu', 'English'],
    quals: [
      ['MBBS', RMU, 2013],
      ['FCPS (Paediatrics)', CPSP, 2019],
    ],
    exp: [['Consultant paediatrician', 'Little Stars Clinic', 2019, null]],
    services: ['Vaccination', 'Newborn care', 'Child nutrition'],
    conditions: ['child-fever', 'child-vaccination'],
    reviews: 18,
    pmdc: '44120-P',
    locs: [
      { kind: 'video', name: 'Video consultation', area: '', city: 'Islamabad', fee: 1200, hours: VIDEO_HOURS },
      { kind: 'clinic', name: 'Little Stars Clinic', area: 'G-9', city: 'Islamabad', fee: 1800, hours: MON_SAT([['17:00', '20:00']]) },
    ],
  },
  {
    id: 'd_waqas',
    name: 'Waqas Butt',
    gender: 'male',
    specialty: 'urologist',
    since: 2010,
    city: 'Islamabad',
    languages: ['Urdu', 'English', 'Punjabi'],
    quals: [
      ['MBBS', RMU, 2008],
      ['FCPS (Urology)', CPSP, 2015],
    ],
    exp: [['Consultant urologist', 'Kidney and Stone Centre', 2015, null]],
    services: ['Kidney stone treatment', 'Urine infection care', 'Prostate check'],
    conditions: ['kidney-stones', 'urine-infection'],
    reviews: 10,
    pmdc: '30880-P',
    locs: [{ kind: 'clinic', name: 'Kidney and Stone Centre', area: 'Blue Area', city: 'Islamabad', fee: 2500, hours: MON_SAT([['17:00', '20:00']]) }],
  },
  {
    id: 'd_amna',
    name: 'Amna Yousaf',
    gender: 'female',
    specialty: 'pulmonologist',
    since: 2014,
    city: 'Islamabad',
    languages: ['Urdu', 'English'],
    quals: [
      ['MBBS', 'Army Medical College', 2012],
      ['FCPS (Pulmonology)', CPSP, 2018],
    ],
    exp: [['Consultant chest physician', 'Breathe Well Clinic', 2018, null]],
    services: ['Asthma care', 'Chronic cough', 'Lung function review'],
    conditions: ['asthma', 'chronic-cough'],
    reviews: 8,
    pmdc: '40333-P',
    locs: [
      { kind: 'video', name: 'Video consultation', area: '', city: 'Islamabad', fee: 1500, hours: VIDEO_HOURS },
      { kind: 'clinic', name: 'Breathe Well Clinic', area: 'I-8 Markaz', city: 'Islamabad', fee: 2000, hours: MON_SAT([['16:00', '19:00']]) },
    ],
  },
  {
    id: 'd_sadia',
    name: 'Sadia Iqbal',
    gender: 'female',
    specialty: 'dentist',
    since: 2016,
    city: 'Islamabad',
    languages: ['Urdu', 'English'],
    quals: [
      ['BDS', 'Islamic International Dental College', 2014],
      ['FCPS (Operative Dentistry)', CPSP, 2020],
    ],
    exp: [['Dental surgeon', 'Smile Dental Studio', 2016, null]],
    services: ['Tooth filling', 'Root canal', 'Scaling and polishing'],
    conditions: ['toothache'],
    reviews: 13,
    pmdc: '9910-D',
    locs: [{ kind: 'clinic', name: 'Smile Dental Studio', area: 'F-10 Markaz', city: 'Islamabad', fee: 1500, slot: 30, hours: MON_SAT([['11:00', '15:00'], ['17:00', '20:00']]) }],
  },
  {
    id: 'd_tahir',
    name: 'Tahir Mehmood',
    gender: 'male',
    specialty: 'orthopedic-surgeon',
    since: 2006,
    city: 'Islamabad',
    languages: ['Urdu', 'English', 'Punjabi'],
    quals: [
      ['MBBS', RMU, 2004],
      ['FCPS (Orthopaedics)', CPSP, 2011],
    ],
    exp: [['Consultant orthopaedic surgeon', 'Capital Bone Clinic', 2011, null]],
    services: ['Joint replacement advice', 'Back pain management', 'Sports injuries'],
    conditions: ['back-pain', 'joint-pain'],
    reviews: 16,
    pmdc: '21876-P',
    locs: [{ kind: 'clinic', name: 'Capital Bone Clinic', area: 'F-7 Markaz', city: 'Islamabad', fee: 3000, hours: MON_SAT([['18:00', '21:00']]) }],
  },
  {
    id: 'd_hamza',
    ownerId: 'u_newdoc',
    businessId: 'b_newdoc',
    name: 'Hamza Rauf',
    gender: 'male',
    specialty: 'general-physician',
    since: 2019,
    city: 'Lahore',
    languages: ['Urdu', 'English'],
    quals: [],
    exp: [],
    services: [],
    conditions: [],
    reviews: 0,
    pmdc: '58840-P',
    locs: [],
    about: '',
  },
];

// ─── Reviews (deterministic, so screenshots are stable) ─
const AUTHORS = [
  'Ali Raza', 'Fatima Noor', 'Hassan Javed', 'Zainab Akhtar', 'Usman Ghani', 'Maryam Shah', 'Bilal Aslam', 'Iqra Hameed',
  'Saad Khan', 'Hira Malik', 'Danish Iqbal', 'Ayesha Rehman', 'Umair Sheikh', 'Kinza Tariq', 'Fahad Mirza', 'Amna Riaz',
];
const TEXTS = [
  'The doctor listened carefully and explained everything in simple words.',
  'Very professional. The treatment plan was clear and the follow-up was easy to book.',
  'On time and thorough. I felt comfortable asking questions.',
  'Good experience overall. The clinic staff were helpful.',
  'Explained the reports properly and did not prescribe unnecessary medicines.',
  'Booking was simple and I was seen at my time.',
  'Calm and patient with my child. Highly recommended.',
  'The video consultation was clear and I received the prescription right after.',
  null,
  'Waited a little longer than expected, but the consultation was worth it.',
];
const TAG_POOL = ['No waiting time', 'Great experience', 'Explained clearly', 'Friendly staff', 'On time', 'Clean clinic', 'Good value'];
const REPLIES = ['Thank you for your kind words. Wishing you good health.', 'Thank you. Please book a follow-up if anything changes.'];

const lcg = (seed: number) => {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
};

const seedReviews = (d: DoctorSeed, locs: MockLocation[], now: number): MockDoctorReview[] => {
  const rnd = lcg(d.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 7919);
  const kinds = locs.map(l => l.kind);
  const out: MockDoctorReview[] = [];
  for (let i = 0; i < d.reviews; i++) {
    const kind: ConsultKind = kinds.length ? kinds[Math.floor(rnd() * kinds.length)] : 'clinic';
    const r = rnd();
    const rating = r < 0.68 ? 5 : r < 0.9 ? 4 : r < 0.97 ? 3 : 2;
    const tags = TAG_POOL.filter(t => (kind === 'video' ? t !== 'Clean clinic' && t !== 'Friendly staff' : true)).filter(() => rnd() < 0.28);
    const text = TEXTS[Math.floor(rnd() * TEXTS.length)];
    out.push({
      id: `rv_${d.id}_${i}`,
      doctorId: d.id,
      appointmentId: null,
      userId: null,
      authorName: AUTHORS[Math.floor(rnd() * AUTHORS.length)],
      anonymous: rnd() < 0.55,
      rating,
      recommend: rating >= 4 || rnd() < 0.3,
      dimensions:
        kind === 'clinic'
          ? { diagnosis: Math.min(5, rating + (rnd() < 0.2 ? -1 : 0)), staff: Math.min(5, Math.max(3, rating - (rnd() < 0.3 ? 1 : 0))), environment: Math.max(3, rating - (rnd() < 0.4 ? 1 : 0)) }
          : { diagnosis: rating },
      tags,
      text,
      kind,
      waitMinutes: kind === 'clinic' ? Math.round(2 + rnd() * 14) : Math.round(rnd() * 4),
      createdAt: new Date(now - Math.floor(2 + rnd() * 200) * DAY).toISOString(),
      reply: rnd() < 0.25 ? { text: REPLIES[i % 2], createdAt: new Date(now - Math.floor(1 + rnd() * 2) * DAY).toISOString() } : null,
      isHidden: false,
      hiddenReason: null,
    });
  }
  return out;
};

// ─── Demo photos (Unsplash License; credited in docs/MOCK_IMAGES.md) ───
// Stand-ins for the fictional doctors' own uploads: licensed portraits,
// gender-matched, one face per doctor. Every demo profile says it is fictional.
const unsplash = (id: string) => `https://images.unsplash.com/${id}`;
/** A face-centred crop; cdn() keeps it and adds the rendered size. */
const portrait = (id: string) => `${unsplash(id)}?fit=facearea&facepad=3.2`;

export const DEMO_PORTRAITS: Record<string, string> = {
  d_ayesha: portrait('photo-1659353888906-adb3e0041693'), // Fotos
  d_hina: portrait('photo-1670191247079-f9713ae06dcf'), // Kamal Hoseinianzade
  d_mariam: portrait('photo-1757125736482-328a3cdd9743'), // Ike Ellyana
  d_farah: portrait('photo-1713865467253-ce0ac8477d34'), // Look Studio
  d_nida: portrait('photo-1623854767648-e7bb8009f0db'), // Siednji Leon
  d_saima: portrait('photo-1678695972687-033fa0bdbac9'), // Ato Aikins
  d_rabia: portrait('photo-1559839734-2b71ea197ec2'), // Humberto Chávez
  d_sana_m: portrait('photo-1673865641073-4479f93a7776'), // Bermix Studio
  d_mehwish: portrait('photo-1758691462651-611d730c5272'), // Vitaly Gariev
  d_amna: portrait('photo-1770134223774-13b735e29201'), // Beatriz Mendez
  d_sadia: portrait('photo-1643297654416-05795d62e39c'), // Eben Kassaye
  d_bilal: portrait('photo-1612349317150-e413f6a5b16d'), // Usman Yousaf
  d_usman: portrait('photo-1659353889416-fab1265eaa7f'), // Fotos
  d_kamran: portrait('photo-1637059824899-a441006a6875'), // vaibhav vivian
  d_imran: portrait('photo-1622253694242-abeb37a33e97'), // Bruno Rodrigues
  d_adeel: portrait('photo-1730597842283-943c7986ee2c'), // Muhammad Hicham
  d_ahmed: portrait('photo-1678940805950-73f2127f9d4e'), // Frederick Medina
  d_faisal: portrait('photo-1700041785712-649e859d9909'), // mohamad azaam
  d_zeeshan: portrait('photo-1769072610024-5b8a50f05c73'), // David Akinwale
  d_omar: portrait('photo-1666887360369-1901f341fdad'), // Nappy
  d_waqas: portrait('photo-1622902046580-2b47f47f5471'), // Dalton Ngangi
  d_tahir: portrait('photo-1659353888096-cc5e333db5e0'), // Fotos
  d_hamza: portrait('photo-1756699279298-c89cdef354ab'), // SoyBreno
};

export const DEMO_NOTE = ' (Demo profile: this doctor is fictional.)';

/** The Health home's promotions (photos: Unsplash License). */
const BANNERS: MockHealthBanner[] = [
  {
    id: 'hb_video',
    imageUrl: unsplash('photo-1758691463620-188ca7c1a04f'), // Vitaly Gariev
    title: 'See a doctor by video today',
    subtitle: 'PMDC-verified doctors, from home. You pay the doctor directly.',
    targetType: 'screen',
    targetId: null,
    targetScreen: 'video_consultation',
    city: null,
    startsAt: null,
    endsAt: null,
    sort: 1,
    isActive: true,
  },
  {
    id: 'hb_skin',
    imageUrl: unsplash('photo-1688588162416-f7a7e726e0bf'), // Anna Keibalo
    title: 'Skin and hair specialists',
    subtitle: 'Acne, hair fall and eczema, seen by dermatologists near you.',
    targetType: 'specialty',
    targetId: 'sp_dermatologist',
    targetScreen: null,
    city: null,
    startsAt: null,
    endsAt: null,
    sort: 2,
    isActive: true,
  },
  {
    id: 'hb_symptoms',
    imageUrl: unsplash('photo-1758273241078-8eec353836be'), // Vitaly Gariev
    title: 'Not sure who to see?',
    subtitle: 'Describe how you feel and we will suggest the right specialist.',
    targetType: 'screen',
    targetId: null,
    targetScreen: 'symptom_checker',
    city: null,
    startsAt: null,
    endsAt: null,
    sort: 3,
    isActive: true,
  },
  {
    id: 'hb_child',
    imageUrl: unsplash('photo-1708687045004-a3e3c4420e6d'), // Ortopediatri Çocuk Ortopedi Akademisi
    title: 'Gentle care for your child',
    subtitle: 'Paediatricians in Lahore for check-ups, fevers and vaccines.',
    targetType: 'specialty',
    targetId: 'sp_pediatrician',
    targetScreen: null,
    city: 'Lahore',
    startsAt: null,
    endsAt: null,
    sort: 4,
    isActive: true,
  },
  {
    id: 'hb_family',
    imageUrl: unsplash('photo-1632053002928-1919605ee6f7'), // CDC
    title: "Your family's records, in one place",
    subtitle: 'Reports and prescriptions for everyone you book for.',
    targetType: 'screen',
    targetId: null,
    targetScreen: 'records',
    city: null,
    startsAt: null,
    endsAt: null,
    sort: 5,
    isActive: true,
  },
];

/** Older stored dummy data: add the portraits, the demo note and the banners. */
export const migrateHealth = (h: MockHealth) => {
  for (const d of h.doctors) {
    if (!d.photoUrl && DEMO_PORTRAITS[d.id]) d.photoUrl = DEMO_PORTRAITS[d.id];
    if (DEMO_PORTRAITS[d.id] && !d.about.includes(DEMO_NOTE.trim())) d.about = `${d.about}${DEMO_NOTE}`;
  }
  if (!h.banners) h.banners = BANNERS.map(b => ({ ...b }));
  for (const c of h.conditions) if (c.icon === undefined) c.icon = CONDITION_ICONS[c.slug] ?? null;
};

const RULES_DEFAULT = { windowDays: 14, minNoticeMinutes: 60, cancelCutoffHours: 4, videoPrepay: false };

const aboutFor = (d: DoctorSeed, specialtyName: string, years: number) =>
  d.about ??
  `${d.gender === 'female' ? 'She' : 'He'} is a ${specialtyName.toLowerCase()} with ${years} years of practice in ${d.city}. ` +
    `${d.gender === 'female' ? 'Her' : 'His'} patients come for ${d.services.slice(0, 3).join(', ').toLowerCase()}. ` +
    `Consultations are in ${d.languages.slice(0, 2).join(' and ')}.`;

// ─── The seed ─────────────────────────────────────────
export const seedHealth = (now: number = Date.now()): MockHealth => {
  const year = new Date(now).getUTCFullYear();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const h: MockHealth = {
    specialties: SPECIALTIES.map(([slug, name, nameUr, icon], i) => ({ id: `sp_${slug}`, slug, name, nameUr, icon, sort: i + 1 })),
    conditions: CONDITIONS.map(([slug, name, nameUr, specialtySlug, isCommon, aliases]) => ({
      id: `cn_${slug}`,
      slug,
      name,
      nameUr,
      specialtySlug,
      isCommon,
      icon: CONDITION_ICONS[slug] ?? null,
      aliases,
    })),
    doctors: [],
    locations: [],
    timeOff: [],
    appointments: [],
    family: [
      { id: 'fm_hassan', userId: 'u_customer', name: 'Hassan Khan', relation: 'spouse', gender: 'male', dateOfBirth: '1990-08-21', phone: '+923214567890' },
      { id: 'fm_zara', userId: 'u_customer', name: 'Zara Khan', relation: 'child', gender: 'female', dateOfBirth: '2019-03-14', phone: null },
    ],
    records: [
      {
        id: 'rec_cbc',
        userId: 'u_customer',
        memberId: null,
        title: 'Complete blood count',
        type: 'lab_report',
        recordedOn: addDays(todayInZone(PKT, now), -20),
        files: [{ url: 'https://placehold.co/900x1200/png?text=Complete+blood+count', mime: 'image/png' }],
        createdAt: iso(20 * DAY),
      },
      {
        id: 'rec_xray',
        userId: 'u_customer',
        memberId: 'fm_hassan',
        title: 'Chest X-ray',
        type: 'imaging',
        recordedOn: addDays(todayInZone(PKT, now), -45),
        files: [{ url: 'https://placehold.co/900x1200/png?text=Chest+X-ray', mime: 'image/png' }],
        createdAt: iso(45 * DAY),
      },
      {
        id: 'rec_vacc',
        userId: 'u_customer',
        memberId: 'fm_zara',
        title: 'Vaccination card',
        type: 'other',
        recordedOn: addDays(todayInZone(PKT, now), -90),
        files: [
          { url: 'https://placehold.co/900x1200/png?text=Vaccination+card+page+1', mime: 'image/png' },
          { url: 'https://placehold.co/900x1200/png?text=Vaccination+card+page+2', mime: 'image/png' },
        ],
        createdAt: iso(90 * DAY),
      },
      {
        id: 'rec_discharge',
        userId: 'u_customer',
        memberId: null,
        title: 'Discharge summary',
        type: 'discharge',
        recordedOn: addDays(todayInZone(PKT, now), -200),
        files: [{ url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', mime: 'application/pdf' }],
        createdAt: iso(200 * DAY),
      },
    ],
    prescriptions: [],
    reviews: [],
    paymentAccounts: {
      d_ayesha: [
        { id: 'pa_ay1', kind: 'jazzcash', title: 'Ayesha Siddiqui', number: '+923001112233', bankName: null, isActive: true },
        { id: 'pa_ay2', kind: 'bank', title: 'Ayesha Siddiqui', number: 'PK36SCBL0000001123456702', bankName: 'Standard Chartered', isActive: true },
      ],
      d_bilal: [{ id: 'pa_bi1', kind: 'easypaisa', title: 'Bilal Ahmed', number: '+923004445566', bankName: null, isActive: true }],
    },
    pmdc: {
      b_doctor: { verified: true, note: 'Checked on the PMDC register.', at: iso(60 * DAY) },
      b_derm: { verified: true, note: 'Checked on the PMDC register.', at: iso(60 * DAY) },
      b_newdoc: { verified: true, note: 'Checked on the PMDC register.', at: iso(3 * DAY) },
      b_pmdc: { verified: false, note: null, at: null },
    },
    favourites: {},
    formulary: FORMULARY,
    idempotency: {},
    contested: [],
    banners: BANNERS.map(b => ({ ...b })),
    seq: 1,
  };

  for (const d of DOCTORS) {
    const spec = h.specialties.find(s => s.slug === d.specialty)!;
    const doctor: MockDoctor = {
      id: d.id,
      ownerId: d.ownerId ?? null,
      businessId: d.businessId ?? null,
      title: 'Dr.',
      name: d.name,
      gender: d.gender,
      photoUrl: DEMO_PORTRAITS[d.id] ?? null,
      specialtySlug: d.specialty,
      secondarySpecialtySlug: d.secondary ?? null,
      practisingSince: d.since,
      languages: d.languages,
      about: `${aboutFor(d, spec.name, year - d.since)}${DEMO_NOTE}`,
      qualifications: d.quals.map(([degree, institute, y]): Qualification => ({ degree, institute, year: y })),
      experience: d.exp.map(([role, place, from, to]): ExperienceRow => ({ role, place, from, to })),
      services: d.services,
      conditionSlugs: d.conditions,
      bookingRules: { ...RULES_DEFAULT, videoPrepay: d.locs.some(l => l.prepay) },
      pmdcNumber: d.pmdc,
      isListed: d.id !== 'd_hamza',
      topBooked: !!d.topBooked,
      city: d.city,
      previewSeen: d.id !== 'd_hamza',
      createdAt: iso(400 * DAY),
    };
    h.doctors.push(doctor);
    const locs: MockLocation[] = d.locs.map((l, i) => ({
      id: `loc_${d.id.slice(2)}_${i + 1}`,
      doctorId: d.id,
      kind: l.kind,
      name: l.name,
      area: l.area,
      city: l.city,
      address: l.address ?? (l.kind === 'clinic' ? `${l.name}, ${l.area}, ${l.city}` : null),
      lat: l.lat ?? null,
      lng: l.lng ?? null,
      phone: l.phone ?? null,
      fee: l.fee,
      slotMinutes: l.slot ?? 15,
      instructions: l.instructions ?? (l.kind === 'video' ? 'Join from Appointments 10 minutes before your time. Keep your reports nearby.' : null),
      timezone: PKT,
      requiresPrepay: !!l.prepay,
      hours: l.hours,
      isActive: true,
    }));
    h.locations.push(...locs);
    h.reviews.push(...seedReviews(d, locs, now));
    if (FAVOURITES[d.id]) {
      h.favourites[d.id] = FAVOURITES[d.id].map(name => FORMULARY.find(f => f.name === name)!).filter(Boolean);
    }
  }

  seedAppointments(h, now);
  return h;
};

// ─── Appointments for the demo accounts ───────────────
const APPT_BASE = (h: MockHealth, over: Partial<MockAppointment> & Pick<MockAppointment, 'doctorId' | 'locationId' | 'startAt' | 'status'>, now: number): MockAppointment => {
  const loc = h.locations.find(l => l.id === over.locationId)!;
  const start = Date.parse(over.startAt);
  return {
    id: `ap_${(h.seq++).toString(36)}`,
    code: appointmentCode(h),
    userId: 'u_customer',
    familyMemberId: null,
    patientName: 'Ayesha Khan',
    patientDob: '1995-04-12',
    patientGender: 'female',
    patientPhone: '+923001234567',
    kind: loc.kind,
    endAt: new Date(start + loc.slotMinutes * MINUTE).toISOString(),
    reasonTags: [],
    reason: null,
    recordIds: [],
    paymentMethod: 'pay_at_visit',
    paymentStatus: 'pay_at_visit',
    fee: loc.fee,
    instructions: null,
    proof: null,
    events: [{ type: 'booked', note: null, createdAt: new Date(Math.min(now, start) - 3 * DAY).toISOString() }],
    checkedInAt: null,
    startedAt: null,
    completedAt: null,
    cancelledBy: null,
    cancelReason: null,
    lateCancel: false,
    rescheduleCount: 0,
    notes: { text: '', attachments: [], updatedAt: null },
    prescriptionId: null,
    reviewId: null,
    roomSecret: Math.random().toString(36).slice(2, 12),
    createdAt: new Date(Math.min(now, start) - 3 * DAY).toISOString(),
    ...over,
  };
};

const completeAt = (a: MockAppointment, start: number) => {
  a.checkedInAt = new Date(start - 6 * MINUTE).toISOString();
  a.startedAt = new Date(start + 2 * MINUTE).toISOString();
  a.completedAt = new Date(start + 14 * MINUTE).toISOString();
  a.events.push(
    ...(a.kind === 'clinic' ? [{ type: 'checked_in' as const, note: null, createdAt: a.checkedInAt }] : []),
    { type: 'in_progress', note: null, createdAt: a.startedAt },
    { type: 'completed', note: null, createdAt: a.completedAt },
  );
};

/** A past start on the doctor's grid: `daysAgo` days back at hh:mm PKT. */
const pastAt = (now: number, daysAgo: number, hhmm: string) => zonedToIso(addDays(todayInZone(PKT, now), -daysAgo), hhmm, PKT);

const STAND_INS: { name: string; dob: string; gender: 'male' | 'female'; phone: string }[] = [
  { name: 'Ali Raza', dob: '1988-02-11', gender: 'male', phone: '+923011234567' },
  { name: 'Fatima Noor', dob: '1997-06-30', gender: 'female', phone: '+923021234567' },
  { name: 'Hassan Javed', dob: '1979-11-05', gender: 'male', phone: '+923031234567' },
  { name: 'Zainab Akhtar', dob: '2002-01-19', gender: 'female', phone: '+923041234567' },
  { name: 'Usman Ghani', dob: '1965-09-23', gender: 'male', phone: '+923051234567' },
  { name: 'Maryam Shah', dob: '1992-12-02', gender: 'female', phone: '+923061234567' },
];

const seedAppointments = (h: MockHealth, now: number) => {
  const loc = (id: string) => h.locations.find(l => l.id === id)!;
  const bilalGulberg = loc('loc_bilal_2');
  const ayeshaVideo = loc('loc_ayesha_1');
  const ayeshaClinic = loc('loc_ayesha_2');
  const imranClinic = loc('loc_imran_2');
  const usmanClinic = loc('loc_usman_1');

  // Upcoming: a clinic visit with Dr. Bilal at his next free time from tomorrow.
  const next = nextAvailable(h, bilalGulberg, now, addDays(todayInZone(PKT, now), 1));
  if (next) {
    h.appointments.push(
      APPT_BASE(h, { doctorId: 'd_bilal', locationId: bilalGulberg.id, startAt: next.startAt, status: 'confirmed', reasonTags: ['follow_up'], reason: 'Blood pressure follow-up', recordIds: ['rec_cbc'] }, now),
    );
  }

  // Upcoming: Zara's prepaid video consult with Dr. Ayesha, proof sent — the doctor confirms it.
  const vnext = nextAvailable(h, ayeshaVideo, now, addDays(todayInZone(PKT, now), 2));
  if (vnext) {
    const a = APPT_BASE(
      h,
      {
        doctorId: 'd_ayesha',
        locationId: ayeshaVideo.id,
        startAt: vnext.startAt,
        status: 'awaiting_payment',
        familyMemberId: 'fm_zara',
        patientName: 'Zara Khan',
        patientDob: '2019-03-14',
        reasonTags: ['new_problem'],
        reason: 'Dry, itchy patches on both arms',
        paymentMethod: 'transfer',
        paymentStatus: 'proof_submitted',
        instructions: {
          kind: 'jazzcash',
          accountTitle: 'Ayesha Siddiqui',
          accountNumber: '+923001112233',
          bankName: null,
          amount: ayeshaVideo.fee,
          payBy: new Date(Math.min(now + 3 * HOUR, Date.parse(vnext.startAt) - 15 * MINUTE)).toISOString(),
        },
        proof: { transactionId: 'JC8842019935', imageUrl: null, submittedAt: new Date(now - 2 * HOUR).toISOString(), rejectionReason: null },
      },
      now,
    );
    a.events.push({ type: 'payment_proof_submitted', note: 'JC8842019935', createdAt: new Date(now - 2 * HOUR).toISOString() });
    h.appointments.push(a);
  }

  // Past: acne visit 12 days ago with a prescription, not yet rated (Rate visit).
  const acneStart = pastAt(now, 12, '16:20');
  const acne = APPT_BASE(h, { doctorId: 'd_ayesha', locationId: ayeshaClinic.id, startAt: acneStart, status: 'completed', reasonTags: ['new_problem'], reason: 'Pimples on the face for three months' }, now);
  completeAt(acne, Date.parse(acneStart));
  acne.notes = { text: 'Moderate acne on cheeks and forehead. No scarring. Start topical treatment; review in 6 weeks.', attachments: [], updatedAt: acne.completedAt };
  const p1 = {
    id: 'rx_acne',
    appointmentId: acne.id,
    doctorId: 'd_ayesha',
    issuedAt: acne.completedAt!,
    diagnosis: 'Acne vulgaris (moderate)',
    medicines: [
      { name: 'Adapalene', strength: '0.1%', form: 'cream' as const, dose: '0+0+1', timing: 'bedtime' as const, days: 42, instructions: 'A pea-sized amount on the whole face, not on spots only.' },
      { name: 'Clindamycin', strength: '1%', form: 'cream' as const, dose: '1+0+0', timing: null, days: 42, instructions: null },
      { name: 'Doxycycline', strength: '100 mg', form: 'capsule' as const, dose: '1+0+0', timing: 'after_meal' as const, days: 30, instructions: 'With a full glass of water. Avoid lying down for 30 minutes.' },
    ],
    tests: [],
    advice: 'Use a gentle face wash twice a day and a non-oily sunscreen. Do not squeeze the spots.',
    followUpInDays: 42,
  };
  acne.prescriptionId = p1.id;
  acne.events.push({ type: 'prescription_issued', note: null, createdAt: p1.issuedAt });
  h.prescriptions.push(p1);
  h.appointments.push(acne);

  // Past: a GP visit 40 days ago, rated, with a prescription.
  const feverStart = pastAt(now, 40, '18:00');
  const fever = APPT_BASE(h, { doctorId: 'd_imran', locationId: imranClinic.id, startAt: feverStart, status: 'completed', reasonTags: ['new_problem'], reason: 'Fever and sore throat for three days' }, now);
  completeAt(fever, Date.parse(feverStart));
  const p2 = {
    id: 'rx_fever',
    appointmentId: fever.id,
    doctorId: 'd_imran',
    issuedAt: fever.completedAt!,
    diagnosis: 'Viral pharyngitis',
    medicines: [
      { name: 'Paracetamol', strength: '500 mg', form: 'tablet' as const, dose: '1+1+1', timing: 'after_meal' as const, days: 3, instructions: 'Only when the temperature is above 100°F.' },
      { name: 'Cetirizine', strength: '10 mg', form: 'tablet' as const, dose: '0+0+1', timing: 'bedtime' as const, days: 5, instructions: null },
    ],
    tests: ['Complete blood count'],
    advice: 'Warm salt-water gargles, plenty of fluids and rest.',
    followUpInDays: null,
  };
  fever.prescriptionId = p2.id;
  h.prescriptions.push(p2);
  const ownReview: MockDoctorReview = {
    id: 'rv_own_fever',
    doctorId: 'd_imran',
    appointmentId: fever.id,
    userId: 'u_customer',
    authorName: 'Ayesha Khan',
    anonymous: true,
    rating: 5,
    recommend: true,
    dimensions: { diagnosis: 5, staff: 4, environment: 4 },
    tags: ['Explained clearly', 'On time'],
    text: 'Quick and clear. I felt better in two days.',
    kind: 'clinic',
    waitMinutes: 8,
    createdAt: new Date(Date.parse(fever.completedAt!) + DAY).toISOString(),
    reply: null,
    isHidden: false,
    hiddenReason: null,
  };
  fever.reviewId = ownReview.id;
  h.reviews.push(ownReview);
  h.appointments.push(fever);

  // Past: a cancelled visit, and Zara's missed one.
  h.appointments.push(
    APPT_BASE(
      h,
      {
        doctorId: 'd_kamran',
        locationId: 'loc_kamran_1',
        startAt: pastAt(now, 5, '18:30'),
        status: 'cancelled',
        cancelledBy: 'patient',
        cancelReason: 'Schedule clash',
        events: [
          { type: 'booked', note: null, createdAt: new Date(now - 9 * DAY).toISOString() },
          { type: 'cancelled', note: 'Schedule clash', createdAt: new Date(now - 6 * DAY).toISOString() },
        ],
      },
      now,
    ),
    APPT_BASE(h, { doctorId: 'd_usman', locationId: usmanClinic.id, startAt: pastAt(now, 20, '17:30'), status: 'no_show', familyMemberId: 'fm_zara', patientName: 'Zara Khan', patientDob: '2019-03-14' }, now),
  );

  // Today's queue for the two demo doctors: stand-in patients around now.
  const todayAt = (offsetMin: number, slot: number) => {
    const t = Math.floor((now + offsetMin * MINUTE) / (slot * MINUTE)) * slot * MINUTE;
    return new Date(t).toISOString();
  };
  const queue: [string, MockLocation, number, MockAppointment['status']][] = [
    ['d_ayesha', ayeshaClinic, -100, 'completed'],
    ['d_ayesha', ayeshaClinic, -60, 'no_show'],
    ['d_ayesha', ayeshaClinic, -20, 'checked_in'],
    ['d_ayesha', ayeshaClinic, 40, 'confirmed'],
    ['d_ayesha', ayeshaClinic, 80, 'confirmed'],
    ['d_bilal', bilalGulberg, -45, 'checked_in'],
    ['d_bilal', bilalGulberg, 60, 'confirmed'],
  ];
  queue.forEach(([doctorId, l, offset, status], i) => {
    const p = STAND_INS[i % STAND_INS.length];
    const startAt = todayAt(offset, l.slotMinutes);
    const a = APPT_BASE(
      h,
      {
        doctorId,
        locationId: l.id,
        startAt,
        status,
        userId: `u_standin_${i % STAND_INS.length}`,
        patientName: p.name,
        patientDob: p.dob,
        patientGender: p.gender,
        patientPhone: p.phone,
        reasonTags: i % 2 ? ['follow_up'] : ['new_problem'],
        reason: i % 3 === 0 ? 'Rash that keeps coming back' : null,
      },
      now,
    );
    if (status === 'completed') {
      completeAt(a, Date.parse(startAt));
      a.paymentStatus = 'collected';
    }
    if (status === 'checked_in') {
      a.checkedInAt = new Date(Math.min(now - 7 * MINUTE, Date.parse(startAt))).toISOString();
      a.events.push({ type: 'checked_in', note: null, createdAt: a.checkedInAt });
    }
    if (status === 'no_show') a.events.push({ type: 'no_show', note: null, createdAt: new Date(Date.parse(startAt) + 15 * MINUTE).toISOString() });
    h.appointments.push(a);
    // A history with this doctor for some stand-ins (previous visits, first-visit badge).
    if (i % 2 === 1) {
      const past = APPT_BASE(
        h,
        {
          doctorId,
          locationId: l.id,
          startAt: pastAt(now, 30 + i, '17:00'),
          status: 'completed',
          userId: a.userId,
          patientName: p.name,
          patientDob: p.dob,
          patientGender: p.gender,
          patientPhone: p.phone,
          paymentStatus: 'collected',
        },
        now,
      );
      completeAt(past, Date.parse(past.startAt));
      past.notes = { text: 'Responded well to treatment. Continue for two more weeks.', attachments: [], updatedAt: past.completedAt };
      h.appointments.push(past);
    }
  });
};

/** Partner accounts and businesses for the seed doctors (merged into mockDb's seed). */
export const HEALTH_SEED_USERS = [
  { id: 'u_derm', email: 'derm@metromatrix.app', name: 'Dr. Ayesha Siddiqui', gender: 'female' as const, businessId: 'b_derm', businessName: 'Dr. Ayesha Siddiqui Skin Clinic', status: 'approved' as const, specialty: 'Dermatologist', pmdc: '38417-P', listed: true },
  { id: 'u_newdoc', email: 'newdoctor@metromatrix.app', name: 'Dr. Hamza Rauf', gender: 'male' as const, businessId: 'b_newdoc', businessName: 'Dr. Hamza Rauf', status: 'approved' as const, specialty: 'General physician', pmdc: '58840-P', listed: false },
  { id: 'u_pmdc', email: 'pmdc@metromatrix.app', name: 'Dr. Sana Iqbal', gender: 'female' as const, businessId: 'b_pmdc', businessName: 'Dr. Sana Iqbal Clinic', status: 'pending_approval' as const, specialty: 'Pediatrician', pmdc: '61207-P', listed: false },
];
