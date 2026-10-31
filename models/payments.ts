// ═══════════════════════════════════════════════════════
// MetroMatrix — Payment shapes shared by every service
// ═══════════════════════════════════════════════════════
// MetroMatrix never holds money: a customer pays a store or a doctor
// directly, in cash or by transfer to the partner's own account. These are
// the shapes the transfer flow (instructions → "I've paid" → review) and
// the partner's payment accounts use, in Shopping and Healthcare alike.

/** One page of a list: `GET …?page=&pageSize=` → `{ items, total, page, pageSize }`. */
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type PaymentAccountKind = 'raast' | 'jazzcash' | 'easypaisa' | 'bank';

/** Where and how much to send, and by when. */
export interface PaymentInstructions {
  kind: PaymentAccountKind;
  accountTitle: string;
  accountNumber: string;
  bankName: string | null;
  amount: number;
  payBy: string;
}

/** What the customer sent as proof of a transfer. */
export interface PaymentProof {
  transactionId: string;
  imageUrl: string | null;
  submittedAt: string;
  rejectionReason: string | null;
}

/** The transfer states PaymentInstructionsCard draws (both services use these names). */
export type TransferState = 'awaiting_transfer' | 'proof_submitted' | 'proof_rejected' | 'paid';

/** A partner's own account that customers pay into. */
export interface PaymentAccount {
  id: string;
  kind: PaymentAccountKind;
  title: string;
  number: string;
  bankName: string | null;
  isActive: boolean;
}

export type PaymentAccountInput = Omit<PaymentAccount, 'id'>;
