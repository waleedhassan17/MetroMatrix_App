// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen growth: tiffin subscribers
// ═══════════════════════════════════════════════════════
// Requests to answer (approve, or decline with a reason), people on a plan
// (pause, resume, end), and each one's period: what it costs and whether it
// is paid (a transfer to check, or cash taken). One plan's, from its row on
// Tiffin, or everyone's, from a count there or a hub card.

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { TIFFIN_STATUS, tiffinPaymentStatus } from '../../models/kitchen/kitchenStatusModel';
import { periodAmountLabel, periodLabel, scheduleLabel } from '../../models/kitchen/tiffinModel';
import { PAYMENT_REJECT_REASONS } from '../../models/food/foodStatusModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, ChoiceChip, EmptyState, IconButton, InlineNotice, ScreenShell, Sheet, SkeletonLines, StatusPill, TextAction } from '../../Custom-Components/index';
import { ChoiceLine } from '../../Custom-Components/food/ChoiceLine';
import type { FoodVendorStackParamList, TiffinSubscription } from '../../models';
import { formatDayShort } from '../../utils/health-time/healthTime';
import { formatPkPhoneForDisplay } from '../../utils/phone/phone';
import { callNumber } from '../../utils/maps/maps';
import { haptics } from '../../utils/haptics/haptics';
import { loadSubscribersAsync, selectTiffinSubscribers, setSubscribersTab, subscriberActAsync, type SubscriberAct, type SubscribersTab } from './tiffinSubscribersSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'GrowthTiffinSubscribers'>;

const DECLINE_REASONS = ['The plan is full', 'We don’t deliver to that area', 'We can’t start on that day'];

const inTab = (s: TiffinSubscription, tab: SubscribersTab) => (tab === 'ended' ? ['ended', 'cancelled', 'declined'].includes(s.status) : s.status === tab);

const makeStyles = ({ space, gutter }: Theme) =>
  StyleSheet.create({
    chipBar: { flexGrow: 0, flexShrink: 0 },
    chips: { flexDirection: 'row', gap: space.s8, paddingRight: gutter },
    gap: { gap: space.s8 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    grow: { flex: 1, gap: space.s4, minWidth: 0 },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    actions: { flexDirection: 'row', gap: space.s8 },
    half: { flex: 1 },
  });

const TiffinSubscribers: React.FC<Props> = props => (
  <ServiceScope service="food">
    <TiffinSubscribersContent {...props} />
  </ServiceScope>
);

const TiffinSubscribersContent: React.FC<Props> = ({ navigation, route }) => {
  const planId = route.params?.planId ?? null;
  const { back } = useBack({ name: 'GrowthTiffin' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectTiffinSubscribers);
  const [declining, setDeclining] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ code: string; periodId: string } | null>(null);

  const wantTab = route.params?.status;
  useEffect(() => {
    if (wantTab) dispatch(setSubscribersTab(wantTab));
  }, [dispatch, wantTab]);
  const load = useCallback(() => void dispatch(loadSubscribersAsync(planId)), [dispatch, planId]);
  useFocusEffect(load);

  const act = async (code: string, a: SubscriberAct, done: string) => {
    haptics.press();
    const r = await dispatch(subscriberActAsync({ code, act: a }));
    if (subscriberActAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: done });
      return true;
    }
    haptics.warning();
    return false;
  };

  const inbox = s.planId === planId ? s.inbox : null;
  const items = inbox?.items.filter(x => inTab(x, s.tab)) ?? [];
  const ended = inbox?.items.filter(x => inTab(x, 'ended')).length ?? 0;
  const tabs: { key: SubscribersTab; label: string }[] = [
    { key: 'pending', label: `To approve · ${inbox?.counts.pending ?? 0}` },
    { key: 'active', label: `Active · ${inbox?.counts.active ?? 0}` },
    { key: 'paused', label: `Paused · ${inbox?.counts.paused ?? 0}` },
    { key: 'ended', label: `Ended · ${ended}` },
  ];

  const card = (x: TiffinSubscription) => {
    const busy = s.acting === x.code;
    const pay = x.period ? tiffinPaymentStatus(x.period.payment.status) : null;
    const periodId = x.period?.id;
    return (
      <Card key={x.code}>
        <View style={styles.gap}>
          <View style={styles.head}>
            <View style={styles.grow}>
              <AppText variant="title">{x.customer?.name ?? 'Customer'}</AppText>
              <AppText variant="small" tone="muted">
                {[x.customer?.phone ? formatPkPhoneForDisplay(x.customer.phone) : null, x.address?.area, `from ${formatDayShort(x.startDate)}`].filter(Boolean).join(' · ')}
              </AppText>
            </View>
            {x.customer?.phone ? <IconButton icon="call-outline" accessibilityLabel={`Call ${x.customer.name}`} onPress={() => callNumber(x.customer!.phone!)} /> : null}
          </View>
          <View style={styles.pills}>
            <StatusPill label={TIFFIN_STATUS[x.status].vendorLabel} tone={TIFFIN_STATUS[x.status].tone} />
            {pay ? <StatusPill label={pay.vendorLabel} tone={pay.tone} /> : null}
            {!planId ? <StatusPill label={x.plan.name} /> : null}
          </View>
          {x.period ? (
            <AppText variant="small">
              {`${periodLabel(x.period)}: ${periodAmountLabel(x.period, x.plan.perMeal)}${x.period.payment.reference ? ` · ref ${x.period.payment.reference}` : ''}`}
            </AppText>
          ) : (
            <AppText variant="small" tone="muted">
              {scheduleLabel(x.plan)} · {x.plan.mode === 'delivery' ? 'Delivered' : 'Collected'} · pays by {x.paymentMethod === 'transfer' ? 'transfer' : 'cash'}
            </AppText>
          )}
          {x.nextDelivery && x.status !== 'pending' ? (
            <AppText variant="caption" tone="muted">
              {`Next: ${formatDayShort(x.nextDelivery.date)} · ${x.nextDelivery.dishes.join(', ')}`}
            </AppText>
          ) : null}
          {x.declineReason || x.endReason ? (
            <AppText variant="caption" tone="muted">
              {x.declineReason ?? x.endReason}
            </AppText>
          ) : null}

          {x.status === 'pending' ? (
            <View style={styles.actions}>
              <View style={styles.half}>
                <Button label="Decline" variant="secondary" size="sm" disabled={busy} onPress={() => setDeclining(x.code)} fullWidth />
              </View>
              <View style={styles.half}>
                <Button label="Approve" size="sm" loading={busy} onPress={() => void act(x.code, { kind: 'approve' }, `${x.customer?.name ?? 'Subscriber'} starts ${formatDayShort(x.startDate)}`)} fullWidth />
              </View>
            </View>
          ) : null}
          {periodId && ['proof_submitted', 'awaiting_transfer', 'unpaid'].includes(x.period!.payment.status) && ['active', 'paused'].includes(x.status) ? (
            <View style={styles.actions}>
              {x.period!.payment.status === 'proof_submitted' ? (
                <View style={styles.half}>
                  <Button label="Not received" variant="secondary" size="sm" disabled={busy} onPress={() => setRejecting({ code: x.code, periodId })} fullWidth />
                </View>
              ) : null}
              <View style={styles.half}>
                <Button
                  label={x.paymentMethod === 'cash' ? 'Cash received' : 'The money is in'}
                  size="sm"
                  variant={x.period!.payment.status === 'proof_submitted' ? 'primary' : 'secondary'}
                  loading={busy}
                  onPress={() => void act(x.code, { kind: 'confirm-payment', periodId }, 'Period paid')}
                  fullWidth
                />
              </View>
            </View>
          ) : null}
          {x.status === 'active' ? (
            <View style={styles.actions}>
              <TextAction label="Pause" icon="pause-outline" onPress={() => void act(x.code, { kind: 'pause' }, 'Paused until you resume it')} disabled={busy} />
              <TextAction label="End" tone="danger" onPress={() => void act(x.code, { kind: 'end' }, 'Subscription ended')} disabled={busy} />
            </View>
          ) : x.status === 'paused' ? (
            <View style={styles.actions}>
              <TextAction label="Resume" icon="play-outline" onPress={() => void act(x.code, { kind: 'resume' }, 'Resumed')} disabled={busy} />
              <TextAction label="End" tone="danger" onPress={() => void act(x.code, { kind: 'end' }, 'Subscription ended')} disabled={busy} />
            </View>
          ) : null}
        </View>
      </Card>
    );
  };

  return (
    <ScreenShell
      title={s.plan && planId ? s.plan.name : 'Subscribers'}
      subtitle={s.plan && planId ? `${s.plan.subscribers} of ${s.plan.capacity} places · ${s.plan.window.label}` : 'Everyone on your tiffin plans'}
      onBack={back}
      refreshing={s.status === 'loading' && !!inbox}
      onRefresh={load}
      headerRight={planId ? <IconButton icon="create-outline" accessibilityLabel="Edit the plan" onPress={() => navigation.navigate('GrowthTiffinPlanForm', { id: planId })} /> : undefined}>
      {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : null}
      {s.actionError.message && !declining && !rejecting ? <InlineNotice message={s.actionError.message} /> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
        {tabs.map(t => (
          <ChoiceChip key={t.key} label={t.label} selected={s.tab === t.key} onPress={() => dispatch(setSubscribersTab(t.key))} />
        ))}
      </ScrollView>
      {!inbox ? (
        s.status === 'failed' ? null : <SkeletonLines lines={6} />
      ) : !items.length ? (
        <EmptyState
          icon="users"
          title={s.tab === 'pending' ? 'No requests to answer' : 'Nobody here'}
          body={s.tab === 'pending' ? 'New tiffin requests wait here for you to approve. Their first period is due once you do.' : 'Subscriptions move here as they change.'}
        />
      ) : (
        items.map(card)
      )}

      <Sheet visible={!!declining} onClose={() => setDeclining(null)} title="Decline this request?" subtitle="The customer is told why.">
        {s.actionError.message ? <InlineNotice message={s.actionError.message} /> : null}
        {DECLINE_REASONS.map(reason => (
          <ChoiceLine
            key={reason}
            label={reason}
            price={null}
            selected={false}
            multiple={false}
            disabled={s.acting !== null}
            onPress={async () => {
              if (declining && (await act(declining, { kind: 'decline', reason }, 'Declined'))) setDeclining(null);
            }}
          />
        ))}
        <Button label="Go back" variant="secondary" onPress={() => setDeclining(null)} fullWidth />
      </Sheet>

      <Sheet visible={!!rejecting} onClose={() => setRejecting(null)} title="Transfer not received" subtitle="The customer is told why and can send it again.">
        {s.actionError.message ? <InlineNotice message={s.actionError.message} /> : null}
        {PAYMENT_REJECT_REASONS.map(reason => (
          <ChoiceLine
            key={reason}
            label={reason}
            price={null}
            selected={false}
            multiple={false}
            disabled={s.acting !== null}
            onPress={async () => {
              if (rejecting && (await act(rejecting.code, { kind: 'reject-payment', periodId: rejecting.periodId, reason }, 'The customer has been told'))) setRejecting(null);
            }}
          />
        ))}
        <Button label="Go back" variant="secondary" onPress={() => setRejecting(null)} fullWidth />
      </Sheet>
    </ScreenShell>
  );
};

export default TiffinSubscribers;
