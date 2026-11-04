// ═══════════════════════════════════════════════════════
// MetroMatrix — Food rider: Cash
// ═══════════════════════════════════════════════════════
// The cash the rider holds for their vendor: collected on deliveries, handed
// over at the kitchen (the vendor records each handover). It's the vendor's
// money; MetroMatrix holds none of it.

import React, { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { ServiceScope } from '../../theme/index';
import { EmptyState, InlineNotice, RowCardsSkeleton, ScreenShell } from '../../Custom-Components/index';
import { TrustNote } from '../../Components/food/FoodParts';
import { CashLedger } from '../../Custom-Components/food/CashLedger';
import { loadRiderHomeAsync, selectRiderHome } from '../rider-deliveries-screen/riderHomeSlice';
import { loadRiderCashAsync, selectRiderCash } from './riderCashSlice';

const RiderCash: React.FC = () => {
  const dispatch = useAppDispatch();
  const c = useAppSelector(selectRiderCash);
  const home = useAppSelector(selectRiderHome).home;
  const vendor = home?.vendor.name ?? 'your vendor';
  const hasHome = !!home;

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadRiderCashAsync());
      if (!hasHome) void dispatch(loadRiderHomeAsync());
    }, [dispatch, hasHome]),
  );

  return (
    <ServiceScope service="food">
      <ScreenShell title="Cash" subtitle="What you hold for your vendor" refreshing={c.status === 'loading' && !!c.cash} onRefresh={() => void dispatch(loadRiderCashAsync())}>
        {c.status === 'failed' ? <InlineNotice message={c.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadRiderCashAsync()) }} /> : null}
        {!c.cash ? (
          c.status === 'failed' ? null : <RowCardsSkeleton count={3} />
        ) : c.cash.entries.length || c.cash.balance > 0 ? (
          // A balance with no entries yet still shows: the rider holds money either way.
          <>
            <CashLedger cash={c.cash} holder="You" vendor={vendor} />
            <TrustNote text={`Hand the cash to ${vendor}; they record it and it comes off here. It’s ${vendor}’s money: MetroMatrix holds none of it.`} />
          </>
        ) : (
          <EmptyState ion="cash-outline" title="No cash held" body="Cash you collect on delivery adds up here until you hand it over at the kitchen." />
        )}
      </ScreenShell>
    </ServiceScope>
  );
};

export default RiderCash;
