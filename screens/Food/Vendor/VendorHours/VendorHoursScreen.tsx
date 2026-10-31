// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor opening hours
// ═══════════════════════════════════════════════════════
// Monday to Sunday; each day any number of ranges up to four. A day with no
// range is closed. "18:00 – 02:00" runs past midnight (the label says so).

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { MAX_RANGES_PER_DAY, WEEK, rangeLabel, validateHours } from '../../../../models/food/vendorModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, IconButton, InlineNotice, ScreenShell, SkeletonLines, TextAction, TextField } from '../../../../Custom-Components/index';
import type { FoodVendorStackParamList } from '../../../../types';
import { haptics } from '../../../../utils/haptics';
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
    day: { gap: space.s8 },
    head: { gap: space.s4 },
    range: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8 },
    field: { flex: 1 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s16 },
  });

const VendorHoursScreen: React.FC<Props> = props => (
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
      footer={<Button label="Save hours" onPress={() => void save()} loading={s.saving} disabled={!s.dirty && s.status !== 'failed'} fullWidth />}
    >
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      {errors.overlap ? <InlineNotice message={errors.overlap} /> : null}
      {s.status === 'loading' && !s.ranges.length ? (
        <SkeletonLines lines={10} />
      ) : (
        WEEK.map(day => {
          const ranges = s.ranges.filter(r => r.weekday === day.weekday);
          return (
            <Card key={day.weekday} style={styles.day}>
              <View style={styles.head}>
                <AppText variant="title">{day.label}</AppText>
                <AppText variant="small" tone="muted">
                  {ranges.length ? ranges.map(rangeLabel).join(' · ') : 'Closed'}
                </AppText>
              </View>
              {ranges.map((r, i) => (
                <View key={i} style={styles.range}>
                  <View style={styles.field}>
                    <TextField
                      label="Opens"
                      value={r.opensAt}
                      onChangeText={v => dispatch(setRange({ weekday: day.weekday, index: i, field: 'opensAt', value: v }))}
                      placeholder="12:00"
                      maxLength={5}
                      keyboardType="numbers-and-punctuation"
                      error={errors[`${day.weekday}.${i}.opensAt`]}
                    />
                  </View>
                  <View style={styles.field}>
                    <TextField
                      label="Closes"
                      value={r.closesAt}
                      onChangeText={v => dispatch(setRange({ weekday: day.weekday, index: i, field: 'closesAt', value: v }))}
                      placeholder="23:00"
                      maxLength={5}
                      keyboardType="numbers-and-punctuation"
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
            </Card>
          );
        })
      )}
      <AppText variant="small" tone="muted">
        A range that closes before it opens runs past midnight, e.g. 18:00 to 02:00.
      </AppText>
    </ScreenShell>
  );
};

export default VendorHoursScreen;
