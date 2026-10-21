// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen: a recipe card
// ═══════════════════════════════════════════════════════
// One dish, one size: the servings a batch makes, its ingredients, what
// each add-on uses, its packaging, and whose signature recipe it is. The
// cost to make, what it sells for and what the kitchen keeps update as the
// cook types; saving makes it the one the kitchen counts stock and costs by.

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { draftCost, draftLineCost, recipeInputOf, validateRecipe, type CostedIngredient, type DraftLine } from '@models/kitchen/costingModel';
import { unitChoices, unitOfKey } from '@models/kitchen/stockModel';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import {
  AppText,
  BottomSheetPicker,
  Button,
  Card,
  ChoiceChip,
  CostBreakdown,
  Divider,
  InlineNotice,
  RecipeLineRow,
  ScreenShell,
  SkeletonLines,
  TextAction,
  TextField,
  ToggleRow,
} from '@custom/index';
import { SectionHead } from '@components/admin/AdminParts';
import { IngredientPicker } from '@components/kitchen/IngredientPicker';
import type { FoodVendorStackParamList } from '@/types';
import { Alert } from '@utils/alert';
import { haptics } from '@utils/haptics';
import {
  addRecipeLine,
  deleteRecipeAsync,
  loadRecipeEditorAsync,
  removeRecipeLine,
  saveRecipeAsync,
  selectRecipeEditor,
  setRecipeLineErrors,
  setRecipeYield,
  setSignature,
  updateRecipeLine,
  type LineSection,
} from './recipeEditorSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenRecipe'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', gap: space.s8, flexWrap: 'wrap' },
    section: { gap: space.s8 },
    addon: { gap: space.s4, paddingVertical: space.s8 },
  });

const RecipeEditorScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <RecipeEditorContent {...props} />
  </ServiceScope>
);

const RecipeEditorContent: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'KitchenRecipes' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectRecipeEditor);
  const { itemId, variantId } = route.params;
  const [picking, setPicking] = useState<LineSection | null>(null);
  const [unitFor, setUnitFor] = useState<{ section: LineSection; line: DraftLine } | null>(null);

  useEffect(() => {
    void dispatch(loadRecipeEditorAsync({ itemId, variantId }));
  }, [dispatch, itemId, variantId]);

  const byId = useMemo<Record<string, CostedIngredient>>(() => Object.fromEntries(s.ingredients.map(i => [i.id, i])), [s.ingredients]);
  const r = s.recipe?.itemId === itemId ? s.recipe : null;
  const d = s.draft;
  const servings = Math.max(1, Math.round(Number(d.yield) || 1));
  const cost = r ? draftCost(d, byId, r.sellPrice, r.targetFoodCostPct) : null;

  const switchSize = (vid: string) => {
    if (vid === r?.variantId) return;
    const go = () => navigation.setParams({ variantId: vid });
    if (s.dirty) Alert.alert('Leave your changes?', 'This size’s card isn’t saved yet.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Leave them', style: 'destructive', onPress: go }]);
    else go();
  };

  const save = async () => {
    if (!r) return;
    const { input, lineErrors } = recipeInputOf(d, byId);
    const errors = validateRecipe(input);
    if (Object.keys(lineErrors).length || Object.keys(errors).length) {
      dispatch(setRecipeLineErrors(lineErrors));
      haptics.warning();
      return;
    }
    const res = await dispatch(saveRecipeAsync({ itemId, variantId: r.variantId, input }));
    if (saveRecipeAsync.fulfilled.match(res)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Recipe saved', text2: res.payload.cost ? `Cost to make ${res.payload.cost.toMake}. Stock now counts it.` : undefined });
    } else haptics.warning();
  };

  const lines = (section: LineSection, list: DraftLine[], tag?: string) =>
    list.map((l, n) => {
      const i = byId[l.ingredientId];
      const unit = i ? unitOfKey(i, l.unitKey) : null;
      return (
        <View key={l.key}>
          {n > 0 ? <Divider /> : null}
          <RecipeLineRow
            name={i?.name ?? 'Ingredient'}
            amount={l.amount}
            unitLabel={unit?.label ?? ''}
            costLabel={draftLineCost(l, byId, section === 'lines' ? servings : 1)}
            onAmountChange={amount => dispatch(updateRecipeLine({ section, key: l.key, patch: { amount } }))}
            onUnitPress={() => setUnitFor({ section, line: l })}
            onNamePress={() => setPicking(section)}
            onRemove={() => dispatch(removeRecipeLine({ section, key: l.key }))}
            tag={tag}
            error={s.lineErrors[l.key]}
          />
        </View>
      );
    });

  if (!r) {
    return (
      <ScreenShell title="Recipe card" onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadRecipeEditorAsync({ itemId, variantId })) }} /> : <SkeletonLines lines={8} />}
      </ScreenShell>
    );
  }

  const addonCount = Object.values(d.addOns).reduce((n, xs) => n + xs.length, 0);
  return (
    <ScreenShell
      title={r.itemName}
      subtitle={r.variants.length ? `${r.variants.find(v => v.id === r.variantId)?.name ?? 'Every size'} · recipe card` : 'Recipe card'}
      onBack={back}
      footer={<Button label={s.dirty ? 'Save the recipe' : 'Saved'} onPress={() => void save()} loading={s.saving} disabled={!s.dirty} fullWidth />}>
      {r.variants.length > 1 ? (
        <View style={styles.chips}>
          {r.variants.map(v => (
            <ChoiceChip key={v.id} label={`${v.name}${v.hasRecipe ? '' : ' · no card'}`} selected={v.id === r.variantId} onPress={() => switchSize(v.id)} />
          ))}
        </View>
      ) : null}

      {cost ? (
        <Card>
          <CostBreakdown cost={cost} targetPct={r.targetFoodCostPct} />
        </Card>
      ) : null}
      {r.servingsLeft !== null ? (
        <AppText variant="small" tone="muted">
          Stock makes {r.servingsLeft} more {r.servingsLeft === 1 ? 'serving' : 'servings'} of this.
        </AppText>
      ) : null}

      <TextField label="Servings this batch makes" value={d.yield} onChangeText={t => dispatch(setRecipeYield(t))} keyboardType="number-pad" helper="Enter the batch as you cook it: 2 kg of chicken for 10 plates is 10" />

      <View style={styles.section}>
        <SectionHead title="Ingredients" action={{ label: 'Add', onPress: () => setPicking('lines') }} />
        <Card padded="horizontal">
          {d.lines.length ? lines('lines', d.lines) : <AppText variant="small" tone="muted">Add what goes into one batch.</AppText>}
        </Card>
        {s.touched && !d.lines.length ? <AppText variant="caption" tone="danger">Add at least one ingredient</AppText> : null}
      </View>

      {r.options.length ? (
        <View style={styles.section}>
          <SectionHead title={addonCount ? 'Add-ons' : 'Add-ons (optional)'} />
          <Card padded="horizontal">
            {r.options.map((o, n) => {
              const section: LineSection = `addon:${o.optionId}`;
              const xs = d.addOns[o.optionId] ?? [];
              return (
                <View key={o.optionId} style={styles.addon}>
                  {n > 0 ? <Divider /> : null}
                  <AppText variant="bodyStrong">
                    {o.name} <AppText variant="caption" tone="muted">{o.groupName}</AppText>
                  </AppText>
                  {lines(section, xs, `Add-on: ${o.name}`)}
                  <TextAction label={xs.length ? 'Add another ingredient' : 'What does it use?'} icon="add" onPress={() => setPicking(section)} />
                </View>
              );
            })}
          </Card>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHead title="Packaging" action={{ label: 'Add', onPress: () => setPicking('packaging') }} />
        <Card padded="horizontal">{d.packaging.length ? lines('packaging', d.packaging, 'Packaging') : <AppText variant="small" tone="muted">Boxes, foil, bags: one serving’s.</AppText>}</Card>
      </View>

      <Card>
        <ToggleRow label="Signature recipe" helper="Shown on your page as the cook’s own" value={d.signatureOn} onChange={on => dispatch(setSignature({ on }))} />
        {r.signature.removedNote && !d.signatureOn ? (
          <InlineNotice tone="info" title="MetroMatrix took the signature label off" message={`${r.signature.removedNote} Turn it on again once that’s sorted, and staff will look again.`} />
        ) : null}
        {d.signatureOn ? (
          <TextField
            label="Created by"
            value={d.creatorName}
            onChangeText={creatorName => dispatch(setSignature({ creatorName }))}
            error={s.touched && d.creatorName.trim().length < 2 ? 'Say who created this recipe' : undefined}
          />
        ) : null}
      </Card>

      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      {r.updatedAt ? (
        <TextAction
          label="Remove this card"
          tone="danger"
          onPress={() =>
            Alert.alert('Remove this recipe card?', 'Costs, stock and the prep sheet stop counting this size.', [
              { text: 'Keep it', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => void dispatch(deleteRecipeAsync({ itemId, variantId: r.variantId })) },
            ])
          }
        />
      ) : null}

      <IngredientPicker
        visible={!!picking}
        onClose={() => setPicking(null)}
        ingredients={s.ingredients}
        only={picking === 'packaging' ? 'packaging' : 'food'}
        title={picking === 'packaging' ? 'Pick packaging' : 'Pick an ingredient'}
        onPick={ingredient => picking && dispatch(addRecipeLine({ section: picking, ingredient }))}
        onCreate={name => navigation.navigate('KitchenIngredientForm', { name })}
      />
      <BottomSheetPicker
        visible={!!unitFor}
        onClose={() => setUnitFor(null)}
        title="Unit"
        options={unitFor && byId[unitFor.line.ingredientId] ? unitChoices(byId[unitFor.line.ingredientId]).map(u => ({ value: u.key, label: u.label })) : []}
        value={unitFor?.line.unitKey ?? null}
        onSelect={unitKey => {
          if (unitFor) dispatch(updateRecipeLine({ section: unitFor.section, key: unitFor.line.key, patch: { unitKey } }));
          setUnitFor(null);
        }}
      />
    </ScreenShell>
  );
};

export default RecipeEditorScreen;
