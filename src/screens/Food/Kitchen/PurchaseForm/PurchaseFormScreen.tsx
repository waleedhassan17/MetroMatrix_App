// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen: a new purchase
// ═══════════════════════════════════════════════════════
// Three ways in, one draft to check: type the lines, scan the receipt (its
// lines come back to check; names the kitchen doesn't stock are offered as
// new ingredients), or say it ("5 kilo tamatar 1200 rupay"). When the
// assistant can't help, the typed lines carry on. Saving adds the stock.

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { aiDownNote, isAiDown } from '@models/kitchen/aiModel';
import { CATEGORY_LABEL, CATEGORY_ORDER } from '@models/kitchen/kitchenStatusModel';
import { draftTotal, purchaseInput, validatePurchase, type DraftLine } from '@models/kitchen/purchaseModel';
import { unitChoices } from '@models/kitchen/stockModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, BottomSheetPicker, Button, Card, ChoiceChip, Divider, IconButton, IonIcon, InlineNotice, ScreenShell, Sheet, StatusPill, TextAction, TextField } from '@custom/index';
import { SectionHead } from '@components/admin/AdminParts';
import { IngredientPicker } from '@components/kitchen/IngredientPicker';
import { VoiceEntry } from '@components/voice/VoiceEntry';
import type { FoodVendorStackParamList, Ingredient, IngredientCategory } from '@/types';
import { addDays, todayInZone } from '@utils/healthTime';
import { formatPKR } from '@utils/money';
import { pickImageFromLibrary, takePhoto } from '@utils/pickers';
import { STANDARD_UNITS, UNITS } from '@utils/units';
import { haptics } from '@utils/haptics';
import {
  addPurchaseLine,
  addSpokenLines,
  loadPurchaseFormAsync,
  removePurchaseLine,
  savePurchaseAsync,
  scanReceiptAsync,
  selectPurchaseForm,
  setDaysAgo,
  setPurchaseLineErrors,
  setSupplier,
  startPurchaseForm,
  updatePurchaseLine,
} from './purchaseFormSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenPurchaseForm'>;

const DAYS = [
  { n: 0, label: 'Today' },
  { n: 1, label: 'Yesterday' },
  { n: 2, label: '2 days ago' },
];

const makeStyles = ({ space, size, radius, colors, type }: Theme) =>
  StyleSheet.create({
    ways: { flexDirection: 'row', gap: space.s8 },
    grow: { flex: 1 },
    chips: { gap: space.s8 },
    line: { gap: space.s8, paddingVertical: space.s12 },
    lineHead: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    name: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.s4, minHeight: size.touch },
    fields: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    input: {
      ...type.input,
      color: colors.ink,
      flex: 1,
      flexBasis: 0,
      minWidth: 0,
      minHeight: size.control.sm,
      paddingHorizontal: space.s12,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderColor: colors.line,
    },
    inputError: { borderColor: colors.danger },
    unit: { minHeight: size.control.sm, minWidth: size.control.sm, paddingHorizontal: space.s8, borderRadius: radius.md, backgroundColor: colors.surfaceSunk, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.s4 },
    total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  });

const PurchaseFormScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <PurchaseFormContent {...props} />
  </ServiceScope>
);

const PurchaseFormContent: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'KitchenPurchases' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const s = useAppSelector(selectPurchaseForm);
  const [picking, setPicking] = useState<string | null>(null);
  const [unitFor, setUnitFor] = useState<DraftLine | null>(null);
  const [kindFor, setKindFor] = useState<DraftLine | null>(null);
  // Opened with `scan` (the camera button on Purchases): the scan sheet first.
  const [scanOpen, setScanOpen] = useState(!!route.params?.scan);
  const [speaking, setSpeaking] = useState(false);
  const [otherSupplier, setOtherSupplier] = useState(false);
  const byId = useMemo<Record<string, Ingredient>>(() => Object.fromEntries(s.ingredients.map(i => [i.id, i])), [s.ingredients]);

  useEffect(() => {
    dispatch(startPurchaseForm(route.params?.draft));
    void dispatch(loadPurchaseFormAsync());
  }, [dispatch, route.params?.draft]);

  const scan = async (how: 'camera' | 'library') => {
    setScanOpen(false);
    const file = how === 'camera' ? await takePhoto() : await pickImageFromLibrary();
    if (file) void dispatch(scanReceiptAsync(file));
  };

  const unitsOf = (l: DraftLine) =>
    l.ingredientId && byId[l.ingredientId]
      ? unitChoices(byId[l.ingredientId]).map(u => ({ value: typeof u.unit === 'string' ? u.unit : u.unit.name, label: u.label }))
      : STANDARD_UNITS.map(u => ({ value: u as string, label: UNITS[u].many }));
  const unitLabel = (l: DraftLine) => unitsOf(l).find(u => u.value === l.unit)?.label ?? l.unit;

  const save = async () => {
    const { errors, lineErrors } = validatePurchase(s.lines);
    if (Object.keys(errors).length || Object.keys(lineErrors).length) {
      dispatch(setPurchaseLineErrors(lineErrors));
      haptics.warning();
      return;
    }
    const date = addDays(todayInZone('Asia/Karachi'), -s.daysAgo);
    const res = await dispatch(savePurchaseAsync(purchaseInput(s.lines, s.source, { supplierId: s.supplierId, supplierName: s.supplierName, receiptUrl: s.receiptUrl, date })));
    if (savePurchaseAsync.fulfilled.match(res)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Purchase saved', text2: `${formatPKR(res.payload.total)} · stock updated` });
      navigation.replace('KitchenPurchase', { id: res.payload.id });
    } else haptics.warning();
  };

  const scanNote = isAiDown(s.scanError.code) ? aiDownNote(s.scanError.code, s.scanError.details) : null;
  const total = draftTotal(s.lines);

  return (
    <ScreenShell title="New purchase" subtitle="Check each line, then save" onBack={back} footer={<Button label={total ? `Save · ${formatPKR(total)}` : 'Save the purchase'} onPress={() => void save()} loading={s.saving} fullWidth />}>
      <View style={styles.ways}>
        <View style={styles.grow}>
          <Button label="Scan a receipt" variant="secondary" leftIcon="camera-outline" onPress={() => setScanOpen(true)} loading={s.scanning} fullWidth />
        </View>
        <View style={styles.grow}>
          <Button label={speaking ? 'Close' : 'Say it'} variant="secondary" leftIcon="mic-outline" onPress={() => setSpeaking(x => !x)} fullWidth />
        </View>
      </View>
      {scanNote ? <InlineNotice tone="info" title={scanNote.title} message={`${scanNote.message} Type the lines below.`} /> : s.scanError.message ? <InlineNotice message={s.scanError.message} /> : null}
      {s.source === 'receipt' && !s.scanning ? <InlineNotice tone="success" message="The receipt’s lines are below. Check each one: new names become new ingredients." /> : null}
      {speaking ? (
        <Card>
          <VoiceEntry
            context="purchases"
            onConfirm={a => {
              if (a.kind !== 'purchase.add') return false;
              dispatch(addSpokenLines(a.lines));
              setSpeaking(false);
              return true;
            }}
          />
        </Card>
      ) : null}

      <SectionHead title="What you bought" action={{ label: 'Add a line', onPress: () => dispatch(addPurchaseLine()) }} />
      <Card padded="horizontal">
        {s.lines.map((l, n) => {
          const known = l.ingredientId ? byId[l.ingredientId] : null;
          const err = s.lineErrors[l.key];
          return (
            <View key={l.key}>
              {n > 0 ? <Divider /> : null}
              <View style={styles.line}>
                <View style={styles.lineHead}>
                  <Pressable style={styles.name} onPress={() => setPicking(l.key)} accessibilityRole="button" accessibilityLabel={`${known?.name ?? l.name ?? 'Ingredient'}. Change`}>
                    <AppText variant="bodyStrong" numberOfLines={1} tone={known || l.name ? 'ink' : 'muted'}>
                      {known?.name ?? (l.name || 'Pick an ingredient')}
                    </AppText>
                    <IonIcon name="chevron-down" size="sm" color={colors.inkMuted} />
                  </Pressable>
                  {!l.ingredientId && l.name ? (
                    <Pressable onPress={() => setKindFor(l)} accessibilityRole="button" accessibilityLabel={`New ingredient: ${CATEGORY_LABEL[l.category]}. Change the kind`}>
                      <StatusPill label={`New · ${CATEGORY_LABEL[l.category]}`} tone="accent" />
                    </Pressable>
                  ) : null}
                  <IconButton icon="close" tone="muted" onPress={() => dispatch(removePurchaseLine(l.key))} accessibilityLabel="Remove this line" />
                </View>
                <View style={styles.fields}>
                  <TextInput
                    value={l.qty}
                    onChangeText={qty => dispatch(updatePurchaseLine({ key: l.key, patch: { qty } }))}
                    keyboardType="decimal-pad"
                    placeholder="How much"
                    placeholderTextColor={colors.inkFaint}
                    style={[styles.input, err ? styles.inputError : null]}
                    accessibilityLabel="How much"
                  />
                  <Pressable onPress={() => setUnitFor(l)} style={styles.unit} accessibilityRole="button" accessibilityLabel={`Unit: ${unitLabel(l)}. Change`}>
                    <AppText variant="label">{unitLabel(l)}</AppText>
                    <IonIcon name="chevron-down" size="sm" color={colors.inkMuted} />
                  </Pressable>
                  <TextInput
                    value={l.total}
                    onChangeText={total => dispatch(updatePurchaseLine({ key: l.key, patch: { total } }))}
                    keyboardType="number-pad"
                    placeholder="Rs total"
                    placeholderTextColor={colors.inkFaint}
                    style={[styles.input, err ? styles.inputError : null]}
                    accessibilityLabel="What it cost, in rupees"
                  />
                </View>
                {err ? (
                  <AppText variant="caption" tone="danger">
                    {err}
                  </AppText>
                ) : null}
              </View>
            </View>
          );
        })}
      </Card>
      <View style={styles.total}>
        <AppText variant="bodyStrong">Total</AppText>
        <AppText variant="title">{formatPKR(total)}</AppText>
      </View>

      <SectionHead title="From" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {s.suppliers.map(sp => (
          <ChoiceChip key={sp.id} label={sp.name} selected={s.supplierId === sp.id} onPress={() => { setOtherSupplier(false); dispatch(setSupplier({ id: s.supplierId === sp.id ? null : sp.id })); }} />
        ))}
        <ChoiceChip label="Someone else" selected={otherSupplier || (!s.supplierId && !!s.supplierName)} onPress={() => { setOtherSupplier(true); dispatch(setSupplier({ id: null })); }} />
      </ScrollView>
      {otherSupplier || (!s.supplierId && s.supplierName) ? <TextField label="Supplier’s name" value={s.supplierName} onChangeText={name => dispatch(setSupplier({ id: null, name }))} helper="Saved to your suppliers" /> : null}

      <SectionHead title="When" />
      <View style={styles.ways}>
        {DAYS.map(d => (
          <ChoiceChip key={d.n} label={d.label} selected={s.daysAgo === d.n} onPress={() => dispatch(setDaysAgo(d.n))} />
        ))}
      </View>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      <TextAction label="Manage suppliers" onPress={() => navigation.navigate('KitchenSuppliers')} />

      <IngredientPicker
        visible={!!picking}
        onClose={() => setPicking(null)}
        ingredients={s.ingredients}
        onPick={i => picking && dispatch(updatePurchaseLine({ key: picking, patch: { ingredientId: i.id, name: i.name, baseUnit: i.baseUnit, unit: i.baseUnit === 'g' ? 'kg' : i.baseUnit === 'ml' ? 'l' : i.dozens ? 'dozen' : 'pc' } }))}
        onCreate={name => picking && dispatch(updatePurchaseLine({ key: picking, patch: { ingredientId: null, name } }))}
      />
      <BottomSheetPicker
        visible={!!unitFor}
        onClose={() => setUnitFor(null)}
        title="Unit"
        options={unitFor ? unitsOf(unitFor) : []}
        value={unitFor?.unit ?? null}
        onSelect={unit => {
          if (unitFor) dispatch(updatePurchaseLine({ key: unitFor.key, patch: { unit, ...(unitFor.ingredientId ? null : { baseUnit: UNITS[unit as keyof typeof UNITS]?.base ?? unitFor.baseUnit }) } }));
          setUnitFor(null);
        }}
      />
      <BottomSheetPicker
        visible={!!kindFor}
        onClose={() => setKindFor(null)}
        title="What kind of ingredient?"
        options={CATEGORY_ORDER.map(c => ({ value: c, label: CATEGORY_LABEL[c] }))}
        value={kindFor?.category ?? null}
        onSelect={category => {
          if (kindFor) dispatch(updatePurchaseLine({ key: kindFor.key, patch: { category: category as IngredientCategory } }));
          setKindFor(null);
        }}
      />
      <Sheet visible={scanOpen} onClose={() => setScanOpen(false)} title="Scan a receipt" subtitle="The lines come back for you to check. Nothing is saved until you do.">
        <Button label="Take a photo" leftIcon="camera-outline" onPress={() => void scan('camera')} fullWidth />
        <Button label="Choose a photo" variant="secondary" leftIcon="image-outline" onPress={() => void scan('library')} fullWidth />
      </Sheet>
    </ScreenShell>
  );
};

export default PurchaseFormScreen;
