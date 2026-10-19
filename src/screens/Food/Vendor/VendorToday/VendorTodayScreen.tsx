// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor (home kitchen): Today
// ═══════════════════════════════════════════════════════
// The day's dishes: cooking or not, and how many plates. Dishes not on
// today's menu are listed below, with the weekly menu a tap away. The
// kitchen's forecast offers today's portions in one tap; "aaj 20 biryani"
// sets them by voice; in the evening, leftovers go up as a Bachat Box.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { DAY_LONG } from '@models/food/menuModel';
import { portionsLine } from '@models/kitchen/forecastModel';
import { VoiceSheetButton } from '@components/voice/VoiceSheet';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, Button, Card, Divider, EmptyState, InlineNotice, ScreenShell, SkeletonLines, TextAction, ToggleRow } from '@custom/index';
import { PortionStepper } from '@custom/food/PortionStepper';
import { formatDayFull, hourOfDay } from '@utils/healthTime';
import { useNow } from '@hooks/useNow';
import Toast from 'react-native-toast-message';
import { haptics } from '@utils/haptics';
import { selectBusiness } from '../../../Auth/authSlice';
import { applyPortions, discardToday, editToday, loadTodayAsync, saveTodayAsync, selectSuggestedPortions, selectVendorToday } from './vendorTodaySlice';

type Nav = { navigate: (name: string, params?: object) => void };

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    dish: { gap: space.s4, paddingVertical: space.s8 },
    links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s16 },
    gap: { gap: space.s8 },
    footer: { gap: space.s4, alignItems: 'center' },
  });

const VendorTodayScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVendorToday);
  const business = useAppSelector(selectBusiness);
  const suggested = useAppSelector(selectSuggestedPortions);
  const t = s.today;
  const now = useNow(60_000);
  /** From 5 PM: leftovers can go up as a Bachat Box for tonight. */
  const evening = hourOfDay(new Date(now).toISOString(), 'Asia/Karachi') >= 17;

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadTodayAsync());
    }, [dispatch]),
  );

  const dirty = Object.keys(s.edits).length > 0;
  const onMenu = t?.items.filter(i => i.onTodaysMenu) ?? [];
  const offMenu = t?.items.filter(i => !i.onTodaysMenu) ?? [];

  const save = async () => {
    const r = await dispatch(saveTodayAsync());
    if (saveTodayAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Today saved' });
    } else haptics.warning();
  };

  return (
    <ServiceScope service="food">
      <ScreenShell
        title="Today"
        subtitle={t ? `${DAY_LONG[t.weekday]}, ${formatDayFull(t.date)}` : business?.name}
        refreshing={s.status === 'loading' && !!t}
        onRefresh={() => void dispatch(loadTodayAsync())}
        headerRight={
          <VoiceSheetButton
            context="today"
            title="Speak today’s portions"
            busy={s.saving}
            onConfirm={async a => {
              if (a.kind !== 'portions.set') return false;
              dispatch(applyPortions(a.lines.map(l => ({ itemId: l.itemId, portions: l.portions }))));
              const r = await dispatch(saveTodayAsync());
              if (saveTodayAsync.fulfilled.match(r)) {
                haptics.success();
                Toast.show({ type: 'success', text1: 'Today saved', text2: portionsLine(a.lines) });
                return true;
              }
              haptics.warning();
              return false;
            }}
          />
        }
        footer={
          dirty ? (
            <View style={styles.footer}>
              <Button label="Save today" onPress={() => void save()} loading={s.saving} fullWidth />
              <TextAction label="Discard changes" tone="muted" onPress={() => dispatch(discardToday())} />
            </View>
          ) : undefined
        }
      >
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
        {suggested.length && !dirty ? (
          <InlineNotice
            tone="info"
            title="Suggested portions for today"
            message={`From your usual orders: ${portionsLine(suggested)}.`}
            action={{ label: 'Use these', onPress: () => dispatch(applyPortions(suggested)) }}
          />
        ) : null}
        {evening && t?.items.some(i => i.onTodaysMenu && i.cooking) ? (
          <Card>
            <View style={styles.gap}>
              <AppText variant="title">Food left tonight?</AppText>
              <AppText variant="small" tone="muted">
                Put it up as a Bachat Box: sold for pickup at a lower price instead of thrown away.
              </AppText>
              <TextAction label="Make a Bachat Box" onPress={() => navigation.navigate('KitchenBoxForm', { suggest: true })} />
            </View>
          </Card>
        ) : null}
        <View style={styles.links}>
          <TextAction label="Weekly menu" icon="calendar-outline" onPress={() => navigation.navigate('VendorWeeklyMenu')} />
          <TextAction label="Pre-order slots" icon="time-outline" onPress={() => navigation.navigate('VendorPreorderSlots')} />
        </View>
        {!t ? (
          s.status === 'failed' ? null : <SkeletonLines lines={8} />
        ) : !t.items.length ? (
          <EmptyState icon="book-open" title="Add your dishes first" body="Put your dishes on the menu, then set how many plates you cook each day." action={{ label: 'Open the menu', onPress: () => navigation.navigate('VendorMenuPage') }} />
        ) : (
          <>
            <AppText variant="sectionTitle">Cooking today</AppText>
            {onMenu.length ? (
              <Card padded="horizontal">
                {onMenu.map((i, n) => {
                  const e = s.edits[i.itemId] ?? {};
                  const cooking = e.cooking ?? i.cooking;
                  const portions = e.portions !== undefined ? e.portions : i.dailyLimit;
                  return (
                    <View key={i.itemId}>
                      {n > 0 ? <Divider /> : null}
                      <View style={styles.dish}>
                        <ToggleRow label={i.name} helper={cooking ? undefined : 'Off for today'} value={cooking} onChange={v => dispatch(editToday({ itemId: i.itemId, edit: { cooking: v } }))} />
                        {cooking ? <PortionStepper name={i.name} portions={portions} sold={i.sold} onChange={p => dispatch(editToday({ itemId: i.itemId, edit: { portions: p } }))} /> : null}
                      </View>
                    </View>
                  );
                })}
              </Card>
            ) : (
              <AppText variant="small" tone="muted">
                Nothing is on today’s menu. Choose the days for each dish in the weekly menu.
              </AppText>
            )}
            {offMenu.length ? (
              <>
                <AppText variant="sectionTitle">Not on today’s menu</AppText>
                <Card padded="horizontal">
                  {offMenu.map((i, n) => (
                    <View key={i.itemId}>
                      {n > 0 ? <Divider /> : null}
                      <View style={styles.dish}>
                        <AppText variant="bodyStrong" tone="muted">
                          {i.name}
                        </AppText>
                      </View>
                    </View>
                  ))}
                </Card>
              </>
            ) : null}
          </>
        )}
      </ScreenShell>
    </ServiceScope>
  );
};

export default VendorTodayScreen;
