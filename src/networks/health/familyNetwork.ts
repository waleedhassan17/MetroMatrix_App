// MetroMatrix — Family members the patient books for.
// TODO(API_HEALTH): paths and shapes from docs/API_HEALTH_ASSUMED.md.

import { api } from '../network/apiHelpers';
import { familyMemberSerializer, familySerializer } from '../../serializers/health/recordsSerializer';
import type { FamilyMemberInput } from '../../types/health';
import { ack, request } from '../shopping/http';

export const listFamily = () => request(() => api.get('/healthcare/family'), familySerializer);

export const addFamilyMember = (input: FamilyMemberInput) =>
  request(() => api.post('/healthcare/family', input), familyMemberSerializer);

export const updateFamilyMember = (id: string, input: FamilyMemberInput) =>
  request(() => api.patch(`/healthcare/family/${encodeURIComponent(id)}`, input), familyMemberSerializer);

export const removeFamilyMember = (id: string) => request(() => api.delete(`/healthcare/family/${encodeURIComponent(id)}`), ack);
