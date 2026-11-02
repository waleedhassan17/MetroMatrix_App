// ═══════════════════════════════════════════════════════
// useStorePartner — the store's app: what its tab bar counts
// ═══════════════════════════════════════════════════════
// The Orders tab's badge is the dashboard's new orders (Today loads them on
// focus, and Orders refreshes them), so a store sees new work from any tab.

import { useAppSelector } from './useReduxHooks';
import { selectNewOrderCount } from '../screens/store-today-screen/storeTodaySlice';

export const useStoreNewOrders = (): number => useAppSelector(selectNewOrderCount);
