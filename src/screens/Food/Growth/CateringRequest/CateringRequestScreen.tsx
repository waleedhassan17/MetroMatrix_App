// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen growth: one catering request
// ═══════════════════════════════════════════════════════
// The event (day and time, guests, how it is served, where), what the
// customer asked for and their budget, every quote sent (newest first, the
// older ones marked replaced), and what comes next: send a quote or a new
// version, decline, or check the advance in the kitchen's own account.

import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { CATERING_MODE, CATERING_STATUS, EVENT_TYPE_LABEL, boxPaymentStatus } from '@models/kitchen/kitchenStatusModel';
import { advanceLine, latestQuote, quoteCardData, whenLine } from '@models/kitchen/cateringModel';
import { PAYMENT_REJECT_REASONS } from '@models/food/foodStatusModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, Card, Divider, IconButton, InlineNotice, IonIcon, QuoteCard, ScreenShell, Sheet, SkeletonLines, StatusPill } from '@custom/index';
import { ChoiceLine } from '@custom/food/ChoiceLine';
import type { FoodVendorStackParamList } from '@/types';
import { formatPKR } from '@utils/money';
import { formatPkPhoneForDisplay } from '@utils/phone';
import { callNumber, navigateTo, openWhatsApp } from '@utils/maps';
import { haptics } from '@utils/haptics';
import { cateringActAsync, loadCateringRequestAsync, selectCateringRequest, selectCateringRequestUi, type CateringAct } from './cateringRequestSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'GrowthCateringRequest'>;

const TZ = 'Asia/Karachi';
const DECLINE_REASONS = ['We’re booked that day', 'Too many guests for us', 'Too far for us', 'We don’t make those dishes'];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s8 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    grow: { flex: 1, gap: space.s4, minWidth: 0 },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s12 },
    actions: { flexDirection: 'row', gap: space.s8 },
    half: { flex: 1 },
  });

const CateringRequestScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <CateringRequestContent {...props} />
  </ServiceScope>
);

const CateringRequestContent: React.FC<Props> = ({ navigation, route }) => {
  const { code } = route.params;
  const { back } = useBack({ name: 'GrowthCatering' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const ui = useAppSelector(selectCateringRequestUi);
  const r = useAppSelector(st => selectCateringRequest(st, code));
  const [sheet, setSheet] = useState<'decline' | 'reject' | null>(null);

  const load = useCallback(() => void dispatch(loadCateringRequestAsync(code)), [dispatch, code]);
  useFocusEffect(load);

  const act = async (a: CateringAct, done: string) => {
    haptics.press();
    const res = await dispatch(cateringActAsync({ code, act: a }));
    if (cateringActAsync.fulfilled.match(res)) {
      haptics.success();
      Toast.show({ type: 'success', text1: done });
      setSheet(null);
    } else haptics.warning();
  };

  if (!r) {
    return (
      <ScreenShell title="Catering request" onBack={back}>
        {ui.status === 'failed' ? <InlineNotice message={ui.error.message} action={ui.error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: load }} /> : <SkeletonLines lines={10} />}
      </ScreenShell>
    );
  }

  const latest = latestQuote(r);
  const quotes = [...r.quotes].reverse();
  const adv = r.advance;

  return (
    <ScreenShell
      title={`${EVENT_TYPE_LABEL[r.eventType]} for ${r.customer?.name ?? 'a customer'}`}
      subtitle={whenLine(r)}
      onBack={back}
      refreshing={ui.status === 'loading'}
      onRefresh={load}
      footer={
        r.canQuote ? (
          <Button label={latest ? `Send a new version (v${latest.version + 1})` : 'Send a quote'} onPress={() => navigation.navigate('GrowthQuote', { code: r.code })} fullWidth />
        ) : undefined
      }>
      {ui.actionError.message && !sheet ? <InlineNotice message={ui.actionError.message} /> : null}
      <StatusPill label={CATERING_STATUS[r.status].vendorLabel} tone={CATERING_STATUS[r.status].tone} />

      <Card>
        <View style={styles.head}>
          <IonIcon name="person-outline" size="lg" color={colors.inkMuted} />
          <View style={styles.grow}>
            <AppText variant="bodyStrong">{r.customer?.name ?? 'Customer'}</AppText>
            {r.customer?.phone ? (
              <AppText variant="small" tone="muted">
                {formatPkPhoneForDisplay(r.customer.phone)}
              </AppText>
            ) : null}
          </View>
          {r.customer?.phone ? (
            <>
              <IconButton icon="logo-whatsapp" accessibilityLabel={`WhatsApp ${r.customer.name}`} onPress={() => openWhatsApp(r.customer!.phone!)} />
              <IconButton icon="call-outline" accessibilityLabel={`Call ${r.customer.name}`} onPress={() => callNumber(r.customer!.phone!)} />
            </>
          ) : null}
        </View>
        <Divider />
        <AppText variant="body">{`${CATERING_MODE[r.mode].label}: ${CATERING_MODE[r.mode].hint}`}</AppText>
        {r.address ? (
          <View style={styles.row}>
            <AppText variant="small" tone="muted" style={styles.grow}>
              {[r.address.line1, r.address.area, r.address.city].filter(Boolean).join(', ')}
            </AppText>
            {r.address.lat !== null && r.address.lng !== null ? <IconButton icon="navigate-outline" accessibilityLabel="Directions" onPress={() => navigateTo(r.address!.lat!, r.address!.lng!)} /> : null}
          </View>
        ) : null}
        {r.budget ? <AppText variant="small">{`Budget about ${formatPKR(r.budget)}`}</AppText> : null}
        {r.notes ? <AppText variant="small" tone="accentDeep">{`“${r.notes}”`}</AppText> : null}
      </Card>

      <Card>
        <View style={styles.gap}>
          <AppText variant="title">Asked for</AppText>
          {r.dishes.map((d, n) => (
            <View key={`${d.name}-${n}`} style={styles.row}>
              <AppText variant="body" style={styles.grow}>
                {d.name}
              </AppText>
              <AppText variant="bodyStrong">{`× ${d.qty}`}</AppText>
            </View>
          ))}
        </View>
      </Card>

      {adv ? (
        <Card>
          <View style={styles.gap}>
            <View style={styles.row}>
              <AppText variant="title">Advance</AppText>
              <StatusPill label={boxPaymentStatus(adv.status).vendorLabel} tone={boxPaymentStatus(adv.status).tone} />
            </View>
            {latest ? <AppText variant="small">{advanceLine(r.quotes.find(q => q.version === r.acceptedVersion) ?? latest)}</AppText> : null}
            {adv.reference ? <AppText variant="small">{`Reference from the customer: ${adv.reference}`}</AppText> : null}
            {r.status === 'accepted' && ['proof_submitted', 'awaiting_transfer'].includes(adv.status) ? (
              <View style={styles.actions}>
                {adv.status === 'proof_submitted' ? (
                  <View style={styles.half}>
                    <Button label="Not received" variant="secondary" size="sm" disabled={ui.acting} onPress={() => setSheet('reject')} fullWidth />
                  </View>
                ) : null}
                <View style={styles.half}>
                  <Button label="The money is in" size="sm" loading={ui.acting} onPress={() => void act({ kind: 'confirm-advance' }, 'Confirmed: it’s in your calendar')} fullWidth />
                </View>
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}

      {quotes.length ? <AppText variant="sectionTitle">Quotes</AppText> : null}
      {quotes.map(q => (
        <QuoteCard key={q.version} quote={quoteCardData(q, TZ, latest?.version ?? q.version)} />
      ))}

      {r.declineReason || r.cancelReason ? (
        <AppText variant="small" tone="muted">
          {r.declineReason ? `You declined: ${r.declineReason}` : `They cancelled${r.cancelReason ? `: ${r.cancelReason}` : '.'}`}
        </AppText>
      ) : null}
      {r.canQuote ? <Button label="Decline" variant="secondary" onPress={() => setSheet('decline')} fullWidth /> : null}

      <Sheet visible={!!sheet} onClose={() => setSheet(null)} title={sheet === 'decline' ? 'Decline this request?' : 'Advance not received'} subtitle="The customer is told why.">
        {ui.actionError.message ? <InlineNotice message={ui.actionError.message} /> : null}
        {(sheet === 'decline' ? DECLINE_REASONS : PAYMENT_REJECT_REASONS).map(reason => (
          <ChoiceLine
            key={reason}
            label={reason}
            price={null}
            selected={false}
            multiple={false}
            disabled={ui.acting}
            onPress={() => void act(sheet === 'decline' ? { kind: 'decline', reason } : { kind: 'reject-advance', reason }, sheet === 'decline' ? 'Declined' : 'The customer has been told')}
          />
        ))}
        <Button label="Go back" variant="secondary" onPress={() => setSheet(null)} fullWidth />
      </Sheet>
    </ScreenShell>
  );
};

export default CateringRequestScreen;
