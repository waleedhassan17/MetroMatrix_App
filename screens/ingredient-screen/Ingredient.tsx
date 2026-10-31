// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen: an ingredient
// ═══════════════════════════════════════════════════════
// How much there is against the restock level, what it costs, each batch
// with its expiry and supplier, every movement (bought, used in orders,
// wasted, counted), and the dishes that use it. Edit or delete it.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { CATEGORY_LABEL, MOVEMENT_LABEL, STOCK_STATE } from '../../models/kitchen/kitchenStatusModel';
import { parLabel, qtyLabel } from '../../models/kitchen/stockModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, Divider, ExpiryChip, InlineNotice, ListRow, ScreenShell, SkeletonLines, StatusPill, StockLevelBar, TextAction } from '../../Custom-Components/index';
import { SectionHead } from '../../Components/admin/AdminParts';
import type { FoodVendorStackParamList } from '../../models';
import { Alert } from '../../utils/alert/alert';
import { formatDateTime, formatDate } from '../../utils/dates/dates';
import { formatUnitPrice } from '../../utils/units/units';
import { todayInZone } from '../../utils/health-time/healthTime';
import { deleteIngredientAsync, loadIngredientAsync, selectIngredient } from './ingredientSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenIngredient'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    facts: { gap: space.s8 },
    fact: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s12 },
    batch: { gap: space.s4, paddingVertical: space.s12 },
    batchHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s8 },
    move: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s8 },
    grow: { flex: 1, gap: space.s4 },
  });

const Ingredient: React.FC<Props> = props => (
  <ServiceScope service="food">
    <IngredientContent {...props} />
  </ServiceScope>
);

const IngredientContent: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'KitchenStock' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectIngredient);
  const id = route.params.id;
  const i = s.detail?.id === id ? s.detail : null;
  const today = todayInZone('Asia/Karachi');

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadIngredientAsync(id));
    }, [dispatch, id]),
  );

  const remove = () =>
    Alert.alert(`Delete ${i?.name ?? 'this ingredient'}?`, 'Its batches and history go too. Dishes that use it must drop it first.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void dispatch(deleteIngredientAsync(id)).then(res => {
            if (deleteIngredientAsync.fulfilled.match(res)) {
              Toast.show({ type: 'success', text1: 'Ingredient deleted' });
              back();
            }
          }),
      },
    ]);

  const fact = (label: string, value: string) => (
    <View style={styles.fact}>
      <AppText variant="body" tone="muted">
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );

  return (
    <ScreenShell
      title={i?.name ?? 'Ingredient'}
      subtitle={i ? `${CATEGORY_LABEL[i.category]} · ${STOCK_STATE[i.state].label}` : undefined}
      onBack={back}
      refreshing={s.status === 'loading' && !!i}
      onRefresh={() => void dispatch(loadIngredientAsync(id))}
      footer={i ? <Button label="Edit" variant="secondary" leftIcon="create-outline" onPress={() => navigation.navigate('KitchenIngredientForm', { id })} fullWidth /> : undefined}>
      {s.status === 'failed' && !i ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadIngredientAsync(id)) }} /> : null}
      {!i && s.status !== 'failed' ? <SkeletonLines lines={8} /> : null}
      {i ? (
        <>
          <StockLevelBar ingredient={i} today={today} />
          <Card>
            <View style={styles.facts}>
              {fact('On hand', parLabel(i))}
              {fact('Average cost', formatUnitPrice(i.costPerBase, i.baseUnit))}
              {fact('Last paid', formatUnitPrice(i.latestCostPerBase, i.baseUnit))}
              {i.customUnits.length ? fact('Your units', i.customUnits.map(u => `1 ${u.name} = ${qtyLabel(i, u.base)}`).join(', ')) : null}
            </View>
          </Card>

          <SectionHead title="In stock" />
          <Card padded="horizontal">
            {i.batches.length ? (
              i.batches.map((b, n) => (
                <View key={b.id}>
                  {n > 0 ? <Divider /> : null}
                  <View style={styles.batch}>
                    <View style={styles.batchHead}>
                      <AppText variant="bodyStrong">{qtyLabel(i, b.qty)}</AppText>
                      {b.expiresOn ? <ExpiryChip on={b.expiresOn} today={today} /> : <StatusPill label="Keeps" />}
                    </View>
                    <AppText variant="caption" tone="muted">
                      Bought {formatDate(b.receivedAt)}
                      {b.supplierName ? ` from ${b.supplierName}` : ''} · {formatUnitPrice(b.costPerBase, i.baseUnit)}
                    </AppText>
                  </View>
                </View>
              ))
            ) : (
              <ListRow title={i.onHand < 0 ? `${qtyLabel(i, -i.onHand)} used beyond the records` : 'Nothing in stock'} subtitle="A purchase or a count puts it right." chevron={false} />
            )}
          </Card>

          {i.usedIn.length ? (
            <>
              <SectionHead title="Used in" />
              <Card padded="horizontal">
                {i.usedIn.map((u, n) => (
                  <View key={`${u.itemId}-${u.variantId}`}>
                    {n > 0 ? <Divider /> : null}
                    <ListRow title={u.name} subtitle={`${qtyLabel(i, u.qtyPerServing)} a serving`} onPress={() => navigation.navigate('KitchenRecipe', { itemId: u.itemId, variantId: u.variantId })} />
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <SectionHead title="History" />
          <Card padded="horizontal">
            {i.movements.length ? (
              i.movements.slice(0, 20).map((m, n) => (
                <View key={m.id}>
                  {n > 0 ? <Divider /> : null}
                  <View style={styles.move}>
                    <View style={styles.grow}>
                      <AppText variant="body">{m.orderCode ? `${MOVEMENT_LABEL[m.kind]} · ${m.orderCode}` : (m.note ?? MOVEMENT_LABEL[m.kind])}</AppText>
                      <AppText variant="caption" tone="muted">
                        {formatDateTime(m.at)}
                      </AppText>
                    </View>
                    <AppText variant="bodyStrong" tone={m.qty < 0 ? 'muted' : 'success'}>
                      {m.qty > 0 ? '+' : ''}
                      {qtyLabel(i, m.qty)}
                    </AppText>
                  </View>
                </View>
              ))
            ) : (
              <ListRow title="No movements yet" chevron={false} />
            )}
          </Card>
          {s.deleteError.message ? <InlineNotice message={s.deleteError.message} /> : null}
          <TextAction label="Delete this ingredient" tone="danger" onPress={remove} disabled={s.deleting} />
        </>
      ) : null}
    </ScreenShell>
  );
};

export default Ingredient;
