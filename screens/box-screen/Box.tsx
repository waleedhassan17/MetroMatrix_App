// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen: one Bachat Box
// ═══════════════════════════════════════════════════════
// How many are reserved, collected and left; each reservation with its
// pickup code, the customer, how it is paid, and the counter's move:
// hand it over, check a transfer first, or mark a no-show once the window
// has started. More or fewer boxes, or end it early (the ones reserved can
// still be collected).

import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useNow } from '../../hooks/useNow';
import { BOX_PAYMENT, BOX_STATUS, RESERVATION_STATUS, boxPaymentStatus } from '../../models/kitchen/kitchenStatusModel';
import { BACHAT_BOX, MAX_BOX_QUANTITY, discountLabel } from '../../models/kitchen/surplusModel';
import { PAYMENT_REJECT_REASONS } from '../../models/food/foodStatusModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, Divider, EmptyState, IconButton, InlineNotice, ScreenShell, Sheet, SkeletonLines, StatusPill, TextAction } from '../../Custom-Components/index';
import { ChoiceLine } from '../../Custom-Components/food/ChoiceLine';
import { StatGrid } from '../../Components/admin/AdminParts';
import type { FoodVendorStackParamList, SurplusReservation } from '../../models';
import { formatSlot } from '../../utils/health-time/healthTime';
import { formatPKR } from '../../utils/money/money';
import { cdn } from '../../utils/cdn/cdn';
import { haptics } from '../../utils/haptics/haptics';
import { boxActAsync, loadBoxAsync, selectKitchenBox, type BoxAct } from './boxSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenBox'>;

const TZ = 'Asia/Karachi';

const makeStyles = ({ space, radius, colors, size }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    grow: { flex: 1, gap: space.s4, minWidth: 0 },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    actions: { flexDirection: 'row', gap: space.s8 },
    half: { flex: 1 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    photo: { width: '100%', aspectRatio: size.railPhotoAspect, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
  });

const Box: React.FC<Props> = props => (
  <ServiceScope service="food">
    <BoxContent {...props} />
  </ServiceScope>
);

const BoxContent: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const { back } = useBack({ name: 'KitchenWaste' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectKitchenBox);
  const now = useNow(30_000);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  const load = useCallback(() => void dispatch(loadBoxAsync(id)), [dispatch, id]);
  useFocusEffect(load);

  const act = async (a: BoxAct, done: string) => {
    haptics.press();
    const r = await dispatch(boxActAsync({ id, act: a }));
    if (boxActAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: done });
      return true;
    }
    haptics.warning();
    return false;
  };

  const b = s.box?.id === id ? s.box : null;
  if (!b) {
    return (
      <ScreenShell title={BACHAT_BOX} onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={s.error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: load }} /> : <SkeletonLines lines={8} />}
      </ScreenShell>
    );
  }

  const started = Date.parse(b.pickupFrom) <= now;
  const open = b.status === 'live' || b.status === 'sold_out';
  const toCollect = b.reservations.filter(r => r.status === 'reserved');
  const done = b.reservations.filter(r => r.status !== 'reserved');

  const ticket = (r: SurplusReservation) => {
    const pay = boxPaymentStatus(r.payment.status);
    const transferPending = r.payment.method === 'transfer' && r.payment.status !== 'paid';
    const busy = s.acting === r.code;
    return (
      <Card key={r.code}>
        <View style={styles.gap}>
          <View style={styles.row}>
            <View style={styles.grow}>
              <AppText variant="title" selectable>
                {r.code}
              </AppText>
              <AppText variant="small" tone="muted">
                {`${r.customerName ?? 'Customer'} · ${r.quantity === 1 ? '1 box' : `${r.quantity} boxes`} · ${formatPKR(r.total)}`}
              </AppText>
            </View>
          </View>
          <View style={styles.pills}>
            <StatusPill label={RESERVATION_STATUS[r.status].vendorLabel} tone={RESERVATION_STATUS[r.status].tone} />
            <StatusPill label={r.status === 'reserved' ? pay.vendorLabel : BOX_PAYMENT[r.payment.method].label} tone={r.status === 'reserved' ? pay.tone : 'neutral'} />
          </View>
          {r.status === 'reserved' && r.payment.reference ? (
            <AppText variant="small">
              {`Transfer reference: `}
              <AppText variant="bodyStrong" selectable>
                {r.payment.reference}
              </AppText>
            </AppText>
          ) : null}
          {r.status === 'reserved' ? (
            transferPending ? (
              <View style={styles.actions}>
                {r.payment.status === 'proof_submitted' ? (
                  <View style={styles.half}>
                    <Button label="Not received" variant="secondary" size="sm" onPress={() => setRejectFor(r.code)} disabled={busy} fullWidth />
                  </View>
                ) : null}
                <View style={styles.half}>
                  <Button label="The money is in" size="sm" loading={busy} onPress={() => void act({ kind: 'confirm-payment', code: r.code }, 'Transfer confirmed')} fullWidth />
                </View>
              </View>
            ) : (
              <Button
                label={r.payment.method === 'pay_at_pickup' ? `Collected · ${formatPKR(r.total)} in cash` : 'Collected'}
                size="sm"
                loading={busy}
                onPress={() => void act({ kind: 'collect', code: r.code }, 'Handed over')}
                fullWidth
              />
            )
          ) : r.collectedAt ? (
            <AppText variant="caption" tone="muted">
              {`Collected at ${formatSlot(r.collectedAt, TZ)}`}
            </AppText>
          ) : null}
          {r.status === 'reserved' && started ? <TextAction label="They didn’t come" tone="muted" onPress={() => void act({ kind: 'no-show', code: r.code }, 'Marked as not collected')} disabled={busy} /> : null}
        </View>
      </Card>
    );
  };

  return (
    <ScreenShell title={b.title} subtitle={`Pickup ${b.pickupLabel}`} onBack={back} refreshing={s.status === 'loading'} onRefresh={load}>
      {s.actionError.message && !rejectFor ? <InlineNotice message={s.actionError.message} /> : null}
      {b.photoUrl ? <Image source={cdn(b.photoUrl, { w: 640 }) ?? undefined} style={styles.photo} contentFit="cover" accessibilityLabel={`${b.title}: photo`} /> : null}
      <View style={styles.pills}>
        <StatusPill label={BOX_STATUS[b.status].label} tone={BOX_STATUS[b.status].tone} />
        <StatusPill label={`${formatPKR(b.price)} · ${discountLabel(b.value, b.price)}`} tone="success" />
      </View>
      <AppText variant="body">{b.contentsHint}</AppText>
      <StatGrid
        stats={[
          { key: 'reserved', icon: 'bookmark-outline', tint: 'blue', value: b.reserved, label: 'Reserved', hint: `of ${b.quantity}` },
          { key: 'collected', icon: 'checkmark-done-outline', tint: 'violet', value: b.collected, label: 'Collected' },
          { key: 'left', icon: 'gift-outline', tint: 'rose', value: b.left, label: 'Left' },
        ]}
      />

      {open ? (
        <Card>
          <View style={styles.row}>
            <View style={styles.grow}>
              <AppText variant="title">Boxes</AppText>
              <AppText variant="caption" tone="muted">
                {b.reserved ? `At least ${b.reserved}: they are reserved` : 'Change it if you have more or less'}
              </AppText>
            </View>
            <View style={styles.stepper}>
              <IconButton
                icon="remove"
                tone="muted"
                onPress={() => void act({ kind: 'quantity', quantity: b.quantity - 1 }, `${b.quantity - 1} boxes`)}
                disabled={s.acting === 'box' || b.quantity <= Math.max(1, b.reserved) || b.status !== 'live'}
                accessibilityLabel="One box fewer"
              />
              <AppText variant="h2">{String(b.quantity)}</AppText>
              <IconButton
                icon="add"
                tone="muted"
                onPress={() => void act({ kind: 'quantity', quantity: b.quantity + 1 }, `${b.quantity + 1} boxes`)}
                disabled={s.acting === 'box' || b.quantity >= MAX_BOX_QUANTITY || b.status !== 'live'}
                accessibilityLabel="One box more"
              />
            </View>
          </View>
        </Card>
      ) : null}

      <AppText variant="sectionTitle">{toCollect.length ? `To collect · ${toCollect.length}` : 'Reservations'}</AppText>
      {!b.reservations.length ? <EmptyState icon="bookmark" title="No reservations yet" body="Customers nearby see it on Food Court’s home. Reservations show here, each with a pickup code." /> : null}
      {toCollect.map(ticket)}
      {done.length ? <Divider /> : null}
      {done.map(ticket)}

      {b.status === 'live' ? <Button label="End it now" variant="secondary" onPress={() => setEnding(true)} fullWidth /> : null}

      <Sheet
        visible={ending}
        onClose={() => setEnding(false)}
        title="End this Bachat Box?"
        subtitle="No one else can reserve it. Boxes already reserved can still be collected."
        footer={
          <Button
            label="End it"
            variant="destructive"
            loading={s.acting === 'box'}
            onPress={async () => {
              if (await act({ kind: 'end' }, 'Ended')) setEnding(false);
            }}
            fullWidth
          />
        }>
        <View />
      </Sheet>

      <Sheet visible={!!rejectFor} onClose={() => setRejectFor(null)} title="Transfer not received" subtitle="The customer is told why and gets 15 more minutes to send it.">
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
              if (rejectFor && (await act({ kind: 'reject-payment', code: rejectFor, reason }, 'The customer has been told'))) setRejectFor(null);
            }}
          />
        ))}
        <Button label="Go back" variant="secondary" onPress={() => setRejectFor(null)} fullWidth />
      </Sheet>
    </ScreenShell>
  );
};

export default Box;
