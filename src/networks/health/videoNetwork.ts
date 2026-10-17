// MetroMatrix — Join a video consultation (Jitsi / JaaS room from the API).
// MetroMatrix-API docs/VIDEO.md. Outside the window: 409 VIDEO_NOT_JOINABLE
// (details.reason, opensAt); a prepaid visit not yet paid: 402 PAYMENT_REQUIRED.

import { api } from '../network/apiHelpers';
import { videoJoinSerializer } from '../../serializers/health/recordsSerializer';
import { request } from '../shopping/http';

/** The patient's join, by appointment code. */
export const joinVideo = (code: string) =>
  request(() => api.post(`/health/appointments/${encodeURIComponent(code)}/video/join`, {}), videoJoinSerializer);

/** The doctor's join (the doctor side's appointment id is its code); it starts the consultation. */
export const joinVideoAsDoctor = (appointmentId: string) =>
  request(() => api.post(`/health/doctor/appointments/${encodeURIComponent(appointmentId)}/video/join`, {}), videoJoinSerializer);
