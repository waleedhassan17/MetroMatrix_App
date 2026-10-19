// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen: suppliers
// ═══════════════════════════════════════════════════════
// Who the kitchen buys from: a name, a phone number to call, a note
// ("delivers before 9", "cash only"), and how often and when it last bought.

import React, { useEffect } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { Button, EmptyState, InlineNotice, ScreenShell, Sheet, SkeletonLines, TextAction, TextField } from '@custom/index';
import { RowCard } from '@components/admin/AdminParts';
import { formatDayFull } from '@utils/healthTime';
import { haptics } from '@utils/haptics';
import { deleteSupplierAsync, editSupplier, loadSuppliersAsync, saveSupplierAsync, selectSuppliers, setSupplierDraft } from './suppliersSlice';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s12, paddingBottom: space.s40 },
  });

const SuppliersScreen: React.FC = () => (
  <ServiceScope service="food">
    <SuppliersContent />
  </ServiceScope>
);

const SuppliersContent: React.FC = () => {
  const { back } = useBack({ name: 'KitchenPurchases' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectSuppliers);
  const e = s.editing;

  useEffect(() => {
    void dispatch(loadSuppliersAsync());
  }, [dispatch]);

  const save = async () => {
    if (!e || e.name.trim().length < 2) {
      haptics.warning();
      return;
    }
    const res = await dispatch(saveSupplierAsync(e));
    if (saveSupplierAsync.fulfilled.match(res)) haptics.success();
  };

  return (
    <ScreenShell
      title="Suppliers"
      subtitle="Who you buy from"
      onBack={back}
      scroll={false}
      footer={<Button label="Add a supplier" leftIcon="add" onPress={() => dispatch(editSupplier({ id: null, name: '', phone: '', note: '' }))} fullWidth />}>
      <FlatList
        data={s.suppliers}
        keyExtractor={x => x.id}
        contentContainerStyle={styles.list}
        onRefresh={() => void dispatch(loadSuppliersAsync())}
        refreshing={s.status === 'loading' && !!s.suppliers.length}
        renderItem={({ item: x }) => (
          <RowCard
            title={x.name}
            mark={{ name: x.name }}
            lines={[x.phone, x.note, x.purchaseCount ? `${x.purchaseCount} ${x.purchaseCount === 1 ? 'purchase' : 'purchases'}${x.lastPurchaseOn ? `, last on ${formatDayFull(x.lastPurchaseOn)}` : ''}` : 'No purchases yet']}
            onPress={() => dispatch(editSupplier({ id: x.id, name: x.name, phone: x.phone ?? '', note: x.note ?? '' }))}
          />
        )}
        ListEmptyComponent={
          s.status === 'loading' ? (
            <SkeletonLines lines={4} />
          ) : s.status === 'failed' ? (
            <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadSuppliersAsync()) }} />
          ) : (
            <EmptyState icon="truck" title="No suppliers yet" body="Add the mandi stall, the meat shop, the cash and carry: then pick them on a purchase." />
          )
        }
      />
      <Sheet
        visible={!!e}
        onClose={() => dispatch(editSupplier(null))}
        title={e?.id ? 'Edit supplier' : 'New supplier'}
        footer={<Button label="Save" onPress={() => void save()} loading={s.saving} fullWidth />}>
        <TextField label="Name" value={e?.name ?? ''} onChangeText={name => dispatch(setSupplierDraft({ name }))} error={e && e.name.trim().length > 0 && e.name.trim().length < 2 ? 'At least 2 letters' : undefined} />
        <TextField label="Phone (optional)" value={e?.phone ?? ''} onChangeText={phone => dispatch(setSupplierDraft({ phone }))} keyboardType="phone-pad" />
        <TextField label="Note (optional)" value={e?.note ?? ''} onChangeText={note => dispatch(setSupplierDraft({ note }))} placeholder="Delivers before 9, cash only…" />
        {s.saveError.message ? <InlineNotice message={s.saveError.message} /> : null}
        {e?.id ? <TextAction label="Remove this supplier" tone="danger" onPress={() => e.id && void dispatch(deleteSupplierAsync(e.id))} /> : null}
      </Sheet>
    </ScreenShell>
  );
};

export default SuppliersScreen;
