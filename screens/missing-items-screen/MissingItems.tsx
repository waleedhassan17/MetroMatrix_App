// ═══════════════════════════════════════════════════════
// MetroMatrix — My Kitchen: get the missing items
// ═══════════════════════════════════════════════════════
// For each thing a recipe needs that the kitchen hasn't got: MetroMatrix
// Shopping's grocery packs, cheapest per kilo, litre or piece first, with
// the store, the pack and how many packs the recipe needs. "Add to bag"
// puts them in the Shopping bag (paid to the store at checkout); "View bag"
// opens Shopping.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useServiceNav } from '../../hooks/useServiceNav';
import { optionLine } from '../../models/myKitchen/pantryModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, Divider, EmptyState, InlineNotice, ScreenShell, SkeletonLines, StatusPill } from '../../Custom-Components/index';
import type { FoodAppParamList, GroceryOption } from '../../models';
import { formatQty } from '../../utils/units/units';
import { haptics } from '../../utils/haptics/haptics';
import { addToBagAsync, selectBag } from '../bag-screen/bagSlice';
import { loadMissingItemsAsync, markAddedToBag, selectMissingItems } from './missingItemsSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'MyKitchenMissing'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    tight: { gap: space.s4 },
    option: { gap: space.s8, paddingVertical: space.s8 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.s8 },
    grow: { flex: 1, minWidth: 0 },
  });

const MissingItems: React.FC<Props> = props => (
  <ServiceScope service="food">
    <MissingItemsContent {...props} />
  </ServiceScope>
);

const MissingItemsContent: React.FC<Props> = ({ route }) => {
  const { id, title, servings = null } = route.params;
  const { back } = useBack({ name: 'MyKitchenRecipes' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectMissingItems);
  const bag = useAppSelector(selectBag);
  const { openShopTab } = useServiceNav();

  const load = useCallback(() => void dispatch(loadMissingItemsAsync({ id, servings })), [dispatch, id, servings]);
  useFocusEffect(load);

  const add = async (o: GroceryOption) => {
    if (!o.variantId) return;
    haptics.press();
    const r = await dispatch(addToBagAsync({ variantId: o.variantId, quantity: o.packsNeeded }));
    if (addToBagAsync.fulfilled.match(r)) {
      haptics.success();
      dispatch(markAddedToBag(o.variantId));
      Toast.show({ type: 'success', text1: `${o.name} in your bag`, text2: `${o.packsNeeded > 1 ? `${o.packsNeeded} packs · ` : ''}${o.store.name}` });
    } else haptics.warning();
  };

  const items = s.recipeId === id ? s.items : [];
  return (
    <ScreenShell title="Get what’s missing" subtitle={title ?? 'From MetroMatrix Shopping'} onBack={back} refreshing={s.status === 'loading' && !!items.length} onRefresh={load}>
      {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : null}
      {bag.addError.message ? <InlineNotice message={bag.addError.message} /> : null}
      {!items.length && s.status === 'loading' ? <SkeletonLines lines={8} /> : null}
      {s.status === 'succeeded' && !items.length ? <EmptyState icon="check-circle" title="Nothing missing" body="You have everything this recipe needs." /> : null}
      {items.map(m => (
        <Card key={m.key}>
          <View style={styles.gap}>
            <View style={styles.tight}>
              <AppText variant="title">{m.name}</AppText>
              <AppText variant="small" tone="muted">{`The recipe needs ${formatQty(m.need.qty, m.need.unit)}`}</AppText>
            </View>
            {!m.options.length ? (
              <AppText variant="small" tone="muted">
                No store on MetroMatrix sells this yet.
              </AppText>
            ) : null}
            {m.options.map((o, n) => {
              const added = !!o.variantId && s.added.includes(o.variantId);
              return (
                <View key={o.productId}>
                  {n ? <Divider /> : null}
                  <View style={styles.option}>
                    <View style={styles.head}>
                      <AppText variant="bodyStrong" style={styles.grow}>
                        {o.name}
                      </AppText>
                      {n === 0 && m.options.length > 1 ? <StatusPill label="Cheapest per unit" tone="success" /> : null}
                    </View>
                    <AppText variant="small" tone="muted">{`${o.store.name} · ${optionLine(o)}`}</AppText>
                    <Button
                      label={added ? 'In your bag' : o.inStock ? `Add ${o.packsNeeded > 1 ? `${o.packsNeeded} ` : ''}to bag` : 'Out of stock'}
                      variant={n === 0 ? 'primary' : 'secondary'}
                      size="sm"
                      disabled={added || !o.inStock || !o.variantId}
                      loading={bag.adding}
                      onPress={() => void add(o)}
                      fullWidth
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      ))}
      {s.added.length ? <Button label="View bag" leftIcon="bag-outline" onPress={() => openShopTab('BagTab')} fullWidth /> : null}
      <AppText variant="caption" tone="muted">
        Prices are each store’s own on MetroMatrix Shopping. You pay the store at checkout.
      </AppText>
    </ScreenShell>
  );
};

export default MissingItems;
