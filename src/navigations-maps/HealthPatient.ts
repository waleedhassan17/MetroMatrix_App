// ═══════════════════════════════════════════════════════
// MetroMatrix — Healthcare (patient) routes
// ═══════════════════════════════════════════════════════
// The customer's Digital Health app, the FYP's way: HEALTH_TABS (Home ·
// Appointments · Records · Profile) under HEALTH_APP_ROUTES, which push over
// the tabs. HEALTH_BROWSE_ROUTES also stays in the shared Profile stack.

import type { IRoute, ITabRoute } from './types';
import { ROUTES } from './Base';

import HealthHomeScreen from '../screens/Health/Patient/HealthHome/HealthHomeScreen';
import HealthSearchScreen from '../screens/Health/Patient/HealthSearch/HealthSearchScreen';
import SpecialtyListScreen from '../screens/Health/Patient/SpecialtyList/SpecialtyListScreen';
import ConditionListScreen from '../screens/Health/Patient/ConditionList/ConditionListScreen';
import DoctorListScreen from '../screens/Health/Patient/DoctorList/DoctorListScreen';
import DoctorProfileScreen from '../screens/Health/Patient/DoctorProfile/DoctorProfileScreen';
import DoctorReviewsScreen from '../screens/Health/Patient/DoctorReviews/DoctorReviewsScreen';
import BookingConfirmedScreen from '../screens/Health/Patient/BookingConfirmed/BookingConfirmedScreen';
import AppointmentDetailScreen from '../screens/Health/Patient/AppointmentDetail/AppointmentDetailScreen';
import VideoPrecheckScreen from '../screens/Health/Patient/VideoPrecheck/VideoPrecheckScreen';
import VideoConsultScreen from '../screens/Health/Patient/VideoConsult/VideoConsultScreen';
import PostConsultReviewScreen from '../screens/Health/Patient/PostConsultReview/PostConsultReviewScreen';
import PrescriptionListScreen from '../screens/Health/Patient/PrescriptionList/PrescriptionListScreen';
import PrescriptionViewScreen from '../screens/Health/Patient/PrescriptionView/PrescriptionViewScreen';
import HealthRecordsScreen from '../screens/Health/Patient/HealthRecords/HealthRecordsScreen';
import RecordDetailScreen from '../screens/Health/Patient/RecordDetail/RecordDetailScreen';
import RecordUploadScreen from '../screens/Health/Patient/RecordUpload/RecordUploadScreen';
import FamilyMembersScreen from '../screens/Health/Patient/FamilyMembers/FamilyMembersScreen';
import FamilyMemberFormScreen from '../screens/Health/Patient/FamilyMemberForm/FamilyMemberFormScreen';
import SymptomCheckerScreen from '../screens/Health/Patient/SymptomChecker/SymptomCheckerScreen';
import SymptomResultScreen from '../screens/Health/Patient/SymptomResult/SymptomResultScreen';
import EmergencyScreen from '../screens/Health/Patient/Emergency/EmergencyScreen';
import HealthAppointmentsScreen from '../screens/Health/Patient/HealthAppointments/HealthAppointmentsScreen';
import ProfileScreen from '../screens/Account/Profile/ProfileScreen';
import PaymentProofScreen from '../screens/Shopping/Customer/PaymentProof/PaymentProofScreen';

export const HEALTH_BROWSE_ROUTES: IRoute[] = [
  { title: ROUTES.HEALTH_SEARCH, component: HealthSearchScreen, options: { animation: 'fade' } },
  { title: ROUTES.SPECIALTY_LIST, component: SpecialtyListScreen },
  { title: ROUTES.CONDITION_LIST, component: ConditionListScreen },
  { title: ROUTES.DOCTOR_LIST, component: DoctorListScreen },
  { title: ROUTES.DOCTOR_PROFILE, component: DoctorProfileScreen },
  { title: ROUTES.DOCTOR_REVIEWS, component: DoctorReviewsScreen },
  { title: ROUTES.BOOKING_CONFIRMED, component: BookingConfirmedScreen },
  { title: ROUTES.APPOINTMENT_DETAIL, component: AppointmentDetailScreen },
  { title: ROUTES.VIDEO_PRECHECK, component: VideoPrecheckScreen },
  // The call takes the whole screen; a stray swipe must not drop it.
  { title: ROUTES.VIDEO_CONSULT, component: VideoConsultScreen, options: { gestureEnabled: false } },
  { title: ROUTES.POST_CONSULT_REVIEW, component: PostConsultReviewScreen },
  { title: ROUTES.PRESCRIPTION_LIST, component: PrescriptionListScreen },
  { title: ROUTES.PRESCRIPTION_VIEW, component: PrescriptionViewScreen },
  { title: ROUTES.HEALTH_RECORDS, component: HealthRecordsScreen },
  { title: ROUTES.RECORD_DETAIL, component: RecordDetailScreen },
  { title: ROUTES.RECORD_UPLOAD, component: RecordUploadScreen },
  { title: ROUTES.FAMILY_MEMBERS, component: FamilyMembersScreen },
  { title: ROUTES.FAMILY_MEMBER_FORM, component: FamilyMemberFormScreen },
  { title: ROUTES.SYMPTOM_CHECKER, component: SymptomCheckerScreen },
  { title: ROUTES.SYMPTOM_RESULT, component: SymptomResultScreen },
  { title: ROUTES.EMERGENCY, component: EmergencyScreen },
];

const AS_TAB = { asTab: true };

/** The FYP's Health tabs: Home · Appointments · Records · Profile. */
export const HEALTH_TABS: ITabRoute[] = [
  { title: ROUTES.HEALTH_HOME_TAB, component: HealthHomeScreen, label: 'Home', icon: 'home-outline', iconActive: 'home', initialParams: AS_TAB },
  { title: ROUTES.APPOINTMENTS_TAB, component: HealthAppointmentsScreen, label: 'Appointments', icon: 'calendar-outline', iconActive: 'calendar', initialParams: AS_TAB },
  { title: ROUTES.RECORDS_TAB, component: HealthRecordsScreen, label: 'Records', icon: 'document-text-outline', iconActive: 'document-text', initialParams: AS_TAB },
  { title: ROUTES.HEALTH_PROFILE_TAB, component: ProfileScreen, label: 'Profile', icon: 'person-outline', iconActive: 'person', initialParams: AS_TAB },
];

/** Everything that opens over the Health tabs (Records is a tab, not a page here). */
export const HEALTH_APP_ROUTES: IRoute[] = [
  ...HEALTH_BROWSE_ROUTES.filter(r => r.title !== ROUTES.HEALTH_RECORDS),
  // "I've paid" for an appointment's transfer (the screen Shopping shares).
  { title: ROUTES.PAYMENT_PROOF, component: PaymentProofScreen },
];
