// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: city prices
// ═══════════════════════════════════════════════════════
// The PBS SPI items Price watch compares each kitchen's purchases with: in
// how many cities, and the latest week loaded. PBS publishes a PDF, so staff
// type the rows they need into a CSV, checked row by row before anything is
// imported.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector, useAppStore } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useDebouncedValue } from '../../hooks/usePagedList';
import { PRICE_COLUMNS, referenceLine, validateCsvText } from '../../models/kitchen/adminKitchenModel';
import { useStyles, type Theme } from '../../theme/index';
import { AppText, Card, Divider, InlineNotice, ScreenShell, SkeletonLines } from '../../Custom-Components/index';
import { SearchField } from '../../Components/shopping/ShopParts';
import { CsvImport } from '../../Components/admin/CsvImport';
import { CsvFileError, pickCsvFile } from '../../services/csvFile';
import type { AdminFoodStackParamList } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
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

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s8 },
    grow: { flex: 1, gap: space.s4 },
  });

const AdminKitchenPrices: React.FC<Props> = () => {
  const { back } = useBack({ name: 'FoodOverview' });
  const dispatch = useAppDispatch();
  const appStore = useAppStore();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAdminKitchenPrices);
  const l = s.list;
  const q = useDebouncedValue(s.q.trim());
  const csvError = s.csv.trim() ? validateCsvText(s.csv, PRICE_COLUMNS).csv : undefined;

  useEffect(() => {
    void dispatch(loadPricesAsync({ q }));
  }, [dispatch, q]);

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
    const r = await dispatch(importPricesCsvAsync({ csv: s.csv }));
    if (importPricesCsvAsync.fulfilled.match(r)) {
      haptics.success();
      const imported = selectAdminKitchenPrices(appStore.getState()).result?.imported ?? 0;
      Toast.show({ type: 'success', text1: `${imported} ${imported === 1 ? 'price' : 'prices'} imported` });
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title="City prices"
      subtitle="What kitchens compare their purchases with (PBS weekly prices)"
      onBack={back}
      refreshing={s.status === 'loading' && !!l}
      onRefresh={() => void dispatch(loadPricesAsync({ q }))}
      headerContent={<SearchField value={s.q} onChange={t => dispatch(setPricesFilter({ q: t }))} placeholder="An item" />}>
      {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadPricesAsync({ q })) }} /> : null}
      {!l && s.status !== 'failed' ? <SkeletonLines lines={8} /> : null}
      {l ? (
        <Card>
          {l.length ? (
            l.map((p, i) => (
              <View key={p.key}>
                {i ? <Divider /> : null}
                <View style={styles.row}>
                  <View style={styles.grow}>
                    <AppText variant="bodyStrong">{p.name}</AppText>
                    <AppText variant="small" tone="muted">
                      {referenceLine(p)}
                    </AppText>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <AppText variant="body">{s.q.trim() ? `No item matches “${s.q.trim()}”.` : 'No items yet: import a week below.'}</AppText>
          )}
        </Card>
      ) : null}

      <CsvImport
        columns={PRICE_COLUMNS}
        example="2026-10-15,Lahore,Tomatoes,kg,180"
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
      />
      <AppText variant="caption" tone="muted">
        A row is one item’s price in one city for the week ending that day (kg, g, litre, ml, dozen or piece). Kitchens see their own purchases against it in Price watch.
      </AppText>
    </ScreenShell>
  );
};

export default AdminKitchenPrices;
