// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen growth: a tiffin plan
// ═══════════════════════════════════════════════════════
// What the plan is (a name, the meal, the days, a week or four weeks at a
// price, delivered or collected, the time window, how many people), how
// late a customer can skip a day, and what is cooked on each day: dishes
// from the menu, or a note ("Sabzi, daal and roti"). Editing an existing
// plan can also stop it taking new subscribers.

import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { CUTOFF_CHOICES, MAX_PLAN_DISHES, WEEKDAYS, cutoffChoiceLabel, draftPerMeal, planInput, validatePlan } from '../../models/kitchen/tiffinModel';
import { MEAL_LABEL, WEEKDAY_LONG, WEEKDAY_SHORT } from '../../models/kitchen/kitchenStatusModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, Card, Checkbox, ChoiceChip, Divider, InlineNotice, ScreenShell, SegmentTabs, Sheet, SkeletonLines, TextAction, TextField, ToggleRow } from '../../Custom-Components/index';
import type { FoodVendorStackParamList, Meal } from '../../models';
import { formatPKR } from '../../utils/money/money';
import { haptics } from '../../utils/haptics/haptics';
import {
  editPlanForm,
  loadPlanFormAsync,
  removePlanAsync,
  savePlanAsync,
  selectTiffinPlanForm,
  setPlanErrors,
  setPlanMeal,
  setRotationDay,
  togglePlanDay,
} from './tiffinPlanFormSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'GrowthTiffinPlanForm'>;

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner'];

const makeStyles = ({ space, size }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    two: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1, flexBasis: 0, minWidth: 0 },
    day: { gap: space.s8, paddingVertical: space.s12 },
    dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s8 },
    pickList: { maxHeight: size.heatmap },
  });

const TiffinPlanForm: React.FC<Props> = props => (
  <ServiceScope service="food">
    <TiffinPlanFormContent {...props} />
  </ServiceScope>
);

const TiffinPlanFormContent: React.FC<Props> = ({ navigation, route }) => {
  const id = route.params?.id ?? null;
  const { back } = useBack({ name: 'GrowthTiffin' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { space } = useTheme();
  const s = useAppSelector(selectTiffinPlanForm);
  const f = s.form;
  const [pickingDay, setPickingDay] = useState<number | null>(null);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    void dispatch(loadPlanFormAsync(id));
  }, [dispatch, id]);

  const perMeal = draftPerMeal(f);
  const nameOf = (itemId: string) => s.menu.find(m => m.id === itemId)?.name ?? 'A dish';
  const picking = pickingDay !== null ? (f.rotation[pickingDay]?.itemIds ?? []) : [];

  const save = async () => {
    const errors = validatePlan(f);
    if (Object.keys(errors).length) {
      dispatch(setPlanErrors(errors));
      haptics.warning();
      return;
    }
    const r = await dispatch(savePlanAsync({ id, input: planInput(f) }));
    if (savePlanAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: id ? 'Plan saved' : 'Plan is up', text2: id ? undefined : 'Customers see it on your page.' });
      back();
    } else haptics.warning();
  };

  if (s.status !== 'succeeded' || s.planId !== id) {
    return (
      <ScreenShell title={id ? 'Tiffin plan' : 'New tiffin plan'} onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadPlanFormAsync(id)) }} /> : <SkeletonLines lines={10} />}
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={id ? 'Tiffin plan' : 'New tiffin plan'}
      subtitle={perMeal ? `${formatPKR(perMeal)} a meal` : 'Same meal on set days, paid ahead'}
      onBack={back}
      footer={<Button label={id ? 'Save' : 'Put it up'} onPress={() => void save()} loading={s.saving} fullWidth />}>
      {s.saveError.message ? <InlineNotice message={s.saveError.message} /> : null}

      <TextField label="Name" value={f.name} onChangeText={name => dispatch(editPlanForm({ name }))} placeholder="Office lunch tiffin" maxLength={60} error={s.errors.name} />
      <TextField
        label="About it (optional)"
        value={f.description}
        onChangeText={description => dispatch(editPlanForm({ description }))}
        placeholder="Home-cooked lunch on weekdays, with roti and salad."
        maxLength={300}
        multiline
      />

      <AppText variant="sectionTitle">Meal and days</AppText>
      <View style={styles.chips}>
        {MEALS.map(m => (
          <ChoiceChip key={m} label={MEAL_LABEL[m]} selected={f.meal === m} onPress={() => dispatch(setPlanMeal(m))} />
        ))}
      </View>
      <View style={styles.chips}>
        {WEEKDAYS.map(d => (
          <ChoiceChip key={d} label={WEEKDAY_SHORT[d]} selected={f.days.includes(d)} onPress={() => dispatch(togglePlanDay(d))} accessibilityHint={WEEKDAY_LONG[d]} />
        ))}
      </View>
      {s.errors.days ? (
        <AppText variant="small" tone="danger">
          {s.errors.days}
        </AppText>
      ) : null}

      <AppText variant="sectionTitle">Price</AppText>
      <SegmentTabs
        options={[
          { key: 'week', label: 'A week' },
          { key: 'month', label: '4 weeks' },
        ]}
        value={f.period}
        onChange={period => dispatch(editPlanForm({ period }))}
        accessibilityLabel="Paid for"
      />
      <TextField
        label={f.period === 'week' ? 'Price for a week (Rs)' : 'Price for 4 weeks (Rs)'}
        value={f.price}
        onChangeText={price => dispatch(editPlanForm({ price }))}
        keyboardType="number-pad"
        placeholder="2300"
        error={s.errors.price}
        helper={perMeal ? `${formatPKR(perMeal)} a meal for ${f.days.length * (f.period === 'week' ? 1 : 4)} meals` : undefined}
      />

      <AppText variant="sectionTitle">Delivery and time</AppText>
      <SegmentTabs
        options={[
          { key: 'delivery', label: 'Delivered' },
          { key: 'pickup', label: 'Collected' },
        ]}
        value={f.mode}
        onChange={mode => dispatch(editPlanForm({ mode }))}
        accessibilityLabel="How customers get it"
      />
      <View style={styles.two}>
        <View style={styles.half}>
          <TextField label="From" value={f.from} onChangeText={from => dispatch(editPlanForm({ from }))} placeholder="12:30" keyboardType="numbers-and-punctuation" />
        </View>
        <View style={styles.half}>
          <TextField label="Until" value={f.to} onChangeText={to => dispatch(editPlanForm({ to }))} placeholder="13:30" keyboardType="numbers-and-punctuation" error={s.errors.window} />
        </View>
      </View>
      <TextField label="Places" value={f.capacity} onChangeText={capacity => dispatch(editPlanForm({ capacity }))} keyboardType="number-pad" helper="How many people you can cook for on this plan" error={s.errors.capacity} />

      <AppText variant="sectionTitle">Skipping a day</AppText>
      <AppText variant="small" tone="muted">
        Customers can skip a day until this cut-off; after it, the day’s tiffins go on your board. Skipped meals come off their next period.
      </AppText>
      <View style={styles.chips}>
        {CUTOFF_CHOICES.map(h => (
          <ChoiceChip key={h} label={`${h} h`} selected={f.skipCutoffHours === h} onPress={() => dispatch(editPlanForm({ skipCutoffHours: h }))} />
        ))}
      </View>
      <AppText variant="caption" tone="muted">
        {cutoffChoiceLabel(f.skipCutoffHours, f.from)}
      </AppText>

      <AppText variant="sectionTitle">What you cook</AppText>
      {s.errors.rotation ? <InlineNotice message={s.errors.rotation} /> : null}
      <Card padded="horizontal">
        {f.days.map((d, n) => {
          const r = f.rotation[d] ?? { itemIds: [], note: '' };
          return (
            <View key={d}>
              {n > 0 ? <Divider /> : null}
              <View style={styles.day}>
                <View style={styles.dayHead}>
                  <AppText variant="title">{WEEKDAY_LONG[d]}</AppText>
                  <TextAction label={r.itemIds.length ? 'Change dishes' : 'Pick dishes'} icon="restaurant-outline" onPress={() => setPickingDay(d)} />
                </View>
                {r.itemIds.length ? <AppText variant="body">{r.itemIds.map(nameOf).join(', ')}</AppText> : null}
                <TextField
                  label={r.itemIds.length ? 'And (optional)' : 'Or say what it is'}
                  value={r.note}
                  onChangeText={note => dispatch(setRotationDay({ weekday: d, note }))}
                  placeholder="Sabzi, daal and roti"
                  maxLength={80}
                />
              </View>
            </View>
          );
        })}
      </Card>

      {id && s.plan ? (
        <View style={{ gap: space.s8 }}>
          <ToggleRow
            label="Taking new subscribers"
            helper="Off: it leaves your page; people on it carry on."
            value={s.plan.isActive}
            onChange={isActive => void dispatch(savePlanAsync({ id, input: { ...planInput(f), isActive } })).then(() => dispatch(loadPlanFormAsync(id)))}
          />
          <TextAction label="Remove this plan" tone="danger" onPress={() => setStopping(true)} />
        </View>
      ) : null}

      <Sheet
        visible={pickingDay !== null}
        onClose={() => setPickingDay(null)}
        title={pickingDay !== null ? `${WEEKDAY_LONG[pickingDay]}’s dishes` : 'Dishes'}
        subtitle={`Up to ${MAX_PLAN_DISHES} from your menu`}
        footer={<Button label="Done" onPress={() => setPickingDay(null)} fullWidth />}>
        <ScrollView style={styles.pickList}>
          {s.menu.map(m => {
            const on = picking.includes(m.id);
            return (
              <Checkbox
                key={m.id}
                checked={on}
                onToggle={() => {
                  if (pickingDay === null) return;
                  if (!on && picking.length >= MAX_PLAN_DISHES) return haptics.warning();
                  dispatch(setRotationDay({ weekday: pickingDay, itemIds: on ? picking.filter(x => x !== m.id) : [...picking, m.id] }));
                }}
                label={`${m.name} · ${formatPKR(m.basePrice)}`}
                accessibilityLabel={m.name}
              />
            );
          })}
        </ScrollView>
      </Sheet>

      <Sheet
        visible={stopping}
        onClose={() => setStopping(false)}
        title="Remove this plan?"
        subtitle="A plan people are on can’t be removed: stop it taking new subscribers instead, and end theirs."
        footer={
          <Button
            label="Remove it"
            variant="destructive"
            loading={s.saving}
            onPress={async () => {
              if (!id) return;
              const r = await dispatch(removePlanAsync(id));
              if (removePlanAsync.fulfilled.match(r)) {
                setStopping(false);
                Toast.show({ type: 'success', text1: r.payload.removed ? 'Plan removed' : 'Plan taken off your page' });
                navigation.navigate('GrowthTiffin');
              }
            }}
            fullWidth
          />
        }>
        {s.saveError.message ? <InlineNotice message={s.saveError.message} /> : <View />}
      </Sheet>
    </ScreenShell>
  );
};

export default TiffinPlanForm;
