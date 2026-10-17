// MetroMatrix — Health records (uploads go through mediaNetwork, purpose health_record).
// MetroMatrix-API docs/API_HEALTH.md §2 (HealthRecord), §4.2. Each record is named
// with its person from the family list, fetched alongside.

import { api } from '../network/apiHelpers';
import { healthRecordSerializer } from '../../serializers/health/recordsSerializer';
import { publicIdFromCloudinaryUrl, recordTypeOut } from '../../serializers/health/healthCommon';
import { paged } from '../../serializers/shopping/common';
import { arr, isObject, str } from '../../serializers/serializerUtils';
import type { RecordInput, RecordType } from '../../types/health';
import { ack, clean, pageParams, request, requestAll } from '../shopping/http';

const enc = encodeURIComponent;
const family = () => api.get('/health/family-members');

/** A record with its person's name (from the family list). */
const named = (record: unknown, members: unknown) => {
  if (!isObject(record)) return record;
  const member = arr(members).find(m => isObject(m) && str(m.id) === str(record.familyMemberId));
  return isObject(member) ? { ...record, memberName: str(member.fullName) } : record;
};

/** `memberId`: a family member's id, 'self' for the patient, or null for everyone. */
export const listRecords = (filter: { memberId: string | null; type: RecordType | null }, page: number, pageSize = 30) =>
  requestAll(
    {
      records: () =>
        api.get('/health/records', {
          params: clean({ person: filter.memberId, type: filter.type ? recordTypeOut(filter.type) : null, ...pageParams(page, pageSize) }),
        }),
      family,
    },
    ({ records, family: members }) => {
      const r = isObject(records) ? records : {};
      return paged({ ...r, items: arr(r.items).map(x => named(x, members)) }, healthRecordSerializer);
    },
  );

export const getRecord = (id: string) =>
  requestAll({ record: () => api.get(`/health/records/${enc(id)}`), family }, ({ record, family: members }) =>
    healthRecordSerializer(named(record, members)),
  );

/** Files are the `health_record` uploads; the API checks each one's public id against the signed folder. */
const recordBody = (input: RecordInput) => ({
  title: input.title,
  type: recordTypeOut(input.type),
  recordDate: input.recordedOn || undefined,
  familyMemberId: input.memberId ?? undefined,
  files: input.files.map(f => ({ url: f.url, publicId: publicIdFromCloudinaryUrl(f.url), mime: f.mime })),
});

export const createRecord = (input: RecordInput) =>
  requestAll({ record: () => api.post('/health/records', recordBody(input)), family }, ({ record, family: members }) =>
    healthRecordSerializer(named(record, members)),
  );

export const deleteRecord = (id: string) => request(() => api.delete(`/health/records/${enc(id)}`), ack);
