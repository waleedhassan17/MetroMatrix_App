// ═══════════════════════════════════════════════════════
// MetroMatrix — Media Network (AUTH_CONTRACT.md)
// ═══════════════════════════════════════════════════════
// Per MetroMatrix_Backend media.controller.ts: POST /media/sign-upload
// { purpose } signs one upload into metromatrix/{env}/{userId}/{purpose};
// the Cloudinary secret never reaches the device. The file then goes straight
// to Cloudinary (apiHelpers' upload section; services/mediaUpload.ts does both).

import { api, toApiError } from '../network/apiHelpers';

/** `purpose` is the API's name (models/mediaModel `API_PURPOSE`). */
export const signUploadAPI = async (purpose: string): Promise<unknown> => {
  try {
    const response = await api.post('/media/sign-upload', { purpose });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
