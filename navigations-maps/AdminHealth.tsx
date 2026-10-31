// MetroMatrix — Admin console: the Health tab's stack.

import type { IRoute } from './types';
import { ROUTES } from './Base';

import HealthOverview from '../screens/health-overview-screen/HealthOverview';
import Specialties from '../screens/specialties-screen/Specialties';
import Conditions from '../screens/conditions-screen/Conditions';
import DoctorVerification from '../screens/doctor-verification-screen/DoctorVerification';
import ReviewModeration from '../screens/review-moderation-screen/ReviewModeration';
import AppointmentLookup from '../screens/appointment-lookup-screen/AppointmentLookup';

export const ADMIN_HEALTH_ROUTES: IRoute[] = [
  { title: ROUTES.HEALTH_OVERVIEW, component: HealthOverview },
  { title: ROUTES.DOCTOR_VERIFICATION, component: DoctorVerification },
  { title: ROUTES.REVIEW_MODERATION, component: ReviewModeration },
  { title: ROUTES.SPECIALTIES, component: Specialties },
  { title: ROUTES.CONDITIONS, component: Conditions },
  { title: ROUTES.APPOINTMENT_LOOKUP, component: AppointmentLookup },
];
