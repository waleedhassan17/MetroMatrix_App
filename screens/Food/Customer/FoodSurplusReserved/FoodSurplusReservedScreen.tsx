// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: a Bachat Box reservation
// ═══════════════════════════════════════════════════════
// The pickup code to show at the counter, large; the box, when and where
// to collect it, and how it is paid — cash at pickup, or a transfer to the
// kitchen's own account with the receipt sent from here. Cancel before the
// window starts. Read again whenever it comes into view.

import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { BOX_PAYMENT, RESERVATION_STATUS, boxPaymentStatus } from '../../../../models/kitchen/kitchenStatusModel';
import { BACHAT_BOX } from '../../../../models/kitchen/surplusModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, Divider, IconButton, InlineNotice, IonIcon, ScreenShell, Sheet, SkeletonLines, StatusPill, TextAction } from '../../../../Custom-Components/index';
import { TransferCard } from '../../../../Custom-Components/food/TransferCard';
import type { FoodAppParamList } from '../../../../types';
import { formatSlot } from '../../../../utils/healthTime';
import { callNumber, navigateTo } from '../../../../utils/maps';
import { formatPKR } from '../../../../utils/money';
import { haptics } from '../../../../utils/haptics';
import { cancelReservationAsync, loadReservationAsync, selectReservation, selectSurplusReserved } from './surplusReservedSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodSurplusReserved'>;

const TZ = 'Asia/Karachi';

const makeStyles = ({ space, radius, colors, size, service }: Theme) =>
  StyleSheet.create({
    code: { alignItems: 'center', gap: space.s8, paddingVertical: space.s24, borderRadius: radius.lg, borderWidth: size.border, borderColor: service.accentLine, backgroundColor: colors.surface },
    gap: { gap: space.s8 },
    line: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    grow: { flex: 1, gap: space.s4, minWidth: 0 },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8, justifyContent: 'center' },
  });

const FoodSurplusReservedScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodSurplusReservedContent {...props} />
  </ServiceScope>
);

const FoodSurplusReservedContent: React.FC<Props> = ({ navigation, route }) => {
  const { code, fresh } = route.params;
  const { back } = useBack({ name: 'FoodSurplusReservations' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const ui = useAppSelector(selectSurplusReserved);
  const r = useAppSelector(st => selectReservation(st, code));
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => void dispatch(loadReservationAsync(code)), [dispatch, code]);
  useFocusEffect(load);

  if (!r) {
    return (
      <ScreenShell title={BACHAT_BOX} onBack={back}>
        {ui.status === 'failed' ? <InlineNotice message={ui.error.message} action={ui.error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: load }} /> : <SkeletonLines lines={8} />}
      </ScreenShell>
    );
  }

  const status = RESERVATION_STATUS[r.status];
  const pay = boxPaymentStatus(r.payment.status);
  const where = [r.vendor.location.addressLine, r.vendor.location.area, r.vendor.location.city].filter(Boolean).join(', ');
  const live = r.status === 'reserved';

  return (
    <ScreenShell title={r.vendor.name} subtitle={`${BACHAT_BOX} · ${r.pickupLabel}`} onBack={back} refreshing={ui.status === 'loading'} onRefresh={load}>
      {fresh && live ? <InlineNotice tone="success" title="Reserved" message={`It’s held for you. Collect it ${r.pickupLabel}.`} /> : null}
      <View style={styles.code} accessible accessibilityLabel={`Pickup code ${r.code.split('').join(' ')}. ${status.label}.`}>
        <AppText variant="overline" tone="muted">
          Pickup code
        </AppText>
        <AppText variant="display" tone={live ? 'accentDeep' : 'muted'} selectable>
          {r.code}
        </AppText>
        <View style={styles.pills}>
          <StatusPill label={status.label} tone={status.tone} />
          {live ? <StatusPill label={pay.label} tone={pay.tone} /> : null}
        </View>
        {live ? (
          <AppText variant="small" tone="muted" align="center">
            Show this code at the counter.
          </AppText>
        ) : null}
      </View>

      <Card>
        <View style={styles.gap}>
          <AppText variant="title">{r.box.title}</AppText>
          <AppText variant="small" tone="muted">
            {`${r.quantity === 1 ? '1 box' : `${r.quantity} boxes`} · ${formatPKR(r.total)} (${formatPKR(r.box.value * r.quantity)} of food)`}
          </AppText>
          {r.collectedAt ? <AppText variant="small">{`Collected at ${formatSlot(r.collectedAt, TZ)}`}</AppText> : null}
        </View>
      </Card>

      <Card>
        <View style={styles.line}>
          <IonIcon name="time-outline" size="md" color={colors.inkMuted} />
          <AppText variant="bodyStrong" style={styles.grow}>{`Pick up ${r.pickupLabel}`}</AppText>
        </View>
        <Divider />
        <View style={styles.line}>
          <IonIcon name="location-outline" size="md" color={colors.inkMuted} />
          <View style={styles.grow}>
            <AppText variant="bodyStrong">{r.vendor.name}</AppText>
            {where ? (
              <AppText variant="small" tone="muted">
                {where}
              </AppText>
            ) : null}
          </View>
          {r.vendor.phone ? <IconButton icon="call-outline" accessibilityLabel={`Call ${r.vendor.name}`} onPress={() => callNumber(r.vendor.phone!)} /> : null}
        </View>
        {r.vendor.location.lat !== null && r.vendor.location.lng !== null ? (
          <TextAction label="Directions" icon="navigate-outline" onPress={() => navigateTo(r.vendor.location.lat!, r.vendor.location.lng!)} />
        ) : null}
      </Card>

      {live && r.payment.method === 'transfer' && r.payment.accounts?.length ? (
        <TransferCard
          vendorName={r.vendor.name}
          amount={r.total}
          accounts={r.payment.accounts}
          status={r.payment.status}
          payBy={r.payment.payBy}
          reference={r.payment.reference}
          rejectedReason={r.payment.rejectedReason}
          holds="reservation"
          onSendReceipt={r.payment.status === 'awaiting_transfer' ? () => navigation.navigate('PaymentProof', { surplusCode: r.code }) : undefined}
        />
      ) : live ? (
        <Card>
          <View style={styles.gap}>
            <AppText variant="title">{BOX_PAYMENT[r.payment.method].label}</AppText>
            <AppText variant="small" tone="muted">
              {r.payment.status === 'paid' ? 'Paid. Just show your code.' : `Bring ${formatPKR(r.total)} in cash. ${BOX_PAYMENT.pay_at_pickup.hint}`}
            </AppText>
          </View>
        </Card>
      ) : null}

      <AppText variant="caption" tone="muted">
        You pay the kitchen directly. MetroMatrix takes no commission.
      </AppText>

      {ui.cancelError.message ? <InlineNotice message={ui.cancelError.message} /> : null}
      {r.canCancel ? <Button label="Cancel the reservation" variant="secondary" onPress={() => setCancelling(true)} fullWidth /> : null}

      <Sheet
        visible={cancelling}
        onClose={() => setCancelling(false)}
        title="Cancel this reservation?"
        subtitle="The box goes back for someone else to reserve."
        footer={
          <Button
            label="Cancel it"
            variant="destructive"
            loading={ui.cancelling}
            onPress={async () => {
              const res = await dispatch(cancelReservationAsync(r.code));
              if (cancelReservationAsync.fulfilled.match(res)) {
                haptics.success();
                setCancelling(false);
                Toast.show({ type: 'success', text1: 'Cancelled' });
              } else haptics.warning();
            }}
            fullWidth
          />
        }>
        <Button label="Keep it" variant="secondary" onPress={() => setCancelling(false)} fullWidth />
      </Sheet>
    </ScreenShell>
  );
};

export default FoodSurplusReservedScreen;
