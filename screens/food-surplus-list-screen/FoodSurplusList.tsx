// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: Bachat Box near you
// ═══════════════════════════════════════════════════════
// Every box kitchens near the customer's point have put up for pickup
// today, nearest first, and the way to the reservations already made.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { BACHAT_BOX } from '../../models/kitchen/surplusModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, EmptyState, IconButton, InlineNotice, RowCardsSkeleton, ScreenShell, SurplusCard } from '../../Custom-Components/index';
import type { FoodAppParamList } from '../../models';
import { selectFoodPoint } from '../../store/preferencesSlice';
import { loadSurplusListAsync, selectSurplusList } from './surplusListSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodSurplusList'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s16 },
  });

const FoodSurplusList: React.FC<Props> = props => (
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
      onRefresh={load}
      headerRight={<IconButton icon="bookmark-outline" onPress={() => navigation.navigate('FoodSurplusReservations')} accessibilityLabel="Your reservations" />}>
      <AppText variant="small" tone="muted">
        What a kitchen has left at the end of the day, at a lower price, so good food isn’t thrown away. What’s inside is a surprise; you collect it yourself.
      </AppText>
      {!point ? (
        <EmptyState ion="location-outline" title="Choose your address" body="Pick your address on the Food Court home to see Bachat Boxes near you." />
      ) : s.status === 'failed' ? (
        <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} />
      ) : s.status === 'loading' && !s.items.length ? (
        <RowCardsSkeleton count={3} />
      ) : !s.items.length ? (
        <EmptyState ion="gift-outline" title="None nearby right now" body="Kitchens put Bachat Boxes up towards the end of the day. Check back this evening." />
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

export default FoodSurplusList;
