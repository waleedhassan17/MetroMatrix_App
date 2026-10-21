// ═══════════════════════════════════════════════════════
// MetroMatrix — Nutrition (the customer's own)
// ═══════════════════════════════════════════════════════
// Off until the person turns it on, with what is kept and that kitchens
// never see it. A goal in everyday words; body numbers to work out a daily
// target, or a number of their own; "Show calories on Food Court", off
// until they choose it; the week's summary; and "Delete my nutrition data",
// which removes all of it.

import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { ACTIVITIES, ACTIVITY, GOAL, GOALS, metricsFormOf, metricsOf, targetLine, validateManualTarget, validateMetrics, type MetricsForm } from '@models/myKitchen/nutritionModel';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, Button, Card, ChoiceChip, InlineNotice, ListRow, ScreenShell, Sheet, SkeletonLines, TextField, ToggleRow } from '@custom/index';
import type { FoodAppParamList, NutritionSettings } from '@/types';
import { haptics } from '@utils/haptics';
import { deleteNutritionAsync, loadNutritionSettingsAsync, saveNutritionAsync, selectNutritionSettings } from './nutritionSettingsSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'NutritionSettings'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    tight: { gap: space.s4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    two: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1, flexBasis: 0, minWidth: 0 },
  });

const NutritionSettingsScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <NutritionSettingsContent {...props} />
  </ServiceScope>
);

const NutritionSettingsContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'FoodTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectNutritionSettings);
  const n = s.settings;
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => void dispatch(loadNutritionSettingsAsync()), [dispatch]);
  useFocusEffect(load);

  const save = async (patch: Parameters<typeof saveNutritionAsync>[0], done?: string) => {
    haptics.press();
    const r = await dispatch(saveNutritionAsync(patch));
    if (saveNutritionAsync.fulfilled.match(r)) {
      haptics.success();
      if (done) Toast.show({ type: 'success', text1: done });
      return true;
    }
    haptics.warning();
    return false;
  };

  if (!n) {
    return (
      <ScreenShell title="Nutrition" onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : <SkeletonLines lines={8} />}
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Nutrition" subtitle="Only for you" onBack={back} refreshing={s.status === 'loading'} onRefresh={load}>
      {s.saveError.message ? <InlineNotice message={s.saveError.message} /> : null}
      <Card>
        <View style={styles.gap}>
          <AppText variant="title">What this keeps, and who sees it</AppText>
          <AppText variant="body">
            If you turn it on, MetroMatrix keeps your goal and, if you add them, your age, height, weight and how active you are, to work out a daily target. It adds up the
            Food Court dishes you order. Kitchens never see any of it, and you can delete it all at any time.
          </AppText>
          <ToggleRow label="Turn on nutrition" value={n.enabled} disabled={s.saving} onChange={v => void save({ enabled: v }, v ? 'Nutrition is on' : 'Nutrition is off')} />
        </View>
      </Card>

      {n.enabled ? (
        <>
          <Card>
            <View style={styles.gap}>
              <ToggleRow label="Show calories on Food Court" helper="Off until you turn it on. Dishes then show their estimated calories and protein." value={n.showCalories} disabled={s.saving} onChange={v => void save({ showCalories: v }, v ? 'Calories will show on Food Court' : 'Calories are hidden')} />
              <AppText variant="bodyStrong">{targetLine(n.targetKcal)}</AppText>
            </View>
          </Card>

          <Card>
            <View style={styles.gap}>
              <AppText variant="title">Your goal</AppText>
              <View style={styles.chips}>
                {GOALS.map(g => (
                  <ChoiceChip key={g} label={GOAL[g].label} selected={n.goal === g} disabled={s.saving} onPress={() => void save({ goal: g })} />
                ))}
              </View>
              <AppText variant="small" tone="muted">
                {GOAL[n.goal].hint}
              </AppText>
            </View>
          </Card>

          {/* Keyed by what is saved: the form starts again from it after a save or a delete. */}
          <NumbersCard key={n.updatedAt ?? 'none'} metrics={n.metrics} manualTargetKcal={n.manualTargetKcal} saving={s.saving} onSave={save} />

          <Card padded="horizontal">
            <ListRow title="Your week" subtitle="What you ordered on Food Court in the last 7 days" leftIcon="bar-chart-outline" onPress={() => navigation.navigate('NutritionSummary')} />
          </Card>
        </>
      ) : null}

      {n.enabled || n.metrics || n.manualTargetKcal ? <Button label="Delete my nutrition data" variant="secondary" onPress={() => setDeleting(true)} fullWidth /> : null}

      <Sheet
        visible={deleting}
        onClose={() => setDeleting(false)}
        title="Delete your nutrition data?"
        subtitle="Your goal, your numbers and your target go, and nutrition turns off. Your orders stay."
        footer={
          <Button
            label="Delete it"
            variant="destructive"
            loading={s.deleting}
            onPress={async () => {
              const r = await dispatch(deleteNutritionAsync());
              if (deleteNutritionAsync.fulfilled.match(r)) {
                setDeleting(false);
                Toast.show({ type: 'success', text1: 'Nutrition data deleted' });
              }
            }}
            fullWidth
          />
        }>
        <Button label="Keep it" variant="secondary" onPress={() => setDeleting(false)} fullWidth />
      </Sheet>
    </ScreenShell>
  );
};

/** Body numbers and an own target: a form seeded from what is saved. */
const NumbersCard: React.FC<{
  metrics: NutritionSettings['metrics'];
  manualTargetKcal: number | null;
  saving: boolean;
  onSave: (patch: Parameters<typeof saveNutritionAsync>[0], done?: string) => Promise<boolean>;
}> = ({ metrics, manualTargetKcal, saving, onSave }) => {
  const styles = useStyles(makeStyles);
  const [form, setForm] = useState<MetricsForm>(() => metricsFormOf(metrics));
  const [manual, setManual] = useState(() => (manualTargetKcal ? String(manualTargetKcal) : ''));
  const metricErrors = validateMetrics(form);
  const manualError = manual.trim() ? validateManualTarget(manual) : null;
  return (
    <Card>
      <View style={styles.gap}>
        <AppText variant="title">Your numbers (optional)</AppText>
        <AppText variant="small" tone="muted">
          Used only to work out a daily target.
        </AppText>
        <View style={styles.chips}>
          <ChoiceChip label="Female" selected={form.sex === 'female'} onPress={() => setForm({ ...form, sex: 'female' })} />
          <ChoiceChip label="Male" selected={form.sex === 'male'} onPress={() => setForm({ ...form, sex: 'male' })} />
        </View>
        <View style={styles.two}>
          <View style={styles.half}>
            <TextField label="Age" mode="numeric" value={form.age} onChangeText={v => setForm({ ...form, age: v })} error={form.age && metricErrors.age ? metricErrors.age : undefined} />
          </View>
          <View style={styles.half}>
            <TextField label="Height (cm)" mode="numeric" value={form.heightCm} onChangeText={v => setForm({ ...form, heightCm: v })} error={form.heightCm && metricErrors.heightCm ? metricErrors.heightCm : undefined} />
          </View>
        </View>
        <TextField label="Weight (kg)" mode="numeric" value={form.weightKg} onChangeText={v => setForm({ ...form, weightKg: v })} error={form.weightKg && metricErrors.weightKg ? metricErrors.weightKg : undefined} />
        <View style={styles.chips}>
          {ACTIVITIES.map(a => (
            <ChoiceChip key={a} label={ACTIVITY[a]} selected={form.activity === a} onPress={() => setForm({ ...form, activity: a })} />
          ))}
        </View>
        <Button label="Save my numbers" variant="secondary" loading={saving} disabled={Object.keys(metricErrors).length > 0} onPress={() => void onSave({ metrics: metricsOf(form) }, 'Daily target updated')} fullWidth />
        <TextField
          label="Or a daily target of my own (kcal)"
          mode="numeric"
          value={manual}
          onChangeText={setManual}
          helper="Leave empty to use the worked-out one."
          error={manualError ?? undefined}
        />
        <Button label="Save my target" variant="secondary" disabled={!!manualError} loading={saving} onPress={() => void onSave({ manualTargetKcal: manual.trim() ? Number(manual) : null }, 'Daily target saved')} fullWidth />
      </View>
    </Card>
  );
};

export default NutritionSettingsScreen;
