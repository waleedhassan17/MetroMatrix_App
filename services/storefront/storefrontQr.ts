// MetroMatrix — the kitchen's QR code on a phone: the image (from the QR on
// screen, react-native-qrcode-svg's PNG) is written to the cache with
// expo-file-system and handed to the share sheet (WhatsApp, Files, print
// shops); the card prints through expo-print.

import type { PrintColours } from '../../utils/prescriptionHtml';
import { cardHtmlFor, fileNameFor, type QrResult } from './storefrontQrShared';

export type { QrResult } from './storefrontQrShared';

/** `pngBase64`: the on-screen QR's PNG (null on web, where it's drawn again). */
export const shareQrImage = async (q: { url: string; slug: string; name: string; pngBase64: string | null }): Promise<QrResult> => {
  if (!q.pngBase64) return 'unavailable';
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  const Sharing = require('expo-sharing') as typeof import('expo-sharing');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const file = new File(Paths.cache, fileNameFor(q.slug));
  if (file.exists) file.delete();
  file.create();
  file.write(q.pngBase64, { encoding: 'base64' });
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: `${q.name} QR code` });
  return 'shared';
};

export const printStoreCard = async (card: { name: string; qrUrl: string; shortUrl: string }, colours: PrintColours): Promise<QrResult> => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Print = require('expo-print') as typeof import('expo-print');
  await Print.printAsync({ html: await cardHtmlFor(card, colours) });
  return 'printed';
};
