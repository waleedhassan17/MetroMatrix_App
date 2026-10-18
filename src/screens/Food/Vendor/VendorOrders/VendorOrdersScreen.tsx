// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: Orders (the board)
// ═══════════════════════════════════════════════════════
// New · Cooking · Ready · Out for delivery: tabs with counts on a phone, four
// columns side by side from tablet width. A new order rings (and vibrates)
// until it is opened or answered, and shows the time left to answer; one
// tap accepts it with a time, or declines it with a reason. The kitchen's
// switches — busy (+15 min for an hour), pause — sit on top. Live over the
// socket; read again after reconnects and every few seconds while it's down.
// The screen stays awake while the board is open.

import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useNow } from '@hooks/useNow';
import { useLayoutClass } from '@hooks/useLayoutClass';
import { useVendorBoard } from '@hooks/useFoodLive';
import { BOARD_COLUMNS, ETA_CHOICES, REJECT_REASONS, columnCounts, columnOf, type BoardColumn, type VendorMove } from '@models/food/foodStatusModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, ChoiceChip, EmptyState, InlineNotice, ScreenShell, Sheet, SkeletonLines } from '@custom/index';
import { ChoiceLine } from '@custom/food/ChoiceLine';
import { OrderTicket } from '@custom/food/OrderTicket';
import type { BoardCard } from '@/types';
import { orderAlert, type OrderAlertState } from '@/services/orderAlert';
import { formatSlot } from '@utils/healthTime';
import { haptics } from '@utils/haptics';
import { selectBusiness } from '../../../Auth/authSlice';
import {
  acceptOrderAsync,
  boardNewOrder,
  boardOrderUpdated,
  boardSynced,
  loadBoardAsync,
  loadKitchenAsync,
  markOrderSeen,
  moveOrderAsync,
  openAccept,
  openReject,
  rejectOrderAsync,
  selectUnseenCount,
  selectVendorBoard,
  setBoardColumn,
  switchKitchenAsync,
  type BoardMove,
} from './vendorBoardSlice';

type Nav = { navigate: (name: string, params?: object) => void };

const KEEP_AWAKE_TAG = 'food-board';

const makeStyles = ({ space, gutter, colors, radius, size }: Theme) =>
  StyleSheet.create({
    switches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    chipBar: { flexGrow: 0, flexShrink: 0 },
    chips: { flexDirection: 'row', gap: space.s8, paddingRight: gutter },
    list: { gap: space.s12, paddingBottom: space.s40 },
    columns: { flexDirection: 'row', gap: space.s12, flex: 1 },
    column: { flex: 1, gap: space.s12, padding: space.s12, borderRadius: radius.lg, backgroundColor: colors.surfaceSunk, minHeight: size.storeCard },
    columnHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    columnList: { gap: space.s12, paddingBottom: space.s24 },
    etas: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const VendorOrdersScreen: React.FC = () => (
  <ServiceScope service="food">
    <VendorOrdersContent />
  </ServiceScope>
);

/** The time quoted at checkout, snapped to the nearest chip. */
const defaultEta = (c: BoardCard) => {
  const quoted = c.promisedAt ? Math.round((Date.parse(c.promisedAt) - Date.parse(c.placedAt)) / 60_000) : 30;
  return ETA_CHOICES.reduce((best, m) => (Math.abs(m - quoted) < Math.abs(best - quoted) ? m : best), ETA_CHOICES[0]);
};

const VendorOrdersContent: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { space } = useTheme();
  const business = useAppSelector(selectBusiness);
  const live = !!business?.food?.isLive;
  const b = useAppSelector(selectVendorBoard);
  const unseen = useAppSelector(selectUnseenCount);
  const layout = useLayoutClass();
  const now = useNow(1000);
  const [alert, setAlert] = useState<OrderAlertState>(orderAlert.state);

  const refetch = useCallback(() => void dispatch(loadBoardAsync()), [dispatch]);
  useFocusEffect(
    useCallback(() => {
      if (!live) return;
      refetch();
      void dispatch(loadKitchenAsync());
    }, [dispatch, live, refetch]),
  );

  const status = useVendorBoard(
    {
      onSync: s => dispatch(boardSynced(s.orders)),
      onNew: c => {
        dispatch(boardNewOrder(c));
        dispatch(setBoardColumn('new'));
      },
      onUpdate: u => dispatch(boardOrderUpdated(u)),
      onPayment: refetch,
      refetch,
    },
    live,
  );

  // Ring while a new order hasn't been opened; quiet once every one has.
  useEffect(() => orderAlert.subscribe(setAlert), []);
  useEffect(() => {
    if (unseen > 0) orderAlert.start();
    else orderAlert.stop();
  }, [unseen]);
  useEffect(() => () => orderAlert.stop(), []);

  // Awake while the board is open.
  useEffect(() => {
    if (!live) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      try {
        void deactivateKeepAwake(KEEP_AWAKE_TAG);
      } catch {
        /* not supported here (a browser without wake lock) */
      }
    };
  }, [live]);

  if (!live) {
    return (
      <ScreenShell title="Orders" subtitle={business?.name}>
        <EmptyState icon="check-square" title="Finish your setup" body="Customers can order once your kitchen is live." action={{ label: 'Open setup', onPress: () => navigation.navigate('VendorSetup') }} />
      </ScreenShell>
    );
  }

  const counts = columnCounts(b.cards);
  const open = (c: BoardCard) => {
    dispatch(markOrderSeen(c.id));
    navigation.navigate('VendorOrder', { id: c.id });
  };
  const onMove = (c: BoardCard, move: VendorMove) => {
    if (move === 'accept') return void dispatch(openAccept(c.id));
    if (move === 'check-transfer') return open(c);
    if (move === 'assign') {
      dispatch(markOrderSeen(c.id));
      return navigation.navigate('VendorOrder', { id: c.id, assign: true });
    }
    haptics.press();
    void dispatch(moveOrderAsync({ id: c.id, move: move as BoardMove }));
  };
  const ticket = (c: BoardCard) => (
    <OrderTicket key={c.id} card={c} now={now} busy={b.busyId === c.id} onOpen={() => open(c)} onMove={m => onMove(c, m)} onDecline={() => dispatch(openReject(c.id))} />
  );
  const inColumn = (col: BoardColumn) => b.cards.filter(c => columnOf(c.status) === col);

  const profile = b.profile;
  const busy = !!profile?.branch.busy;
  const paused = !!profile?.branch.isPaused;
  const acceptCard = b.cards.find(c => c.id === b.acceptFor) ?? null;
  const rejectCard = b.cards.find(c => c.id === b.rejectFor) ?? null;

  return (
    <ScreenShell title="Orders" subtitle={profile?.branch.openState.label ?? business?.name} scroll={false}>
      {alert.blocked ? <InlineNotice tone="warning" message="Your browser is holding back the new-order sound." action={{ label: 'Turn on order sound', onPress: () => orderAlert.unlock() }} /> : null}
      {paused ? (
        <InlineNotice
          tone="warning"
          title="Paused: customers can’t order"
          message={profile?.branch.pauseMessage ?? 'Your kitchen is hidden from lists until you resume.'}
          action={{ label: 'Resume orders', onPress: () => void dispatch(switchKitchenAsync({ resume: true })) }}
        />
      ) : (
        <View style={styles.switches}>
          <ChoiceChip
            label={busy ? 'Busy · +15 min' : 'Busy? Add 15 min'}
            selected={busy}
            onPress={() => void dispatch(switchKitchenAsync({ busy: busy ? 0 : 15 }))}
          />
          <ChoiceChip label="Pause orders" selected={false} onPress={() => void dispatch(switchKitchenAsync({ pause: null }))} />
        </View>
      )}
      {b.actionError.message && !b.acceptFor && !b.rejectFor ? <InlineNotice message={b.actionError.message} /> : null}
      {b.status === 'failed' ? <InlineNotice message={b.error.message} action={{ label: 'Try again', onPress: refetch }} /> : null}
      {status !== 'connected' && b.status === 'succeeded' ? (
        <AppText variant="caption" tone="muted">
          Reconnecting… the board still refreshes every few seconds.
        </AppText>
      ) : null}

      {b.status === 'loading' && !b.cards.length ? (
        <SkeletonLines lines={8} />
      ) : layout === 'tablet' ? (
        <View style={styles.columns}>
          {BOARD_COLUMNS.map(col => (
            <View key={col.key} style={styles.column} accessibilityLabel={`${col.label}, ${counts[col.key]} orders`}>
              <View style={styles.columnHead}>
                <AppText variant="title">{col.label}</AppText>
                <AppText variant="bodyStrong" tone="muted">
                  {String(counts[col.key])}
                </AppText>
              </View>
              <ScrollView contentContainerStyle={styles.columnList}>
                {inColumn(col.key).map(ticket)}
                {!counts[col.key] ? (
                  <AppText variant="small" tone="muted">
                    {col.key === 'new' ? 'New orders ring here.' : 'Nothing here.'}
                  </AppText>
                ) : null}
              </ScrollView>
            </View>
          ))}
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
            {BOARD_COLUMNS.map(col => (
              <ChoiceChip key={col.key} label={`${col.label} · ${counts[col.key]}`} selected={b.column === col.key} onPress={() => dispatch(setBoardColumn(col.key))} />
            ))}
          </ScrollView>
          <FlatList
            data={inColumn(b.column)}
            keyExtractor={c => c.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => ticket(item)}
            refreshing={false}
            onRefresh={refetch}
            ListEmptyComponent={
              <EmptyState
                icon="inbox"
                title={b.column === 'new' ? 'No new orders' : 'Nothing here right now'}
                body={b.column === 'new' ? 'New orders ring here and wait for your answer. Keep this screen open.' : 'Orders move along as you tap.'}
              />
            }
          />
        </>
      )}

      <Sheet
        visible={!!acceptCard}
        onClose={() => dispatch(openAccept(null))}
        title={acceptCard ? `Accept ${acceptCard.code}` : 'Accept'}
        subtitle={
          acceptCard?.scheduledFor
            ? `For ${formatSlot(acceptCard.scheduledFor, 'Asia/Karachi')}`
            : acceptCard?.fulfilment === 'pickup'
              ? 'How long until it’s ready to collect?'
              : 'How long until it reaches the customer?'
        }
      >
        {b.actionError.message ? <InlineNotice message={b.actionError.message} /> : null}
        {acceptCard?.scheduledFor ? (
          <Button
            label={`Accept for ${formatSlot(acceptCard.scheduledFor, 'Asia/Karachi')}`}
            loading={b.busyId === acceptCard.id}
            onPress={() => void dispatch(acceptOrderAsync({ id: acceptCard.id, eta: 30 }))}
            fullWidth
          />
        ) : acceptCard ? (
          <>
            <View style={[styles.etas, { marginBottom: space.s8 }]}>
              {ETA_CHOICES.map(m => (
                <ChoiceChip
                  key={m}
                  label={`${m} min`}
                  selected={m === defaultEta(acceptCard)}
                  onPress={() => {
                    haptics.success();
                    void dispatch(acceptOrderAsync({ id: acceptCard.id, eta: m }));
                  }}
                />
              ))}
            </View>
            <AppText variant="small" tone="muted">
              The customer sees this time. Tap one to accept.
            </AppText>
          </>
        ) : null}
      </Sheet>

      <Sheet visible={!!rejectCard} onClose={() => dispatch(openReject(null))} title={rejectCard ? `Decline ${rejectCard.code}?` : 'Decline'} subtitle="The customer is told why, and isn’t charged.">
        {b.actionError.message ? <InlineNotice message={b.actionError.message} /> : null}
        {REJECT_REASONS.map(r => (
          <ChoiceLine
            key={r.key}
            label={r.label}
            price={null}
            selected={false}
            multiple={false}
            disabled={b.busyId === rejectCard?.id}
            onPress={() => rejectCard && void dispatch(rejectOrderAsync({ id: rejectCard.id, reason: r.key }))}
          />
        ))}
        <Button label="Keep the order" variant="secondary" onPress={() => dispatch(openReject(null))} fullWidth />
      </Sheet>
    </ScreenShell>
  );
};

export default VendorOrdersScreen;
