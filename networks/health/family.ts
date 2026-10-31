// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Family Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_HEALTH.md §4.2.

import { API, toApiError } from '../network/network';
import type { FamilyMemberInput } from '../../models/health';

const enc = encodeURIComponent;

const body = (m: FamilyMemberInput) => ({
  fullName: m.name,
  relation: m.relation,
  gender: m.gender,
  dateOfBirth: m.dateOfBirth || undefined,
  phone: m.phone || undefined,
});

export const fetchFamily = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/family-members' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const addFamilyMember = async (input: FamilyMemberInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/health/family-members', data: body(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateFamilyMember = async (id: string, input: FamilyMemberInput): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/health/family-members/${enc(id)}`, data: body(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const removeFamilyMember = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/health/family-members/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
