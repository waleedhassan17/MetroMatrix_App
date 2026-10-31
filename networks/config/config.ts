// ═══════════════════════════════════════════════════════
// MetroMatrix — Config Network (ADMIN_API.md §5)
// ═══════════════════════════════════════════════════════
// Real contract: MetroMatrix API docs/ADMIN_API.md §5.

import { API, toApiError } from '../network/network';

export const fetchPlatformConfig = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/config' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
