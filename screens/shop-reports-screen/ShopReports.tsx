// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: reported products
// ═══════════════════════════════════════════════════════
// What shoppers flagged, most recent first, with how many reported it.
// Dismiss it, or take the product down (the store is told why).

import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { usePagedList } from '../../hooks/usePagedList';
import { getReportsAPI } from '../../networks/admin/adminShopNetwork';
import { useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, Card, EmptyState, InlineNotice, ScreenShell, SegmentTabs, Sheet, SkeletonLines, StatusPill, TextField } from '../../Custom-Components/index';
import type { AdminShopStackParamList, ReportStatus } from '../../models';
import { cdn } from '../../utils/cdn/cdn';
import { formatDay } from '../../utils/dates/dates';
import { decideReportAsync, openRemove, selectShopReports, setRemoveReason, setReportsStatus } from './shopReportsSlice';
import { productReportPageSerializer } from '../../serializers/shopping/adminShopSerializer';

type Props = NativeStackScreenProps<AdminShopStackParamList, 'ShopReports'>;

const SEGMENTS: { key: ReportStatus; label: string }[] = [
  { key: 'open', label: 'To decide' },
  { key: 'removed', label: 'Removed' },
  { key: 'dismissed', label: 'Dismissed' },
];

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s12, paddingBottom: space.s40 },
    head: { flexDirection: 'row', gap: space.s12 },
    thumb: { width: size.thumb, aspectRatio: size.productAspect, borderRadius: radius.sm, backgroundColor: colors.surfaceSunk },
    text: { flex: 1, gap: space.s4 },
    actions: { flexDirection: 'row', gap: space.s12 },
    grow: { flex: 1 },
  });

const ShopReports: React.FC<Props> = () => {
  const { back } = useBack({ name: 'ShopOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const s = useAppSelector(selectShopReports);
  const list = usePagedList((page, sz) => getReportsAPI(s.status, page, sz), productReportPageSerializer, `reports|${s.status}`);

  const decide = async (d: { id: string; kind: 'dismiss' } | { id: string; kind: 'remove'; reason: string }) => {
    const r = await dispatch(decideReportAsync(d));
    if (decideReportAsync.fulfilled.match(r)) {
      list.setRows(rows => rows.filter(x => x.productId !== r.payload.productId));
      Toast.show({ type: 'success', text1: d.kind === 'dismiss' ? 'Report dismissed' : 'Product taken down', text2: d.kind === 'remove' ? 'The store has your reason.' : undefined });
    }
  };

  return (
    <ScreenShell title="Reported products" onBack={back} scroll={false} headerContent={<SegmentTabs options={SEGMENTS} value={s.status} onChange={k => dispatch(setReportsStatus(k))} accessibilityLabel="Reports" />}>
      {s.error.message && !s.removing ? <InlineNotice message={s.error.message} /> : null}
      <FlatList
        data={list.rows}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        onEndReached={list.loadMore}
        renderItem={({ item: r }) => (
          <Card>
            <View style={styles.head}>
              {r.productImage ? <Image source={{ uri: cdn(r.productImage, { w: size.thumb }) ?? undefined }} style={styles.thumb} contentFit="cover" /> : <View style={styles.thumb} />}
              <View style={styles.text}>
                <AppText variant="title" numberOfLines={2}>
                  {r.productName}
                </AppText>
                <AppText variant="small" tone="muted">
                  {r.storeName} · {formatDay(r.createdAt)}
                </AppText>
                <StatusPill label={r.reportCount > 1 ? `${r.reportCount} reports` : '1 report'} tone={r.reportCount > 1 ? 'danger' : 'warning'} />
              </View>
            </View>
            <AppText variant="bodyStrong">{r.reason}</AppText>
            {r.details ? <AppText variant="body">{r.details}</AppText> : null}
            {r.status === 'open' ? (
              <View style={styles.actions}>
                <Button label="Dismiss" variant="secondary" onPress={() => void decide({ id: r.id, kind: 'dismiss' })} loading={s.busy === r.id && !s.removing} />
                <View style={styles.grow}>
                  <Button label="Take it down" variant="destructive" onPress={() => dispatch(openRemove(r.id))} fullWidth />
                </View>
              </View>
            ) : null}
          </Card>
        )}
        ListEmptyComponent={
          list.isLoading ? (
            <SkeletonLines lines={6} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState icon="flag" title={s.status === 'open' ? 'Nothing to decide' : 'Nothing here'} body="Products shoppers report show here." />
          )
        }
      />
      <Sheet
        visible={!!s.removing}
        onClose={() => dispatch(openRemove(null))}
        title="Take this product down?"
        subtitle="It disappears from the shop at once. The store sees your reason."
        footer={
          <Button
            label="Take it down"
            variant="destructive"
            disabled={s.reason.trim().length < 10}
            loading={!!s.busy}
            onPress={() => s.removing && void decide({ id: s.removing, kind: 'remove', reason: s.reason })}
            fullWidth
          />
        }>
        <TextField label="Reason for the store" value={s.reason} onChangeText={t => dispatch(setRemoveReason(t))} multiline helper="At least 10 characters." placeholder="The photos show a branded watch; counterfeit goods aren't allowed." />
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      </Sheet>
    </ScreenShell>
  );
};

export default ShopReports;
