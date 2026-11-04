// ═══════════════════════════════════════════════════════
// MetroMatrix — The Food vendor's app: what its tabs count
// ═══════════════════════════════════════════════════════
// The Orders tab's badge: new orders waiting for an answer, from the board
// the VendorBoardHost keeps live on every tab; and the rider's Deliveries
// tab: the deliveries on their hands.

import { useAppSelector } from './useReduxHooks';
import { selectNewOrderCount } from '../screens/vendor-orders-screen/vendorBoardSlice';
import { selectActiveDeliveryCount } from '../screens/rider-deliveries-screen/riderHomeSlice';

export const useNewFoodOrders = () => useAppSelector(selectNewOrderCount);

/** The rider's Deliveries tab: deliveries on their hands now. */
export const useActiveDeliveries = () => useAppSelector(selectActiveDeliveryCount);
