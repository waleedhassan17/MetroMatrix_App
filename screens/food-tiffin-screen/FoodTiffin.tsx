// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: a tiffin subscription
// ═══════════════════════════════════════════════════════
// Where it stands (waiting for the kitchen, active, paused), the next
// delivery, the month as a calendar: tap a day to skip or un-skip it until
// its cut-off (after that it is closed, and the day says why). The
// period's payment to the kitchen (a transfer with its receipt, or cash),
// pausing while away, cancelling.

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { TIFFIN_DAY, TIFFIN_STATUS, WEEKDAY_SHORT, tiffinPaymentStatus } from '../../models/kitchen/kitchenStatusModel';
import { cutoffLabel, dayA11y, monthGrid, monthLabel, monthOf, periodAmountLabel, periodLabel, scheduleLabel, shiftMonth } from '../../models/kitchen/tiffinModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, Card, IconButton, InlineNotice, ScreenShell, Sheet, SkeletonLines, StatusPill } from '../../Custom-Components/index';
import { ChoiceLine } from '../../Custom-Components/food/ChoiceLine';
import { TransferCard } from '../../Custom-Components/food/TransferCard';
import type { FoodAppParamList, TiffinDay } from '../../models';
import { addDays, formatDayShort, formatWhen, todayInZone } from '../../utils/health-time/healthTime';
import { formatPKR } from '../../utils/money/money';
import { haptics } from '../../utils/haptics/haptics';
import { loadMyTiffinAsync, selectFoodTiffinUi, selectMyTiffin, selectTiffinCalendar, tiffinActAsync, tiffinDayAsync, type TiffinAct } from './foodTiffinSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodTiffin'>;

const TZ = 'Asia/Karachi';
const PAUSE_FOR: { label: string; days: number | null }[] = [
  { label: 'Until I resume', days: null },
  { label: 'One week', days: 7 },
  { label: 'Two weeks', days: 14 },
];

const makeStyles = ({ space, radius, colors, size }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s8 },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    month: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    week: { flexDirection: 'row', gap: space.s4 },
    cell: { flex: 1, aspectRatio: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: size.focusBorder },
    empty: { flex: 1, aspectRatio: 1 },
    head: { flex: 1, alignItems: 'center' },
    dot: { width: size.focusBorder * 3, height: size.focusBorder * 3, borderRadius: radius.pill },
    today: { borderWidth: size.border, borderColor: colors.ink },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    swatch: { width: space.s12, height: space.s12, borderRadius: radius.sm, borderWidth: size.border, borderColor: colors.line },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const FoodTiffin: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodTiffinContent {...props} />
  </ServiceScope>
);

const FoodTiffinContent: React.FC<Props> = ({ navigation, route }) => {
  const { code, fresh } = route.params;
  const { back } = useBack({ name: 'FoodTiffins' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const today = useMemo(() => todayInZone(TZ), []);
  const [month, setMonth] = useState(() => monthOf(today));
  const [day, setDay] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'pause' | 'cancel' | null>(null);
  const ui = useAppSelector(selectFoodTiffinUi);
  const x = useAppSelector(st => selectMyTiffin(st, code));
  const cal = useAppSelector(st => selectTiffinCalendar(st, code, month));

  const load = useCallback(() => void dispatch(loadMyTiffinAsync({ code, month })), [dispatch, code, month]);
  useFocusEffect(load);

  if (!x) {
    return (
      <ScreenShell title="Tiffin" onBack={back}>
        {ui.status === 'failed' ? <InlineNotice message={ui.error.message} action={ui.error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: load }} /> : <SkeletonLines lines={10} />}
      </ScreenShell>
    );
  }

  const status = TIFFIN_STATUS[x.status];
  const picked: TiffinDay | null = day ? (cal?.days.find(d => d.date === day) ?? null) : null;
  const pay = x.period ? tiffinPaymentStatus(x.period.payment.status) : null;

  /** The day's colour: coming (accent), skipped or paused (sunk), delivered (success), nothing (none). */
  const fill = (d: TiffinDay) =>
    d.state === 'upcoming' || d.state === 'ordered'
      ? service.accentSoft
      : d.state === 'delivered'
        ? colors.successSoft
        : d.state === 'skipped' || d.state === 'paused' || d.state === 'pending'
          ? colors.surfaceSunk
          : 'transparent';

  const act = async (a: TiffinAct, done: string) => {
    haptics.press();
    const r = await dispatch(tiffinActAsync({ code, act: a }));
    if (tiffinActAsync.fulfilled.match(r)) {
      haptics.success();
      setSheet(null);
      Toast.show({ type: 'success', text1: done });
      load();
    } else haptics.warning();
  };

  const skip = async (d: TiffinDay, on: boolean) => {
    haptics.press();
    const r = await dispatch(tiffinDayAsync({ code, date: d.date, skip: on }));
    if (tiffinDayAsync.fulfilled.match(r)) {
      haptics.success();
      setDay(null);
      Toast.show({ type: 'success', text1: on ? `${formatDayShort(d.date)} skipped` : `${formatDayShort(d.date)} back on`, text2: on ? 'It comes off your next period.' : undefined });
    } else haptics.warning();
  };

  return (
    <ScreenShell title={x.plan.name} subtitle={`${x.vendor.name} · ${status.label}`} onBack={back} refreshing={ui.status === 'loading'} onRefresh={load}>
      {fresh && x.status === 'pending' ? (
        <InlineNotice tone="success" title="Request sent" message={`${x.vendor.name} approves it, then your first period is due. You start ${formatDayShort(x.startDate)}.`} />
      ) : null}
      {ui.actionError.message && !day && !sheet ? <InlineNotice message={ui.actionError.message} /> : null}
      {x.status === 'declined' && x.declineReason ? <InlineNotice title={`${x.vendor.name} couldn’t take it`} message={x.declineReason} /> : null}

      <Card>
        <View style={styles.gap}>
          <View style={styles.pills}>
            <StatusPill label={status.label} tone={status.tone} />
            <StatusPill label={scheduleLabel(x.plan)} />
          </View>
          {x.nextDelivery ? (
            <>
              <AppText variant="title">{`Next: ${formatDayShort(x.nextDelivery.date)}, ${x.plan.window.label}`}</AppText>
              <AppText variant="body">{x.nextDelivery.dishes.join(', ')}</AppText>
              <AppText variant="caption" tone="muted">
                {cutoffLabel(x.nextDelivery.cutoffAt, TZ)}
              </AppText>
            </>
          ) : x.status === 'pending' ? (
            <AppText variant="body">{`Starts ${formatDayShort(x.startDate)} once ${x.vendor.name} approves.`}</AppText>
          ) : x.status === 'paused' ? (
            <AppText variant="body">{x.pausedUntil ? `Paused until ${formatDayShort(x.pausedUntil)}.` : 'Paused until you resume it.'}</AppText>
          ) : null}
          {x.address ? (
            <AppText variant="small" tone="muted">
              {`${x.plan.mode === 'delivery' ? 'To' : 'Collect from the kitchen'} ${[x.address.line1, x.address.area].filter(Boolean).join(', ')}`}
            </AppText>
          ) : null}
        </View>
      </Card>

      {['pending', 'active', 'paused'].includes(x.status) || cal?.days.some(d => d.state === 'delivered') ? (
        <Card>
          <View style={styles.gap}>
            <View style={styles.month}>
              <IconButton icon="chevron-back" accessibilityLabel="The month before" onPress={() => setMonth(m => shiftMonth(m, -1))} />
              <AppText variant="title">{monthLabel(month)}</AppText>
              <IconButton icon="chevron-forward" accessibilityLabel="The month after" onPress={() => setMonth(m => shiftMonth(m, 1))} />
            </View>
            <View style={styles.week}>
              {[1, 2, 3, 4, 5, 6, 7].map(d => (
                <View key={d} style={styles.head}>
                  <AppText variant="micro" tone="muted">
                    {WEEKDAY_SHORT[d].toUpperCase()}
                  </AppText>
                </View>
              ))}
            </View>
            {!cal ? (
              <SkeletonLines lines={5} />
            ) : (
              monthGrid(cal.days).map((week, w) => (
                <View key={w} style={styles.week}>
                  {week.map((d, n) =>
                    d ? (
                      <Pressable
                        key={d.date}
                        onPress={() => (d.state === 'off' || d.state === 'before_start' ? undefined : setDay(d.date))}
                        style={[styles.cell, { backgroundColor: fill(d) }, d.date === today && styles.today]}
                        accessibilityRole="button"
                        accessibilityLabel={dayA11y(d, TIFFIN_DAY[d.state].label)}>
                        <AppText variant="small" tone={d.state === 'off' || d.state === 'before_start' || d.state === 'none' ? 'faint' : 'ink'}>
                          {String(Number(d.date.slice(8)))}
                        </AppText>
                        {d.state === 'skipped' ? <View style={[styles.dot, { backgroundColor: colors.inkMuted }]} /> : null}
                      </Pressable>
                    ) : (
                      <View key={`e${n}`} style={styles.empty} />
                    ),
                  )}
                </View>
              ))
            )}
            <View style={styles.legend}>
              {[
                [service.accentSoft, 'Coming'],
                [colors.successSoft, 'Delivered'],
                [colors.surfaceSunk, 'Skipped or paused'],
              ].map(([c, l]) => (
                <View key={l} style={styles.legendItem}>
                  <View style={[styles.swatch, { backgroundColor: c }]} />
                  <AppText variant="caption" tone="muted">
                    {l}
                  </AppText>
                </View>
              ))}
            </View>
            <AppText variant="caption" tone="muted">
              Tap a day to skip it, until its cut-off.
            </AppText>
          </View>
        </Card>
      ) : null}

      {x.period ? (
        x.period.payment.method === 'transfer' && x.period.payment.accounts?.length ? (
          <>
            <AppText variant="small" tone="muted">
              {`${periodLabel(x.period)}: ${periodAmountLabel(x.period, x.plan.perMeal)}`}
            </AppText>
            <TransferCard
              vendorName={x.vendor.name}
              amount={x.period.amount}
              accounts={x.period.payment.accounts}
              status={x.period.payment.status}
              payBy={null}
              reference={x.period.payment.reference}
              rejectedReason={x.period.payment.rejectedReason}
              onSendReceipt={x.period.payment.status === 'awaiting_transfer' ? () => navigation.navigate('PaymentProof', { tiffinPeriodId: x.period!.id, tiffinCode: x.code }) : undefined}
            />
          </>
        ) : (
          <Card>
            <View style={styles.gap}>
              <View style={styles.month}>
                <AppText variant="title">{periodLabel(x.period)}</AppText>
                {pay ? <StatusPill label={pay.label} tone={pay.tone} /> : null}
              </View>
              <AppText variant="body">{periodAmountLabel(x.period, x.plan.perMeal)}</AppText>
              {x.period.payment.status === 'unpaid' ? (
                <AppText variant="small" tone="muted">{`Pay ${formatPKR(x.period.amount)} in cash with the first delivery of the period.`}</AppText>
              ) : null}
            </View>
          </Card>
        )
      ) : null}
      <AppText variant="caption" tone="muted">
        You pay the kitchen directly. MetroMatrix takes no commission.
      </AppText>

      <View style={styles.actions}>
        {x.canPause ? <Button label="Pause" variant="secondary" leftIcon="pause-outline" onPress={() => setSheet('pause')} /> : null}
        {x.canResume ? <Button label="Resume" leftIcon="play-outline" loading={ui.busy === 'sub'} onPress={() => void act({ kind: 'resume' }, 'Resumed')} /> : null}
        {x.canCancel ? <Button label={x.status === 'pending' ? 'Withdraw the request' : 'Cancel the tiffin'} variant="secondary" onPress={() => setSheet('cancel')} /> : null}
      </View>

      <Sheet
        visible={!!picked}
        onClose={() => setDay(null)}
        title={picked ? formatDayShort(picked.date) : ''}
        subtitle={picked ? TIFFIN_DAY[picked.state].label : undefined}
        footer={
          picked?.canSkip ? (
            <Button label="Skip this day" variant="secondary" loading={ui.busy === picked.date} onPress={() => void skip(picked, true)} fullWidth />
          ) : picked?.canUnskip ? (
            <Button label="Bring it back" loading={ui.busy === picked.date} onPress={() => void skip(picked, false)} fullWidth />
          ) : undefined
        }>
        {picked ? (
          <View style={styles.gap}>
            {ui.actionError.message ? <InlineNotice message={ui.actionError.message} /> : null}
            {picked.dishes.length ? <AppText variant="body">{picked.dishes.join(', ')}</AppText> : null}
            {picked.orderCode ? <AppText variant="small">{`Order ${picked.orderCode}`}</AppText> : null}
            {picked.cutoffAt ? (
              <AppText variant="small" tone={picked.canSkip || picked.canUnskip ? 'muted' : 'warning'}>
                {picked.canSkip || picked.canUnskip
                  ? cutoffLabel(picked.cutoffAt, TZ)
                  : ['upcoming', 'ordered', 'skipped'].includes(picked.state)
                    ? `Changes closed at ${formatWhen(picked.cutoffAt, TZ)}: the kitchen has started on it.`
                    : ''}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={sheet === 'pause'} onClose={() => setSheet(null)} title="Pause your tiffin" subtitle="From the next day you can still change.">
        {ui.actionError.message ? <InlineNotice message={ui.actionError.message} /> : null}
        {PAUSE_FOR.map(p => (
          <ChoiceLine
            key={p.label}
            label={p.label}
            price={null}
            selected={false}
            multiple={false}
            disabled={ui.busy === 'sub'}
            onPress={() => void act({ kind: 'pause', until: p.days === null ? null : addDays(today, p.days) }, 'Paused')}
          />
        ))}
      </Sheet>

      <Sheet
        visible={sheet === 'cancel'}
        onClose={() => setSheet(null)}
        title={x.status === 'pending' ? 'Withdraw your request?' : 'Cancel your tiffin?'}
        subtitle={x.status === 'pending' ? undefined : 'Days the kitchen has started on still come.'}
        footer={<Button label={x.status === 'pending' ? 'Withdraw it' : 'Cancel it'} variant="destructive" loading={ui.busy === 'sub'} onPress={() => void act({ kind: 'cancel' }, 'Cancelled')} fullWidth />}>
        <Button label="Keep it" variant="secondary" onPress={() => setSheet(null)} fullWidth />
      </Sheet>
    </ScreenShell>
  );
};

export default FoodTiffin;
