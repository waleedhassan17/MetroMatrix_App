// ═══════════════════════════════════════════════════════
// MetroMatrix — Media Network (signed direct-to-Cloudinary uploads)
// ═══════════════════════════════════════════════════════
// 1. signUpload(purpose) — the API signs the upload parameters; the
//    Cloudinary secret never reaches the device.
// 2. uploadToCloudinary(file, signed, onProgress) — the file goes straight
//    to Cloudinary, so large documents never pass through Heroku.
//
// XMLHttpRequest, not axios or fetch: it is the only API that reports upload
// progress on native AND web. Native posts a { uri, name, type } part; web
// posts the real Blob (RN's object trick serializes to "[object Object]").
// Per MetroMatrix_Backend media.controller.ts: POST /media/sign-upload
// { purpose } → signed params; everything but the file and api_key is signed
// (folder, timestamp, allowed_formats, and `type` for private uploads), so
// all of them are sent exactly as given.

import { Platform } from 'react-native';
import { USE_MOCK_API } from '../../config/env';
import { api, unwrap, toAuthError, AuthError } from '../network/apiHelpers';
import { ERROR_CODES } from '../network/errorCodes';
import { isObject, num, str } from '../../serializers/serializerUtils';
import type { LocalFile, SignedUpload, UploadedFile } from '../../types/auth';

export type UploadPurpose =
  | 'avatar'
  | 'business_document'
  // Shopping (TODO(API_SHOPPING): the API's UPLOAD_PURPOSES must list these)
  | 'product_image'
  | 'store_logo'
  | 'store_cover'
  | 'review_photo'
  | 'return_photo'
  | 'payment_proof'
  | 'banner_image'
  // Healthcare (TODO(API_HEALTH): the API's UPLOAD_PURPOSES must list these)
  | 'health_record'
  | 'doctor_photo'
  | 'consult_attachment';

export const signUpload = async (purpose: UploadPurpose): Promise<SignedUpload> => {
  try {
    const response = await api.post('/media/sign-upload', { purpose });
    const raw = unwrap(response);
    if (!isObject(raw) || !raw.signature || !raw.cloudName) {
      throw new AuthError('Upload could not be prepared. Please try again.', ERROR_CODES.BAD_RESPONSE);
    }
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
  } catch (e) {
    throw toAuthError(e);
  }
};

const extensionOf = (file: LocalFile): string => {
  const fromName = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (fromName && fromName !== file.name.toLowerCase()) return fromName === 'jpeg' ? 'jpg' : fromName;
  const fromMime = file.mimeType.split('/')[1]?.toLowerCase() ?? '';
  return fromMime === 'jpeg' ? 'jpg' : fromMime;
};

/**
 * What Cloudinary would refuse anyway, said before the upload starts: a file
 * over the purpose's size limit, or a format it doesn't allow. Null when fine.
 */
export const uploadProblem = (file: LocalFile & { size?: number }, signed: SignedUpload): string | null => {
  if (signed.maxBytes && typeof file.size === 'number' && file.size > signed.maxBytes) {
    return `That file is too large. The limit is ${Math.floor(signed.maxBytes / 1_000_000)} MB.`;
  }
  if (signed.allowedFormats) {
    const allowed = signed.allowedFormats.split(',').map(f => (f.trim() === 'jpeg' ? 'jpg' : f.trim()));
    const ext = extensionOf(file);
    if (ext && !allowed.includes(ext)) {
      return `That file type isn't accepted. Use ${signed.allowedFormats.split(',').join(', ').toUpperCase()}.`;
    }
  }
  return null;
};

const appendFile = async (form: FormData, file: LocalFile) => {
  if (Platform.OS === 'web') {
    const blob = file.file ?? (await (await fetch(file.uri)).blob());
    (form as unknown as { append: (k: string, v: Blob, n: string) => void }).append('file', blob, file.name);
    return;
  }
  form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
};

/** Dummy API: a believable upload — progress over ~1.2 s, then the local file. */
const mockUpload = (file: LocalFile, onProgress?: (fraction: number) => void): Promise<UploadedFile> =>
  new Promise(resolve => {
    let step = 0;
    const tick = setInterval(() => {
      step += 1;
      onProgress?.(Math.min(1, step / 6));
      if (step >= 6) {
        clearInterval(tick);
        resolve({ url: file.uri, publicId: `mock/${file.name}`, mimeType: file.mimeType });
      }
    }, 200);
  });

/** Resolves with the stored file; onProgress receives 0..1. */
export const uploadToCloudinary = async (
  file: LocalFile,
  signed: SignedUpload,
  onProgress?: (fraction: number) => void,
): Promise<UploadedFile> => {
  const problem = uploadProblem(file, signed);
  if (problem) throw new AuthError(problem, ERROR_CODES.VALIDATION_FAILED);
  if (USE_MOCK_API) return mockUpload(file, onProgress);
  const form = new FormData();
  await appendFile(form, file);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', String(signed.timestamp));
  form.append('signature', signed.signature);
  // Signed by the API: each must be sent exactly as given, or Cloudinary refuses.
  if (signed.folder) form.append('folder', signed.folder);
  if (signed.allowedFormats) form.append('allowed_formats', signed.allowedFormats);
  if (signed.type) form.append('type', signed.type);

  return new Promise<UploadedFile>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', signed.uploadUrl);
    xhr.timeout = 120000;
    xhr.upload.onprogress = event => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      let body: any = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.secure_url) {
        onProgress?.(1);
        resolve({
          url: str(body.secure_url),
          publicId: str(body.public_id),
          mimeType: file.mimeType,
        });
      } else {
        reject(
          new AuthError(
            body?.error?.message ?? `Upload failed (${xhr.status}). Please try again.`,
            'UPLOAD_FAILED',
            xhr.status,
          ),
        );
      }
    };
    xhr.onerror = () =>
      reject(new AuthError("Upload failed — you're offline or the connection dropped.", 'NETWORK_ERROR'));
    xhr.ontimeout = () => reject(new AuthError('Upload timed out. Please try again.', 'NETWORK_ERROR'));
    xhr.send(form);
  });
};

/** Sign, then upload: one call for a photo a form attaches (review, return, payment proof, product). */
export const uploadImage = async (file: LocalFile, purpose: UploadPurpose, onProgress?: (fraction: number) => void): Promise<UploadedFile> =>
  uploadToCloudinary(file, await signUpload(purpose), onProgress);
