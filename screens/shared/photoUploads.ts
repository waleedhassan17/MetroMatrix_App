// ═══════════════════════════════════════════════════════
// MetroMatrix — Photos a form attaches (reviews, returns, payment proof)
// ═══════════════════════════════════════════════════════
// The slices that attach photos share this bookkeeping: a photo shows at
// once (its local file) and uploads in the background; the form sends only
// the stored URLs, and waits while any is still uploading.

import type { LocalFile } from '../../models';
import { uploadImage } from '../../services/mediaUpload';
import type { UploadPurpose } from '../../models/mediaModel';
import type { StripPhoto } from '../../Custom-Components/PhotoStrip';

export interface FormPhoto extends StripPhoto {
  /** The stored URL once uploaded. */
  url: string | null;
  failed: boolean;
}

export const pendingPhoto = (key: string, file: LocalFile): FormPhoto => ({ key, uri: file.uri, url: null, progress: 0, failed: false });

export const photoProgress = (photos: FormPhoto[], key: string, progress: number) => {
  const p = photos.find(x => x.key === key);
  if (p && p.url === null) p.progress = progress;
};

export const photoUploaded = (photos: FormPhoto[], key: string, url: string) => {
  const p = photos.find(x => x.key === key);
  if (p) {
    p.url = url;
    p.progress = null;
  }
};

/** A failed upload is dropped (the strip shows the add tile again). */
export const photoFailed = (photos: FormPhoto[], key: string) => photos.filter(x => x.key !== key);

export const storedUrls = (photos: FormPhoto[]) => photos.map(p => p.url).filter((u): u is string => !!u);
export const uploading = (photos: FormPhoto[]) => photos.some(p => p.url === null);

/** A unique key for a photo in a form. */
export const photoKey = () => `ph_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const upload = (file: LocalFile, purpose: UploadPurpose, onProgress: (f: number) => void) => uploadImage(file, purpose, onProgress);
