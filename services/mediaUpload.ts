// ═══════════════════════════════════════════════════════
// MetroMatrix — Media upload (sign, then straight to Cloudinary)
// ═══════════════════════════════════════════════════════
// The two steps every photo, document and voice clip takes: the API signs the
// upload (media network), then the file goes to Cloudinary with exactly those
// parameters (apiHelpers' upload section). The slices that attach files call
// these instead of repeating both steps.

import {
  ApiError,
  ERROR_CODES,
  required,
  toApiError,
  UPLOAD_UNAVAILABLE_COPY,
  uploadToCloudinary,
} from '../networks/network/network';
import { signUpload as signUploadRequest } from '../networks/media/media';
import { signedUploadSerializer } from '../serializers/mediaSerializer';
import { API_PURPOSE, type UploadPurpose } from '../models/mediaModel';
import type { LocalFile, SignedUpload, UploadedFile } from '../models/auth';

/** Signing failures that mean "uploads aren't working right now" (e.g. storage not configured). */
const SIGNING_DOWN = new Set<string | undefined>([ERROR_CODES.SERVICE_UNAVAILABLE, ERROR_CODES.INTERNAL_ERROR]);

/**
 * The API's signature for one upload of this kind. A server that can't sign
 * (503 "File uploads are not configured", a 500) reads as uploads being
 * unavailable, in words the person can act on, never the server's own text.
 */
export const signUpload = async (purpose: UploadPurpose): Promise<SignedUpload> => {
  let raw: unknown;
  try {
    raw = await signUploadRequest(API_PURPOSE[purpose]);
  } catch (e) {
    const error = toApiError(e);
    if (SIGNING_DOWN.has(error.code)) {
      throw new ApiError(UPLOAD_UNAVAILABLE_COPY, ERROR_CODES.UPLOAD_FAILED, error.status, { kind: 'service' });
    }
    throw error;
  }
  return required(signedUploadSerializer(raw));
};

/** Sign, then upload: one call for a photo a form attaches (review, return, payment proof, product). */
export const uploadImage = async (
  file: LocalFile,
  purpose: UploadPurpose,
  onProgress?: (fraction: number) => void,
): Promise<UploadedFile> => uploadToCloudinary(file, await signUpload(purpose), onProgress);
