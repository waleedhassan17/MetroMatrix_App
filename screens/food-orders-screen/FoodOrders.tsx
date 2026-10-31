// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court → Orders (a tab)
// ═══════════════════════════════════════════════════════
// Orders from the Food Court's kitchens: Active (on their way) or Past. An
// order opens its live page. Tiffins, dawat requests and Bachat Box
// reservations are a tap away (Kitchen Intelligence). Stateless: the
// segment is in ordersSlice, and the list is shared with the cross-service
// Orders screen (OrdersLists).

import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useStyles, type Theme } from '../../theme/index';
import { ChoiceChip, ScreenShell, TextAction } from '../../Custom-Components/index';
import type { FoodTabParamList } from '../../models';
import { FOOD_SEGMENTS, FoodOrdersList } from '../orders-screen/OrdersLists';
import { selectOrdersView, setFoodSegment } from '../orders-screen/ordersSlice';

type Props = BottomTabScreenProps<FoodTabParamList, 'FoodOrdersTab'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', gap: space.s8 },
    links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s16 },
  });

type Nav = { navigate: (name: string, params?: object) => void };

const FoodOrders: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const v = useAppSelector(selectOrdersView);
  // FoodOrder is pushed over the Food app's tabs (its stack, the tab's parent).
  const stack = navigation.getParent() as unknown as Nav | undefined;
  return (
    <ScreenShell title="Orders" subtitle="From the Food Court's kitchens" scroll={false}>
      <View style={styles.links}>
        <TextAction label="Tiffins" icon="calendar-outline" onPress={() => stack?.navigate('FoodTiffins')} />
        <TextAction label="Dawat requests" icon="people-outline" onPress={() => stack?.navigate('FoodCateringRequests')} />
        <TextAction label="Bachat Box" icon="gift-outline" onPress={() => stack?.navigate('FoodSurplusReservations')} />
      </View>
      <View style={styles.chips}>
        {FOOD_SEGMENTS.map(sg => (
          <ChoiceChip key={sg.key} label={sg.label} selected={v.food === sg.key} onPress={() => dispatch(setFoodSegment(sg.key))} />
        ))}
      </View>
      <FoodOrdersList segment={v.food} onOpen={code => stack?.navigate('FoodOrder', { code })} onBrowse={() => navigation.navigate('FoodHomeTab')} />
    </ScreenShell>
  );
};

export default FoodOrders;
