// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping → Orders (a tab, as in the FYP)
// ═══════════════════════════════════════════════════════
// Active, Completed or Cancelled, grouped by checkout; each card leads with
// what most needs attention. An order opens over the tabs.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useStyles, type Theme } from '../../../../theme/index';
import { ChoiceChip, ScreenShell } from '../../../../Custom-Components/index';
import type { ShopTabParamList } from '../../../../types';
import { SHOP_SEGMENTS, ShopOrders } from '../../../Customer/Orders/OrdersLists';
import { selectOrdersView, setOrdersSegment } from '../../../Customer/Orders/ordersSlice';

type Props = BottomTabScreenProps<ShopTabParamList, 'ShopOrdersTab'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', gap: space.s8 },
  });

const ShopOrdersScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { segment } = useAppSelector(selectOrdersView);
  const asked = route.params?.segment;

  useEffect(() => {
    if (asked) dispatch(setOrdersSegment(asked));
  }, [asked, dispatch]);

  const go = navigation as unknown as { navigate: (name: string, params?: object) => void };

  return (
    <ScreenShell title="Orders" subtitle="Track every order, store by store" scroll={false}>
      <View style={styles.chips}>
        {SHOP_SEGMENTS.map(sg => (
          <ChoiceChip key={sg.key} label={sg.label} selected={segment === sg.key} onPress={() => dispatch(setOrdersSegment(sg.key))} />
        ))}
      </View>
      <ShopOrders segment={segment} onOpen={groupCode => go.navigate('OrderDetail', { groupCode })} onShop={() => navigation.navigate('ShopHomeTab')} />
    </ScreenShell>
  );
};

export default ShopOrdersScreen;
