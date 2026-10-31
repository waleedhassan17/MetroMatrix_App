// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: menu categories
// ═══════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { categoryWindowLabel, validateCategory } from '../../models/food/menuModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, Divider, EmptyState, IconButton, InlineNotice, ScreenShell, Sheet, SkeletonLines, TextAction, TextField, ToggleRow } from '../../Custom-Components/index';
import { Alert } from '../../utils/alert/alert';
import { haptics } from '../../utils/haptics/haptics';
import {
  closeCategorySheet,
  deleteCategoryAsync,
  loadCategoriesAsync,
  markCategorySubmitted,
  moveCategoryAsync,
  openCategorySheet,
  saveCategoryAsync,
  selectVendorCategories,
  setCategoryActive,
  setCategoryField,
  setCategoryWindowed,
} from './vendorCategoriesSlice';
import { menuPlace } from '../../models/food/vendorModel';
import { selectBusiness } from '../../store/authSlice';

const makeStyles = ({ space, size }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s4, minHeight: size.control.lg },
    main: { flex: 1, paddingVertical: space.s12, gap: space.s4 },
    pair: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1 },
    sheet: { gap: space.s12 },
  });

const VendorCategories: React.FC = () => {
  const { back } = useBack(menuPlace(useAppSelector(selectBusiness)?.subType === 'home_kitchen'));
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVendorCategories);
  const sheet = s.sheet;

  useEffect(() => {
    void dispatch(loadCategoriesAsync());
  }, [dispatch]);

  const errors = sheet && s.submitted ? validateCategory(sheet.windowed ? sheet.form : { ...sheet.form, availableFrom: '', availableTo: '' }) : {};

  const save = async () => {
    if (!sheet) return;
    dispatch(markCategorySubmitted());
    if (Object.keys(validateCategory(sheet.windowed ? sheet.form : { ...sheet.form, availableFrom: '', availableTo: '' })).length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(saveCategoryAsync(sheet));
    if (saveCategoryAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: sheet.id ? 'Category saved' : 'Category added' });
    }
  };

  const remove = () => {
    if (!sheet?.id) return;
    const c = s.categories.find(x => x.id === sheet.id);
    if (c && c.itemCount > 0) {
      Alert.alert('Move its dishes first', `${c.name} still has ${c.itemCount} ${c.itemCount === 1 ? 'dish' : 'dishes'}. Move them to another category or delete them, then delete the category.`);
      return;
    }
    Alert.alert(`Delete ${c?.name ?? 'this category'}?`, undefined, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void dispatch(deleteCategoryAsync(sheet.id!)) },
    ]);
  };

  return (
    <ServiceScope service="food">
      <ScreenShell
        title="Categories"
        subtitle="The sections of your menu, in order"
        onBack={back}
        footer={<Button label="Add a category" leftIcon="add" onPress={() => dispatch(openCategorySheet(null))} fullWidth />}
      >
        {s.error.message && !sheet ? <InlineNotice message={s.error.message} /> : null}
        {s.status === 'loading' && !s.categories.length ? (
          <SkeletonLines lines={6} />
        ) : !s.categories.length ? (
          <EmptyState icon="layers" title="No categories yet" body="Customers browse your menu by these: Biryani, BBQ, Drinks…" />
        ) : (
          <Card padded="horizontal">
            {s.categories.map((c, i) => (
              <View key={c.id}>
                {i > 0 ? <Divider /> : null}
                <View style={styles.row}>
                  <Pressable style={styles.main} onPress={() => dispatch(openCategorySheet(c.id))} accessibilityRole="button" accessibilityLabel={`Edit ${c.name}`}>
                    <AppText variant="bodyStrong" tone={c.isActive ? 'ink' : 'muted'}>
                      {c.name}
                    </AppText>
                    <AppText variant="small" tone="muted">
                      {[`${c.itemCount} ${c.itemCount === 1 ? 'dish' : 'dishes'}`, categoryWindowLabel(c.availableFrom, c.availableTo), c.isActive ? null : 'Hidden'].filter(Boolean).join(' · ')}
                    </AppText>
                  </Pressable>
                  <IconButton icon="chevron-up" accessibilityLabel={`Move ${c.name} up`} disabled={i === 0} onPress={() => void dispatch(moveCategoryAsync({ id: c.id, by: -1 }))} />
                  <IconButton
                    icon="chevron-down"
                    accessibilityLabel={`Move ${c.name} down`}
                    disabled={i === s.categories.length - 1}
                    onPress={() => void dispatch(moveCategoryAsync({ id: c.id, by: 1 }))}
                  />
                </View>
              </View>
            ))}
          </Card>
        )}

        <Sheet
          visible={!!sheet}
          onClose={() => dispatch(closeCategorySheet())}
          title={sheet?.id ? 'Edit category' : 'New category'}
          footer={<Button label={sheet?.id ? 'Save' : 'Add category'} onPress={() => void save()} loading={s.saving} fullWidth />}
        >
          {sheet ? (
            <View style={styles.sheet}>
              {s.error.message ? <InlineNotice message={s.error.message} /> : null}
              <TextField label="Name" value={sheet.form.name} onChangeText={v => dispatch(setCategoryField({ field: 'name', value: v }))} error={errors.name} maxLength={80} placeholder="BBQ" />
              <ToggleRow label="Only at certain times" helper="e.g. BBQ from 6 PM, breakfast until noon" value={sheet.windowed} onChange={v => dispatch(setCategoryWindowed(v))} />
              {sheet.windowed ? (
                <View style={styles.pair}>
                  <View style={styles.half}>
                    <TextField label="From" value={sheet.form.availableFrom} onChangeText={v => dispatch(setCategoryField({ field: 'availableFrom', value: v }))} error={errors.availableFrom} maxLength={5} keyboardType="numbers-and-punctuation" placeholder="18:00" />
                  </View>
                  <View style={styles.half}>
                    <TextField label="Until" value={sheet.form.availableTo} onChangeText={v => dispatch(setCategoryField({ field: 'availableTo', value: v }))} error={errors.availableTo} maxLength={5} keyboardType="numbers-and-punctuation" placeholder="23:30" />
                  </View>
                </View>
              ) : null}
              {sheet.id ? (
                <>
                  <ToggleRow label="Show on the menu" helper="Off hides the category and its dishes" value={sheet.isActive} onChange={v => dispatch(setCategoryActive(v))} />
                  <TextAction label="Delete category" icon="trash-outline" tone="danger" onPress={remove} />
                </>
              ) : null}
            </View>
          ) : null}
        </Sheet>
      </ScreenShell>
    </ServiceScope>
  );
};

export default VendorCategories;
