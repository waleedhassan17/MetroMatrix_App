// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: calendar
// ═══════════════════════════════════════════════════════
// Ramadan, Eid and the other days kitchens plan around. Kitchens' Ramadan
// mode and "Iftar near you" follow the Ramadan dates here, which stay
// approximate until the moon is sighted, so staff move them.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { EVENT_KINDS, EVENT_KIND_LABEL, EVENT_STATE, eventLine, validateEvent } from '@models/kitchen/adminKitchenModel';
import { todayInZone } from '@utils/healthTime';
import { useStyles, type Theme } from '@theme/index';
import {
  AppText,
  Button,
  ChoiceChip,
  DateField,
  InlineNotice,
  ScreenShell,
  Sheet,
  SkeletonLines,
  TextAction,
  TextField,
} from '@custom/index';
import { RowCard } from '@components/admin/AdminParts';
import type { AdminFoodStackParamList, CalendarEvent } from '@/types';
import { Alert } from '@utils/alert';
import { haptics } from '@utils/haptics';
import {
  changeEventAsync,
  loadEventsAsync,
  markEventSubmitted,
  openEventSheet,
  selectAdminKitchenCalendar,
  setEventSheet,
} from './adminKitchenCalendarSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminKitchenCalendar'>;

const TZ = 'Asia/Karachi';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    actions: { flexDirection: 'row', gap: space.s16, paddingTop: space.s8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const AdminKitchenCalendarScreen: React.FC<Props> = () => {
  const { back } = useBack({ name: 'FoodOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAdminKitchenCalendar);
  const sheet = s.sheet;
  const errors = sheet && s.submitted ? validateEvent(sheet) : {};

  const load = useCallback(() => void dispatch(loadEventsAsync()), [dispatch]);
  useFocusEffect(load);

  const save = () => {
    if (!sheet) return;
    dispatch(markEventSubmitted());
    if (Object.keys(validateEvent(sheet)).length) return haptics.warning();
    void dispatch(changeEventAsync({ kind: 'save', sheet }));
  };

  const remove = (e: CalendarEvent) =>
    Alert.alert(`Delete ${e.name}?`, e.kind === 'ramadan' ? 'Kitchens can’t turn on Ramadan mode without a Ramadan event.' : 'It leaves the calendar.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void dispatch(changeEventAsync({ kind: 'delete', id: e.id })) },
    ]);

  return (
    <ScreenShell
      title="Calendar"
      subtitle="Ramadan, Eid and other days kitchens plan for"
      onBack={back}
      refreshing={s.status === 'loading' && !!s.events.length}
      onRefresh={load}
      footer={<Button label="New event" leftIcon="add" onPress={() => dispatch(openEventSheet({ new: todayInZone(TZ) }))} fullWidth />}>
      {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : null}
      {s.saveError.message && !sheet ? <InlineNotice message={s.saveError.message} /> : null}
      {s.status === 'loading' && !s.events.length ? <SkeletonLines lines={6} /> : null}
      {s.events.map(e => (
        <RowCard
          key={e.id}
          title={e.name}
          mark={{ icon: e.kind === 'ramadan' ? 'moon-outline' : e.kind === 'eid' ? 'sparkles-outline' : 'calendar-outline', tint: e.kind === 'ramadan' ? 'violet' : e.kind === 'eid' ? 'amber' : 'blue' }}
          lines={[EVENT_KIND_LABEL[e.kind], eventLine(e)]}
          pill={EVENT_STATE[e.state]}>
          <View style={styles.actions}>
            <TextAction label="Change the dates" onPress={() => dispatch(openEventSheet(e))} />
            <TextAction label="Delete" tone="danger" onPress={() => remove(e)} />
          </View>
        </RowCard>
      ))}
      {s.status === 'succeeded' && !s.events.length ? <AppText variant="body">No events yet.</AppText> : null}
      <AppText variant="caption" tone="muted">
        Kitchens’ Ramadan mode and “Iftar near you” follow the Ramadan dates. They are approximate until the moon is sighted; move them here when it is.
      </AppText>

      <Sheet
        visible={!!sheet}
        onClose={() => dispatch(openEventSheet(null))}
        title={sheet?.id ? `Edit ${sheet.name}` : 'New event'}
        footer={<Button label="Save" loading={s.busy} onPress={save} fullWidth />}>
        {s.saveError.message ? <InlineNotice message={s.saveError.message} /> : null}
        <View style={styles.chips}>
          {EVENT_KINDS.map(k => (
            <ChoiceChip key={k} label={EVENT_KIND_LABEL[k]} selected={sheet?.kind === k} onPress={() => dispatch(setEventSheet({ kind: k }))} />
          ))}
        </View>
        <TextField label="Name" value={sheet?.name ?? ''} onChangeText={t => dispatch(setEventSheet({ name: t.slice(0, 60) }))} placeholder="Ramadan 1448" error={errors.name} />
        <DateField label="First day" value={sheet?.startsOn ?? ''} onChange={v => dispatch(setEventSheet({ startsOn: v }))} error={errors.startsOn} />
        <DateField label="Last day" value={sheet?.endsOn ?? ''} min={sheet?.startsOn} onChange={v => dispatch(setEventSheet({ endsOn: v }))} error={errors.endsOn} />
      </Sheet>
    </ScreenShell>
  );
};

export default AdminKitchenCalendarScreen;
