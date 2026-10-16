// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court → Orders (a tab)
// ═══════════════════════════════════════════════════════
// Orders from the Food Court's vendors will list here once ordering opens;
// until then, the way back to the vendors.

import React from 'react';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { EmptyState, ScreenShell } from '@custom/index';
import type { FoodTabParamList } from '@/types';

type Props = BottomTabScreenProps<FoodTabParamList, 'FoodOrdersTab'>;

const FoodOrdersScreen: React.FC<Props> = ({ navigation }) => (
  <ScreenShell title="Orders" subtitle="From the Food Court's vendors">
    <EmptyState
      icon="coffee"
      title="No Food Court orders yet"
      body="Menus and ordering open in the next update. Your orders will show here, with each vendor's delivery time."
      action={{ label: 'Browse the Food Court', onPress: () => navigation.navigate('FoodHomeTab') }}
    />
  </ScreenShell>
);

export default FoodOrdersScreen;
