// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Family Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_HEALTH.md §4.2.

import { api, toApiError } from '../network/apiHelpers';
import type { FamilyMemberInput } from '../../models/health';

const enc = encodeURIComponent;

const body = (m: FamilyMemberInput) => ({
  fullName: m.name,
  relation: m.relation,
  gender: m.gender,
  dateOfBirth: m.dateOfBirth || undefined,
  phone: m.phone || undefined,
});

export const getFamilyAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/health/family-members');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const addFamilyMemberAPI = async (input: FamilyMemberInput): Promise<unknown> => {
  try {
    const response = await api.post('/health/family-members', body(input));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateFamilyMemberAPI = async (id: string, input: FamilyMemberInput): Promise<unknown> => {
  try {
    const response = await api.patch(`/health/family-members/${enc(id)}`, body(input));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const removeFamilyMemberAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/health/family-members/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
