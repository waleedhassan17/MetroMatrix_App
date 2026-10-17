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
// MetroMatrix-API: POST /media/sign-upload { purpose } signs one upload into
// metromatrix/{env}/{userId}/{purpose}; the signed allowed_formats (and
// type, for private PHI uploads) go back to Cloudinary unchanged.

import { Platform } from 'react-native';
import { USE_MOCK_API } from '../../config/env';
import { api, unwrap, toAuthError, AuthError } from '../network/apiHelpers';
import { isObject, num, str } from '../../serializers/serializerUtils';
import type { LocalFile, SignedUpload, UploadedFile } from '../../types/auth';

export type UploadPurpose =
  | 'avatar'
  | 'business_document'
  // Shopping
  | 'product_image'
  | 'store_logo'
  | 'store_cover'
  | 'review_photo'
  | 'return_photo'
  | 'payment_proof'
  | 'banner_image'
  // Healthcare
  | 'health_record'
  | 'doctor_photo'
  | 'consult_attachment';

/** The app's purposes → the API's (one store branding folder; doctors' note files are `medical_note`). */
const API_PURPOSE: Record<UploadPurpose, string> = {
  avatar: 'avatar',
  business_document: 'business_document',
  product_image: 'product_image',
  store_logo: 'store_branding',
  store_cover: 'store_branding',
  review_photo: 'review_photo',
  return_photo: 'return_photo',
  payment_proof: 'payment_proof',
  banner_image: 'banner',
  health_record: 'health_record',
  doctor_photo: 'doctor_photo',
  consult_attachment: 'medical_note',
};

export const signUpload = async (purpose: UploadPurpose): Promise<SignedUpload> => {
  try {
    const response = await api.post('/media/sign-upload', { purpose: API_PURPOSE[purpose] });
    const raw = unwrap(response);
    if (!isObject(raw) || !raw.signature || !raw.cloudName) {
      throw new AuthError('Upload could not be prepared. Please try again.', 'BAD_RESPONSE');
    }
    const cloudName = str(raw.cloudName);
    return {
      cloudName,
      apiKey: str(raw.apiKey),
      timestamp: num(raw.timestamp),
      signature: str(raw.signature),
      folder: str(raw.folder),
      uploadUrl: str(raw.uploadUrl) || `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      allowedFormats: str(raw.allowedFormats) || null,
      type: raw.type === 'authenticated' ? 'authenticated' : null,
    };
  } catch (e) {
    throw toAuthError(e);
  }
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
  if (USE_MOCK_API) return mockUpload(file, onProgress);
  const form = new FormData();
  await appendFile(form, file);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', String(signed.timestamp));
  form.append('signature', signed.signature);
  if (signed.folder) form.append('folder', signed.folder);
  // Signed with the rest: Cloudinary refuses the upload if these are missing.
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
