// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: find a tiffin or catering
// ═══════════════════════════════════════════════════════
// For a dispute: type the code a customer or kitchen gives (TF-… or
// CT-…) and see it as the kitchen sees it: who, what, when, its state and
// where its payment stands. Read only; customers pay kitchens directly.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { validateLookupCode } from '@models/kitchen/adminKitchenModel';
import { CATERING_STATUS, EVENT_TYPE_LABEL, TIFFIN_STATUS, tiffinPaymentStatus } from '@models/kitchen/kitchenStatusModel';
import { latestQuote, whenLine } from '@models/kitchen/cateringModel';
import { periodLabel, priceLabel, scheduleLabel } from '@models/kitchen/tiffinModel';
import { formatDayShort } from '@utils/healthTime';
import { formatPKR } from '@utils/money';
import { useStyles, type Theme } from '@theme/index';
import { AppText, Button, Card, Divider, InlineNotice, ScreenShell, StatusPill, TextField } from '@custom/index';
import type { AdminFoodStackParamList, CateringRequest, TiffinSubscription } from '@/types';
import { haptics } from '@utils/haptics';
import { lookupCodeAsync, markLookupSubmitted, selectAdminKitchenLookup, setLookupCode } from './adminKitchenLookupSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminKitchenLookup'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    line: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s12, paddingVertical: space.s4 },
  });

const Line: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) => {
  const styles = useStyles(makeStyles);
  return value ? (
    <View style={styles.line}>
      <AppText variant="small" tone="muted">
        {label}
      </AppText>
      <AppText variant="small" align="right" style={styles.grow}>
        {value}
      </AppText>
    </View>
  ) : null;
};

const TiffinCard: React.FC<{ t: TiffinSubscription }> = ({ t }) => {
  const styles = useStyles(makeStyles);
  const pay = t.period ? tiffinPaymentStatus(t.period.payment.status) : null;
  return (
    <Card>
      <View style={styles.gap}>
        <View style={styles.head}>
          <View style={styles.grow}>
            <AppText variant="overline" tone="muted">
              {`Tiffin · ${t.code}`}
            </AppText>
            <AppText variant="title">{t.plan.name}</AppText>
          </View>
          <StatusPill label={TIFFIN_STATUS[t.status].vendorLabel} tone={TIFFIN_STATUS[t.status].tone} />
        </View>
        <Divider />
        <Line label="Kitchen" value={`${t.vendor.name}${t.vendor.phone ? ` · ${t.vendor.phone}` : ''}`} />
        <Line label="Customer" value={t.customer ? `${t.customer.name}${t.customer.phone ? ` · ${t.customer.phone}` : ''}` : null} />
        <Line label="Plan" value={`${scheduleLabel(t.plan)} · ${priceLabel(t.plan)}`} />
        <Line label="Started" value={formatDayShort(t.startDate)} />
        <Line label="Ended" value={t.endDate ? formatDayShort(t.endDate) : null} />
        <Line label="Next delivery" value={t.nextDelivery ? `${formatDayShort(t.nextDelivery.date)}${t.nextDelivery.dishes.length ? ` · ${t.nextDelivery.dishes.join(', ')}` : ''}` : null} />
        <Line label="Paused" value={t.pausedFrom ? `${formatDayShort(t.pausedFrom)}${t.pausedUntil ? ` – ${formatDayShort(t.pausedUntil)}` : ''}` : null} />
        {t.period && pay ? (
          <>
            <Divider />
            <View style={styles.head}>
              <View style={styles.grow}>
                <AppText variant="bodyStrong">{`This period · ${periodLabel(t.period)}`}</AppText>
                <AppText variant="small" tone="muted">
                  {`${t.period.meals} meals · ${formatPKR(t.period.amount)}`}
                </AppText>
              </View>
              <StatusPill label={pay.vendorLabel} tone={pay.tone} />
            </View>
          </>
        ) : null}
        <Line label="Declined because" value={t.declineReason} />
        <Line label="Ended because" value={t.endReason} />
      </View>
    </Card>
  );
};

const CateringCard: React.FC<{ c: CateringRequest }> = ({ c }) => {
  const styles = useStyles(makeStyles);
  const q = latestQuote(c);
  return (
    <Card>
      <View style={styles.gap}>
        <View style={styles.head}>
          <View style={styles.grow}>
            <AppText variant="overline" tone="muted">
              {`Catering · ${c.code}`}
            </AppText>
            <AppText variant="title">{EVENT_TYPE_LABEL[c.eventType]}</AppText>
            <AppText variant="small" tone="muted">
              {whenLine(c)}
            </AppText>
          </View>
          <StatusPill label={CATERING_STATUS[c.status].vendorLabel} tone={CATERING_STATUS[c.status].tone} />
        </View>
        <Divider />
        <Line label="Kitchen" value={`${c.vendor.name}${c.vendor.phone ? ` · ${c.vendor.phone}` : ''}`} />
        <Line label="Customer" value={c.customer ? `${c.customer.name}${c.customer.phone ? ` · ${c.customer.phone}` : ''}` : null} />
        <Line label="Asked for" value={c.dishes.map(d => `${d.qty} × ${d.name}`).join(', ')} />
        <Line label="Budget" value={c.budget ? formatPKR(c.budget) : null} />
        <Line
          label={q ? `Quote ${q.version}${c.acceptedVersion === q.version ? ' (accepted)' : ''}` : 'Quote'}
          value={q ? `${formatPKR(q.total)} · ${q.advancePct}% advance (${formatPKR(q.advance)})` : 'No quote yet'}
        />
        <Line label="Advance" value={c.advance ? `${formatPKR(c.advance.amount)} · ${tiffinPaymentStatus(c.advance.status).vendorLabel}` : null} />
        <Line label="Declined because" value={c.declineReason} />
        <Line label="Cancelled because" value={c.cancelReason} />
      </View>
    </Card>
  );
};

const AdminKitchenLookupScreen: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'FoodOverview' });
  const dispatch = useAppDispatch();
  const s = useAppSelector(selectAdminKitchenLookup);
  const errors = s.submitted ? validateLookupCode(s.code) : {};

  // A link with a code looks it up at once.
  const linked = route.params?.code;
  useEffect(() => {
    if (!linked) return;
    dispatch(setLookupCode(linked));
    void dispatch(lookupCodeAsync(linked));
  }, [dispatch, linked]);

  const find = () => {
    dispatch(markLookupSubmitted());
    if (Object.keys(validateLookupCode(s.code)).length) return haptics.warning();
    void dispatch(lookupCodeAsync(s.code));
  };

  return (
    <ScreenShell title="Find a tiffin or catering" subtitle="By the code the customer or kitchen gives you" onBack={back}>
      <TextField
        label="Code"
        value={s.code}
        onChangeText={t => dispatch(setLookupCode(t))}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="TF-HMZ4K2 or CT-MHD7Q4"
        returnKeyType="search"
        onSubmitEditing={find}
        error={errors.code}
      />
      <Button label="Find it" leftIcon="search-outline" loading={s.status === 'loading'} onPress={find} fullWidth />
      {s.status === 'failed' ? <InlineNotice tone={s.error.code === 'NOT_FOUND' ? 'info' : 'error'} message={s.error.message} /> : null}
      {s.result?.kind === 'tiffin' ? <TiffinCard t={s.result.tiffin} /> : null}
      {s.result?.kind === 'catering' ? <CateringCard c={s.result.catering} /> : null}
      <AppText variant="caption" tone="muted">
        MetroMatrix takes no commission: customers pay the kitchen directly, so payments here are what the kitchen recorded.
      </AppText>
    </ScreenShell>
  );
};

export default AdminKitchenLookupScreen;
