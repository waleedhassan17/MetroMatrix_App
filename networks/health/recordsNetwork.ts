// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Records Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_HEALTH.md §2 (HealthRecord), §4.2. Each record is named
// with its person from the family list, fetched alongside.

import { api, toApiError, clean, pageParams } from '../network/apiHelpers';
import { publicIdFromCloudinaryUrl, recordTypeOut } from '../../serializers/health/healthCommon';
import type { RecordInput, RecordType } from '../../models/health';

const enc = encodeURIComponent;


/** `memberId`: a family member's id, 'self' for the patient, or null for everyone. */
/** A page of records (the list names each record's person from the family list). */
export const getRecordsAPI = async (filter: { memberId: string | null; type: RecordType | null }, page: number, pageSize = 30): Promise<unknown> => {
  try {
    const response = await api.get('/health/records', {
          params: clean({ person: filter.memberId, type: filter.type ? recordTypeOut(filter.type) : null, ...pageParams(page, pageSize) }),
        });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getRecordAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`/health/records/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Files are the `health_record` uploads; the API checks each one's public id against the signed folder. */
const recordBody = (input: RecordInput) => ({
  title: input.title,
  type: recordTypeOut(input.type),
  recordDate: input.recordedOn || undefined,
  familyMemberId: input.memberId ?? undefined,
  files: input.files.map(f => ({ url: f.url, publicId: publicIdFromCloudinaryUrl(f.url), mime: f.mime })),
});

export const createRecordAPI = async (input: RecordInput): Promise<unknown> => {
  try {
    const response = await api.post('/health/records', recordBody(input));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteRecordAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/health/records/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
