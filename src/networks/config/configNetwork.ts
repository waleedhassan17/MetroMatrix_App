// MetroMatrix — platform config network (GET /config, public).
// Real contract: MetroMatrix API docs/ADMIN_API.md §5.

import { api } from '../network/apiHelpers';
import { platformConfigSerializer } from '../../serializers/platformConfigSerializer';
import { request } from '../shopping/http';

export const fetchPlatformConfig = () => request(() => api.get('/config'), platformConfigSerializer);
