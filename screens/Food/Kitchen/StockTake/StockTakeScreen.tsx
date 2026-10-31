// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen: count stock
// ═══════════════════════════════════════════════════════
// Walk the store room and type what is there: each ingredient in the unit
// it is easiest to count in (kilos, dozens, a crate). Empty rows are left
// as they are. Saving records the differences; the result says how many
// changed. Ingredients from a "below zero" card come first.

import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { countsOf, defaultUnit, qtyLabel, unitChoices } from '../../../../models/kitchen/stockModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import { AppText, BottomSheetPicker, Button, Divider, IonIcon, InlineNotice, ScreenShell, SkeletonLines } from '../../../../Custom-Components/index';
import type { FoodVendorStackParamList, Ingredient } from '../../../../types';
import { haptics } from '../../../../utils/haptics';
import { loadStockTakeAsync, resetStockTake, saveStockTakeAsync, selectStockTake, setCount, setCountUnit, setRowErrors } from './stockTakeSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenStockTake'>;

const makeStyles = ({ space, size, radius, colors, type }: Theme) =>
  StyleSheet.create({
    list: { paddingBottom: space.s40 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s8, paddingVertical: space.s12 },
    text: { flex: 1, gap: space.s4 },
    input: {
      ...type.input,
      color: colors.ink,
      width: size.stockField,
      minHeight: size.control.sm,
      paddingHorizontal: space.s12,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderColor: colors.line,
      textAlign: 'right',
    },
    inputError: { borderColor: colors.danger },
    unit: { minHeight: size.control.sm, minWidth: size.control.sm, paddingHorizontal: space.s8, borderRadius: radius.md, backgroundColor: colors.surfaceSunk, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.s4 },
  });

const StockTakeScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <StockTakeContent {...props} />
  </ServiceScope>
);

const StockTakeContent: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'KitchenStock' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const s = useAppSelector(selectStockTake);
  const [picking, setPicking] = useState<Ingredient | null>(null);
  const first = route.params?.ingredientIds;

  useEffect(() => {
    dispatch(resetStockTake());
    void dispatch(loadStockTakeAsync());
  }, [dispatch]);

  // Ingredients a card pointed at come first, then the store room in order.
  const rows = useMemo(() => (first?.length ? [...s.ingredients.filter(i => first.includes(i.id)), ...s.ingredients.filter(i => !first.includes(i.id))] : s.ingredients), [s.ingredients, first]);
  const unitOf = (i: Ingredient) => unitChoices(i).find(u => u.key === (s.units[i.id] ?? defaultUnit(i))) ?? unitChoices(i)[0];
  const filled = Object.values(s.typed).filter(t => t.trim()).length;

  const save = async () => {
    const { lines, errors } = countsOf(rows.map(i => ({ ingredientId: i.id, typed: s.typed[i.id] ?? '', unit: unitOf(i).unit })));
    if (Object.keys(errors).length || !lines.length) {
      dispatch(setRowErrors(errors));
      haptics.warning();
      return;
    }
    const res = await dispatch(saveStockTakeAsync(lines));
    if (saveStockTakeAsync.fulfilled.match(res)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Count saved', text2: res.payload.adjusted ? `${res.payload.adjusted} ${res.payload.adjusted === 1 ? 'ingredient' : 'ingredients'} changed.` : 'Everything matched.' });
      back();
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title="Count stock"
      subtitle="Type what is there; leave a row empty to keep it"
      onBack={back}
      scroll={false}
      footer={<Button label={filled ? `Save ${filled} ${filled === 1 ? 'count' : 'counts'}` : 'Save the count'} onPress={() => void save()} loading={s.saving} disabled={!filled} fullWidth />}>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      <FlatList
        data={rows}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Divider}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: i }) => {
          const unit = unitOf(i);
          const err = s.rowErrors[i.id];
          return (
            <View style={styles.row}>
              <View style={styles.text}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {i.name}
                </AppText>
                <AppText variant="caption" tone={err ? 'danger' : 'muted'}>
                  {err ?? `Recorded: ${qtyLabel(i, i.onHand)}`}
                </AppText>
              </View>
              <TextInput
                value={s.typed[i.id] ?? ''}
                onChangeText={text => dispatch(setCount({ id: i.id, text }))}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={colors.inkFaint}
                style={[styles.input, err ? styles.inputError : null]}
                accessibilityLabel={`${i.name}: how much is there, in ${unit.label}`}
              />
              <Pressable onPress={() => setPicking(i)} style={styles.unit} accessibilityRole="button" accessibilityLabel={`Unit: ${unit.label}. Change`}>
                <AppText variant="label">{unit.label}</AppText>
                <IonIcon name="chevron-down" size="sm" color={colors.inkMuted} />
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadStockTakeAsync()) }} /> : <SkeletonLines lines={8} />}
      />
      <BottomSheetPicker
        visible={!!picking}
        onClose={() => setPicking(null)}
        title={picking ? `Count ${picking.name} in` : 'Unit'}
        options={picking ? unitChoices(picking).map(u => ({ value: u.key, label: u.label })) : []}
        value={picking ? unitOf(picking).key : null}
        onSelect={key => {
          if (picking) dispatch(setCountUnit({ id: picking.id, unit: key }));
          setPicking(null);
        }}
      />
    </ScreenShell>
  );
};

export default StockTakeScreen;
