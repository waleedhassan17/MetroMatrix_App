// ═══════════════════════════════════════════════════════
// MetroMatrix — Image sizing (request the size you render)
// ═══════════════════════════════════════════════════════
// Cloudinary URLs get a transformation (f_auto,q_auto + size at the device's
// pixel ratio, capped at 3×); the dummy catalogue's Unsplash URLs get the
// equivalent query; anything else (a local file:// preview) passes through.

import { PixelRatio } from 'react-native';

export interface CdnOptions {
  w: number;
  h?: number;
  /** fill = crop to the box; fit = whole image inside it. */
  fit?: 'fill' | 'fit';
}

const dpr = () => Math.min(3, Math.max(1, Math.round(PixelRatio.get())));

export const cdn = (url: string | null | undefined, { w, h, fit = 'fill' }: CdnOptions): string | null => {
  if (!url) return null;
  const scale = dpr();
  const width = Math.round(w * scale);
  const height = h ? Math.round(h * scale) : null;

  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    const t = ['f_auto', 'q_auto', `w_${width}`, height ? `h_${height}` : null, fit === 'fill' ? 'c_fill,g_auto' : 'c_fit']
      .filter(Boolean)
      .join(',');
    return url.replace('/upload/', `/upload/${t}/`);
  }

  if (url.includes('images.unsplash.com')) {
    const [base] = url.split('?');
    const params = [`w=${width}`, height ? `h=${height}` : null, `fit=${fit === 'fill' ? 'crop' : 'max'}`, 'auto=format', 'q=70']
      .filter(Boolean)
      .join('&');
    return `${base}?${params}`;
  }

  return url;
};
