// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor (home kitchen): the weekly menu
// ═══════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { DAY_SHORT, EVERY_DAY, WEEK_ORDER, daysLabel } from '../../../../models/food/menuModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, ChoiceChip, EmptyState, InlineNotice, ScreenShell, SkeletonLines, TextAction } from '../../../../Custom-Components/index';
import { haptics } from '../../../../utils/haptics';
import { loadWeeklyMenuAsync, saveWeeklyMenuAsync, selectVendorWeeklyMenu, setWeeklyDays, toggleWeeklyDay } from './vendorWeeklyMenuSlice';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    card: { gap: space.s8 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s8 },
    name: { flex: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const VendorWeeklyMenuScreen: React.FC = () => {
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'TodayTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVendorWeeklyMenu);

  useEffect(() => {
    void dispatch(loadWeeklyMenuAsync());
  }, [dispatch]);

  const dirty = s.saved.some(r => JSON.stringify(r.days) !== JSON.stringify(s.days[r.itemId]));
  const empty = s.saved.some(r => !(s.days[r.itemId] ?? []).length);

  const save = async () => {
    const r = await dispatch(saveWeeklyMenuAsync());
    if (saveWeeklyMenuAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Weekly menu saved' });
      back();
    } else haptics.warning();
  };

  return (
    <ServiceScope service="food">
      <ScreenShell
        title="Weekly menu"
        subtitle="The days you cook each dish"
        onBack={back}
        footer={dirty ? <Button label="Save weekly menu" onPress={() => void save()} loading={s.saving} disabled={empty} fullWidth /> : undefined}
      >
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
        {empty ? <InlineNotice tone="warning" message="Every dish needs at least one day. To stop cooking one, hide it from the menu instead." /> : null}
        {s.status === 'loading' && !s.saved.length ? (
          <SkeletonLines lines={8} />
        ) : !s.saved.length ? (
          <EmptyState icon="calendar" title="No dishes yet" body="Add dishes to your menu, then choose the days you cook each one." />
        ) : (
          s.saved.map(r => {
            const days = s.days[r.itemId] ?? [];
            return (
              <Card key={r.itemId} style={styles.card}>
                <View style={styles.head}>
                  <View style={styles.name}>
                    <AppText variant="bodyStrong">{r.name}</AppText>
                    <AppText variant="small" tone="muted">
                      {daysLabel(days)}
                    </AppText>
                  </View>
                  {days.length < 7 ? <TextAction label="Every day" onPress={() => dispatch(setWeeklyDays({ itemId: r.itemId, days: EVERY_DAY }))} /> : null}
                </View>
                <View style={styles.chips}>
                  {WEEK_ORDER.map(d => (
                    <ChoiceChip key={d} label={DAY_SHORT[d]} selected={days.includes(d)} onPress={() => dispatch(toggleWeeklyDay({ itemId: r.itemId, day: d }))} />
                  ))}
                </View>
              </Card>
            );
          })
        )}
      </ScreenShell>
    </ServiceScope>
  );
};

export default VendorWeeklyMenuScreen;
