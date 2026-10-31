// ═══════════════════════════════════════════════════════
// MetroMatrix — The prescription as a PDF (expo-print + expo-sharing)
// ═══════════════════════════════════════════════════════
// The same layout as the screen (utils/prescriptionHtml), printed to a PDF
// file and handed to the share sheet (WhatsApp, email, Files). On web the
// browser's print dialog does both: print, or "Save as PDF".

import { Platform } from 'react-native';

export type PdfResult = 'shared' | 'printed' | 'unavailable';

export const sharePrescriptionPdf = async (html: string, fileTitle: string): Promise<PdfResult> => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const Print = require('expo-print') as typeof import('expo-print');
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return 'printed';
  }
  const Sharing = require('expo-sharing') as typeof import('expo-sharing');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: fileTitle });
  return 'shared';
};
