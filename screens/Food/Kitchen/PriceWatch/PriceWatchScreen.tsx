// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen: price watch
// ═══════════════════════════════════════════════════════
// The ingredients the kitchen last paid at least 10% more for than the
// city's price list this week: how much more, both prices per kilo, litre
// or piece, and the city's last eight weeks. A nudge to ask around.

import React, { useEffect } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { AppText, Card, EmptyState, InlineNotice, ScreenShell, SkeletonLines, StatusPill } from '../../../../Custom-Components/index';
import { Sparkline } from '../../../../Custom-Components/shopping/charts/Sparkline';
import type { FoodVendorStackParamList } from '../../../../types';
import { formatDayShort } from '../../../../utils/healthTime';
import { formatUnitPrice } from '../../../../utils/units';
import { loadPriceWatchAsync, selectPriceWatch } from './priceWatchSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenPriceWatch'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s12, paddingBottom: space.s40 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s8 },
    body: { gap: space.s8 },
  });

const PriceWatchScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <PriceWatchContent {...props} />
  </ServiceScope>
);

const PriceWatchContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'KitchenPurchases' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectPriceWatch);
  const w = s.watch;

  useEffect(() => {
    void dispatch(loadPriceWatchAsync());
  }, [dispatch]);

  return (
    <ScreenShell title="Price watch" subtitle={w ? `Against ${w.city}’s prices${w.week ? `, week of ${formatDayShort(w.week)}` : ''}` : 'What you pay against the city'} onBack={back} scroll={false}>
      <FlatList
        data={w?.items ?? []}
        keyExtractor={x => x.ingredientId}
        contentContainerStyle={styles.list}
        onRefresh={() => void dispatch(loadPriceWatchAsync())}
        refreshing={s.status === 'loading' && !!w}
        renderItem={({ item: x }) => (
          <Card onPress={() => navigation.navigate('KitchenIngredient', { id: x.ingredientId })} accessibilityLabel={`${x.name}: ${x.diffPct}% over the city's price`}>
            <View style={styles.body}>
              <View style={styles.head}>
                <AppText variant="title">{x.name}</AppText>
                <StatusPill label={`+${x.diffPct}%`} tone="warning" />
              </View>
              <AppText variant="small" tone="muted">
                You paid {formatUnitPrice(x.yourCostPerBase, x.baseUnit)} · the city {formatUnitPrice(x.cityCostPerBase, x.baseUnit)}
              </AppText>
              <Sparkline values={x.trend.map(t => t.costPerBase)} accessibilityLabel={`${x.name}: the city's price over ${x.trend.length} weeks, now ${formatUnitPrice(x.cityCostPerBase, x.baseUnit)}`} />
              <AppText variant="caption" tone="muted">
                The city’s price over the last {x.trend.length} weeks
              </AppText>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          !w && s.status !== 'failed' ? (
            <SkeletonLines lines={6} />
          ) : s.status === 'failed' ? (
            <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadPriceWatchAsync()) }} />
          ) : (
            <EmptyState icon="trending-down" title="Your prices look fair" body="Nothing you buy costs you 10% more than the city’s price this week." />
          )
        }
      />
    </ScreenShell>
  );
};

export default PriceWatchScreen;
