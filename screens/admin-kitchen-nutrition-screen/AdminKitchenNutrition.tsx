// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: nutrition foods
// ═══════════════════════════════════════════════════════
// The reference foods a dish's estimated calories come from: per 100 g,
// 100 ml or piece, and how many kitchens' ingredients use each. Add or
// correct one, or import many from a CSV after a dry run. A change moves
// every dish made with it.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector, useAppStore } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useDebouncedValue } from '../../hooks/usePagedList';
import {
  CHANGE_LABEL,
  NUTRITION_COLUMNS,
  PERS,
  PER_LABEL,
  macrosLine,
  validateCsvText,
  validateNutritionFood,
} from '../../models/kitchen/adminKitchenModel';
import { useStyles, type Theme } from '../../theme/index';
import {
  AppText,
  Button,
  Card,
  ChoiceChip,
  Divider,
  InlineNotice,
  ScreenShell,
  Sheet,
  SkeletonLines,
  TextAction,
  TextField,
} from '../../Custom-Components/index';
import { SearchField } from '../../Components/shopping/ShopParts';
import { CsvImport } from '../../Components/admin/CsvImport';
import { CsvFileError, pickCsvFile } from '../../services/csvFile';
import type { AdminFoodStackParamList } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import Toast from 'react-native-toast-message';
import {
  checkFoodsCsvAsync,
  importFoodsCsvAsync,
  loadFoodsAsync,
  markFoodSubmitted,
  openFoodSheet,
  saveFoodAsync,
  selectAdminKitchenNutrition,
  setFoodForm,
  setFoodsCsv,
  setFoodsImportError,
  setFoodsQuery,
} from './adminKitchenNutritionSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminKitchenNutrition'>;

const decimal = (t: string) => t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 7);

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    row: { gap: space.s4, paddingVertical: space.s8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    two: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1, flexBasis: 0, minWidth: 0 },
  });

const AdminKitchenNutrition: React.FC<Props> = () => {
  const { back } = useBack({ name: 'FoodOverview' });
  const dispatch = useAppDispatch();
  const appStore = useAppStore();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAdminKitchenNutrition);
  const sheet = s.sheet;
  const f = sheet?.form;
  const q = useDebouncedValue(s.q.trim());
  const errors = sheet && s.submitted ? validateNutritionFood(sheet.form, !sheet.id) : {};
  const csvError = s.csv.trim() ? validateCsvText(s.csv, NUTRITION_COLUMNS).csv : undefined;

  useEffect(() => {
    void dispatch(loadFoodsAsync(q));
  }, [dispatch, q]);

  const save = () => {
    if (!sheet) return;
    dispatch(markFoodSubmitted());
    if (Object.keys(validateNutritionFood(sheet.form, !sheet.id)).length) return haptics.warning();
    void dispatch(saveFoodAsync({ sheet, q }));
  };

  const pickFile = async () => {
    try {
      const file = await pickCsvFile();
      if (file) dispatch(setFoodsCsv({ csv: file.text, fileName: file.name }));
    } catch (e) {
      dispatch(setFoodsImportError(e instanceof CsvFileError ? e.message : "That file couldn't be read."));
    }
  };

  const runImport = async () => {
    haptics.press();
    const r = await dispatch(importFoodsCsvAsync({ csv: s.csv, q }));
    if (importFoodsCsvAsync.fulfilled.match(r)) {
      haptics.success();
      const imported = selectAdminKitchenNutrition(appStore.getState()).result?.imported ?? 0;
      Toast.show({ type: 'success', text1: `${imported} ${imported === 1 ? 'food' : 'foods'} imported` });
    } else haptics.warning();
  };

  const macro = (field: 'kcal' | 'protein' | 'carbs' | 'fat', label: string) => (
    <View style={styles.half}>
      <TextField label={label} keyboardType="decimal-pad" value={f?.[field] ?? ''} onChangeText={t => dispatch(setFoodForm({ [field]: decimal(t) }))} error={errors[field]} />
    </View>
  );

  return (
    <ScreenShell
      title="Nutrition foods"
      subtitle={s.status === 'succeeded' ? `${s.total} ${s.total === 1 ? 'food' : 'foods'} · dish numbers come from these` : 'Dish numbers come from these'}
      onBack={back}
      refreshing={s.status === 'loading' && !!s.items.length}
      onRefresh={() => void dispatch(loadFoodsAsync(q))}
      headerContent={<SearchField value={s.q} onChange={t => dispatch(setFoodsQuery(t))} placeholder="A food or its key" />}
      footer={<Button label="New food" leftIcon="add" onPress={() => dispatch(openFoodSheet('new'))} fullWidth />}>
      {s.status === 'failed' ? (
        <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadFoodsAsync(q)) }} />
      ) : null}
      {s.status === 'loading' && !s.items.length ? <SkeletonLines lines={8} /> : null}
      {s.status === 'succeeded' || s.items.length ? (
        <Card>
          {s.items.length ? (
            s.items.map((x, i) => (
              <View key={x.id}>
                {i ? <Divider /> : null}
                <View style={styles.row}>
                  <AppText variant="bodyStrong">{x.name}</AppText>
                  <AppText variant="small" tone="muted">
                    {macrosLine(x)}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {`${x.key} · ${x.usedBy ? `${x.usedBy} kitchen ${x.usedBy === 1 ? 'ingredient' : 'ingredients'}` : 'not used yet'}`}
                  </AppText>
                  <TextAction label="Edit" onPress={() => dispatch(openFoodSheet(x))} />
                </View>
              </View>
            ))
          ) : (
            <AppText variant="body">{s.q.trim() ? `No food matches “${s.q.trim()}”.` : 'No nutrition foods yet.'}</AppText>
          )}
        </Card>
      ) : null}

      <CsvImport
        columns={NUTRITION_COLUMNS}
        example="khoya,Khoya,g100,421,14.6,25,30"
        csv={s.csv}
        fileName={s.fileName}
        onChangeCsv={t => dispatch(setFoodsCsv({ csv: t, fileName: null }))}
        onPickFile={() => void pickFile()}
        onCheck={() => {
          if (csvError) return haptics.warning();
          void dispatch(checkFoodsCsvAsync(s.csv));
        }}
        onImport={() => void runImport()}
        result={s.result}
        checking={s.checking}
        importing={s.importing}
        error={s.importError.message}
        formError={csvError}
        previewOf={r => ({ key: `${r.row}`, title: `${r.name} (${r.key})`, line: macrosLine(r), pill: CHANGE_LABEL[r.change] })}
      />

      <Sheet
        visible={!!sheet}
        onClose={() => dispatch(openFoodSheet(null))}
        title={sheet?.id ? `Edit ${f?.name ?? 'food'}` : 'New nutrition food'}
        subtitle={sheet?.id ? 'Every dish made with it changes too.' : undefined}
        footer={<Button label="Save" loading={s.busy} onPress={save} fullWidth />}>
        {s.saveError.message ? <InlineNotice message={s.saveError.message} /> : null}
        <TextField label="Name" value={f?.name ?? ''} onChangeText={t => dispatch(setFoodForm({ name: t.slice(0, 60) }))} placeholder="Spinach (palak)" error={errors.name} />
        {!sheet?.id ? (
          <TextField
            label="Key"
            value={f?.key ?? ''}
            onChangeText={t => dispatch(setFoodForm({ key: t.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 40) }))}
            autoCapitalize="none"
            helper="How CSV files and kitchens' ingredients name it. It can't change later."
            error={errors.key}
          />
        ) : null}
        <View style={styles.chips}>
          {PERS.map(p => (
            <ChoiceChip key={p} label={PER_LABEL[p]} selected={f?.per === p} onPress={() => dispatch(setFoodForm({ per: p }))} />
          ))}
        </View>
        <View style={styles.two}>
          {macro('kcal', 'kcal')}
          {macro('protein', 'Protein (g)')}
        </View>
        <View style={styles.two}>
          {macro('carbs', 'Carbs (g)')}
          {macro('fat', 'Fat (g)')}
        </View>
      </Sheet>
    </ScreenShell>
  );
};

export default AdminKitchenNutrition;
