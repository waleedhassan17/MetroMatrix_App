// ═══════════════════════════════════════════════════════
// MetroMatrix — The doctor's app
// ═══════════════════════════════════════════════════════
// Four tabs (Today · Calendar · Patients · More) at the root of a stack; every
// tool pushes over the tabs. Until the doctor is listed for patients the
// stack opens on Practice setup instead (sessionGate.doctorRootRoute).

import type { IRoute, ITabRoute } from './types';
import { ROUTES } from './Base';

import DoctorToday from '../screens/doctor-today-screen/DoctorToday';
import DoctorCalendar from '../screens/doctor-calendar-screen/DoctorCalendar';
import DoctorPatients from '../screens/doctor-patients-screen/DoctorPatients';
import DoctorMore from '../screens/doctor-more-screen/DoctorMore';
import PracticeSetup from '../screens/practice-setup-screen/PracticeSetup';
import Availability from '../screens/availability-screen/Availability';
import TimeOff from '../screens/time-off-screen/TimeOff';
import DoctorAppointment from '../screens/doctor-appointment-screen/DoctorAppointment';
import PrescriptionWriter from '../screens/prescription-writer-screen/PrescriptionWriter';
import PatientHistory from '../screens/patient-history-screen/PatientHistory';
import MyReviews from '../screens/my-reviews-screen/MyReviews';
import DoctorInsights from '../screens/doctor-insights-screen/DoctorInsights';
import DoctorProfileEdit from '../screens/doctor-profile-edit-screen/DoctorProfileEdit';
import PaymentAccounts from '../screens/payment-accounts-screen/PaymentAccounts';
import VideoPrecheck from '../screens/video-precheck-screen/VideoPrecheck';
import VideoConsult from '../screens/video-consult-screen/VideoConsult';
import Profile from '../screens/profile-screen/Profile';
import ChangePassword from '../screens/change-password-screen/ChangePassword';
import Notifications from '../screens/notifications-screen/Notifications';

export const DOCTOR_PARTNER_TABS: ITabRoute[] = [
  { title: ROUTES.TODAY_TAB, component: DoctorToday, label: 'Today', icon: 'today-outline', iconActive: 'today' },
  { title: ROUTES.CALENDAR_TAB, component: DoctorCalendar, label: 'Calendar', icon: 'calendar-outline', iconActive: 'calendar' },
  { title: ROUTES.PATIENTS_TAB, component: DoctorPatients, label: 'Patients', icon: 'people-outline', iconActive: 'people' },
  { title: ROUTES.MORE_TAB, component: DoctorMore, label: 'More', icon: 'grid-outline', iconActive: 'grid' },
];

/** Pushed over the tabs (the tabs, or Practice setup, are the stack's first screen). */
export const DOCTOR_PARTNER_STACK_ROUTES: IRoute[] = [
  { title: ROUTES.PRACTICE_SETUP, component: PracticeSetup },
  { title: ROUTES.AVAILABILITY, component: Availability },
  { title: ROUTES.TIME_OFF, component: TimeOff },
  { title: ROUTES.DOCTOR_APPOINTMENT, component: DoctorAppointment },
  { title: ROUTES.PRESCRIPTION_WRITER, component: PrescriptionWriter },
  { title: ROUTES.PATIENT_HISTORY, component: PatientHistory },
  { title: ROUTES.MY_REVIEWS, component: MyReviews },
  { title: ROUTES.DOCTOR_INSIGHTS, component: DoctorInsights },
  { title: ROUTES.DOCTOR_PROFILE_EDIT, component: DoctorProfileEdit },
  { title: ROUTES.PAYMENT_ACCOUNTS, component: PaymentAccounts },
  { title: ROUTES.VIDEO_PRECHECK, component: VideoPrecheck },
  { title: ROUTES.VIDEO_CONSULT, component: VideoConsult, options: { gestureEnabled: false } },
  { title: ROUTES.PROFILE, component: Profile },
  { title: ROUTES.CHANGE_PASSWORD, component: ChangePassword },
  { title: ROUTES.NOTIFICATIONS, component: Notifications },
];
