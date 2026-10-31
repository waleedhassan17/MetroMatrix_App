// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen: recipes and costs
// ═══════════════════════════════════════════════════════
// Every dish: what it costs to make, what it sells for, what the kitchen
// keeps, and its food cost against the target (red only when over). Dishes
// without a recipe card can't be costed, counted out of stock or prepped:
// "Needs a recipe" lists them.

import React, { useCallback, useEffect } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { RECIPE_STATUS } from '../../models/kitchen/kitchenStatusModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Card, ChoiceChip, CostBreakdown, EmptyState, IconButton, InlineNotice, ScreenShell, SkeletonLines, StatusPill } from '../../Custom-Components/index';
import type { FoodVendorStackParamList, RecipeRow } from '../../models';
import { cdn } from '../../utils/cdn/cdn';
import { formatPKR } from '../../utils/money/money';
import { loadRecipesAsync, selectRecipesAndCosts, setNeedsRecipe } from './recipesAndCostsSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenRecipes'>;

const makeStyles = ({ space, size, radius, colors }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s12, paddingBottom: space.s40 },
    row: { flexDirection: 'row', gap: space.s12, alignItems: 'flex-start' },
    photo: { width: size.thumb, height: size.thumb, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    text: { flex: 1, gap: space.s4 },
    chips: { flexDirection: 'row', gap: space.s8 },
  });

const RecipesAndCosts: React.FC<Props> = props => (
  <ServiceScope service="food">
    <RecipesAndCostsContent {...props} />
  </ServiceScope>
);

const RecipesAndCostsContent: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'VendorTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const s = useAppSelector(selectRecipesAndCosts);
  const l = s.list;

  useEffect(() => {
    if (route.params?.needsRecipe !== undefined) dispatch(setNeedsRecipe(route.params.needsRecipe));
  }, [dispatch, route.params?.needsRecipe]);

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadRecipesAsync(s.needsRecipe));
    }, [dispatch, s.needsRecipe]),
  );

  const row = (r: RecipeRow) => (
    <Card onPress={() => navigation.navigate('KitchenRecipe', { itemId: r.itemId, variantId: r.variantId })} accessibilityLabel={`${r.name}. ${r.cost ? `Cost to make ${formatPKR(r.cost.toMake)}` : RECIPE_STATUS[r.status].label}`}>
      <View style={styles.row}>
        <Image source={cdn(r.photoUrl, { w: size.thumb, h: size.thumb }) ?? undefined} style={styles.photo} contentFit="cover" />
        <View style={styles.text}>
          <AppText variant="title" numberOfLines={1}>
            {r.name}
          </AppText>
          <AppText variant="caption" tone="muted">
            {[r.categoryName, r.variantName ? `${r.variantName}${r.variantCount > 1 ? ` (of ${r.variantCount} sizes)` : ''}` : null, formatPKR(r.sellPrice)].filter(Boolean).join(' · ')}
          </AppText>
          {r.cost && l ? <CostBreakdown cost={r.cost} targetPct={l.targetFoodCostPct} compact /> : <StatusPill label={RECIPE_STATUS[r.status].label} tone={RECIPE_STATUS[r.status].tone} />}
          {r.cost && r.status === 'partial' ? <StatusPill label={RECIPE_STATUS.partial.label} tone="warning" /> : null}
        </View>
      </View>
    </Card>
  );

  return (
    <ScreenShell
      title="Recipes and costs"
      subtitle={l ? (l.avgFoodCostPct === null ? `Target food cost ${l.targetFoodCostPct}%` : `Average food cost ${l.avgFoodCostPct}% · target ${l.targetFoodCostPct}%`) : 'What each dish costs you to make'}
      onBack={back}
      scroll={false}
      headerRight={<IconButton icon="options-outline" onPress={() => navigation.navigate('KitchenSettings')} accessibilityLabel="Target food cost and kitchen settings" />}
      headerContent={
        <View style={styles.chips}>
          <ChoiceChip label="All dishes" selected={!s.needsRecipe} onPress={() => dispatch(setNeedsRecipe(false))} />
          <ChoiceChip label={l?.counts.missing ? `Needs a recipe · ${l.counts.missing}` : 'Needs a recipe'} selected={s.needsRecipe} onPress={() => dispatch(setNeedsRecipe(true))} />
          {l?.counts.overTarget ? <ChoiceChip label={`Over target · ${l.counts.overTarget}`} selected={false} onPress={() => dispatch(setNeedsRecipe(false))} /> : null}
        </View>
      }>
      <FlatList
        data={l?.items ?? []}
        keyExtractor={r => r.itemId}
        contentContainerStyle={styles.list}
        onRefresh={() => void dispatch(loadRecipesAsync(s.needsRecipe))}
        refreshing={s.status === 'loading' && !!l}
        renderItem={({ item }) => row(item)}
        ListEmptyComponent={
          !l && s.status !== 'failed' ? (
            <SkeletonLines lines={8} />
          ) : s.status === 'failed' ? (
            <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadRecipesAsync(s.needsRecipe)) }} />
          ) : (
            <EmptyState icon="check-circle" title={s.needsRecipe ? 'Every dish has a recipe card' : 'No dishes yet'} body={s.needsRecipe ? 'Costs, stock and the prep sheet can use all of them.' : 'Add dishes to your menu first.'} />
          )
        }
      />
    </ScreenShell>
  );
};

export default RecipesAndCosts;
