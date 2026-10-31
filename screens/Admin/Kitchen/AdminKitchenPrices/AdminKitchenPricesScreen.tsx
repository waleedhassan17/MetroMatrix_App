// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: city prices
// ═══════════════════════════════════════════════════════
// The reference price list Price watch compares each kitchen's purchases
// with: a city's latest week, per kg, litre or piece, with how far each
// moved in four weeks. A new week comes in as a CSV, checked row by row
// before anything is imported.

import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { useDebouncedValue } from '../../../../hooks/usePagedList';
import {
  PRICE_COLUMNS,
  changeLine,
  changeTone,
  unitPrice,
  validateCsvText,
  weekLine,
} from '../../../../models/kitchen/adminKitchenModel';
import { useStyles, type Theme } from '../../../../theme/index';
import {
  AppText,
  Card,
  ChoiceChip,
  Divider,
  InlineNotice,
  ScreenShell,
  SkeletonLines,
  StatusPill,
} from '../../../../Custom-Components/index';
import { SearchField } from '../../../../Components/shopping/ShopParts';
import { CsvImport } from '../../../../Components/admin/CsvImport';
import { CsvFileError, pickCsvFile } from '../../../../services/csvFile';
import type { AdminFoodStackParamList } from '../../../../types';
import { haptics } from '../../../../utils/haptics';
import { formatPKR } from '../../../../utils/money';
import Toast from 'react-native-toast-message';
import {
  checkPricesCsvAsync,
  importPricesCsvAsync,
  loadPricesAsync,
  selectAdminKitchenPrices,
  setPricesCsv,
  setPricesFilter,
  setPricesImportError,
} from './adminKitchenPricesSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminKitchenPrices'>;

const makeStyles = ({ space, gutter }: Theme) =>
  StyleSheet.create({
    chipBar: { flexGrow: 0, flexShrink: 0 },
    chips: { flexDirection: 'row', gap: space.s8, paddingRight: gutter },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s8 },
    grow: { flex: 1, gap: space.s4 },
  });

const AdminKitchenPricesScreen: React.FC<Props> = () => {
  const { back } = useBack({ name: 'FoodOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAdminKitchenPrices);
  const l = s.list;
  const q = useDebouncedValue(s.q.trim());
  const csvError = s.csv.trim() ? validateCsvText(s.csv, PRICE_COLUMNS).csv : undefined;

  useEffect(() => {
    void dispatch(loadPricesAsync({ city: s.city, q }));
  }, [dispatch, s.city, q]);

  const pickFile = async () => {
    try {
      const f = await pickCsvFile();
      if (f) dispatch(setPricesCsv({ csv: f.text, fileName: f.name }));
    } catch (e) {
      dispatch(setPricesImportError(e instanceof CsvFileError ? e.message : "That file couldn't be read."));
    }
  };

  const runImport = async () => {
    haptics.press();
    const r = await dispatch(importPricesCsvAsync({ csv: s.csv, city: s.city }));
    if (importPricesCsvAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: `${r.payload.result.imported} ${r.payload.result.imported === 1 ? 'price' : 'prices'} imported` });
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title="City prices"
      subtitle={l ? weekLine(l) : 'What kitchens compare their purchases with'}
      onBack={back}
      refreshing={s.status === 'loading' && !!l}
      onRefresh={() => void dispatch(loadPricesAsync({ city: s.city, q }))}
      headerContent={
        <>
          <SearchField value={s.q} onChange={t => dispatch(setPricesFilter({ q: t }))} placeholder="An ingredient" />
          {l?.cities.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
              {l.cities.map(c => (
                <ChoiceChip key={c} label={c} selected={l.city === c} onPress={() => dispatch(setPricesFilter({ city: c }))} />
              ))}
            </ScrollView>
          ) : null}
        </>
      }>
      {s.status === 'failed' ? (
        <InlineNotice
          message={s.error.message}
          action={{ label: 'Try again', onPress: () => void dispatch(loadPricesAsync({ city: s.city, q })) }}
        />
      ) : null}
      {!l && s.status !== 'failed' ? <SkeletonLines lines={8} /> : null}
      {l ? (
        <Card>
          {l.items.length ? (
            l.items.map((p, i) => (
              <View key={p.key}>
                {i ? <Divider /> : null}
                <View style={styles.row}>
                  <View style={styles.grow}>
                    <AppText variant="bodyStrong">{p.name}</AppText>
                    <AppText variant="small" tone="muted">
                      {unitPrice(p.price, p.unit)}
                    </AppText>
                  </View>
                  {changeLine(p.changePct) ? <StatusPill label={changeLine(p.changePct)!} tone={changeTone(p.changePct)} /> : null}
                </View>
              </View>
            ))
          ) : (
            <AppText variant="body">{s.q.trim() ? `No ingredient matches “${s.q.trim()}”.` : 'No prices for this city yet.'}</AppText>
          )}
        </Card>
      ) : null}

      <CsvImport
        columns={PRICE_COLUMNS}
        example="tomato,Lahore,2026-10-19,190"
        csv={s.csv}
        fileName={s.fileName}
        onChangeCsv={t => dispatch(setPricesCsv({ csv: t, fileName: null }))}
        onPickFile={() => void pickFile()}
        onCheck={() => {
          if (csvError) return haptics.warning();
          void dispatch(checkPricesCsvAsync(s.csv));
        }}
        onImport={() => void runImport()}
        result={s.result}
        checking={s.checking}
        importing={s.importing}
        error={s.importError.message}
        formError={csvError}
        previewOf={r => ({
          key: `${r.row}`,
          title: `${r.name} · ${r.city}`,
          line: `Week of ${r.week} · ${unitPrice(r.price, r.unit)}${r.previous !== null ? ` (was ${formatPKR(r.previous)})` : ''}`,
          pill: r.previous === null ? { label: 'New', tone: 'accent' } : { label: 'Changes', tone: 'warning' },
        })}
      />
      <AppText variant="caption" tone="muted">
        A price is rupees per kg, litre or piece, for the week starting on its Monday. Kitchens see their own purchases against it in Price watch.
      </AppText>
    </ScreenShell>
  );
};

export default AdminKitchenPricesScreen;
