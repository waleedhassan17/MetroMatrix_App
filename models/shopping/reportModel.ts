// ═══════════════════════════════════════════════════════
// MetroMatrix — Product reports: the API's reasons in plain words
// ═══════════════════════════════════════════════════════

/** The API's report reasons and what shoppers and staff read for them. */
export const REPORT_REASON_LABEL: Record<string, string> = {
  counterfeit: 'Counterfeit or copy',
  misleading: 'Misleading photos or description',
  prohibited_item: 'Prohibited item',
  offensive: 'Offensive content',
  wrong_category: 'Wrong category',
  other: 'Something else',
};

/** The API's reason for the words a shopper picked. */
export const reportReasonKey = (label: string): string =>
  Object.keys(REPORT_REASON_LABEL).find(k => REPORT_REASON_LABEL[k] === label) ?? 'other';
