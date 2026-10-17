// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: Orders
// ═══════════════════════════════════════════════════════
// Stateless for now: the order board arrives with the API's ordering phase.
// Until then the tab says whether customers can find the kitchen.
// TODO(API_FOOD): the board (columns, the new-order alert, accept / reject).

import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector } from '@hooks/useReduxHooks';
import { ServiceScope } from '@theme/index';
import { EmptyState, ScreenShell } from '@custom/index';
import { selectBusiness } from '../../../Auth/authSlice';

type Nav = { navigate: (name: string, params?: object) => void };

const VendorOrdersScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const business = useAppSelector(selectBusiness);
  const live = !!business?.food?.isLive;
  return (
    <ServiceScope service="food">
      <ScreenShell title="Orders" subtitle={business?.name}>
        {live ? (
          <EmptyState icon="inbox" title="No orders yet" body="New orders appear here with a sound, and wait for your answer." />
        ) : (
          <EmptyState
            icon="check-square"
            title="Finish your setup"
            body="Customers can order once your kitchen is live."
            action={{ label: 'Open setup', onPress: () => navigation.navigate('VendorSetup') }}
          />
        )}
      </ScreenShell>
    </ServiceScope>
  );
};

export default VendorOrdersScreen;
