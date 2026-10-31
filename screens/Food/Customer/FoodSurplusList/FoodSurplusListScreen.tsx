// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: Bachat Box near you
// ═══════════════════════════════════════════════════════
// Every box kitchens near the customer's point have put up for pickup
// today, nearest first, and the way to the reservations already made.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { BACHAT_BOX } from '../../../../models/kitchen/surplusModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { AppText, EmptyState, InlineNotice, ScreenShell, SkeletonLines, SurplusCard, TextAction } from '../../../../Custom-Components/index';
import type { FoodAppParamList } from '../../../../types';
import { selectFoodPoint } from '../../../../store/preferencesSlice';
import { loadSurplusListAsync, selectSurplusList } from './surplusListSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodSurplusList'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s16 },
  });

const FoodSurplusListScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodSurplusListContent {...props} />
  </ServiceScope>
);

const FoodSurplusListContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'FoodTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectSurplusList);
  const point = useAppSelector(selectFoodPoint);
  const load = useCallback(() => {
    if (point) void dispatch(loadSurplusListAsync({ lat: point.lat, lng: point.lng }));
  }, [dispatch, point]);
  useFocusEffect(load);

  return (
    <ScreenShell
      title={`${BACHAT_BOX} near you`}
      subtitle={point ? `Pickup today near ${point.label}` : 'Tonight’s food at a lower price'}
      onBack={back}
      refreshing={s.status === 'loading' && !!s.items.length}
      onRefresh={load}>
      <AppText variant="small" tone="muted">
        Kitchens put up what is left at the end of the day at a lower price, so good food isn’t thrown away. What is inside is a surprise; you collect it yourself.
      </AppText>
      <TextAction label="Your reservations" icon="bookmark-outline" onPress={() => navigation.navigate('FoodSurplusReservations')} />
      {!point ? (
        <EmptyState icon="map-pin" title="Where are you?" body="Choose your address on Food Court’s home to see Bachat Boxes near you." />
      ) : s.status === 'failed' ? (
        <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} />
      ) : s.status === 'loading' && !s.items.length ? (
        <SkeletonLines lines={8} />
      ) : !s.items.length ? (
        <EmptyState icon="gift" title="None nearby right now" body="Kitchens usually put Bachat Boxes up in the evening. Check back after 8 PM." />
      ) : (
        <View style={styles.list}>
          {s.items.map(b => (
            <SurplusCard key={b.id} card={b} onPress={() => navigation.navigate('FoodSurplus', { id: b.id })} />
          ))}
        </View>
      )}
    </ScreenShell>
  );
};

export default FoodSurplusListScreen;
