// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor (home kitchen): Today
// ═══════════════════════════════════════════════════════
// The day's dishes: cooking or not, and how many plates. Dishes not on
// today's menu are listed below, with the weekly menu a tap away.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { DAY_LONG } from '@models/food/menuModel';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, Button, Card, Divider, EmptyState, InlineNotice, ScreenShell, SkeletonLines, TextAction, ToggleRow } from '@custom/index';
import { PortionStepper } from '@custom/food/PortionStepper';
import { formatDayFull } from '@utils/healthTime';
import Toast from 'react-native-toast-message';
import { haptics } from '@utils/haptics';
import { selectBusiness } from '../../../Auth/authSlice';
import { discardToday, editToday, loadTodayAsync, saveTodayAsync, selectVendorToday } from './vendorTodaySlice';

type Nav = { navigate: (name: string, params?: object) => void };

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    dish: { gap: space.s4, paddingVertical: space.s8 },
    links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s16 },
    footer: { gap: space.s4, alignItems: 'center' },
  });

const VendorTodayScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVendorToday);
  const business = useAppSelector(selectBusiness);
  const t = s.today;

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
        <View style={styles.links}>
          <TextAction label="Weekly menu" icon="calendar-outline" onPress={() => navigation.navigate('VendorWeeklyMenu')} />
          <TextAction label="Pre-order slots" icon="time-outline" onPress={() => navigation.navigate('VendorPreorderSlots')} />
        </View>
        {!t ? (
          s.status === 'failed' ? null : <SkeletonLines lines={8} />
        ) : !t.items.length ? (
          <EmptyState icon="book-open" title="Add your dishes first" body="Put your dishes on the menu, then set how many plates you cook each day." action={{ label: 'Open the menu', onPress: () => navigation.navigate('MenuTab') }} />
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
