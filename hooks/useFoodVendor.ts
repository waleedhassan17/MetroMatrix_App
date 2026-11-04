// ═══════════════════════════════════════════════════════
// MetroMatrix — The Food vendor's app: what its tabs count
// ═══════════════════════════════════════════════════════
// The Orders tab's badge: new orders waiting for an answer, from the board
// the VendorBoardHost keeps live on every tab.

import { useAppSelector } from './useReduxHooks';
import { selectNewOrderCount } from '../screens/vendor-orders-screen/vendorBoardSlice';

export const useNewFoodOrders = () => useAppSelector(selectNewOrderCount);
