// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: Orders (the board)
// ═══════════════════════════════════════════════════════
// New · Cooking · Ready · Out for delivery: chips with counts inside the
// header on a phone, four columns side by side from tablet width. A new
// order rings (and vibrates) until it is opened or answered, and shows the
// time left to answer; Accept asks for a time, then confirms; Decline asks
// for a reason, then confirms. The kitchen's state — open, busy (+15 min
// for an hour), paused (with a private reason and when it lifts by itself)
// — is one chip in the header. The board is live on every tab
// (VendorBoardHost: the socket, the ring, the spoken order); this screen
// draws it and stays awake while it's open. The kitchen's side (docs/API_KITCHEN.md):
// a new order is spoken out loud after the chime (Settings: Urdu, English
// or off), the mic in the header answers orders by voice, tickets say when
// stock runs low, the usual prep time is offered first, and "Ready" waits
// for a packing photo when the kitchen asks for one.

import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useLayoutClass } from '../../hooks/useLayoutClass';
import { useRealtimeStatus } from '../../hooks/useRealtime';
import { BOARD_COLUMNS, DEFAULT_PREP_MINUTES, ETA_CHOICES, REJECT_REASONS, columnCounts, columnOf, type BoardColumn, type VendorMove } from '../../models/food/foodStatusModel';
import { needsPackingPhoto, pausedNote, resumeAtOf, suggestedEta, ticketStockNote } from '../../models/kitchen/boardModel';
import { PAUSE_DURATIONS, PAUSE_REASONS, PAUSE_REASON_LABEL } from '../../models/kitchen/kitchenStatusModel';
import { VoiceSheetButton } from '../../Components/voice/VoiceSheet';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, ChoiceChip, CountIconButton, EmptyState, InlineNotice, ScreenShell, Sheet, StoreMark } from '../../Custom-Components/index';
import { TicketSkeleton } from '../../Custom-Components/food/FoodSkeletons';
import { SectionHead } from '../../Components/admin/AdminParts';
import { selectUnreadCount } from '../notifications-screen/notificationsSlice';
import { ChoiceLine } from '../../Custom-Components/food/ChoiceLine';
import { OrderTicket } from '../../Custom-Components/food/OrderTicket';
import type { BoardCard, PauseReason, VoiceAction } from '../../models';
import { orderAlert, type OrderAlertState } from '../../services/orderAlert';
import { formatSlot } from '../../utils/health-time/healthTime';
import { haptics } from '../../utils/haptics/haptics';
import { selectBusiness } from '../../store/authSlice';
import {
  acceptOrderAsync,
  loadBoardAsync,
  loadKitchenAsync,
  markOrderSeen,
  moveOrderAsync,
  openAccept,
  openPause,
  openReject,
  rejectOrderAsync,
  soldOutDishAsync,
  selectVendorBoard,
  setBoardColumn,
  switchKitchenAsync,
  type BoardMove,
} from './vendorBoardSlice';

type Nav = { navigate: (name: string, params?: object) => void };

const KEEP_AWAKE_TAG = 'food-board';

const makeStyles = ({ space, gutter, colors, size, radius }: Theme) =>
  StyleSheet.create({
    chipRail: { marginHorizontal: -gutter },
    chips: { flexDirection: 'row', gap: space.s8, paddingHorizontal: gutter },
    mark: { borderRadius: radius.pill, borderWidth: size.focusBorder, borderColor: colors.onScrimLine },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    list: { gap: space.s12, paddingBottom: space.s40 },
    columns: { flexDirection: 'row', gap: space.s12, flex: 1 },
    column: { flex: 1, minWidth: size.boardColumn },
    columnList: { gap: space.s12, paddingBottom: space.s24 },
    etas: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    group: { gap: space.s8 },
    sheetButtons: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1 },
  });

const VendorOrders: React.FC = () => (
  <ServiceScope service="food">
    <VendorOrdersContent />
  </ServiceScope>
);

const VendorOrdersContent: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const business = useAppSelector(selectBusiness);
  const live = !!business?.food?.isLive;
  const b = useAppSelector(selectVendorBoard);
  const unread = useAppSelector(selectUnreadCount);
  const layout = useLayoutClass();
  const [alert, setAlert] = useState<OrderAlertState>(orderAlert.state);
  const [pauseReason, setPauseReason] = useState<PauseReason | null>(null);
  const [pauseFor, setPauseFor] = useState<number | null>(PAUSE_DURATIONS[1].minutes);
  const [eta, setEta] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const status = useRealtimeStatus();

  const refetch = useCallback(() => void dispatch(loadBoardAsync()), [dispatch]);
  useFocusEffect(
    useCallback(() => {
      if (!live) return;
      refetch();
      void dispatch(loadKitchenAsync());
    }, [dispatch, live, refetch]),
  );

  // The ring itself lives in VendorBoardHost; this only shows when a browser holds it back.
  useEffect(() => orderAlert.subscribe(setAlert), []);

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
        <EmptyState ion="checkbox-outline" title="Finish your setup" body="Customers can order once your kitchen is live." action={{ label: 'Open setup', onPress: () => navigation.navigate('VendorSetup') }} />
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
    // The kitchen asks for a packing photo first: the order page takes it, then marks it ready.
    if (move === 'ready' && needsPackingPhoto(c, b.hints?.packingPhoto)) {
      dispatch(markOrderSeen(c.id));
      return navigation.navigate('VendorOrder', { id: c.id, packing: true });
    }
    if (move === 'check-transfer') return open(c);
    if (move === 'assign') {
      dispatch(markOrderSeen(c.id));
      return navigation.navigate('VendorOrder', { id: c.id, assign: true });
    }
    haptics.press();
    void dispatch(moveOrderAsync({ id: c.id, move: move as BoardMove }));
  };
  const ticket = (c: BoardCard) => (
    <OrderTicket
      key={c.id}
      card={c}
      busy={b.busyId === c.id}
      note={ticketStockNote(c, b.hints)}
      onOpen={() => open(c)}
      onMove={m => onMove(c, m)}
      onDecline={() => dispatch(openReject(c.id))}
    />
  );
  const inColumn = (col: BoardColumn) => b.cards.filter(c => columnOf(c.status) === col);

  const profile = b.profile;
  const busy = !!profile?.branch.busy;
  const paused = !!profile?.branch.isPaused;
  const acceptCard = b.cards.find(c => c.id === b.acceptFor) ?? null;
  const rejectCard = b.cards.find(c => c.id === b.rejectFor) ?? null;

  /** A confirmed spoken command → the board's own moves. True when it went through. */
  const runSpoken = async (a: VoiceAction): Promise<boolean> => {
    haptics.press();
    switch (a.kind) {
      case 'order.accept': {
        dispatch(markOrderSeen(a.orderId));
        const card = b.cards.find(c => c.id === a.orderId);
        const r = await dispatch(acceptOrderAsync({ id: a.orderId, eta: a.etaMinutes ?? (card ? suggestedEta(card, b.hints) : DEFAULT_PREP_MINUTES) }));
        return acceptOrderAsync.fulfilled.match(r);
      }
      case 'order.reject': {
        dispatch(markOrderSeen(a.orderId));
        const r = await dispatch(rejectOrderAsync({ id: a.orderId, reason: a.reason }));
        return rejectOrderAsync.fulfilled.match(r);
      }
      case 'order.ready': {
        const card = b.cards.find(c => c.id === a.orderId);
        if (card && needsPackingPhoto(card, b.hints?.packingPhoto)) {
          navigation.navigate('VendorOrder', { id: card.id, packing: true });
          return true;
        }
        const r = await dispatch(moveOrderAsync({ id: a.orderId, move: 'ready' }));
        return moveOrderAsync.fulfilled.match(r);
      }
      case 'item.unavailable': {
        const r = await dispatch(soldOutDishAsync(a.itemId));
        return soldOutDishAsync.fulfilled.match(r);
      }
      case 'vendor.busy': {
        const r = await dispatch(switchKitchenAsync({ busy: a.extraMinutes }));
        return switchKitchenAsync.fulfilled.match(r);
      }
      default:
        return false;
    }
  };

  const acceptEta = acceptCard ? suggestedEta(acceptCard, b.hints) : null;
  const chosenEta = eta ?? acceptEta ?? DEFAULT_PREP_MINUTES;
  const pull = async () => {
    setRefreshing(true);
    await dispatch(loadBoardAsync());
    setRefreshing(false);
  };
  const stateChip = paused
    ? { label: 'Paused', icon: 'pause-circle-outline' as const }
    : busy
      ? { label: 'Busy · +15 min', icon: 'hourglass-outline' as const }
      : { label: 'Open', icon: 'radio-button-on-outline' as const };

  return (
    <ScreenShell
      title="Orders"
      subtitle={[business?.name, profile?.branch.openState.label].filter(Boolean).join(' · ') || undefined}
      scroll={false}
      headerLeading={
        profile ? (
          <View style={styles.mark}>
            <StoreMark store={{ name: profile.name, logoUrl: profile.logoUrl, brandColor: profile.brandColor }} size="md" />
          </View>
        ) : null
      }
      headerRight={
        <View style={styles.headerActions}>
          <VoiceSheetButton
            context="board"
            title="Speak to the board"
            busy={b.busyId !== null || b.switching}
            onConfirm={async a => {
              const ok = await runSpoken(a);
              if (ok) haptics.success();
              else haptics.warning();
              return ok;
            }}
          />
          <CountIconButton icon="notifications-outline" count={unread} onPress={() => navigation.navigate('Notifications')} label="Notifications" />
        </View>
      }
      headerContent={
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRail} contentContainerStyle={styles.chips}>
          {/* The kitchen's state: one chip that opens what can change it. */}
          <ChoiceChip
            label={stateChip.label}
            icon={stateChip.icon}
            selected={paused || busy}
            onPress={() => (paused ? void dispatch(switchKitchenAsync({ resume: true })) : dispatch(openPause(true)))}
            accessibilityHint={paused ? 'Resumes orders' : 'Pause orders, or say you’re busy'}
          />
          {layout === 'tablet'
            ? null
            : BOARD_COLUMNS.map(col => <ChoiceChip key={col.key} label={col.label} count={counts[col.key]} selected={b.column === col.key} onPress={() => dispatch(setBoardColumn(col.key))} />)}
        </ScrollView>
      }>
      {alert.blocked ? <InlineNotice tone="warning" message="Your browser is holding back the new-order sound." action={{ label: 'Turn on order sound', onPress: () => orderAlert.unlock() }} /> : null}
      {paused ? (
        <InlineNotice
          tone="warning"
          title="Paused: customers can’t order"
          message={profile ? pausedNote(profile.branch, 'Asia/Karachi') : 'Your kitchen is hidden from lists until you resume.'}
          action={{ label: 'Resume orders', onPress: () => void dispatch(switchKitchenAsync({ resume: true })) }}
        />
      ) : null}
      {b.actionError.message && !b.acceptFor && !b.rejectFor ? <InlineNotice message={b.actionError.message} /> : null}
      {b.status === 'failed' ? <InlineNotice message={b.error.message} action={{ label: 'Try again', onPress: refetch }} /> : null}
      {status !== 'connected' && b.status === 'succeeded' ? (
        <AppText variant="caption" tone="muted">
          Reconnecting… the board still refreshes every few seconds.
        </AppText>
      ) : null}

      {b.status === 'loading' && !b.cards.length ? (
        <TicketSkeleton />
      ) : layout === 'tablet' ? (
        <ScrollView horizontal contentContainerStyle={styles.columns}>
          {BOARD_COLUMNS.map(col => (
            <View key={col.key} style={styles.column}>
              <Card>
                <SectionHead title={`${col.label} · ${counts[col.key]}`} />
                <ScrollView contentContainerStyle={styles.columnList}>
                  {inColumn(col.key).map(ticket)}
                  {!counts[col.key] ? (
                    <AppText variant="small" tone="muted">
                      {col.key === 'new' ? 'New orders ring here.' : 'Nothing here.'}
                    </AppText>
                  ) : null}
                </ScrollView>
              </Card>
            </View>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={inColumn(b.column)}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => ticket(item)}
          refreshing={refreshing}
          onRefresh={() => void pull()}
          ListEmptyComponent={
            <EmptyState
              ion="file-tray-outline"
              title={b.column === 'new' ? 'No new orders' : 'Nothing here right now'}
              body={b.column === 'new' ? 'New orders ring here and wait for your answer, on any tab.' : 'Orders move along as you tap.'}
            />
          }
        />
      )}

      <Sheet
        visible={!!acceptCard}
        onClose={() => {
          setEta(null);
          dispatch(openAccept(null));
        }}
        title={acceptCard ? `Accept ${acceptCard.code}` : 'Accept'}
        subtitle={
          acceptCard?.scheduledFor
            ? `For ${formatSlot(acceptCard.scheduledFor, 'Asia/Karachi')}`
            : acceptCard?.fulfilment === 'pickup'
              ? 'How long until it’s ready to collect?'
              : 'How long until it reaches the customer?'
        }
        footer={
          acceptCard ? (
            <Button
              label={acceptCard.scheduledFor ? `Accept for ${formatSlot(acceptCard.scheduledFor, 'Asia/Karachi')}` : `Accept · ${chosenEta} min`}
              loading={b.busyId === acceptCard.id}
              onPress={() => {
                haptics.success();
                // A scheduled order has its own time; the API still takes a prep estimate.
                void dispatch(acceptOrderAsync({ id: acceptCard.id, eta: acceptCard.scheduledFor ? DEFAULT_PREP_MINUTES : chosenEta }));
                setEta(null);
              }}
              fullWidth
            />
          ) : undefined
        }
      >
        {b.actionError.message ? <InlineNotice message={b.actionError.message} /> : null}
        {acceptCard && !acceptCard.scheduledFor ? (
          <>
            <View style={styles.etas} accessibilityRole="radiogroup" accessibilityLabel="Time to the customer">
              {ETA_CHOICES.map(m => (
                <ChoiceChip key={m} label={`${m} min`} selected={m === chosenEta} onPress={() => setEta(m)} />
              ))}
            </View>
            <AppText variant="small" tone="muted">
              {b.hints?.prepHint ? `${b.hints.prepHint.label}. The customer sees the time you pick.` : 'The customer sees the time you pick.'}
            </AppText>
          </>
        ) : null}
      </Sheet>

      <Sheet
        visible={!!rejectCard}
        onClose={() => {
          setRejectReason(null);
          dispatch(openReject(null));
        }}
        title={rejectCard ? `Decline ${rejectCard.code}?` : 'Decline'}
        subtitle="The customer is told why, and isn’t charged."
        footer={
          <View style={styles.sheetButtons}>
            <View style={styles.half}>
              <Button label="Keep it" variant="secondary" onPress={() => dispatch(openReject(null))} fullWidth />
            </View>
            <View style={styles.half}>
              <Button
                label="Decline"
                variant="destructive"
                disabled={!rejectReason}
                loading={b.busyId === rejectCard?.id}
                onPress={() => {
                  if (rejectCard && rejectReason) void dispatch(rejectOrderAsync({ id: rejectCard.id, reason: rejectReason }));
                  setRejectReason(null);
                }}
                fullWidth
              />
            </View>
          </View>
        }>
        {b.actionError.message ? <InlineNotice message={b.actionError.message} /> : null}
        <View accessibilityRole="radiogroup" accessibilityLabel="Why you’re declining">
          {REJECT_REASONS.map(r => (
            <ChoiceLine key={r.key} label={r.label} price={null} selected={rejectReason === r.key} multiple={false} disabled={b.busyId === rejectCard?.id} onPress={() => setRejectReason(r.key)} />
          ))}
        </View>
      </Sheet>

      <Sheet
        visible={b.pauseOpen}
        onClose={() => dispatch(openPause(false))}
        title="Busy, or pause?"
        subtitle="A pause stops new orders until it lifts. Orders already in carry on."
        footer={
          <Button
            label={pauseFor === null ? 'Pause until I resume' : `Pause for ${PAUSE_DURATIONS.find(d => d.minutes === pauseFor)?.label ?? `${pauseFor} min`}`}
            loading={b.switching}
            onPress={() => {
              haptics.press();
              void dispatch(switchKitchenAsync({ pause: null, reason: pauseReason, resumeAt: resumeAtOf(pauseFor, Date.now()) }));
            }}
            fullWidth
          />
        }>
        {b.actionError.message ? <InlineNotice message={b.actionError.message} /> : null}
        <View style={styles.group}>
          <AppText variant="title" accessibilityRole="header">
            Just busy?
          </AppText>
          <ChoiceChip
            label={busy ? 'Busy · +15 min (tap to stop)' : 'Add 15 min to every order for an hour'}
            icon="hourglass-outline"
            selected={busy}
            onPress={() => {
              void dispatch(switchKitchenAsync({ busy: busy ? 0 : 15 }));
              dispatch(openPause(false));
            }}
          />
        </View>
        <View style={styles.group}>
          <AppText variant="title" accessibilityRole="header">
            Why pause (only you see this)
          </AppText>
          <View style={styles.etas}>
            {PAUSE_REASONS.map(r => (
              <ChoiceChip key={r} label={PAUSE_REASON_LABEL[r]} selected={pauseReason === r} onPress={() => setPauseReason(pauseReason === r ? null : r)} />
            ))}
          </View>
        </View>
        <View style={styles.group}>
          <AppText variant="title" accessibilityRole="header">
            For how long
          </AppText>
          <View style={styles.etas}>
            {PAUSE_DURATIONS.map(d => (
              <ChoiceChip key={d.label} label={d.label} selected={pauseFor === d.minutes} onPress={() => setPauseFor(d.minutes)} />
            ))}
          </View>
        </View>
      </Sheet>
    </ScreenShell>
  );
};

export default VendorOrders;
