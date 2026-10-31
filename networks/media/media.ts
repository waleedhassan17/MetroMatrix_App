// ═══════════════════════════════════════════════════════
// MetroMatrix — Media Network (AUTH_CONTRACT.md)
// ═══════════════════════════════════════════════════════
// Per MetroMatrix_Backend media.controller.ts: POST /media/sign-upload
// { purpose } signs one upload into metromatrix/{env}/{userId}/{purpose};
// the Cloudinary secret never reaches the device. The file then goes straight
// to Cloudinary (apiHelpers' upload section; services/mediaUpload.ts does both).

import { API, toApiError } from '../network/network';

/** `purpose` is the API's name (models/mediaModel `API_PURPOSE`). */
export const signUpload = async (purpose: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/media/sign-upload', data: { purpose } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
