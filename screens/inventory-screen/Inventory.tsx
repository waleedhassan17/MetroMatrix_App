// ═══════════════════════════════════════════════════════
// MetroMatrix — Inventory (stock per size and colour)
// ═══════════════════════════════════════════════════════
// Lowest stock first. Type a new count and save it; pick several rows to
// set them all at once; a row's history shows every change (orders,
// cancellations, restocked returns, your edits).

import React, { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useDebouncedValue, usePagedList } from '../../hooks/usePagedList';
import { getInventoryAPI } from '../../networks/shopping/partner/inventoryNetwork';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  Button,
  Divider,
  EmptyState,
  InlineNotice,
  IonIcon,
  ScreenShell,
  Sheet,
  SkeletonLines,
  StatusPill,
  StickyCTA,
  TextAction,
  TextField,
  ToggleRow,
} from '../../Custom-Components/index';
import type { InventoryMovement, InventoryRow, MovementReason, StorePartnerStackParamList } from '../../models';
import { cdn } from '../../utils/cdn/cdn';
import { formatDateTime } from '../../utils/dates/dates';
import {
  bulkStockAsync,
  closeHistory,
  loadHistoryAsync,
  saveStockAsync,
  selectInventory,
  setBulkStock,
  setInventoryQuery,
  setLowOnly,
  setStockDraft,
  toggleSelected,
  toggleSelecting,
} from './inventorySlice';
import { inventoryRowPageSerializer } from '../../serializers/shopping/partnerSerializer';

type Props = NativeStackScreenProps<StorePartnerStackParamList, 'Inventory'>;

const REASON: Record<MovementReason, string> = {
  initial: 'Opening stock',
  manual: 'You changed it',
  bulk: 'Set in bulk',
  order: 'Sold',
  cancel: 'Order cancelled',
  return_restock: 'Return restocked',
};

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s12 },
    thumb: { width: size.storeLogo, height: size.storeLogo, borderRadius: radius.sm, backgroundColor: colors.surfaceSunk },
    text: { flex: 1, gap: space.s4 },
    stock: { width: size.stockField, gap: space.s4 },
    list: { paddingBottom: space.s40 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    move: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.s8 },
  });

const Inventory: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <InventoryContent {...props} />
  </ServiceScope>
);

const InventoryContent: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'StoreTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, colors, size } = useTheme();
  const s = useAppSelector(selectInventory);
  const q = useDebouncedValue(s.query.trim());
  const list = usePagedList((page, sz) => getInventoryAPI({ q: q || undefined, lowStock: s.lowOnly || undefined }, page, sz), inventoryRowPageSerializer, `inventory|${q}|${s.lowOnly}`, {
    keyOf: r => r.variantId,
  });

  useEffect(() => {
    if (route.params?.lowStock) dispatch(setLowOnly(true));
  }, [route.params?.lowStock, dispatch]);

  const renderRow = (raw: InventoryRow) => {
    const row = s.saved[raw.variantId] ?? raw;
    const draft = s.drafts[row.variantId];
    const changed = draft !== undefined && draft !== '' && Number(draft) !== row.stock;
    const picked = s.selected.includes(row.variantId);
    return (
      <View style={styles.row}>
        {s.selecting ? (
          <Pressable onPress={() => dispatch(toggleSelected(row.variantId))} accessibilityRole="checkbox" aria-checked={picked} accessibilityLabel={`Select ${row.productName} ${row.variantLabel}`}>
            <IonIcon name={picked ? 'checkbox' : 'square-outline'} size="lg" color={picked ? service.accent : colors.lineStrong} />
          </Pressable>
        ) : row.imageUrl ? (
          <Image source={{ uri: cdn(row.imageUrl, { w: size.storeLogo, h: size.storeLogo }) ?? undefined }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={styles.thumb} />
        )}
        <View style={styles.text}>
          <AppText variant="small" numberOfLines={1}>
            {row.productName}
          </AppText>
          <AppText variant="caption" tone="muted">
            {row.variantLabel} · {row.sku}
          </AppText>
          <View style={styles.head}>
            <StatusPill label={row.stock === 0 ? 'Out' : row.lowStock ? 'Low' : 'OK'} tone={row.stock === 0 ? 'danger' : row.lowStock ? 'warning' : 'success'} />
            <TextAction label="History" onPress={() => void dispatch(loadHistoryAsync({ variantId: row.variantId, label: `${row.productName} · ${row.variantLabel}` }))} />
          </View>
        </View>
        <View style={styles.stock}>
          <TextField
            label="Stock"
            mode="numeric"
            value={draft ?? String(row.stock)}
            onChangeText={v => dispatch(setStockDraft({ variantId: row.variantId, value: v }))}
            accessibilityLabel={`Stock of ${row.productName} ${row.variantLabel}`}
          />
          {changed ? (
            <Button label="Save" size="sm" onPress={() => void dispatch(saveStockAsync({ variantId: row.variantId, stock: Number(draft) }))} loading={s.busy === row.variantId} />
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <ScreenShell
      title="Inventory"
      onBack={back}
      scroll={false}
      headerRight={<TextAction label={s.selecting ? 'Done' : 'Select'} onPress={() => dispatch(toggleSelecting())} />}>
      <TextField label="Search" value={s.query} onChangeText={t => dispatch(setInventoryQuery(t))} icon="search" placeholder="Product or SKU" clearable autoCorrect={false} />
      <ToggleRow label="Only low and out of stock" value={s.lowOnly} onChange={v => dispatch(setLowOnly(v))} />
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      <FlatList
        data={list.rows}
        keyExtractor={r => r.variantId}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Divider}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => renderRow(item)}
        ListEmptyComponent={
          list.isLoading ? (
            <SkeletonLines lines={6} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState icon="layers" title={s.lowOnly ? 'Nothing low on stock' : 'No stock to show'} body={s.lowOnly ? 'Every option has more than 3 left.' : 'Add products to track their stock.'} />
          )
        }
        ListFooterComponent={list.isLoadingMore ? <SkeletonLines lines={2} /> : null}
      />
      {s.selecting && s.selected.length ? (
        <StickyCTA>
          <View style={styles.head}>
            <View style={styles.text}>
              <TextField label={`Set ${s.selected.length} to`} mode="numeric" value={s.bulkStock} onChangeText={t => dispatch(setBulkStock(t))} placeholder="10" />
            </View>
          </View>
          <Button
            label="Apply"
            disabled={!s.bulkStock}
            loading={s.busy === 'bulk'}
            onPress={() => void dispatch(bulkStockAsync({ variantIds: s.selected, stock: Number(s.bulkStock) }))}
            fullWidth
          />
        </StickyCTA>
      ) : null}

      <Sheet visible={!!s.history.variantId} onClose={() => dispatch(closeHistory())} title="Stock history" subtitle={s.history.label}>
        {s.history.status === 'loading' ? <SkeletonLines lines={4} /> : null}
        {s.history.movements.map((m: InventoryMovement, i) => (
          <View key={m.id}>
            {i > 0 ? <Divider /> : null}
            <View style={styles.move}>
              <View style={styles.text}>
                <AppText variant="small">{REASON[m.reason] ?? 'Change'}</AppText>
                <AppText variant="caption" tone="muted">
                  {formatDateTime(m.createdAt)}
                  {m.note ? ` · ${m.note}` : ''}
                </AppText>
              </View>
              <View>
                <AppText variant="bodyStrong" tone={m.delta < 0 ? 'danger' : 'success'} align="right">
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </AppText>
                <AppText variant="caption" tone="muted" align="right">
                  {m.stockAfter} left
                </AppText>
              </View>
            </View>
          </View>
        ))}
      </Sheet>
    </ScreenShell>
  );
};

export default Inventory;
