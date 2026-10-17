// MetroMatrix — Family members the patient books for (at most 8).
// MetroMatrix-API docs/API_HEALTH.md §4.2.

import { api } from '../network/apiHelpers';
import { familyMemberSerializer, familySerializer } from '../../serializers/health/recordsSerializer';
import type { FamilyMemberInput } from '../../types/health';
import { ack, request } from '../shopping/http';

const enc = encodeURIComponent;

const body = (m: FamilyMemberInput) => ({
  fullName: m.name,
  relation: m.relation,
  gender: m.gender,
  dateOfBirth: m.dateOfBirth || undefined,
  phone: m.phone || undefined,
});

export const listFamily = () => request(() => api.get('/health/family-members'), familySerializer);

export const addFamilyMember = (input: FamilyMemberInput) =>
  request(() => api.post('/health/family-members', body(input)), familyMemberSerializer);

export const updateFamilyMember = (id: string, input: FamilyMemberInput) =>
  request(() => api.patch(`/health/family-members/${enc(id)}`, body(input)), familyMemberSerializer);

export const removeFamilyMember = (id: string) => request(() => api.delete(`/health/family-members/${enc(id)}`), ack);
