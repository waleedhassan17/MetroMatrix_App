// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: a dawat request
// ═══════════════════════════════════════════════════════
// The event as asked for, every quote the kitchen sent (the latest first,
// older versions marked replaced, an expired one marked so), accepting the
// latest, then the advance: a transfer to the kitchen's own account and
// its receipt. Confirmed once the kitchen sees it; the rest is paid on the
// day. Cancel before the advance is paid.

import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector, useAppStore } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { CATERING_MODE, CATERING_STATUS, EVENT_TYPE_LABEL } from '../../models/kitchen/kitchenStatusModel';
import { advanceLine, latestQuote, quoteCardData, whenLine } from '../../models/kitchen/cateringModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, DangerRow, InlineNotice, QuoteCard, RowCardsSkeleton, ScreenShell, SectionCard, Sheet, StatusPill } from '../../Custom-Components/index';
import { ChoiceLine } from '../../Custom-Components/food/ChoiceLine';
import { TrustNote } from '../../Components/food/FoodParts';
import { ShopSection } from '../../Components/shopping/ShopParts';
import { customerTrustLine } from '../../models/food/trustModel';
import { TransferCard } from '../../Custom-Components/food/TransferCard';
import type { FoodAppParamList } from '../../models';
import { formatWhen } from '../../utils/health-time/healthTime';
import { formatPKR } from '../../utils/money/money';
import { haptics } from '../../utils/haptics/haptics';
import { loadMyCateringRequestAsync, myCateringActAsync, selectFoodCateringUi, selectMyCateringRequest } from './foodCateringRequestSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodCateringRequest'>;

const TZ = 'Asia/Karachi';
const CANCEL_REASONS = ['Plans changed', 'Found another kitchen', 'The quote is over my budget'];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s8 },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s12 },
    grow: { flex: 1, minWidth: 0 },
    reasons: { gap: space.s4 },
    sheetButtons: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1 },
  });

const FoodCateringRequest: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodCateringRequestContent {...props} />
  </ServiceScope>
);

const FoodCateringRequestContent: React.FC<Props> = ({ navigation, route }) => {
  const { code, fresh } = route.params;
  const { back } = useBack({ name: 'FoodCateringRequests' });
  const dispatch = useAppDispatch();
  const appStore = useAppStore();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const ui = useAppSelector(selectFoodCateringUi);
  const r = useAppSelector(st => selectMyCateringRequest(st, code));
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0]);

  const load = useCallback(() => void dispatch(loadMyCateringRequestAsync(code)), [dispatch, code]);
  useFocusEffect(load);

  if (!r) {
    return (
      <ScreenShell title="Dawat request" onBack={back}>
        {ui.status === 'failed' ? <InlineNotice message={ui.error.message} action={ui.error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: load }} /> : <RowCardsSkeleton count={3} />}
      </ScreenShell>
    );
  }

  const latest = latestQuote(r);
  const quotes = [...r.quotes].reverse();
  const accepted = r.acceptedVersion ? r.quotes.find(q => q.version === r.acceptedVersion) ?? null : null;

  const accept = async (version: number) => {
    haptics.press();
    const res = await dispatch(myCateringActAsync({ code, act: { kind: 'accept', version } }));
    if (myCateringActAsync.fulfilled.match(res)) {
      haptics.success();
      const request = selectFoodCateringUi(appStore.getState()).byCode[code];
      Toast.show({ type: 'success', text1: `Quote ${version} accepted`, text2: request?.advance ? 'Pay the advance to confirm the day.' : 'Your dawat is confirmed.' });
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title={EVENT_TYPE_LABEL[r.eventType]}
      subtitle={`${r.vendor.name} · ${whenLine(r)}`}
      onBack={back}
      refreshing={ui.status === 'loading'}
      onRefresh={load}
      headerRight={<StatusPill label={CATERING_STATUS[r.status].label} tone={CATERING_STATUS[r.status].tone} />}>
      {fresh && r.status === 'requested' ? <InlineNotice tone="success" title="Request sent" message={`${r.vendor.name} will send a quote. You’ll find it here.`} /> : null}
      {ui.actionError.message ? <InlineNotice title={ui.actionError.code === 'QUOTE_OUTDATED' ? 'There is a newer quote' : ui.actionError.code === 'QUOTE_EXPIRED' ? 'That quote has expired' : undefined} message={ui.actionError.message} /> : null}
      {r.declineReason ? <InlineNotice title={`${r.vendor.name} can’t take it`} message={r.declineReason} /> : null}

      {r.advance && r.status === 'accepted' && r.advance.accounts?.length ? (
        <>
          <TransferCard
            vendorName={r.vendor.name}
            amount={r.advance.amount}
            accounts={r.advance.accounts}
            status={r.advance.status}
            payBy={null}
            reference={r.advance.reference}
            rejectedReason={r.advance.rejectedReason}
            onSendReceipt={r.advance.status === 'awaiting_transfer' ? () => navigation.navigate('PaymentProof', { cateringCode: r.code }) : undefined}
          />
          {r.advance.payBy && r.advance.status === 'awaiting_transfer' ? (
            <AppText variant="small" tone="muted">
              {`Pay the advance by ${formatWhen(r.advance.payBy, TZ)} to keep the day.`}
            </AppText>
          ) : null}
        </>
      ) : null}
      {accepted ? (
        <SectionCard title={r.status === 'confirmed' || r.status === 'completed' ? 'Confirmed' : `Quote ${accepted.version} accepted`} subtitle={advanceLine(accepted)} icon="checkmark-circle-outline" tint={{ fg: colors.success, bg: colors.successSoft }}>
          {r.balance !== null && r.advance?.status === 'paid' ? <AppText variant="small" tone="muted">{`${formatPKR(r.balance)} to pay ${r.vendor.name} on the day.`}</AppText> : null}
        </SectionCard>
      ) : null}

      {quotes.length ? <ShopSection title="Quotes" inset={false} /> : <SectionCard title="Waiting for a quote" subtitle={`${r.vendor.name} sends one here. You can accept it, or wait for a new one.`} icon="hourglass-outline" />}
      {quotes.map(q => (
        <QuoteCard key={q.version} quote={quoteCardData(q, TZ, latest?.version ?? q.version)}>
          {r.canAccept && q.state === 'current' ? (
            <Button label={`Accept · ${formatPKR(q.total)}`} loading={ui.acting} onPress={() => void accept(q.version)} fullWidth />
          ) : null}
        </QuoteCard>
      ))}

      <SectionCard title="You asked for" icon="restaurant-outline">
        <View style={styles.gap}>
          {r.dishes.map((d, n) => (
            <View key={`${d.name}-${n}`} style={styles.row}>
              <AppText variant="body" style={styles.grow}>
                {d.name}
              </AppText>
              <AppText variant="bodyStrong">{`× ${d.qty}`}</AppText>
            </View>
          ))}
          <AppText variant="small" tone="muted">
            {[CATERING_MODE[r.mode].label, r.address ? [r.address.line1, r.address.area].filter(Boolean).join(', ') : null, r.budget ? `budget about ${formatPKR(r.budget)}` : null].filter(Boolean).join(' · ')}
          </AppText>
          {r.notes ? <AppText variant="small">{`“${r.notes}”`}</AppText> : null}
        </View>
      </SectionCard>

      <TrustNote text={customerTrustLine(r.vendor.name)} />
      {r.canCancel ? <DangerRow label="Cancel the request" icon="close-circle-outline" onConfirm={() => setCancelling(true)} /> : null}

      <Sheet
        visible={cancelling}
        onClose={() => setCancelling(false)}
        title="Cancel this request?"
        footer={
          <View style={styles.sheetButtons}>
            <View style={styles.half}>
              <Button label="Keep it" variant="secondary" onPress={() => setCancelling(false)} fullWidth />
            </View>
            <View style={styles.half}>
              <Button
                label="Cancel it"
                variant="destructive"
                loading={ui.acting}
                onPress={async () => {
                  const res = await dispatch(myCateringActAsync({ code, act: { kind: 'cancel', reason: cancelReason } }));
                  if (myCateringActAsync.fulfilled.match(res)) {
                    setCancelling(false);
                    Toast.show({ type: 'success', text1: 'Cancelled' });
                  }
                }}
                fullWidth
              />
            </View>
          </View>
        }>
        <AppText variant="small" tone="muted">
          The kitchen is told why.
        </AppText>
        <View style={styles.reasons} accessibilityRole="radiogroup" accessibilityLabel="Why you’re cancelling">
          {CANCEL_REASONS.map(x => (
            <ChoiceLine key={x} label={x} price={null} selected={cancelReason === x} multiple={false} onPress={() => setCancelReason(x)} />
          ))}
        </View>
      </Sheet>
    </ScreenShell>
  );
};

export default FoodCateringRequest;
