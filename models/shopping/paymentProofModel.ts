// MetroMatrix — "I've paid": the transfer's transaction ID (and an optional screenshot).

import type { ValidationErrors } from '../authModel';

export const normaliseTransactionId = (raw: string) => raw.trim().toUpperCase().replace(/\s+/g, '');

export const validatePaymentProof = (transactionId: string): ValidationErrors => {
  const id = normaliseTransactionId(transactionId);
  if (!id) return { transactionId: 'Enter the transaction ID from your bank or wallet' };
  if (!/^[A-Z0-9-]{6,40}$/.test(id)) return { transactionId: 'Use 6 to 40 letters or digits' };
  return {};
};
