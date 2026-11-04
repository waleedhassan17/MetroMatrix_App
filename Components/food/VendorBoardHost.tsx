// ═══════════════════════════════════════════════════════
// MetroMatrix — The kitchen's board, live on every tab
// ═══════════════════════════════════════════════════════
// Mounted once over the Food vendor's tabs (KitchenPartnerNavigator), so the
// board connects, rings and speaks whichever tab is open — a home kitchen
// opens on Today, not Orders. It owns the socket handlers, the read on
// arrival, and the ring while a new order is unopened; the Orders screen
// keeps the screen awake and draws the board. Renders nothing.

import React, { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector, useAppStore } from '../../hooks/useReduxHooks';
import { useVendorBoard } from '../../hooks/useFoodLive';
import { announce } from '../../services/announcer';
import { orderAlert } from '../../services/orderAlert';
import { selectBusiness } from '../../store/authSlice';
import { selectAnnounce } from '../../store/preferencesSlice';
import {
  announceOrderAsync,
  boardNewOrder,
  boardOrderUpdated,
  boardSynced,
  loadBoardAsync,
  loadKitchenAsync,
  selectUnseenCount,
  selectVendorBoard,
  setBoardColumn,
} from '../../screens/vendor-orders-screen/vendorBoardSlice';

export const VendorBoardHost: React.FC = () => {
  const dispatch = useAppDispatch();
  const appStore = useAppStore();
  const live = !!useAppSelector(selectBusiness)?.food?.isLive;
  const spoken = useAppSelector(selectAnnounce);
  const unseen = useAppSelector(selectUnseenCount);

  const refetch = useCallback(() => void dispatch(loadBoardAsync()), [dispatch]);
  // The board and the kitchen (its logo, colour and open state for every tab's
  // header) are read once on arrival; the socket and the fallback poll keep them.
  useEffect(() => {
    if (!live) return;
    refetch();
    void dispatch(loadKitchenAsync());
  }, [dispatch, live, refetch]);

  useVendorBoard(
    {
      onSync: s => dispatch(boardSynced(s.orders)),
      onNew: c => {
        dispatch(boardNewOrder(c));
        dispatch(setBoardColumn('new'));
        // Said out loud after the chime's first ring, once per order.
        const announced = selectVendorBoard(appStore.getState()).announced;
        if (spoken !== 'off' && c.status === 'placed' && !announced.includes(c.id)) {
          void dispatch(announceOrderAsync({ id: c.id, language: spoken })).then(r => {
            const announcement = announceOrderAsync.fulfilled.match(r) ? selectVendorBoard(appStore.getState()).announcement : null;
            if (announcement) void announce(announcement);
          });
        }
      },
      onUpdate: u => dispatch(boardOrderUpdated(u)),
      onPayment: refetch,
      refetch,
    },
    live,
  );

  // Ring while a new order hasn't been opened; quiet once every one has.
  useEffect(() => {
    if (unseen > 0) orderAlert.start();
    else orderAlert.stop();
  }, [unseen]);
  useEffect(() => () => orderAlert.stop(), []);

  return null;
};

export default VendorBoardHost;
