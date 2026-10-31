// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen: add or edit an ingredient
// ═══════════════════════════════════════════════════════
// Its name and kind, how it is counted (weight, volume or pieces — fixed
// once it has stock), the level to restock at, and the kitchen's own units
// ("1 crate = 30 pieces", "1 bori = 40 kg").

import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { CATEGORY_LABEL, CATEGORY_ORDER } from '../../models/kitchen/kitchenStatusModel';
import { MAX_CUSTOM_UNITS, customUnitsOf, ingredientInput, validateIngredient } from '../../models/kitchen/stockModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, ChoiceChip, IconButton, InlineNotice, ScreenShell, SegmentTabs, SkeletonLines, TextAction, TextField, ToggleRow } from '../../Custom-Components/index';
import type { FoodVendorStackParamList } from '../../models';
import { UNITS, unitsFor, type BaseUnit, type StandardUnit } from '../../utils/units/units';
import { haptics } from '../../utils/haptics/haptics';
import {
  loadIngredientForEditAsync,
  saveIngredientAsync,
  selectIngredientForm,
  setCustomUnits,
  setIngredientField,
  startIngredientForm,
  touchIngredientForm,
} from './ingredientFormSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenIngredientForm'>;

const BASES: { key: BaseUnit; label: string }[] = [
  { key: 'g', label: 'Weight' },
  { key: 'ml', label: 'Volume' },
  { key: 'pc', label: 'Pieces' },
];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    group: { gap: space.s8 },
    chips: { gap: space.s8 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8 },
    grow: { flex: 1 },
    units: { flexDirection: 'row', gap: space.s8, flexWrap: 'wrap' },
  });

const IngredientForm: React.FC<Props> = props => (
  <ServiceScope service="food">
    <IngredientFormContent {...props} />
  </ServiceScope>
);

const IngredientFormContent: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'KitchenStock' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectIngredientForm);
  const id = route.params?.id ?? null;
  const f = s.form;

  useEffect(() => {
    if (id) void dispatch(loadIngredientForEditAsync(id));
    else dispatch(startIngredientForm({ name: route.params?.name }));
  }, [dispatch, id, route.params?.name]);

  const errors = s.touched ? validateIngredient(f) : {};
  const custom = customUnitsOf(s.customUnits, f.baseUnit);
  const unitChips = (value: StandardUnit, onPick: (u: StandardUnit) => void) => (
    <View style={styles.units}>
      {unitsFor(f.baseUnit).map(u => (
        <ChoiceChip key={u} label={UNITS[u].many} selected={value === u} onPress={() => onPick(u)} />
      ))}
    </View>
  );

  const save = async () => {
    dispatch(touchIngredientForm());
    if (Object.keys(validateIngredient(f)).length || Object.keys(custom.errors).length) {
      haptics.warning();
      return;
    }
    const res = await dispatch(saveIngredientAsync({ id, input: { ...ingredientInput(f), customUnits: custom.units } }));
    if (saveIngredientAsync.fulfilled.match(res)) {
      haptics.success();
      Toast.show({ type: 'success', text1: id ? 'Ingredient saved' : `${res.payload.name} added to your stock` });
      if (id) back();
      else navigation.replace('KitchenIngredient', { id: res.payload.id });
    } else haptics.warning();
  };

  if (id && s.status !== 'succeeded') {
    return (
      <ScreenShell title="Edit ingredient" onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} /> : <SkeletonLines lines={6} />}
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={id ? 'Edit ingredient' : 'New ingredient'} onBack={back} footer={<Button label={id ? 'Save' : 'Add to stock'} onPress={() => void save()} loading={s.saving} fullWidth />}>
      <TextField label="Name" value={f.name} onChangeText={name => dispatch(setIngredientField({ name }))} error={errors.name} placeholder="Tomato, chicken boneless…" />
      <View style={styles.group}>
        <AppText variant="label">Kind</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORY_ORDER.map(c => (
            <ChoiceChip key={c} label={CATEGORY_LABEL[c]} selected={f.category === c} onPress={() => dispatch(setIngredientField({ category: c }))} />
          ))}
        </ScrollView>
      </View>
      <View style={styles.group}>
        <AppText variant="label">Counted by</AppText>
        <SegmentTabs options={BASES} value={f.baseUnit} onChange={baseUnit => !s.locked && dispatch(setIngredientField({ baseUnit }))} accessibilityLabel="Counted by" />
        {s.locked ? (
          <AppText variant="caption" tone="muted">
            It has stock, so the way it is counted stays.
          </AppText>
        ) : null}
        {f.baseUnit === 'pc' ? <ToggleRow label="Count in dozens" helper="Eggs and the like" value={f.dozens} onChange={dozens => dispatch(setIngredientField({ dozens }))} /> : null}
      </View>
      <View style={styles.group}>
        <TextField label="Restock at (optional)" value={f.par} onChangeText={par => dispatch(setIngredientField({ par }))} keyboardType="decimal-pad" error={errors.par} helper="Below this it shows as running low" />
        {unitChips(f.parUnit, parUnit => dispatch(setIngredientField({ parUnit })))}
      </View>
      <View style={styles.group}>
        <AppText variant="label">Your own units (optional)</AppText>
        <AppText variant="caption" tone="muted">
          A crate, a bori, a tray: how you buy it. Counts and purchases can use them.
        </AppText>
        {s.customUnits.map((u, n) => (
          <View key={n} style={styles.group}>
            <View style={styles.row}>
              <View style={styles.grow}>
                <TextField label="Unit" value={u.name} onChangeText={name => dispatch(setCustomUnits(s.customUnits.map((x, k) => (k === n ? { ...x, name } : x))))} error={s.touched ? custom.errors[n] : undefined} />
              </View>
              <View style={styles.grow}>
                <TextField label="One is" value={u.amount} onChangeText={amount => dispatch(setCustomUnits(s.customUnits.map((x, k) => (k === n ? { ...x, amount } : x))))} keyboardType="decimal-pad" />
              </View>
              <IconButton icon="close" tone="muted" onPress={() => dispatch(setCustomUnits(s.customUnits.filter((_x, k) => k !== n)))} accessibilityLabel={`Remove ${u.name || 'this unit'}`} />
            </View>
            {unitChips(u.unit, unit => dispatch(setCustomUnits(s.customUnits.map((x, k) => (k === n ? { ...x, unit } : x)))))}
          </View>
        ))}
        {s.customUnits.length < MAX_CUSTOM_UNITS ? (
          <TextAction
            label="Add a unit"
            icon="add"
            onPress={() => dispatch(setCustomUnits([...s.customUnits, { name: '', amount: '', unit: unitsFor(f.baseUnit)[f.baseUnit === 'pc' ? 0 : 1] }]))}
          />
        ) : null}
      </View>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
    </ScreenShell>
  );
};

export default IngredientForm;
