// ═══════════════════════════════════════════════════════
// MetroMatrix — Media serializer
// ═══════════════════════════════════════════════════════
// POST /media/sign-upload's answer → the parameters the Cloudinary upload
// sends back unchanged (apiHelpers' upload section).

import type { SignedUpload } from '../types/auth';
import { fromResponse, isObject, num, str } from './serializerUtils';

/** null when the API did not sign anything usable. */
export const signedUploadSerializer = fromResponse((raw: unknown): SignedUpload | null => {
  if (!isObject(raw) || !raw.signature || !raw.cloudName) return null;
  const cloudName = str(raw.cloudName);
  return {
    cloudName,
    apiKey: str(raw.apiKey),
    timestamp: num(raw.timestamp),
    signature: str(raw.signature),
    folder: str(raw.folder),
    uploadUrl: str(raw.uploadUrl) || `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    allowedFormats: str(raw.allowedFormats),
    maxBytes: Math.max(0, num(raw.maxBytes, 0)),
    type: raw.type === 'authenticated' ? 'authenticated' : null,
  };
});
