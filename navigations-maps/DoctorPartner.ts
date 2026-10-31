// ═══════════════════════════════════════════════════════
// MetroMatrix — The doctor's app
// ═══════════════════════════════════════════════════════
// Four tabs (Today · Calendar · Patients · More) at the root of a stack; every
// tool pushes over the tabs. Until the doctor is listed for patients the
// stack opens on Practice setup instead (sessionGate.doctorRootRoute).

import type { IRoute, ITabRoute } from './types';
import { ROUTES } from './Base';

import DoctorTodayScreen from '../screens/Health/Doctor/DoctorToday/DoctorTodayScreen';
import DoctorCalendarScreen from '../screens/Health/Doctor/DoctorCalendar/DoctorCalendarScreen';
import DoctorPatientsScreen from '../screens/Health/Doctor/DoctorPatients/DoctorPatientsScreen';
import DoctorMoreScreen from '../screens/Health/Doctor/DoctorMore/DoctorMoreScreen';
import PracticeSetupScreen from '../screens/Health/Doctor/PracticeSetup/PracticeSetupScreen';
import AvailabilityScreen from '../screens/Health/Doctor/Availability/AvailabilityScreen';
import TimeOffScreen from '../screens/Health/Doctor/TimeOff/TimeOffScreen';
import DoctorAppointmentScreen from '../screens/Health/Doctor/DoctorAppointment/DoctorAppointmentScreen';
import PrescriptionWriterScreen from '../screens/Health/Doctor/PrescriptionWriter/PrescriptionWriterScreen';
import PatientHistoryScreen from '../screens/Health/Doctor/PatientHistory/PatientHistoryScreen';
import MyReviewsScreen from '../screens/Health/Doctor/MyReviews/MyReviewsScreen';
import DoctorInsightsScreen from '../screens/Health/Doctor/DoctorInsights/DoctorInsightsScreen';
import DoctorProfileEditScreen from '../screens/Health/Doctor/DoctorProfileEdit/DoctorProfileEditScreen';
import PaymentAccountsScreen from '../screens/Shopping/Store/PaymentAccounts/PaymentAccountsScreen';
import VideoPrecheckScreen from '../screens/Health/Patient/VideoPrecheck/VideoPrecheckScreen';
import VideoConsultScreen from '../screens/Health/Patient/VideoConsult/VideoConsultScreen';
import ProfileScreen from '../screens/Account/Profile/ProfileScreen';
import ChangePasswordScreen from '../screens/Account/ChangePassword/ChangePasswordScreen';
import NotificationsScreen from '../screens/Account/Notifications/NotificationsScreen';

export const DOCTOR_PARTNER_TABS: ITabRoute[] = [
  { title: ROUTES.TODAY_TAB, component: DoctorTodayScreen, label: 'Today', icon: 'today-outline', iconActive: 'today' },
  { title: ROUTES.CALENDAR_TAB, component: DoctorCalendarScreen, label: 'Calendar', icon: 'calendar-outline', iconActive: 'calendar' },
  { title: ROUTES.PATIENTS_TAB, component: DoctorPatientsScreen, label: 'Patients', icon: 'people-outline', iconActive: 'people' },
  { title: ROUTES.MORE_TAB, component: DoctorMoreScreen, label: 'More', icon: 'grid-outline', iconActive: 'grid' },
];

/** Pushed over the tabs (the tabs, or Practice setup, are the stack's first screen). */
export const DOCTOR_PARTNER_STACK_ROUTES: IRoute[] = [
  { title: ROUTES.PRACTICE_SETUP, component: PracticeSetupScreen },
  { title: ROUTES.AVAILABILITY, component: AvailabilityScreen },
  { title: ROUTES.TIME_OFF, component: TimeOffScreen },
  { title: ROUTES.DOCTOR_APPOINTMENT, component: DoctorAppointmentScreen },
  { title: ROUTES.PRESCRIPTION_WRITER, component: PrescriptionWriterScreen },
  { title: ROUTES.PATIENT_HISTORY, component: PatientHistoryScreen },
  { title: ROUTES.MY_REVIEWS, component: MyReviewsScreen },
  { title: ROUTES.DOCTOR_INSIGHTS, component: DoctorInsightsScreen },
  { title: ROUTES.DOCTOR_PROFILE_EDIT, component: DoctorProfileEditScreen },
  { title: ROUTES.PAYMENT_ACCOUNTS, component: PaymentAccountsScreen },
  { title: ROUTES.VIDEO_PRECHECK, component: VideoPrecheckScreen },
  { title: ROUTES.VIDEO_CONSULT, component: VideoConsultScreen, options: { gestureEnabled: false } },
  { title: ROUTES.PROFILE, component: ProfileScreen },
  { title: ROUTES.CHANGE_PASSWORD, component: ChangePasswordScreen },
  { title: ROUTES.NOTIFICATIONS, component: NotificationsScreen },
];
