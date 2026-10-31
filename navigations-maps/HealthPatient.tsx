// ═══════════════════════════════════════════════════════
// MetroMatrix — Healthcare (patient) routes
// ═══════════════════════════════════════════════════════
// The customer's Digital Health app, the FYP's way: HEALTH_TABS (Home ·
// Appointments · Records · Profile) under HEALTH_APP_ROUTES, which push over
// the tabs. HEALTH_BROWSE_ROUTES also stays in the shared Profile stack.

import type { IRoute, ITabRoute } from './types';
import { ROUTES } from './Base';

import HealthHome from '../screens/health-home-screen/HealthHome';
import HealthSearch from '../screens/health-search-screen/HealthSearch';
import SpecialtyList from '../screens/specialty-list-screen/SpecialtyList';
import ConditionList from '../screens/condition-list-screen/ConditionList';
import DoctorList from '../screens/doctor-list-screen/DoctorList';
import DoctorProfileScreen from '../screens/doctor-profile-screen/DoctorProfile';
import DoctorReviews from '../screens/doctor-reviews-screen/DoctorReviews';
import BookingConfirmed from '../screens/booking-confirmed-screen/BookingConfirmed';
import AppointmentDetail from '../screens/appointment-detail-screen/AppointmentDetail';
import VideoPrecheck from '../screens/video-precheck-screen/VideoPrecheck';
import VideoConsult from '../screens/video-consult-screen/VideoConsult';
import PostConsultReview from '../screens/post-consult-review-screen/PostConsultReview';
import PrescriptionList from '../screens/prescription-list-screen/PrescriptionList';
import PrescriptionView from '../screens/prescription-view-screen/PrescriptionView';
import HealthRecords from '../screens/health-records-screen/HealthRecords';
import RecordDetail from '../screens/record-detail-screen/RecordDetail';
import RecordUpload from '../screens/record-upload-screen/RecordUpload';
import FamilyMembers from '../screens/family-members-screen/FamilyMembers';
import FamilyMemberForm from '../screens/family-member-form-screen/FamilyMemberForm';
import SymptomChecker from '../screens/symptom-checker-screen/SymptomChecker';
import SymptomResult from '../screens/symptom-result-screen/SymptomResult';
import Emergency from '../screens/emergency-screen/Emergency';
import HealthAppointments from '../screens/health-appointments-screen/HealthAppointments';
import Profile from '../screens/profile-screen/Profile';
import PaymentProof from '../screens/payment-proof-screen/PaymentProof';

export const HEALTH_BROWSE_ROUTES: IRoute[] = [
  { title: ROUTES.HEALTH_SEARCH, component: HealthSearch, options: { animation: 'fade' } },
  { title: ROUTES.SPECIALTY_LIST, component: SpecialtyList },
  { title: ROUTES.CONDITION_LIST, component: ConditionList },
  { title: ROUTES.DOCTOR_LIST, component: DoctorList },
  { title: ROUTES.DOCTOR_PROFILE, component: DoctorProfileScreen },
  { title: ROUTES.DOCTOR_REVIEWS, component: DoctorReviews },
  { title: ROUTES.BOOKING_CONFIRMED, component: BookingConfirmed },
  { title: ROUTES.APPOINTMENT_DETAIL, component: AppointmentDetail },
  { title: ROUTES.VIDEO_PRECHECK, component: VideoPrecheck },
  // The call takes the whole screen; a stray swipe must not drop it.
  { title: ROUTES.VIDEO_CONSULT, component: VideoConsult, options: { gestureEnabled: false } },
  { title: ROUTES.POST_CONSULT_REVIEW, component: PostConsultReview },
  { title: ROUTES.PRESCRIPTION_LIST, component: PrescriptionList },
  { title: ROUTES.PRESCRIPTION_VIEW, component: PrescriptionView },
  { title: ROUTES.HEALTH_RECORDS, component: HealthRecords },
  { title: ROUTES.RECORD_DETAIL, component: RecordDetail },
  { title: ROUTES.RECORD_UPLOAD, component: RecordUpload },
  { title: ROUTES.FAMILY_MEMBERS, component: FamilyMembers },
  { title: ROUTES.FAMILY_MEMBER_FORM, component: FamilyMemberForm },
  { title: ROUTES.SYMPTOM_CHECKER, component: SymptomChecker },
  { title: ROUTES.SYMPTOM_RESULT, component: SymptomResult },
  { title: ROUTES.EMERGENCY, component: Emergency },
];

const AS_TAB = { asTab: true };

/** The FYP's Health tabs: Home · Appointments · Records · Profile. */
export const HEALTH_TABS: ITabRoute[] = [
  { title: ROUTES.HEALTH_HOME_TAB, component: HealthHome, label: 'Home', icon: 'home-outline', iconActive: 'home', initialParams: AS_TAB },
  { title: ROUTES.APPOINTMENTS_TAB, component: HealthAppointments, label: 'Appointments', icon: 'calendar-outline', iconActive: 'calendar', initialParams: AS_TAB },
  { title: ROUTES.RECORDS_TAB, component: HealthRecords, label: 'Records', icon: 'document-text-outline', iconActive: 'document-text', initialParams: AS_TAB },
  { title: ROUTES.HEALTH_PROFILE_TAB, component: Profile, label: 'Profile', icon: 'person-outline', iconActive: 'person', initialParams: AS_TAB },
];

/** Everything that opens over the Health tabs (Records is a tab, not a page here). */
export const HEALTH_APP_ROUTES: IRoute[] = [
  ...HEALTH_BROWSE_ROUTES.filter(r => r.title !== ROUTES.HEALTH_RECORDS),
  // "I've paid" for an appointment's transfer (the screen Shopping shares).
  { title: ROUTES.PAYMENT_PROOF, component: PaymentProof },
];
