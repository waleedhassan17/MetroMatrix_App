// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court's trust line (the ONE wording)
// ═══════════════════════════════════════════════════════
// Food Court takes no commission and runs no rider fleet: the customer pays
// the kitchen directly, and the kitchen's own riders deliver. Every screen
// that says so says it in these words, once per page (TrustNote).

/** To the customer: who they pay, who delivers, and that MetroMatrix takes no cut. */
export const customerTrustLine = (kitchen?: string | null, opts: { riders?: boolean } = {}) =>
  `You pay ${kitchen?.trim() || 'the kitchen'} directly${opts.riders ? ', and its own riders deliver' : ''}. MetroMatrix takes no commission.`;

/** To the kitchen. */
export const VENDOR_TRUST_LINE = 'Customers pay you directly. MetroMatrix takes no commission.';
