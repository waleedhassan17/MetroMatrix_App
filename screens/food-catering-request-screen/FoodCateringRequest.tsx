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
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, InlineNotice, QuoteCard, ScreenShell, Sheet, SkeletonLines, StatusPill } from '../../Custom-Components/index';
import { TransferCard } from '../../Custom-Components/food/TransferCard';
import type { FoodAppParamList } from '../../models';
import { formatWhen } from '../../utils/health-time/healthTime';
import { formatPKR } from '../../utils/money/money';
import { haptics } from '../../utils/haptics/haptics';
import { loadMyCateringRequestAsync, myCateringActAsync, selectFoodCateringUi, selectMyCateringRequest } from './foodCateringRequestSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodCateringRequest'>;

const TZ = 'Asia/Karachi';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s8 },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s12 },
    grow: { flex: 1, minWidth: 0 },
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
  const ui = useAppSelector(selectFoodCateringUi);
  const r = useAppSelector(st => selectMyCateringRequest(st, code));
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => void dispatch(loadMyCateringRequestAsync(code)), [dispatch, code]);
  useFocusEffect(load);

  if (!r) {
    return (
      <ScreenShell title="Dawat request" onBack={back}>
        {ui.status === 'failed' ? <InlineNotice message={ui.error.message} action={ui.error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: load }} /> : <SkeletonLines lines={10} />}
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
      Toast.show({ type: 'success', text1: `Quote v${version} accepted`, text2: request?.advance ? 'Pay the advance to confirm the day.' : 'Your dawat is confirmed.' });
    } else haptics.warning();
  };

  return (
    <ScreenShell title={`${EVENT_TYPE_LABEL[r.eventType]} with ${r.vendor.name}`} subtitle={whenLine(r)} onBack={back} refreshing={ui.status === 'loading'} onRefresh={load}>
      {fresh && r.status === 'requested' ? <InlineNotice tone="success" title="Request sent" message={`${r.vendor.name} will send a quote. You’ll find it here.`} /> : null}
      {ui.actionError.message ? <InlineNotice title={ui.actionError.code === 'QUOTE_OUTDATED' ? 'There is a newer quote' : ui.actionError.code === 'QUOTE_EXPIRED' ? 'That quote has expired' : undefined} message={ui.actionError.message} /> : null}
      <StatusPill label={CATERING_STATUS[r.status].label} tone={CATERING_STATUS[r.status].tone} />
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
        <Card>
          <View style={styles.gap}>
            <AppText variant="title">{r.status === 'confirmed' || r.status === 'completed' ? 'Confirmed' : `Version ${accepted.version} accepted`}</AppText>
            <AppText variant="body">{advanceLine(accepted)}</AppText>
            {r.balance !== null && r.advance?.status === 'paid' ? <AppText variant="small" tone="muted">{`${formatPKR(r.balance)} to pay ${r.vendor.name} on the day.`}</AppText> : null}
          </View>
        </Card>
      ) : null}

      {quotes.length ? <AppText variant="sectionTitle">Quotes</AppText> : (
        <Card>
          <AppText variant="body">{`Waiting for ${r.vendor.name} to send a quote.`}</AppText>
        </Card>
      )}
      {quotes.map(q => (
        <QuoteCard key={q.version} quote={quoteCardData(q, TZ, latest?.version ?? q.version)}>
          {r.canAccept && q.state === 'current' ? (
            <Button label={`Accept · ${formatPKR(q.total)}`} loading={ui.acting} onPress={() => void accept(q.version)} fullWidth />
          ) : null}
        </QuoteCard>
      ))}

      <Card>
        <View style={styles.gap}>
          <AppText variant="title">You asked for</AppText>
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
      </Card>

      <AppText variant="caption" tone="muted">
        You pay the kitchen directly. MetroMatrix takes no commission.
      </AppText>
      {r.canCancel ? <Button label="Cancel the request" variant="secondary" onPress={() => setCancelling(true)} fullWidth /> : null}

      <Sheet
        visible={cancelling}
        onClose={() => setCancelling(false)}
        title="Cancel this request?"
        footer={
          <Button
            label="Cancel it"
            variant="destructive"
            loading={ui.acting}
            onPress={async () => {
              const res = await dispatch(myCateringActAsync({ code, act: { kind: 'cancel' } }));
              if (myCateringActAsync.fulfilled.match(res)) {
                setCancelling(false);
                Toast.show({ type: 'success', text1: 'Cancelled' });
              }
            }}
            fullWidth
          />
        }>
        <Button label="Keep it" variant="secondary" onPress={() => setCancelling(false)} fullWidth />
      </Sheet>
    </ScreenShell>
  );
};

export default FoodCateringRequest;
