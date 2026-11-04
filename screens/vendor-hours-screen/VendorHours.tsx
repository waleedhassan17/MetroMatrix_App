// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor opening hours
// ═══════════════════════════════════════════════════════
// Monday to Sunday; each day any number of ranges up to four. A day with no
// range is closed. "18:00 – 02:00" runs past midnight (the label says so).

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { MAX_RANGES_PER_DAY, WEEK, rangeLabel, validateHours } from '../../models/food/vendorModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, IconButton, InlineNotice, RowCardsSkeleton, ScreenShell, SectionCard, TextAction, TimeField } from '../../Custom-Components/index';
import type { FoodVendorStackParamList } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import {
  addRange,
  copyDay,
  loadHoursAsync,
  markHoursSubmitted,
  removeRange,
  saveHoursAsync,
  selectVendorHours,
  setRange,
} from './vendorHoursSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'VendorHours'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    range: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s8 },
    field: { flex: 1 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s16 },
  });

const VendorHours: React.FC<Props> = props => (
  <ServiceScope service="food">
    <VendorHoursContent {...props} />
  </ServiceScope>
);

const VendorHoursContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVendorHours);

  useEffect(() => {
    void dispatch(loadHoursAsync());
  }, [dispatch]);

  const errors = s.submitted ? validateHours(s.ranges) : {};
  // Only a week that loaded can be saved: after a failed load the form would be empty, and saving it would close every day.
  const loaded = s.status === 'succeeded';

  const save = async () => {
    dispatch(markHoursSubmitted());
    if (Object.keys(validateHours(s.ranges)).length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(saveHoursAsync(s.ranges));
    if (saveHoursAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Opening hours saved' });
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title="Opening hours"
      subtitle="When customers can order"
      onBack={back}
      footer={loaded ? <Button label="Save hours" onPress={() => void save()} loading={s.saving} disabled={!s.dirty} fullWidth /> : undefined}
    >
      {s.error.message ? (
        <InlineNotice message={s.error.message} action={s.status === 'failed' ? { label: 'Try again', onPress: () => void dispatch(loadHoursAsync()) } : undefined} />
      ) : null}
      {errors.overlap ? <InlineNotice message={errors.overlap} /> : null}
      {!loaded ? (
        s.status === 'failed' ? null : <RowCardsSkeleton count={4} />
      ) : (
        WEEK.map(day => {
          const ranges = s.ranges.filter(r => r.weekday === day.weekday);
          const bad = ranges.some((_, i) => errors[`${day.weekday}.${i}.opensAt`] || errors[`${day.weekday}.${i}.closesAt`]);
          return (
            <SectionCard key={day.weekday} title={day.label} subtitle={ranges.length ? ranges.map(rangeLabel).join(' · ') : 'Closed'} icon={ranges.length ? 'time-outline' : 'moon-outline'} invalid={bad}>
              {ranges.map((r, i) => (
                <View key={i} style={styles.range}>
                  <View style={styles.field}>
                    <TimeField
                      label="Opens"
                      value={r.opensAt}
                      onChange={v => dispatch(setRange({ weekday: day.weekday, index: i, field: 'opensAt', value: v }))}
                      step={30}
                      error={errors[`${day.weekday}.${i}.opensAt`]}
                    />
                  </View>
                  <View style={styles.field}>
                    <TimeField
                      label="Closes"
                      value={r.closesAt}
                      onChange={v => dispatch(setRange({ weekday: day.weekday, index: i, field: 'closesAt', value: v }))}
                      step={30}
                      allowMidnight
                      error={errors[`${day.weekday}.${i}.closesAt`]}
                    />
                  </View>
                  <IconButton
                    icon="close"
                    accessibilityLabel={`Remove ${day.label}'s ${rangeLabel(r)} range`}
                    onPress={() => dispatch(removeRange({ weekday: day.weekday, index: i }))}
                  />
                </View>
              ))}
              <View style={styles.actions}>
                {ranges.length < MAX_RANGES_PER_DAY ? (
                  <TextAction label={ranges.length ? 'Add another range' : 'Open this day'} icon="add" onPress={() => dispatch(addRange(day.weekday))} />
                ) : null}
                {ranges.length ? <TextAction label="Copy to every day" icon="copy-outline" onPress={() => dispatch(copyDay({ weekday: day.weekday, to: 'all' }))} /> : null}
                {ranges.length && day.weekday >= 1 && day.weekday <= 5 ? (
                  <TextAction label="Copy to Mon–Fri" icon="calendar-outline" onPress={() => dispatch(copyDay({ weekday: day.weekday, to: 'weekdays' }))} />
                ) : null}
              </View>
            </SectionCard>
          );
        })
      )}
      <AppText variant="small" tone="muted">
        A range that closes before it opens runs past midnight, e.g. 6:00 PM to 2:00 AM.
      </AppText>
    </ScreenShell>
  );
};

export default VendorHours;
