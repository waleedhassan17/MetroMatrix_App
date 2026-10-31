// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen: log waste
// ═══════════════════════════════════════════════════════
// What went to waste: ingredients (in the cook's unit, with what they
// cost) or cooked dishes (servings — their recipe comes out of stock),
// why, and a note. Or say it: the spoken lines land here to check.

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { WASTE_REASONS, WASTE_REASON_LABEL } from '../../models/kitchen/kitchenStatusModel';
import { defaultUnit, unitChoices, unitOfKey } from '../../models/kitchen/stockModel';
import { wasteInputOf, wasteLineCost } from '../../models/kitchen/wasteModel';
import type { CostedIngredient } from '../../models/kitchen/costingModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, BottomSheetPicker, Button, Card, ChoiceChip, Divider, EmptyState, InlineNotice, RecipeLineRow, ScreenShell, SkeletonLines, TextAction, TextField } from '../../Custom-Components/index';
import { IngredientPicker } from '../../Components/kitchen/IngredientPicker';
import { VoiceSheetButton } from '../../Components/voice/VoiceSheet';
import type { FoodVendorStackParamList } from '../../models';
import { formatPKR } from '../../utils/money/money';
import { haptics } from '../../utils/haptics/haptics';
import {
  addWasteDish,
  addWasteIngredient,
  fillWasteFromVoice,
  loadWasteFormAsync,
  removeWasteLine,
  resetWasteForm,
  saveWasteAsync,
  selectWasteForm,
  setWasteErrors,
  setWasteNote,
  setWasteReason,
  updateWasteLine,
} from './wasteFormSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenWasteForm'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    adds: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s16 },
  });

const WasteForm: React.FC<Props> = props => (
  <ServiceScope service="food">
    <WasteFormContent {...props} />
  </ServiceScope>
);

const WasteFormContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'KitchenWaste' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectWasteForm);
  /** Adding a line, or changing what one line is (its key). */
  const [picking, setPicking] = useState<{ kind: 'ingredient' | 'dish'; key?: string } | null>(null);
  const [unitFor, setUnitFor] = useState<string | null>(null);

  useEffect(() => {
    dispatch(resetWasteForm());
    void dispatch(loadWasteFormAsync());
  }, [dispatch]);

  const byId = useMemo<Record<string, CostedIngredient>>(() => Object.fromEntries(s.ingredients.map(i => [i.id, i])), [s.ingredients]);
  const unitLine = s.lines.find(l => l.key === unitFor) ?? null;

  const save = async () => {
    const { input, errors, lineErrors } = wasteInputOf(s.lines, s.reason, byId);
    if (Object.keys(errors).length || Object.keys(lineErrors).length) {
      dispatch(setWasteErrors({ errors, lineErrors }));
      haptics.warning();
      return;
    }
    const r = await dispatch(saveWasteAsync(input));
    if (saveWasteAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Waste logged', text2: r.payload ? `${formatPKR(r.payload.cost)} · stock updated` : undefined });
      back();
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title="Log waste"
      subtitle="It comes out of stock at what you paid"
      onBack={back}
      headerRight={
        <VoiceSheetButton
          context="stock"
          title="Speak what went to waste"
          hint="Try “2 kilo chawal kharab ho gaye”"
          onConfirm={a => {
            if (a.kind !== 'waste.log') return false;
            dispatch(fillWasteFromVoice({ lines: a.lines, reason: a.reason }));
            return true;
          }}
        />
      }
      footer={s.lines.length ? <Button label="Save" onPress={() => void save()} loading={s.saving} fullWidth /> : undefined}>
      {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadWasteFormAsync()) }} /> : null}
      {s.saveError.message ? <InlineNotice message={s.saveError.message} /> : null}

      <AppText variant="sectionTitle">Why</AppText>
      <View style={styles.chips}>
        {WASTE_REASONS.map(r => (
          <ChoiceChip key={r} label={WASTE_REASON_LABEL[r]} selected={s.reason === r} onPress={() => dispatch(setWasteReason(r))} />
        ))}
      </View>

      <AppText variant="sectionTitle">What</AppText>
      {s.status === 'loading' && !s.ingredients.length ? (
        <SkeletonLines lines={4} />
      ) : s.lines.length ? (
        <Card padded="horizontal">
          {s.lines.map((l, n) => (
            <View key={l.key}>
              {n > 0 ? <Divider /> : null}
              <RecipeLineRow
                name={l.name}
                amount={l.amount}
                unitLabel={l.kind === 'dish' ? (l.amount === '1' ? 'serving' : 'servings') : byId[l.id] ? unitOfKey(byId[l.id], l.unitKey).label : l.unitKey}
                costLabel={wasteLineCost(l, byId)}
                tag={l.kind === 'dish' ? 'Cooked dish' : null}
                costSuffix=""
                unitFixed={l.kind === 'dish'}
                nameHint={l.kind === 'dish' ? 'Change the dish' : 'Change the ingredient'}
                onAmountChange={amount => dispatch(updateWasteLine({ key: l.key, patch: { amount } }))}
                onUnitPress={() => (l.kind === 'ingredient' ? setUnitFor(l.key) : undefined)}
                onNamePress={() => setPicking({ kind: l.kind, key: l.key })}
                onRemove={() => dispatch(removeWasteLine(l.key))}
                error={s.lineErrors[l.key]}
              />
            </View>
          ))}
        </Card>
      ) : (
        <EmptyState icon="trash-2" title="Add what went to waste" body="An ingredient (rice that went bad), or a cooked dish (six plates left over)." />
      )}
      {s.errors.lines ? <InlineNotice message={s.errors.lines} /> : null}
      <View style={styles.adds}>
        <TextAction label="Add an ingredient" icon="add" onPress={() => setPicking({ kind: 'ingredient' })} />
        <TextAction label="Add a cooked dish" icon="add" onPress={() => setPicking({ kind: 'dish' })} disabled={!s.dishes.length} />
      </View>

      <TextField label="Note (optional)" value={s.note} onChangeText={t => dispatch(setWasteNote(t))} placeholder="End of night, fridge failed…" maxLength={200} />

      <IngredientPicker
        visible={picking?.kind === 'ingredient'}
        onClose={() => setPicking(null)}
        ingredients={s.ingredients}
        title="What went to waste?"
        onPick={i => {
          if (picking?.key) dispatch(updateWasteLine({ key: picking.key, patch: { id: i.id, name: i.name, unitKey: defaultUnit(i) } }));
          else dispatch(addWasteIngredient(i));
          setPicking(null);
        }}
      />
      <BottomSheetPicker
        visible={picking?.kind === 'dish'}
        onClose={() => setPicking(null)}
        title="Which dish?"
        options={s.dishes.map(d => ({ value: d.itemId, label: d.name }))}
        value={null}
        onSelect={itemId => {
          const d = s.dishes.find(x => x.itemId === itemId);
          if (d && picking?.key) dispatch(updateWasteLine({ key: picking.key, patch: { id: d.itemId, name: d.name } }));
          else if (d) dispatch(addWasteDish(d));
          setPicking(null);
        }}
      />
      <BottomSheetPicker
        visible={!!unitLine}
        onClose={() => setUnitFor(null)}
        title="Unit"
        options={unitLine && byId[unitLine.id] ? unitChoices(byId[unitLine.id]).map(u => ({ value: u.key, label: u.label })) : []}
        value={unitLine?.unitKey ?? null}
        onSelect={unitKey => {
          if (unitLine) dispatch(updateWasteLine({ key: unitLine.key, patch: { unitKey } }));
          setUnitFor(null);
        }}
      />
    </ScreenShell>
  );
};

export default WasteForm;
