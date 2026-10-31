// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen: purchases
// ═══════════════════════════════════════════════════════
// What the kitchen bought, newest first, with the week's spend; the
// ingredients it pays more for than the city's price list (the price
// watch); a new purchase by hand, from a receipt photo, or spoken.

import React, { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { usePagedList } from '../../hooks/usePagedList';
import { fetchPurchases } from '../../networks/kitchen/purchases';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, EmptyState, IconButton, InlineNotice, ScreenShell, SkeletonLines, TextAction } from '../../Custom-Components/index';
import { Sparkline } from '../../Custom-Components/shopping/charts/Sparkline';
import { RowCard, SectionHead } from '../../Components/admin/AdminParts';
import { VoiceSheetButton } from '../../Components/voice/VoiceSheet';
import type { FoodVendorStackParamList, Purchase } from '../../models';
import { formatDayShort } from '../../utils/health-time/healthTime';
import { formatPKR } from '../../utils/money/money';
import { formatUnitPrice } from '../../utils/units/units';
import { haptics } from '../../utils/haptics/haptics';
import { confirmSpokenPurchaseAsync, loadPurchasesOverviewAsync, selectPurchases } from './purchasesSlice';
import { purchasesPageSerializer } from '../../serializers/kitchen/stockSerializer';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenPurchases'>;

const SOURCE: Record<Purchase['source'], string> = { manual: 'Typed', receipt: 'From a receipt', voice: 'Spoken' };

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s12, paddingBottom: space.s40 },
    head: { gap: space.s12 },
    watch: { gap: space.s12 },
    watchRow: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    spark: { width: '30%' },
    actions: { flexDirection: 'row', gap: space.s8 },
  });

const Purchases: React.FC<Props> = props => (
  <ServiceScope service="food">
    <PurchasesContent {...props} />
  </ServiceScope>
);

const PurchasesContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'VendorTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectPurchases);
  const list = usePagedList(fetchPurchases, purchasesPageSerializer, `kitchen-purchases|${s.version}`);

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadPurchasesOverviewAsync());
    }, [dispatch]),
  );

  const watch = s.watch?.items ?? [];
  const header = (
    <View style={styles.head}>
      {watch.length ? (
        <Card>
          <View style={styles.watch}>
            <AppText variant="title">You pay more than {s.watch?.city ?? 'the city'} for</AppText>
            {watch.slice(0, 3).map(w => (
              <View key={w.ingredientId} style={styles.watchRow}>
                <View style={styles.grow}>
                  <AppText variant="bodyStrong">
                    {w.name} <AppText variant="bodyStrong" tone="warning">+{w.diffPct}%</AppText>
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    You {formatUnitPrice(w.yourCostPerBase, w.baseUnit)} · city {formatUnitPrice(w.cityCostPerBase, w.baseUnit)}
                  </AppText>
                </View>
                <View style={styles.spark}>
                  <Sparkline values={w.trend.map(t => t.costPerBase)} accessibilityLabel={`${w.name}: the city's price over 8 weeks`} />
                </View>
              </View>
            ))}
            <TextAction label="See the price watch" onPress={() => navigation.navigate('KitchenPriceWatch')} />
          </View>
        </Card>
      ) : null}
      <SectionHead title="Bought" action={{ label: 'Suppliers', onPress: () => navigation.navigate('KitchenSuppliers') }} />
    </View>
  );

  return (
    <ScreenShell
      title="Purchases"
      subtitle={s.weekTotal === null ? 'What you bought, and what it cost' : `${formatPKR(s.weekTotal)} spent this week`}
      onBack={back}
      scroll={false}
      headerRight={
        <>
          <VoiceSheetButton
            context="purchases"
            title="Speak a purchase"
            busy={s.confirming}
            onConfirm={async a => {
              if (a.kind !== 'purchase.add') return false;
              const res = await dispatch(confirmSpokenPurchaseAsync(a.lines));
              if (confirmSpokenPurchaseAsync.fulfilled.match(res)) {
                haptics.success();
                Toast.show({ type: 'success', text1: 'Purchase saved', text2: `${formatPKR(res.payload.total)} · stock updated` });
                void dispatch(loadPurchasesOverviewAsync());
                return true;
              }
              haptics.warning();
              return false;
            }}
            onEdit={a => (a.kind === 'purchase.add' ? navigation.navigate('KitchenPurchaseForm', { draft: a.lines }) : undefined)}
          />
          <IconButton icon="camera-outline" onPress={() => navigation.navigate('KitchenPurchaseForm', { scan: true })} accessibilityLabel="Scan a receipt" />
        </>
      }
      footer={<Button label="Add a purchase" leftIcon="add" onPress={() => navigation.navigate('KitchenPurchaseForm')} fullWidth />}>
      {s.confirmError.message ? <InlineNotice message={s.confirmError.message} /> : null}
      <FlatList
        data={list.rows}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        onRefresh={() => {
          list.refresh();
          void dispatch(loadPurchasesOverviewAsync());
        }}
        refreshing={list.isRefreshing}
        onEndReached={list.loadMore}
        ListHeaderComponent={header}
        renderItem={({ item: p }) => (
          <RowCard
            title={p.supplier?.name ?? 'No supplier'}
            mark={{ icon: p.source === 'receipt' ? 'receipt-outline' : p.source === 'voice' ? 'mic-outline' : 'cart-outline', tint: 'amber' }}
            lines={[formatDayShort(p.date), p.lines.map(l => l.name).slice(0, 3).join(', ') + (p.lines.length > 3 ? ` and ${p.lines.length - 3} more` : '')]}
            pill={{ label: SOURCE[p.source], tone: 'neutral' }}
            amount={formatPKR(p.total)}
            onPress={() => navigation.navigate('KitchenPurchase', { id: p.id })}
          />
        )}
        ListEmptyComponent={
          list.isLoading ? (
            <SkeletonLines lines={6} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState icon="shopping-cart" title="No purchases yet" body="Add what you buy, and stock and costs keep themselves up to date." />
          )
        }
        ListFooterComponent={list.isLoadingMore ? <SkeletonLines lines={2} /> : null}
      />
    </ScreenShell>
  );
};

export default Purchases;
