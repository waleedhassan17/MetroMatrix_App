// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen growth: catering
// ═══════════════════════════════════════════════════════
// Dawat requests by where they stand (new, quoted, confirmed, past), the
// month's events, and the kitchen's terms: whether it takes requests, the
// fewest guests, how many days ahead. Each request opens to quote it.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { CATERING_STATUS, EVENT_TYPE_LABEL } from '../../../../models/kitchen/kitchenStatusModel';
import { eventLine, latestQuote, timeLabel } from '../../../../models/kitchen/cateringModel';
import { monthLabel, monthOf, shiftMonth } from '../../../../models/kitchen/tiffinModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, ChoiceChip, Divider, EmptyState, IconButton, InlineNotice, ScreenShell, Sheet, SkeletonLines, TextField, ToggleRow } from '../../../../Custom-Components/index';
import { RowCard } from '../../../../Components/admin/AdminParts';
import type { CateringRequest, FoodVendorStackParamList } from '../../../../types';
import { formatDayShort, todayInZone } from '../../../../utils/healthTime';
import { formatPKR } from '../../../../utils/money';
import { loadCateringAsync, loadCateringCalendarAsync, saveCateringSettingsAsync, selectCatering, setCateringTab, type CateringTab } from './cateringSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'GrowthCatering'>;

const TZ = 'Asia/Karachi';
const GROUPS: Record<Exclude<CateringTab, 'calendar'>, CateringRequest['status'][]> = {
  new: ['requested'],
  quoted: ['quoted', 'accepted'],
  confirmed: ['confirmed'],
  past: ['completed', 'declined', 'cancelled'],
};

const makeStyles = ({ space, gutter }: Theme) =>
  StyleSheet.create({
    chipBar: { flexGrow: 0, flexShrink: 0 },
    chips: { flexDirection: 'row', gap: space.s8, paddingRight: gutter },
    gap: { gap: space.s8 },
    month: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    event: { flexDirection: 'row', gap: space.s12, alignItems: 'baseline', paddingVertical: space.s8 },
    grow: { flex: 1, minWidth: 0 },
    two: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1, flexBasis: 0, minWidth: 0 },
  });

const CateringScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <CateringContent {...props} />
  </ServiceScope>
);

const CateringContent: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'KitchenTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectCatering);
  const thisMonth = useMemo(() => monthOf(todayInZone(TZ)), []);
  const [terms, setTerms] = useState<{ minGuests: string; leadDays: string } | null>(null);

  const wantTab = route.params?.status;
  useEffect(() => {
    if (wantTab) dispatch(setCateringTab(wantTab));
  }, [dispatch, wantTab]);
  const load = useCallback(() => {
    void dispatch(loadCateringAsync());
    void dispatch(loadCateringCalendarAsync(s.month ?? thisMonth));
  }, [dispatch, s.month, thisMonth]);
  useFocusEffect(load);

  const c = s.inbox?.counts;
  const tabs: { key: CateringTab; label: string }[] = [
    { key: 'new', label: `New · ${c?.new ?? 0}` },
    { key: 'quoted', label: `Quoted · ${c?.quoted ?? 0}` },
    { key: 'confirmed', label: `Confirmed · ${c?.confirmed ?? 0}` },
    { key: 'past', label: 'Past' },
    { key: 'calendar', label: 'Calendar' },
  ];
  const items = s.tab === 'calendar' ? [] : (s.inbox?.items.filter(r => GROUPS[s.tab as Exclude<CateringTab, 'calendar'>].includes(r.status)) ?? []);
  const month = s.month ?? thisMonth;

  return (
    <ScreenShell
      title="Catering"
      subtitle={s.settings ? (s.settings.open ? `Taking requests from ${s.settings.minGuests} guests, ${s.settings.leadDays} days ahead` : 'Not taking requests') : 'Dawat requests and quotes'}
      onBack={back}
      refreshing={s.status === 'loading' && !!s.inbox}
      onRefresh={load}
      headerRight={<IconButton icon="settings-outline" accessibilityLabel="Catering terms" onPress={() => s.settings && setTerms({ minGuests: String(s.settings.minGuests), leadDays: String(s.settings.leadDays) })} />}>
      {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : null}
      {s.settings && !s.settings.open ? (
        <InlineNotice tone="info" title="Not taking requests" message="Customers don’t see “Plan a dawat” on your page." action={{ label: 'Start taking them', onPress: () => void dispatch(saveCateringSettingsAsync({ open: true })) }} />
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
        {tabs.map(t => (
          <ChoiceChip key={t.key} label={t.label} selected={s.tab === t.key} onPress={() => dispatch(setCateringTab(t.key))} />
        ))}
      </ScrollView>

      {s.tab === 'calendar' ? (
        <>
          <View style={styles.month}>
            <IconButton icon="chevron-back" accessibilityLabel="The month before" onPress={() => void dispatch(loadCateringCalendarAsync(shiftMonth(month, -1)))} />
            <AppText variant="title">{monthLabel(month)}</AppText>
            <IconButton icon="chevron-forward" accessibilityLabel="The month after" onPress={() => void dispatch(loadCateringCalendarAsync(shiftMonth(month, 1)))} />
          </View>
          {!s.calendar || s.calendar.month !== month ? (
            <SkeletonLines lines={4} />
          ) : !s.calendar.days.length ? (
            <EmptyState icon="calendar" title="Nothing booked this month" body="Accepted and confirmed events show here by day." />
          ) : (
            s.calendar.days.map(d => (
              <Card key={d.date}>
                <View style={styles.gap}>
                  <AppText variant="title">{formatDayShort(d.date)}</AppText>
                  {d.events.map((e, n) => (
                    <View key={e.code}>
                      {n > 0 ? <Divider /> : null}
                      <Pressable style={styles.event} onPress={() => navigation.navigate('GrowthCateringRequest', { code: e.code })} accessibilityRole="button">
                        <AppText variant="bodyStrong">{timeLabel(e.time)}</AppText>
                        <AppText variant="body" style={styles.grow}>
                          {`${EVENT_TYPE_LABEL[e.eventType]} · ${e.guests} guests · ${e.customerName}`}
                        </AppText>
                        <AppText variant="caption" tone={e.status === 'confirmed' ? 'success' : 'warning'}>
                          {CATERING_STATUS[e.status].vendorLabel}
                        </AppText>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </Card>
            ))
          )}
        </>
      ) : !s.inbox ? (
        s.status === 'failed' ? null : <SkeletonLines lines={6} />
      ) : !items.length ? (
        <EmptyState
          icon="users"
          title={s.tab === 'new' ? 'No new requests' : 'Nothing here'}
          body={s.tab === 'new' ? 'When a customer plans a dawat with you, it comes here to quote.' : 'Requests move here as they go along.'}
        />
      ) : (
        items.map(r => {
          const q = latestQuote(r);
          return (
            <RowCard
              key={r.code}
              title={r.customer?.name ?? 'Customer'}
              mark={{ icon: 'people-outline', tint: 'violet' }}
              lines={[eventLine(r), r.budget ? `Budget about ${formatPKR(r.budget)}` : null, q ? `Quote v${q.version}: ${formatPKR(q.total)}` : `${r.dishes.length} dishes asked for`]}
              pill={{ label: CATERING_STATUS[r.status].vendorLabel, tone: CATERING_STATUS[r.status].tone }}
              onPress={() => navigation.navigate('GrowthCateringRequest', { code: r.code })}
            />
          );
        })
      )}

      <Sheet
        visible={!!terms}
        onClose={() => setTerms(null)}
        title="Catering terms"
        footer={
          <Button
            label="Save"
            loading={s.saving}
            onPress={async () => {
              if (!terms) return;
              const r = await dispatch(saveCateringSettingsAsync({ minGuests: Number(terms.minGuests), leadDays: Number(terms.leadDays) }));
              if (saveCateringSettingsAsync.fulfilled.match(r)) setTerms(null);
            }}
            fullWidth
          />
        }>
        {s.saveError.message ? <InlineNotice message={s.saveError.message} /> : null}
        <ToggleRow label="Take catering requests" helper="“Plan a dawat” shows on your page." value={!!s.settings?.open} onChange={open => void dispatch(saveCateringSettingsAsync({ open }))} />
        <View style={styles.two}>
          <View style={styles.half}>
            <TextField label="Fewest guests" value={terms?.minGuests ?? ''} onChangeText={minGuests => terms && setTerms({ ...terms, minGuests })} keyboardType="number-pad" />
          </View>
          <View style={styles.half}>
            <TextField label="Days ahead, at least" value={terms?.leadDays ?? ''} onChangeText={leadDays => terms && setTerms({ ...terms, leadDays })} keyboardType="number-pad" />
          </View>
        </View>
      </Sheet>
    </ScreenShell>
  );
};

export default CateringScreen;
