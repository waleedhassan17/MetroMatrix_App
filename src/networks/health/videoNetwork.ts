// MetroMatrix — Join a video consultation (Jitsi / JaaS room from the API).
// TODO(API_HEALTH): paths and shapes from docs/API_HEALTH_ASSUMED.md.

import { api } from '../network/apiHelpers';
import { videoJoinSerializer } from '../../serializers/health/recordsSerializer';
import { request } from '../shopping/http';

/** The patient's join (by code) — `403 VIDEO_NOT_OPEN { opensAt }` before the window. */
export const joinVideo = (code: string) =>
  request(() => api.post(`/healthcare/appointments/${encodeURIComponent(code)}/video/join`, {}), videoJoinSerializer);

/** The doctor's join (by appointment id). */
export const joinVideoAsDoctor = (appointmentId: string) =>
  request(() => api.post(`/healthcare/doctor/appointments/${encodeURIComponent(appointmentId)}/video/join`, {}), videoJoinSerializer);
