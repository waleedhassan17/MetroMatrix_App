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
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { BOX_PAYMENT, RESERVATION_STATUS, reservationHeadline } from '../../models/kitchen/kitchenStatusModel';
import { BACHAT_BOX } from '../../models/kitchen/surplusModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, DangerRow, Divider, IconButton, InlineNotice, ListRow, ScreenShell, SectionCard, Sheet, Skeleton, StatusPill, TextAction } from '../../Custom-Components/index';
import { TrustNote } from '../../Components/food/FoodParts';
import { customerTrustLine } from '../../models/food/trustModel';
import { TransferCard } from '../../Custom-Components/food/TransferCard';
import type { FoodAppParamList } from '../../models';
import { formatSlot } from '../../utils/health-time/healthTime';
import { callNumber, navigateTo } from '../../utils/maps/maps';
import { formatPKR } from '../../utils/money/money';
import { haptics } from '../../utils/haptics/haptics';
import { cancelReservationAsync, loadReservationAsync, selectReservation, selectSurplusReserved } from './surplusReservedSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodSurplusReserved'>;

const TZ = 'Asia/Karachi';

const makeStyles = ({ space, radius, colors, size, elevation }: Theme) =>
  StyleSheet.create({
    // The pickup pass: the FYP card, the code large in the middle.
    code: { alignItems: 'center', gap: space.s8, paddingVertical: space.s24, paddingHorizontal: space.s16, borderRadius: radius.lg, borderWidth: size.hairline, borderColor: colors.lineSoft, backgroundColor: colors.surface, ...elevation.card },
    gap: { gap: space.s8 },
    grow: { flex: 1, gap: space.s4, minWidth: 0 },
    sheetButtons: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1 },
    loading: { gap: space.s16 },
  });

const FoodSurplusReserved: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodSurplusReservedContent {...props} />
  </ServiceScope>
);

const FoodSurplusReservedContent: React.FC<Props> = ({ navigation, route }) => {
  const { code, fresh } = route.params;
  const { back } = useBack({ name: 'FoodSurplusReservations' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const ui = useAppSelector(selectSurplusReserved);
  const r = useAppSelector(st => selectReservation(st, code));
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => void dispatch(loadReservationAsync(code)), [dispatch, code]);
  useFocusEffect(load);

  if (!r) {
    return (
      <ScreenShell title={BACHAT_BOX} onBack={back}>
        {ui.status === 'failed' ? (
          <InlineNotice message={ui.error.message} action={ui.error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: load }} />
        ) : (
          <View style={styles.loading} accessibilityLabel="Loading" accessibilityRole="progressbar">
            <Skeleton height={size.storeHero} shape="lg" />
            <Skeleton height={size.control.lg * 2} shape="lg" />
          </View>
        )}
      </ScreenShell>
    );
  }

  const status = RESERVATION_STATUS[r.status];
  const pill = reservationHeadline(r);
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
        <StatusPill label={pill.label} tone={pill.tone} />
        {live ? (
          <AppText variant="small" tone="muted" align="center">
            Show this code at the counter.
          </AppText>
        ) : null}
      </View>

      <SectionCard title={`Pick up ${r.pickupLabel}`} subtitle={r.collectedAt ? `Collected at ${formatSlot(r.collectedAt, TZ)}` : undefined} icon="time-outline">
        <View style={styles.gap}>
          <AppText variant="bodyStrong">{r.box.title}</AppText>
          <AppText variant="small" tone="muted">
            {`${r.quantity === 1 ? '1 box' : `${r.quantity} boxes`} · ${formatPKR(r.total)} (${formatPKR(r.box.value * r.quantity)} of food)`}
          </AppText>
        </View>
        <Divider />
        <ListRow
          title={r.vendor.name}
          subtitle={where || undefined}
          leftIcon="location-outline"
          chevron={false}
          right={r.vendor.phone ? <IconButton icon="call-outline" accessibilityLabel={`Call ${r.vendor.name}`} onPress={() => callNumber(r.vendor.phone!)} /> : undefined}
        />
        {r.vendor.location.lat !== null && r.vendor.location.lng !== null ? (
          <TextAction label="Directions" icon="navigate-outline" onPress={() => navigateTo(r.vendor.location.lat!, r.vendor.location.lng!)} />
        ) : null}
      </SectionCard>

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
        <SectionCard title={BOX_PAYMENT[r.payment.method].label} subtitle={r.payment.status === 'paid' ? 'Paid. Just show your code.' : `Bring ${formatPKR(r.total)} in cash. ${BOX_PAYMENT.pay_at_pickup.hint}`} icon="wallet-outline" />
      ) : null}

      <TrustNote text={customerTrustLine(r.vendor.name)} />

      {ui.cancelError.message ? <InlineNotice message={ui.cancelError.message} /> : null}
      {r.canCancel ? <DangerRow label="Cancel the reservation" icon="close-circle-outline" onConfirm={() => setCancelling(true)} /> : null}

      <Sheet
        visible={cancelling}
        onClose={() => setCancelling(false)}
        title="Cancel this reservation?"
        subtitle="The box goes back for someone else to reserve."
        footer={
          <View style={styles.sheetButtons}>
            <View style={styles.half}>
              <Button label="Keep it" variant="secondary" onPress={() => setCancelling(false)} fullWidth />
            </View>
            <View style={styles.half}>
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
            </View>
          </View>
        }>
        <AppText variant="body" tone="muted">
          {`${r.quantity === 1 ? 'Your box' : `Your ${r.quantity} boxes`} from ${r.vendor.name} won’t be held for you any more.`}
        </AppText>
      </Sheet>
    </ScreenShell>
  );
};

export default FoodSurplusReserved;
