// MetroMatrix — the kitchen's QR code: what native and web share (the SVG
// and the printable card). Platform files: storefrontQr.ts / storefrontQr.web.ts.

import QRCode from 'qrcode';
import { storeCardHtml } from '../../utils/store-card-html/storeCardHtml';
import type { PrintColours } from '../../utils/prescription-html/prescriptionHtml';

export type QrResult = 'shared' | 'downloaded' | 'printed' | 'unavailable';

/** The QR as an SVG document (pure JS: works on every platform). */
export const qrSvg = (url: string) => QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });

export const cardHtmlFor = async (card: { name: string; qrUrl: string; shortUrl: string }, colours: PrintColours) =>
  storeCardHtml({ name: card.name, shortUrl: card.shortUrl, qrSvg: await qrSvg(card.qrUrl) }, colours);

export const fileNameFor = (slug: string) => `${slug || 'kitchen'}-qr.png`;
