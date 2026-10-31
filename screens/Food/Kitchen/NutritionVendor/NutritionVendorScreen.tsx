// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen: nutrition
// ═══════════════════════════════════════════════════════
// Calories and macros for each dish as it is sold: worked out from its
// recipe card where every ingredient is matched to a nutrition food, or
// estimated from its name, always said with how it was worked out and how
// sure it is. Ingredients not matched yet are listed with suggestions (one
// tap matches them, and every dish they are in is worked out again). A dish
// can be hidden from customers. Customers see numbers only if they turn
// calories on themselves.

import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { useDebouncedValue } from '../../../../hooks/usePagedList';
import { NUTRITION_METHOD, PER_LABEL, confidenceOf, nutritionLine } from '../../../../models/kitchen/assistantModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { AppText, Card, ChoiceChip, Divider, InlineNotice, ListRow, ScreenShell, Sheet, SkeletonLines, StatusPill, TextAction, TextField, ToggleRow } from '../../../../Custom-Components/index';
import { SectionHead } from '../../../../Components/admin/AdminParts';
import type { FoodVendorStackParamList } from '../../../../types';
import {
  loadVendorNutritionAsync,
  mapIngredientAsync,
  openFoodSearch,
  searchFoodsAsync,
  selectNutritionVendor,
  setFoodQuery,
  setNutritionHiddenAsync,
} from './nutritionVendorSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenNutrition'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    tight: { gap: space.s4 },
    row: { gap: space.s8, paddingVertical: space.s12 },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    group: { gap: space.s8 },
  });

const NutritionVendorScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <NutritionVendorContent {...props} />
  </ServiceScope>
);

const NutritionVendorContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'KitchenAssistant' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectNutritionVendor);
  const d = s.data;
  const query = useDebouncedValue(s.query, 300);

  const load = useCallback(() => void dispatch(loadVendorNutritionAsync()), [dispatch]);
  useFocusEffect(load);
  useEffect(() => {
    if (s.searchFor) void dispatch(searchFoodsAsync(query));
  }, [dispatch, query, s.searchFor]);

  const searching = d?.unmapped.find(u => u.ingredientId === s.searchFor) ?? null;

  return (
    <ScreenShell title="Nutrition" subtitle="Per dish as you sell it" onBack={back} refreshing={s.status === 'loading' && !!d} onRefresh={load}>
      {s.status === 'failed' && !d ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : null}
      {s.actionError.message ? <InlineNotice message={s.actionError.message} /> : null}
      {!d && s.status !== 'failed' ? <SkeletonLines lines={10} /> : null}
      {d ? (
        <>
          <Card>
            <View style={styles.tight}>
              <AppText variant="title">{`${d.counts.recipe} from recipe cards · ${d.counts.estimate} estimated`}</AppText>
              <AppText variant="small" tone="muted">
                {d.counts.none
                  ? `${d.counts.none} not worked out yet: add their recipe cards, or turn the assistant back on for an estimate.`
                  : 'Customers see these only if they turn calories on. Hide any dish below.'}
              </AppText>
            </View>
          </Card>

          {d.unmapped.length ? (
            <View style={styles.group}>
              <SectionHead title={`Ingredients to match · ${d.unmapped.length}`} />
              <Card padded="horizontal">
                {d.unmapped.map((u, n) => (
                  <View key={u.ingredientId}>
                    {n ? <Divider /> : null}
                    <View style={styles.row}>
                      <AppText variant="bodyStrong">{u.name}</AppText>
                      <AppText variant="small" tone="muted">
                        {u.usedIn.length ? `In ${u.usedIn.join(', ')}` : 'Not in a recipe card yet'}
                      </AppText>
                      <View style={styles.pills}>
                        {u.suggestions.map(f => (
                          <ChoiceChip key={f.foodId} label={`${f.name} (${PER_LABEL[f.per]})`} selected={false} disabled={s.mapping === u.ingredientId} onPress={() => void dispatch(mapIngredientAsync({ ingredientId: u.ingredientId, foodId: f.foodId }))} />
                        ))}
                      </View>
                      {s.mapping === u.ingredientId ? (
                        <AppText variant="small" tone="muted">
                          Matching…
                        </AppText>
                      ) : (
                        <TextAction label="Search all foods" icon="search-outline" onPress={() => dispatch(openFoodSearch({ ingredientId: u.ingredientId, query: u.name.split(/[ (]/)[0] }))} />
                      )}
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}

          <View style={styles.group}>
            <SectionHead title="Dishes" />
            <Card padded="horizontal">
              {d.items.map((i, n) => {
                const c = confidenceOf(i.confidence);
                return (
                  <View key={i.itemId}>
                    {n ? <Divider /> : null}
                    <View style={styles.row}>
                      <AppText variant="bodyStrong">{i.name}</AppText>
                      <AppText variant="body">{nutritionLine(i)}</AppText>
                      <View style={styles.pills}>
                        <StatusPill label={NUTRITION_METHOD[i.method]} tone={i.method === 'recipe' ? 'accent' : 'neutral'} />
                        {i.method !== 'none' ? <StatusPill label={c.label} tone={c.tone} /> : null}
                      </View>
                      {i.missing.length ? (
                        <AppText variant="small" tone="muted">
                          {`Not counted yet: ${i.missing.join(', ')}`}
                        </AppText>
                      ) : null}
                      <ToggleRow label="Show to customers" value={!i.hidden} disabled={i.method === 'none' || s.toggling === i.itemId} onChange={v => void dispatch(setNutritionHiddenAsync({ itemId: i.itemId, hidden: !v }))} />
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
          <AppText variant="caption" tone="muted">
            Estimated from your recipe cards and standard food tables. Real portions vary; numbers are a guide, not a medical claim.
          </AppText>
        </>
      ) : null}

      <Sheet visible={!!searching} onClose={() => dispatch(openFoodSearch(null))} title={searching ? `Match ${searching.name}` : ''} subtitle="Pick the food it is closest to">
        <View style={styles.gap}>
          <TextField label="Search" value={s.query} onChangeText={v => dispatch(setFoodQuery(v))} icon="search-outline" clearable autoFocus />
          {s.searching && !s.foods.length ? <SkeletonLines lines={3} /> : null}
          {s.foods.map(f => (
            <ListRow
              key={f.id}
              title={f.name}
              subtitle={`${f.kcal} kcal ${PER_LABEL[f.per]} · protein ${f.protein} g`}
              onPress={() => searching && void dispatch(mapIngredientAsync({ ingredientId: searching.ingredientId, foodId: f.id }))}
            />
          ))}
          {!s.searching && !s.foods.length ? (
            <AppText variant="small" tone="muted">
              No food by that name. Try a shorter word.
            </AppText>
          ) : null}
        </View>
      </Sheet>
    </ScreenShell>
  );
};

export default NutritionVendorScreen;
