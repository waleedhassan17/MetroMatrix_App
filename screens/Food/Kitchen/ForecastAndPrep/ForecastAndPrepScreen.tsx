// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen: forecast and prep
// ═══════════════════════════════════════════════════════
// Pick a day (tomorrow first): how many of each dish to expect, with its
// likely range and − / + to set the kitchen's own number; how accurate the
// forecast has been, and what that means; the prep sheet that follows
// (ticked off line by line, shared as text to WhatsApp) and the shopping
// list (what to buy beyond what is in stock, added as a purchase once
// bought). A home kitchen sets today's portions to the plan in one tap.
// Phone: three tabs. Tablet: the forecast beside the prep sheet or list.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { useLayoutClass } from '../../../../hooks/useLayoutClass';
import {
  ACCURACY_EXPLAINED,
  LEARNING_BODY,
  LEARNING_TITLE,
  accuracyBadge,
  barMax,
  dayLabel,
  defaultForecastDate,
  dishesLine,
  forecastDates,
  forecastHeadline,
  needHaveLabel,
  prepGroups,
  purchaseDraftOf,
} from '../../../../models/kitchen/forecastModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, DateStrip, Divider, EmptyState, ForecastBar, InlineNotice, PrepList, ScreenShell, SegmentTabs, Sheet, SkeletonLines, StatusPill, TextAction } from '../../../../Custom-Components/index';
import type { FoodVendorStackParamList, ShoppingList } from '../../../../types';
import { formatDayChip, todayInZone } from '../../../../utils/healthTime';
import { formatPKR } from '../../../../utils/money';
import { formatQty } from '../../../../utils/units';
import { haptics } from '../../../../utils/haptics';
import { shareText } from '../../../../utils/shareText';
import { selectBusiness } from '../../../Auth/authSlice';
import {
  adjustDishAsync,
  applyTodayPortionsAsync,
  loadForecastAsync,
  loadPrepAsync,
  loadShoppingAsync,
  selectForecastAndPrep,
  setForecastDate,
  setForecastTab,
  togglePrepLine,
  type ForecastTab,
} from './forecastAndPrepSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenForecast'>;

const TZ = 'Asia/Karachi';

const TABS: { key: ForecastTab; label: string }[] = [
  { key: 'forecast', label: 'Forecast' },
  { key: 'prep', label: 'Prep sheet' },
  { key: 'shopping', label: 'To buy' },
];
const SIDE_TABS = TABS.filter(t => t.key !== 'forecast');

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    columns: { flexDirection: 'row', gap: space.s16, alignItems: 'flex-start' },
    column: { flex: 1, gap: space.s16 },
    gap: { gap: space.s12 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: space.s8, flexWrap: 'wrap' },
    line: { paddingVertical: space.s12 },
  });

const ForecastAndPrepScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <ForecastAndPrepContent {...props} />
  </ServiceScope>
);

const notify = (outcome: Awaited<ReturnType<typeof shareText>>) => {
  if (outcome === 'copied') Toast.show({ type: 'success', text1: 'Copied', text2: 'Paste it into WhatsApp or a message.' });
};

const ForecastAndPrepContent: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'KitchenTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const layout = useLayoutClass();
  const s = useAppSelector(selectForecastAndPrep);
  const homeKitchen = useAppSelector(selectBusiness)?.subType === 'home_kitchen';
  const today = useMemo(() => todayInZone(TZ), []);
  const days = useMemo(() => forecastDates(today), [today]);
  const [explaining, setExplaining] = useState(false);

  // Opened from a card ("Open the prep sheet" for tomorrow): its day and tab.
  const wantDate = route.params?.date;
  const wantTab = route.params?.tab;
  useEffect(() => {
    dispatch(setForecastDate(wantDate && days.includes(wantDate) ? wantDate : defaultForecastDate(today)));
    if (wantTab) dispatch(setForecastTab(wantTab));
  }, [dispatch, wantDate, wantTab, days, today]);

  const date = s.date && days.includes(s.date) ? s.date : defaultForecastDate(today);
  const load = useCallback(() => {
    void dispatch(loadForecastAsync(date));
    void dispatch(loadPrepAsync(date));
    void dispatch(loadShoppingAsync(date));
  }, [dispatch, date]);
  useFocusEffect(load);

  const f = s.forecast[date];
  const prep = s.prep[date];
  const shop = s.shopping[date];
  const forecast = f?.data ?? null;
  const badge = accuracyBadge(s.accuracy);
  const tablet = layout === 'tablet';
  const tab: ForecastTab = tablet && s.tab === 'forecast' ? 'prep' : s.tab;

  const strip = (
    <DateStrip
      days={days.map(d => ({ date: d, slotCount: 1 }))}
      selected={date}
      onSelect={d => dispatch(setForecastDate(d))}
      describe={d => ({ sub: d.date === today ? 'Today' : formatDayChip(d.date).month, label: dayLabel(d.date, today) })}
    />
  );

  const forecastPart = (
    <View style={styles.gap}>
      {forecast?.learning ? (
        <InlineNotice tone="info" title={LEARNING_TITLE} message={`${LEARNING_BODY} ${forecast.basisDays ? `Based on ${forecast.basisDays} days so far.` : ''}`.trim()} />
      ) : badge ? (
        <View style={styles.badge}>
          <StatusPill label={badge} tone="success" />
          <TextAction label="What this means" onPress={() => setExplaining(true)} />
        </View>
      ) : null}
      {s.actionError.message ? <InlineNotice message={s.actionError.message} /> : null}
      {!forecast ? (
        f?.status === 'failed' ? (
          <InlineNotice message={f.error.message} action={{ label: 'Try again', onPress: load }} />
        ) : (
          <SkeletonLines lines={8} />
        )
      ) : !forecast.items.length ? (
        <EmptyState icon="calendar" title="Nothing on the menu that day" body={homeKitchen ? 'Choose the days for each dish in your weekly menu.' : 'No dishes are served that day.'} />
      ) : (
        <Card padded="horizontal">
          {forecast.items.map((i, n) => (
            <View key={i.itemId}>
              {n > 0 ? <Divider /> : null}
              <ForecastBar
                item={i}
                max={barMax(forecast.items)}
                busy={s.adjusting === i.itemId}
                onAdjust={adjusted => {
                  haptics.select();
                  void dispatch(adjustDishAsync({ date, itemId: i.itemId, adjusted }));
                }}
              />
            </View>
          ))}
        </Card>
      )}
      {homeKitchen && forecast?.items.length ? (
        date === today ? (
          <Button
            label="Set today’s portions to these"
            variant="secondary"
            loading={s.applying}
            onPress={async () => {
              const r = await dispatch(applyTodayPortionsAsync(date));
              if (applyTodayPortionsAsync.fulfilled.match(r)) {
                haptics.success();
                Toast.show({ type: 'success', text1: 'Today’s portions set', text2: 'Change any of them on Today.' });
              } else haptics.warning();
            }}
            fullWidth
          />
        ) : (
          <AppText variant="small" tone="muted">
            On the day, Today offers these numbers as your portions in one tap.
          </AppText>
        )
      ) : null}
    </View>
  );

  const prepPart = (
    <View style={styles.gap}>
      {!prep?.data ? (
        prep?.status === 'failed' ? <InlineNotice message={prep.error.message} action={{ label: 'Try again', onPress: load }} /> : <SkeletonLines lines={8} />
      ) : !prep.data.groups.length ? (
        <EmptyState
          icon="clipboard"
          title="No prep for this day"
          body={prep.data.dishes.length ? 'Add recipe cards to your dishes and their ingredients show up here.' : 'Nothing is expected that day.'}
          action={prep.data.dishes.length ? { label: 'Recipes and costs', onPress: () => navigation.navigate('KitchenRecipes', { needsRecipe: true }) } : undefined}
        />
      ) : (
        <>
          <AppText variant="small" tone="muted">
            {`${dishesLine(prep.data)}.`}
          </AppText>
          <Card>
            <PrepList
              groups={prepGroups(prep.data)}
              done={s.done}
              onToggle={id => {
                haptics.select();
                dispatch(togglePrepLine(id));
              }}
              onShare={() => void shareText(prep.data!.shareText, `Prep sheet, ${dayLabel(date, today)}`).then(notify)}
              shareLabel="Share the prep sheet"
            />
          </Card>
        </>
      )}
    </View>
  );

  const shoppingPart = (
    <View style={styles.gap}>
      {!shop?.data ? (
        shop?.status === 'failed' ? <InlineNotice message={shop.error.message} action={{ label: 'Try again', onPress: load }} /> : <SkeletonLines lines={8} />
      ) : !shop.data.lines.length ? (
        <EmptyState icon="shopping-bag" title="Nothing to buy" body="What is in stock covers the dishes expected that day." />
      ) : (
        <ShoppingCard
          list={shop.data}
          onShare={() => void shareText(shop.data!.shareText, `To buy, ${dayLabel(date, today)}`).then(notify)}
          onBought={() => navigation.navigate('KitchenPurchaseForm', { draft: purchaseDraftOf(shop.data!) })}
        />
      )}
    </View>
  );

  return (
    <ScreenShell
      title="Forecast and prep"
      subtitle={forecast ? forecastHeadline(forecast, today) : 'What to expect, prep and buy'}
      onBack={back}
      refreshing={f?.status === 'loading' && !!forecast}
      onRefresh={load}>
      {strip}
      {tablet ? (
        <View style={styles.columns}>
          <View style={styles.column}>{forecastPart}</View>
          <View style={styles.column}>
            <SegmentTabs options={SIDE_TABS} value={tab} onChange={t => dispatch(setForecastTab(t))} accessibilityLabel="Prep sheet or shopping list" />
            {tab === 'shopping' ? shoppingPart : prepPart}
          </View>
        </View>
      ) : (
        <>
          <SegmentTabs options={TABS} value={tab} onChange={t => dispatch(setForecastTab(t))} accessibilityLabel="Forecast, prep sheet or shopping list" />
          {tab === 'forecast' ? forecastPart : tab === 'prep' ? prepPart : shoppingPart}
        </>
      )}

      <Sheet visible={explaining} onClose={() => setExplaining(false)} title={badge ?? 'Forecast accuracy'} footer={<Button label="Got it" onPress={() => setExplaining(false)} fullWidth />}>
        <View style={styles.gap}>
          {s.accuracy?.note ? <AppText variant="bodyStrong">{s.accuracy.note}</AppText> : null}
          {ACCURACY_EXPLAINED.map(t => (
            <AppText key={t} variant="body">
              {t}
            </AppText>
          ))}
        </View>
      </Sheet>
    </ScreenShell>
  );
};

/** What to buy: the amount beyond stock, why, and roughly what it costs. */
const ShoppingCard: React.FC<{ list: ShoppingList; onShare: () => void; onBought: () => void }> = ({ list, onShare, onBought }) => {
  const styles = useStyles(makeStyles);
  const toBuy = list.lines.filter(l => l.toBuy > 0);
  const covered = list.lines.filter(l => l.toBuy <= 0);
  return (
    <>
      <Card padded="horizontal">
        {toBuy.map((l, n) => (
          <View key={l.ingredientId}>
            {n > 0 ? <Divider /> : null}
            <View style={[styles.row, styles.line]}>
              <View style={styles.grow}>
                <AppText variant="bodyStrong">{l.name}</AppText>
                <AppText variant="caption" tone="muted">
                  {needHaveLabel(l)}
                </AppText>
              </View>
              <View>
                <AppText variant="title" align="right">
                  {formatQty(l.toBuy, l.baseUnit, { dozens: l.dozens })}
                </AppText>
                {l.estCost ? (
                  <AppText variant="caption" tone="muted" align="right">
                    {`about ${formatPKR(l.estCost)}`}
                  </AppText>
                ) : null}
              </View>
            </View>
          </View>
        ))}
        {!toBuy.length ? (
          <View style={styles.line}>
            <AppText variant="body" tone="muted">
              Everything is in stock.
            </AppText>
          </View>
        ) : null}
      </Card>
      {list.estTotal ? (
        <View style={styles.row}>
          <AppText variant="title">About</AppText>
          <AppText variant="title">{formatPKR(list.estTotal)}</AppText>
        </View>
      ) : null}
      {covered.length ? (
        <AppText variant="small" tone="muted">
          {`In stock already: ${covered.map(l => l.name).join(', ')}.`}
        </AppText>
      ) : null}
      <Button label="Share the list" variant="secondary" leftIcon="share-outline" onPress={onShare} fullWidth />
      {toBuy.length ? <Button label="Bought it: add as a purchase" leftIcon="cart-outline" onPress={onBought} fullWidth /> : null}
    </>
  );
};

export default ForecastAndPrepScreen;
