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
// { purpose } signs one upload into metromatrix/{env}/{userId}/{purpose};
// everything but the file and api_key is signed (folder, timestamp,
// allowed_formats, and `type` for private PHI uploads), so all of them are
// sent exactly as given.

import { Platform } from 'react-native';
import { api, unwrap, toAuthError, AuthError } from '../network/apiHelpers';
import { ERROR_CODES } from '../network/errorCodes';
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
  | 'consult_attachment'
  // Food (docs/API_FOOD.md §1: food_branding for a brand's logo and cover, menu_item for dish photos)
  | 'food_logo'
  | 'food_cover'
  | 'menu_item'
  // Kitchen Intelligence (TODO(API_KITCHEN): the API has no purpose of its own
  // for a surplus box or hygiene photo; both go where its stories do)
  | 'voice_clip'
  | 'kitchen_receipt'
  | 'food_packing'
  | 'food_surplus'
  | 'food_story'
  | 'hygiene_evidence';

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
  food_logo: 'food_branding',
  food_cover: 'food_branding',
  menu_item: 'menu_item',
  voice_clip: 'voice_audio',
  kitchen_receipt: 'receipt',
  food_packing: 'packing_proof',
  food_surplus: 'kitchen_story',
  food_story: 'kitchen_story',
  hygiene_evidence: 'kitchen_story',
};

export const signUpload = async (purpose: UploadPurpose): Promise<SignedUpload> => {
  try {
    const response = await api.post('/media/sign-upload', { purpose: API_PURPOSE[purpose] });
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

/** Resolves with the stored file; onProgress receives 0..1. */
export const uploadToCloudinary = async (
  file: LocalFile,
  signed: SignedUpload,
  onProgress?: (fraction: number) => void,
): Promise<UploadedFile> => {
  const problem = uploadProblem(file, signed);
  if (problem) throw new AuthError(problem, ERROR_CODES.VALIDATION_FAILED);
  const form = new FormData();
  await appendFile(form, file);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', String(signed.timestamp));
  form.append('signature', signed.signature);
  // Signed by the API: each must be sent exactly as given, or Cloudinary refuses.
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
