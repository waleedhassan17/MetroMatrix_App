// ═══════════════════════════════════════════════════════
// MetroMatrix — Health reads several patient slices share
// ═══════════════════════════════════════════════════════
// FinMatrix's flow, Network → Serializer: thin network calls, serialized
// here. A record is read with the family list (it names its person); a
// write answers less than the screen redraws, so the appointment is read
// again after it.

import { required } from '../../../../networks/network/apiHelpers';
import { attachRecordsAPI, getAppointmentAPI, submitAppointmentPaymentProofAPI } from '../../../../networks/health/appointmentsNetwork';
import { reviewAppointmentAPI } from '../../../../networks/health/reviewsNetwork';
import { getDoctorAPI, getSimilarDoctorsAPI } from '../../../../networks/health/discoveryNetwork';
import { createRecordAPI, getRecordAPI, getRecordsAPI } from '../../../../networks/health/recordsNetwork';
import { getFamilyAPI } from '../../../../networks/health/familyNetwork';
import { appointmentDetailSerializer } from '../../../../serializers/health/appointmentSerializer';
import { doctorWithSimilarSerializer } from '../../../../serializers/health/discoverySerializer';
import { namedRecordSerializer, recordPageSerializer } from '../../../../serializers/health/recordsSerializer';
import type { DoctorReviewInput, RecordInput, RecordType } from '../../../../types/health';

/** The appointment as it now is. */
export const readAppointment = async (code: string) => required(appointmentDetailSerializer(await getAppointmentAPI(code)));

/** A doctor's profile with doctors like them. */
export const getDoctor = async (id: string) => {
  const [profile, similar] = await Promise.all([getDoctorAPI(id), getSimilarDoctorsAPI(id)]);
  return required(doctorWithSimilarSerializer({ profile, similar }));
};

export type RecordFilter = { memberId: string | null; type: RecordType | null };

/** A page of records and the family list, unserialized (usePagedList's fetch). */
export const fetchRecordsPage = async (filter: RecordFilter, page: number, pageSize = 30) => {
  const [records, family] = await Promise.all([getRecordsAPI(filter, page, pageSize), getFamilyAPI()]);
  return { records, family };
};

/** usePagedList's serializer for fetchRecordsPage. */
export const recordsPageSerializer = (payload: unknown) => recordPageSerializer(payload as { records: unknown; family: unknown });

export const listRecords = async (filter: RecordFilter, page: number, pageSize = 30) =>
  recordPageSerializer(await fetchRecordsPage(filter, page, pageSize));

export const getRecord = async (id: string) => {
  const [record, family] = await Promise.all([getRecordAPI(id), getFamilyAPI()]);
  return required(namedRecordSerializer({ record, family }));
};

export const createRecord = async (input: RecordInput) => {
  const [record, family] = await Promise.all([createRecordAPI(input), getFamilyAPI()]);
  return required(namedRecordSerializer({ record, family }));
};

export const reviewAppointment = async (code: string, input: DoctorReviewInput) => {
  await reviewAppointmentAPI(code, input);
  return readAppointment(code);
};

/** The transaction ID (and a screenshot uploaded for `payment_proof`). */
export const submitAppointmentPaymentProof = async (code: string, body: { transactionId: string; imageUrl: string | null }) => {
  await submitAppointmentPaymentProofAPI(code, body);
  return readAppointment(code);
};

/** Share records with the visit (while it's upcoming). */
export const attachRecords = async (code: string, recordIds: string[]) => {
  await attachRecordsAPI(code, recordIds);
  return readAppointment(code);
};
