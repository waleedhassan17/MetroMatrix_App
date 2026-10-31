// ═══════════════════════════════════════════════════════
// MetroMatrix — Config Network (ADMIN_API.md §5)
// ═══════════════════════════════════════════════════════
// Real contract: MetroMatrix API docs/ADMIN_API.md §5.

import { api, toApiError } from '../network/apiHelpers';

export const getPlatformConfigAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/config');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
