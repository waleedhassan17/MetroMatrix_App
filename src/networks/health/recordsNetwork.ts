// MetroMatrix — Health records (uploads go through mediaNetwork, purpose health_record).
// TODO(API_HEALTH): paths and shapes from docs/API_HEALTH_ASSUMED.md.

import { api } from '../network/apiHelpers';
import { healthRecordSerializer } from '../../serializers/health/recordsSerializer';
import { paged } from '../../serializers/shopping/common';
import type { RecordInput, RecordType } from '../../types/health';
import { ack, clean, pageParams, request } from '../shopping/http';

/** `memberId`: a family member's id, 'self' for the patient, or null for everyone. */
export const listRecords = (filter: { memberId: string | null; type: RecordType | null }, page: number, pageSize = 30) =>
  request(
    () => api.get('/healthcare/records', { params: clean({ ...filter, ...pageParams(page, pageSize) }) }),
    raw => paged(raw, healthRecordSerializer),
  );

export const getRecord = (id: string) => request(() => api.get(`/healthcare/records/${encodeURIComponent(id)}`), healthRecordSerializer);

export const createRecord = (input: RecordInput) => request(() => api.post('/healthcare/records', input), healthRecordSerializer);

export const deleteRecord = (id: string) => request(() => api.delete(`/healthcare/records/${encodeURIComponent(id)}`), ack);
