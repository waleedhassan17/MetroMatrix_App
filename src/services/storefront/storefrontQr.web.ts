// MetroMatrix — the kitchen's QR code in a browser: the image is drawn again
// at print size (qrcode → PNG) and downloaded; the card opens the print
// dialog (print it, or "Save as PDF").

import QRCode from 'qrcode';
import type { PrintColours } from '../../utils/prescriptionHtml';
import { cardHtmlFor, fileNameFor, type QrResult } from './storefrontQrShared';

export type { QrResult } from './storefrontQrShared';

export const shareQrImage = async (q: { url: string; slug: string; name: string; pngBase64: string | null }): Promise<QrResult> => {
  const data = await QRCode.toDataURL(q.url, { width: 1024, margin: 2, errorCorrectionLevel: 'M' });
  const a = document.createElement('a');
  a.href = data;
  a.download = fileNameFor(q.slug);
  document.body.appendChild(a);
  a.click();
  a.remove();
  return 'downloaded';
};

/**
 * expo-print on web prints the whole page, so the card goes into a hidden
 * frame of its own and that frame is printed (the browser's dialog).
 */
export const printStoreCard = async (card: { name: string; qrUrl: string; shortUrl: string }, colours: PrintColours): Promise<QrResult> => {
  const html = await cardHtmlFor(card, colours);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.title = 'QR card';
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  frame.dataset.mmStoreCard = card.shortUrl;
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) {
    frame.remove();
    return 'unavailable';
  }
  doc.open();
  doc.write(html);
  doc.close();
  await new Promise(r => setTimeout(r, 250));
  frame.contentWindow.focus();
  frame.contentWindow.print();
  // Kept a minute so the dialog can finish; the next print replaces it.
  setTimeout(() => frame.remove(), 60_000);
  return 'printed';
};
