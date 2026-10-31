// ═══════════════════════════════════════════════════════
// MetroMatrix — The kitchen's printable QR card (expo-print)
// ═══════════════════════════════════════════════════════
// A card for the counter or a delivery bag: the kitchen's name, its QR code
// (an SVG, sharp at any size), "Scan to order", the short link, and the
// zero-commission line. Colours come from the theme (passed in); every value
// from the API is escaped.

import type { PrintColours } from './prescriptionHtml';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface StoreCard {
  name: string;
  /** "metromatrix.app/s/biryani-bazaar". */
  shortUrl: string;
  /** The QR code as an SVG document (from `qrcode`). */
  qrSvg: string;
}

export const storeCardHtml = (card: StoreCard, c: PrintColours): string => `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(card.name)} · Food Court</title>
<style>
  @page { margin: 16mm; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${c.ink}; margin: 0; }
  .card { max-width: 420px; margin: 0 auto; border: 1px solid ${c.line}; border-radius: 16px; padding: 28px 28px 24px; text-align: center; }
  .name { font-size: 26px; font-weight: 800; margin: 0 0 4px; }
  .scan { font-size: 15px; color: ${c.muted}; margin: 0 0 18px; }
  .qr svg { width: 260px; height: 260px; }
  .url { font-size: 15px; font-weight: 700; color: ${c.accent}; margin: 14px 0 6px; word-break: break-all; }
  .foot { font-size: 13px; color: ${c.muted}; margin: 0; }
</style></head>
<body><div class="card">
  <p class="name">${esc(card.name)}</p>
  <p class="scan">Scan to order</p>
  <div class="qr">${card.qrSvg.replace(/<\?xml[^>]*>/, '')}</div>
  <p class="url">${esc(card.shortUrl)}</p>
  <p class="foot">Order on Food Court — no commission. You pay the kitchen directly.</p>
</div></body></html>`;
