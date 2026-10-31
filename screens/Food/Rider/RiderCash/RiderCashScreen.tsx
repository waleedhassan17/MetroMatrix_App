// ═══════════════════════════════════════════════════════
// MetroMatrix — Food rider: Cash
// ═══════════════════════════════════════════════════════
// The cash the rider holds for their vendor: collected on deliveries, handed
// over at the kitchen (the vendor records each handover). It's the vendor's
// money; MetroMatrix holds none of it.

import React, { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { ServiceScope } from '../../../../theme/index';
import { AppText, EmptyState, InlineNotice, ScreenShell, SkeletonLines } from '../../../../Custom-Components/index';
import { CashLedger } from '../../../../Custom-Components/food/CashLedger';
import { loadRiderHomeAsync, selectRiderHome } from '../RiderDeliveries/riderHomeSlice';
import { loadRiderCashAsync, selectRiderCash } from './riderCashSlice';

const RiderCashScreen: React.FC = () => {
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
          c.status === 'failed' ? null : <SkeletonLines lines={6} />
        ) : c.cash.entries.length ? (
          <>
            <CashLedger cash={c.cash} holder="You" vendor={vendor} />
            <AppText variant="small" tone="muted">
              {`Hand the cash to ${vendor}; they record it and it comes off here. It’s ${vendor}’s money: MetroMatrix holds none of it.`}
            </AppText>
          </>
        ) : (
          <EmptyState icon="dollar-sign" title="No cash held" body="Cash you collect on delivery adds up here until you hand it over at the kitchen." />
        )}
      </ScreenShell>
    </ServiceScope>
  );
};

export default RiderCashScreen;
