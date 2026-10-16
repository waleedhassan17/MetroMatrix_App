// MetroMatrix — Admin console: the Health tab's stack.

import type { IRoute } from './types';
import { ROUTES } from './Base';

import HealthOverviewScreen from '../screens/Admin/Health/HealthOverview/HealthOverviewScreen';
import SpecialtiesScreen from '../screens/Admin/Health/Specialties/SpecialtiesScreen';
import ConditionsScreen from '../screens/Admin/Health/Conditions/ConditionsScreen';
import DoctorVerificationScreen from '../screens/Admin/Health/DoctorVerification/DoctorVerificationScreen';
import ReviewModerationScreen from '../screens/Admin/Health/ReviewModeration/ReviewModerationScreen';
import AppointmentLookupScreen from '../screens/Admin/Health/AppointmentLookup/AppointmentLookupScreen';

export const ADMIN_HEALTH_ROUTES: IRoute[] = [
  { title: ROUTES.HEALTH_OVERVIEW, component: HealthOverviewScreen },
  { title: ROUTES.DOCTOR_VERIFICATION, component: DoctorVerificationScreen },
  { title: ROUTES.REVIEW_MODERATION, component: ReviewModerationScreen },
  { title: ROUTES.SPECIALTIES, component: SpecialtiesScreen },
  { title: ROUTES.CONDITIONS, component: ConditionsScreen },
  { title: ROUTES.APPOINTMENT_LOOKUP, component: AppointmentLookupScreen },
];
