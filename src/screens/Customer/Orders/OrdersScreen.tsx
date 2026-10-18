// ═══════════════════════════════════════════════════════
// MetroMatrix — Orders (Shop · Health · Food)
// ═══════════════════════════════════════════════════════
// Everything ordered across the services in one place, opened from the
// home's side menu. Each service also has its own list in its tabs
// (Shopping → Orders, Health → Appointments); an order or a visit opens in
// its service's app, over that service's tabs.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useServiceNav } from '@hooks/useServiceNav';
import { APPOINTMENT_SEGMENTS } from '@models/health/appointmentStatusModel';
import { PageHeaderScope, useStyles, type Theme } from '@theme/index';
import { ChoiceChip, ScreenShell, SegmentTabs } from '@custom/index';
import type { CustomerStackParamList } from '@/types';
import { Appointments, FOOD_SEGMENTS, FoodOrdersList, SHOP_SEGMENTS, ShopOrders } from './OrdersLists';
import { selectOrdersView, setFoodSegment, setOrdersSegment, setOrdersService, setVisitsSegment, type OrdersService } from './ordersSlice';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Orders'>;

const SERVICES: { key: OrdersService; label: string }[] = [
  { key: 'shop', label: 'Shop' },
  { key: 'health', label: 'Health' },
  { key: 'food', label: 'Food' },
];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', gap: space.s8 },
  });

const OrdersScreen: React.FC<Props> = props => (
  <PageHeaderScope>
    <OrdersContent {...props} />
  </PageHeaderScope>
);

const OrdersContent: React.FC<Props> = ({ route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { back, canGoBack } = useBack({ name: 'CustomerHome' });
  const { openShop, openHealth, openFood } = useServiceNav();
  const v = useAppSelector(selectOrdersView);
  const asked = route.params?.segment;
  const askedService = route.params?.service;
  const askedVisits = route.params?.visits;

  useEffect(() => {
    if (asked) {
      dispatch(setOrdersService('shop'));
      dispatch(setOrdersSegment(asked));
    }
  }, [asked, dispatch]);

  useEffect(() => {
    if (askedService) dispatch(setOrdersService(askedService));
    if (askedVisits) dispatch(setVisitsSegment(askedVisits));
  }, [askedService, askedVisits, dispatch]);

  return (
    <ScreenShell title="My orders" subtitle="Shopping, appointments and Food Court" onBack={canGoBack ? back : undefined} scroll={false}>
      <SegmentTabs options={SERVICES} value={v.service} onChange={k => dispatch(setOrdersService(k))} accessibilityLabel="Service" />
      {v.service === 'shop' ? (
        <>
          <View style={styles.chips}>
            {SHOP_SEGMENTS.map(sg => (
              <ChoiceChip key={sg.key} label={sg.label} selected={v.segment === sg.key} onPress={() => dispatch(setOrdersSegment(sg.key))} />
            ))}
          </View>
          <ShopOrders segment={v.segment} onOpen={groupCode => openShop('OrderDetail', { groupCode })} onShop={() => openShop()} />
        </>
      ) : v.service === 'health' ? (
        <>
          <View style={styles.chips}>
            {APPOINTMENT_SEGMENTS.map(sg => (
              <ChoiceChip key={sg.key} label={sg.label} selected={v.visits === sg.key} onPress={() => dispatch(setVisitsSegment(sg.key))} />
            ))}
          </View>
          <Appointments segment={v.visits} onOpen={code => openHealth('AppointmentDetail', { code })} onFind={() => openHealth()} />
        </>
      ) : (
        <>
          <View style={styles.chips}>
            {FOOD_SEGMENTS.map(sg => (
              <ChoiceChip key={sg.key} label={sg.label} selected={v.food === sg.key} onPress={() => dispatch(setFoodSegment(sg.key))} />
            ))}
          </View>
          <FoodOrdersList segment={v.food} onOpen={code => openFood('FoodOrder', { code })} onBrowse={() => openFood()} />
        </>
      )}
    </ScreenShell>
  );
};

export default OrdersScreen;
