// ═══════════════════════════════════════════════════════
// MetroMatrix — Media upload (sign, then straight to Cloudinary)
// ═══════════════════════════════════════════════════════
// The two steps every photo, document and voice clip takes: the API signs the
// upload (media network), then the file goes to Cloudinary with exactly those
// parameters (apiHelpers' upload section). The slices that attach files call
// these instead of repeating both steps.

import { required, uploadToCloudinary } from '../networks/network/apiHelpers';
import { signUploadAPI } from '../networks/media/mediaNetwork';
import { signedUploadSerializer } from '../serializers/mediaSerializer';
import { API_PURPOSE, type UploadPurpose } from '../models/mediaModel';
import type { LocalFile, SignedUpload, UploadedFile } from '../types/auth';

/** The API's signature for one upload of this kind. */
export const signUpload = async (purpose: UploadPurpose): Promise<SignedUpload> =>
  required(signedUploadSerializer(await signUploadAPI(API_PURPOSE[purpose])));

/** Sign, then upload: one call for a photo a form attaches (review, return, payment proof, product). */
export const uploadImage = async (
  file: LocalFile,
  purpose: UploadPurpose,
  onProgress?: (fraction: number) => void,
): Promise<UploadedFile> => uploadToCloudinary(file, await signUpload(purpose), onProgress);
