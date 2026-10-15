// MetroMatrix — The doctor's own profile, its completeness and publishing.
// TODO(API_HEALTH): paths and shapes from docs/API_HEALTH_ASSUMED.md.

import { api } from '../../network/apiHelpers';
import { completenessSerializer, ownProfileSerializer } from '../../../serializers/health/doctorSerializer';
import { businessSerializer } from '../../../serializers/businessSerializer';
import type { DoctorOwnProfile } from '../../../types/health';
import { request } from '../../shopping/http';

export const getOwnProfile = () => request(() => api.get('/healthcare/doctor/profile'), ownProfileSerializer);

export const updateOwnProfile = (patch: Partial<DoctorOwnProfile>) =>
  request(() => api.patch('/healthcare/doctor/profile', patch), ownProfileSerializer);

export const getCompleteness = () => request(() => api.get('/healthcare/doctor/profile/completeness'), completenessSerializer);

/** Lists the doctor for patients (`422 PROFILE_INCOMPLETE` until the checklist is done). Answers with the business. */
export const publishProfile = () => request(() => api.post('/healthcare/doctor/profile/publish', {}), businessSerializer);
