// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen growth: Ramadan mode
// ═══════════════════════════════════════════════════════
// The kitchen keeps Ramadan hours: a sehri window, an iftar window, and
// iftar by pre-order so food is ready at the azaan. The switch moves only
// in Ramadan and the month before it; outside that it says when it opens
// (the dates come from MetroMatrix's calendar). A preview shows what
// customers see on the kitchen's page.

import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { IFTAR_TIMES, SEHRI_TIMES, ramadanDatesLine, ramadanSwitch, validateRamadanWindows, windowText } from '@models/kitchen/reachModel';
import { RAMADAN_STATE } from '@models/kitchen/kitchenStatusModel';
import { timeLabel } from '@models/kitchen/cateringModel';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, BottomSheetPicker, Button, Card, InlineNotice, PickerField, ScreenShell, SkeletonLines, StatusPill, ToggleRow } from '@custom/index';
import type { FoodVendorStackParamList, RamadanSettings } from '@/types';
import { haptics } from '@utils/haptics';
import { loadRamadanAsync, saveRamadanAsync, selectRamadanMode } from './ramadanModeSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'GrowthRamadan'>;
type Window = { from: string; to: string };
type Draft = { sehri: Window; iftar: Window };
type Picking = { which: keyof Draft; end: keyof Window } | null;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    two: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1, flexBasis: 0, minWidth: 0 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
  });

const draftOf = (r: RamadanSettings): Draft => ({ sehri: { from: r.sehri.from, to: r.sehri.to }, iftar: { from: r.iftar.from, to: r.iftar.to } });
const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

const RamadanModeScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <RamadanModeContent {...props} />
  </ServiceScope>
);

const RamadanModeContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'KitchenTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectRamadanMode);
  const r = s.data;
  // The kitchen's edits; null shows what is saved.
  const [edit, setDraft] = useState<Draft | null>(null);
  const [picking, setPicking] = useState<Picking>(null);

  const load = useCallback(() => void dispatch(loadRamadanAsync()), [dispatch]);
  useFocusEffect(load);
  const draft = edit ?? (r ? draftOf(r) : null);

  if (!r || !draft) {
    return (
      <ScreenShell title="Ramadan mode" onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : <SkeletonLines lines={8} />}
      </ScreenShell>
    );
  }

  const sw = ramadanSwitch(r);
  const errors = validateRamadanWindows(draft);
  const dirty = !same(draft, draftOf(r));

  const save = async (input: Parameters<typeof saveRamadanAsync>[0], done: string) => {
    haptics.press();
    const res = await dispatch(saveRamadanAsync(input));
    if (saveRamadanAsync.fulfilled.match(res)) {
      haptics.success();
      Toast.show({ type: 'success', text1: done });
      return true;
    }
    haptics.warning();
    return false;
  };

  const options = (which: keyof Draft) => (which === 'sehri' ? SEHRI_TIMES : IFTAR_TIMES).map(t => ({ value: t, label: timeLabel(t) }));

  return (
    <ScreenShell title="Ramadan mode" subtitle={ramadanDatesLine(r) ?? 'Sehri and iftar hours'} onBack={back} refreshing={s.status === 'loading'} onRefresh={load}>
      {s.saveError.message ? <InlineNotice title={s.saveError.code === 'RAMADAN_NOT_ACTIVE' ? 'Not yet' : undefined} message={s.saveError.message} /> : null}

      <Card>
        <View style={styles.gap}>
          <View style={styles.head}>
            <AppText variant="title">{r.event?.name ?? 'Ramadan'}</AppText>
            <StatusPill label={RAMADAN_STATE[r.state].label} tone={RAMADAN_STATE[r.state].tone} />
          </View>
          <ToggleRow
            label="Keep Ramadan hours"
            helper={r.enabled ? 'Customers see your sehri and iftar times on your page.' : 'Show sehri and iftar times on your page, and take iftar orders ahead.'}
            value={r.enabled}
            disabled={sw.disabled || s.saving}
            onChange={v => void save({ enabled: v }, v ? 'Ramadan hours are on' : 'Ramadan hours are off')}
          />
          {sw.reason ? <InlineNotice tone="info" title="Opens before Ramadan" message={sw.reason} /> : null}
        </View>
      </Card>

      <Card>
        <View style={styles.gap}>
          <AppText variant="title">Sehri</AppText>
          <View style={styles.two}>
            <View style={styles.half}>
              <PickerField label="From" valueLabel={timeLabel(draft.sehri.from)} placeholder="Pick a time" onPress={() => !sw.disabled && setPicking({ which: 'sehri', end: 'from' })} />
            </View>
            <View style={styles.half}>
              <PickerField label="Until" valueLabel={timeLabel(draft.sehri.to)} placeholder="Pick a time" onPress={() => !sw.disabled && setPicking({ which: 'sehri', end: 'to' })} error={errors.sehri} />
            </View>
          </View>
        </View>
      </Card>

      <Card>
        <View style={styles.gap}>
          <AppText variant="title">Iftar</AppText>
          <View style={styles.two}>
            <View style={styles.half}>
              <PickerField label="From" valueLabel={timeLabel(draft.iftar.from)} placeholder="Pick a time" onPress={() => !sw.disabled && setPicking({ which: 'iftar', end: 'from' })} />
            </View>
            <View style={styles.half}>
              <PickerField label="Until" valueLabel={timeLabel(draft.iftar.to)} placeholder="Pick a time" onPress={() => !sw.disabled && setPicking({ which: 'iftar', end: 'to' })} error={errors.iftar} />
            </View>
          </View>
          <ToggleRow
            label="Iftar by pre-order only"
            helper="Iftar orders are placed ahead, so food is ready at the azaan."
            value={r.iftarPreorderOnly}
            disabled={sw.disabled || s.saving}
            onChange={v => void save({ iftarPreorderOnly: v }, v ? 'Iftar is by pre-order' : 'Iftar orders open on the day')}
          />
        </View>
      </Card>

      {dirty ? (
        <Button
          label="Save the hours"
          loading={s.saving}
          disabled={sw.disabled || Object.keys(errors).length > 0}
          onPress={() => void save({ sehri: draft.sehri, iftar: draft.iftar }, 'Hours saved').then(ok => ok && setDraft(null))}
          fullWidth
        />
      ) : null}

      <Card>
        <View style={styles.gap}>
          <AppText variant="overline" tone="muted">
            How customers see it
          </AppText>
          <AppText variant="bodyStrong">Ramadan hours</AppText>
          <AppText variant="body">{`Sehri ${windowText(draft.sehri)}`}</AppText>
          <AppText variant="body">{`Iftar ${windowText(draft.iftar)}${r.iftarPreorderOnly ? ' · order ahead' : ''}`}</AppText>
          <AppText variant="small" tone="muted">
            {r.enabled ? 'Shown on your page and in “Iftar near you” during Ramadan.' : 'Shown once you turn Ramadan hours on.'}
          </AppText>
        </View>
      </Card>

      <BottomSheetPicker
        visible={!!picking}
        onClose={() => setPicking(null)}
        title={picking ? `${picking.which === 'sehri' ? 'Sehri' : 'Iftar'} ${picking.end === 'from' ? 'from' : 'until'}` : ''}
        options={picking ? options(picking.which) : []}
        value={picking ? draft[picking.which][picking.end] : null}
        onSelect={v => {
          if (picking) setDraft({ ...draft, [picking.which]: { ...draft[picking.which], [picking.end]: v } });
          setPicking(null);
        }}
      />
    </ScreenShell>
  );
};

export default RamadanModeScreen;
