// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor (home kitchen): pre-order slots
// ═══════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { CUTOFF_CHOICES, DAY_LONG, MAX_SLOTS, WEEK_ORDER, cutoffLabel, validateSlots } from '../../models/food/menuModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, ChoiceChip, Divider, IconButton, InlineNotice, ScreenShell, SkeletonLines, TextAction, TextField } from '../../Custom-Components/index';
import { haptics } from '../../utils/haptics/haptics';
import { addSlot, loadPreorderSlotsAsync, markSlotsSubmitted, removeSlot, savePreorderSlotsAsync, selectVendorPreorderSlots, setSlot } from './vendorPreorderSlotsSlice';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    card: { gap: space.s8 },
    slot: { gap: space.s8, paddingVertical: space.s8 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8 },
    field: { flex: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const VendorPreorderSlots: React.FC = () => {
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'TodayTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVendorPreorderSlots);

  useEffect(() => {
    void dispatch(loadPreorderSlotsAsync());
  }, [dispatch]);

  const errors = s.submitted ? validateSlots(s.rows) : {};
  const dirty = JSON.stringify(s.rows) !== s.saved;

  const save = async () => {
    dispatch(markSlotsSubmitted());
    if (Object.keys(validateSlots(s.rows)).length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(savePreorderSlotsAsync(s.rows));
    if (savePreorderSlotsAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Slots saved' });
    } else haptics.warning();
  };

  return (
    <ServiceScope service="food">
      <ScreenShell
        title="Pre-order slots"
        subtitle="When customers can order ahead for"
        onBack={back}
        footer={dirty ? <Button label="Save slots" onPress={() => void save()} loading={s.saving} fullWidth /> : undefined}
      >
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
        {errors.slots ? <InlineNotice message={errors.slots} /> : null}
        <AppText variant="small" tone="muted">
          Each slot is a time you hand over food. Orders for it close before you start cooking, and stop once it is full.
        </AppText>
        {s.status === 'loading' && !s.rows.length ? (
          <SkeletonLines lines={8} />
        ) : (
          WEEK_ORDER.map(day => {
            const rows = s.rows.map((r, index) => ({ r, index })).filter(x => x.r.weekday === day);
            return (
              <Card key={day} style={styles.card}>
                <AppText variant="title">{DAY_LONG[day]}</AppText>
                {!rows.length ? (
                  <AppText variant="small" tone="muted">
                    No slots
                  </AppText>
                ) : (
                  rows.map(({ r, index }, n) => (
                    <View key={index}>
                      {n > 0 ? <Divider /> : null}
                      <View style={styles.slot}>
                        <View style={styles.row}>
                          <View style={styles.field}>
                            <TextField
                              label="Time"
                              value={r.slotStart}
                              onChangeText={v => dispatch(setSlot({ index, patch: { slotStart: v } }))}
                              error={errors[`${index}.slotStart`]}
                              maxLength={5}
                              keyboardType="numbers-and-punctuation"
                              placeholder="13:00"
                            />
                          </View>
                          <View style={styles.field}>
                            <TextField
                              label="Most orders"
                              value={r.maxOrders}
                              onChangeText={v => dispatch(setSlot({ index, patch: { maxOrders: v.replace(/[^\d]/g, '') } }))}
                              error={errors[`${index}.maxOrders`]}
                              keyboardType="number-pad"
                            />
                          </View>
                          <IconButton icon="close" accessibilityLabel={`Remove the ${DAY_LONG[day]} ${r.slotStart} slot`} onPress={() => dispatch(removeSlot(index))} />
                        </View>
                        <AppText variant="small" tone="muted">
                          Orders close
                        </AppText>
                        <View style={styles.chips}>
                          {[...new Set([...CUTOFF_CHOICES, r.cutoffMinutesBefore])].sort((a, b) => a - b).map(m => (
                            <ChoiceChip key={m} label={cutoffLabel(m)} selected={r.cutoffMinutesBefore === m} onPress={() => dispatch(setSlot({ index, patch: { cutoffMinutesBefore: m } }))} />
                          ))}
                        </View>
                      </View>
                    </View>
                  ))
                )}
                {s.rows.length < MAX_SLOTS ? <TextAction label="Add a slot" icon="add" onPress={() => dispatch(addSlot(day))} /> : null}
              </Card>
            );
          })
        )}
      </ScreenShell>
    </ServiceScope>
  );
};

export default VendorPreorderSlots;
