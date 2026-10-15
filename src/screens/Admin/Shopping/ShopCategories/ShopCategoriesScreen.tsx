// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: categories (two levels)
// ═══════════════════════════════════════════════════════
// Top levels and their sub-categories, in the order shoppers see them.
// Add, rename (with an icon), move up and down; a category still in use
// can't be deleted.

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useStyles, useTheme, type Theme } from '@theme/index';
import {
  AppText,
  Button,
  Card,
  Divider,
  IconButton,
  InlineNotice,
  IonIcon,
  ScreenShell,
  Sheet,
  SkeletonLines,
  TextAction,
  TextField,
  categoryIcon,
  type IonName,
} from '@custom/index';
import type { AdminShopStackParamList, ShopCategory } from '@/types';
import { Alert } from '@utils/alert';
import { changeCategoryAsync, loadCategoriesTreeAsync, openCategorySheet, selectShopCategories, setCategorySheet } from './shopCategoriesSlice';

type Props = NativeStackScreenProps<AdminShopStackParamList, 'ShopCategories'>;

/** Icons a category can wear (Ionicons). */
const ICONS: IonName[] = [
  'shirt-outline', 'woman-outline', 'man-outline', 'bag-handle-outline', 'footsteps-outline', 'watch-outline', 'headset-outline',
  'phone-portrait-outline', 'hardware-chip-outline', 'sparkles-outline', 'home-outline', 'basket-outline', 'gift-outline', 'pricetag-outline',
];

const makeStyles = ({ space, size, radius }: Theme) =>
  StyleSheet.create({
    iconWell: { width: size.touch, height: size.touch, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s8, paddingVertical: space.s8 },
    child: { paddingLeft: space.s24 },
    text: { flex: 1, gap: space.s4 },
    actions: { flexDirection: 'row', gap: space.s16 },
    icons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const ShopCategoriesScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const s = useAppSelector(selectShopCategories);

  useEffect(() => {
    void dispatch(loadCategoriesTreeAsync());
  }, [dispatch]);

  const move = (siblings: ShopCategory[], i: number, by: -1 | 1, parentId: string | null) => {
    const ids = siblings.map(c => c.id);
    [ids[i], ids[i + by]] = [ids[i + by], ids[i]];
    void dispatch(changeCategoryAsync({ kind: 'reorder', parentId, ids }));
  };

  const remove = (c: ShopCategory) =>
    Alert.alert(`Delete "${c.name}"?`, 'Only an empty category can go.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void dispatch(changeCategoryAsync({ kind: 'delete', id: c.id })) },
    ]);

  const renderRow = (c: ShopCategory, siblings: ShopCategory[], i: number, parentId: string | null) => (
    <View style={[styles.row, parentId ? styles.child : null]}>
      <IonIcon name={categoryIcon(c.icon)} size="md" color={service.accentDeep} />
      <View style={styles.text}>
        <AppText variant={parentId ? 'body' : 'bodyStrong'}>{c.name}</AppText>
        <AppText variant="caption" tone="muted">
          {c.productCount} products
        </AppText>
        <View style={styles.actions}>
          <TextAction label="Rename" onPress={() => dispatch(openCategorySheet({ id: c.id, parentId, name: c.name, icon: c.icon }))} />
          {!parentId ? <TextAction label="Add sub-category" onPress={() => dispatch(openCategorySheet({ id: '', parentId: c.id, name: '', icon: 'pricetag-outline' }))} /> : null}
          <TextAction label="Delete" tone="danger" onPress={() => remove(c)} />
        </View>
      </View>
      <IconButton icon="arrow-up" tone="muted" disabled={i === 0 || s.busy} onPress={() => move(siblings, i, -1, parentId)} accessibilityLabel={`Move ${c.name} up`} />
      <IconButton icon="arrow-down" tone="muted" disabled={i === siblings.length - 1 || s.busy} onPress={() => move(siblings, i, 1, parentId)} accessibilityLabel={`Move ${c.name} down`} />
    </View>
  );

  return (
    <ScreenShell
      title="Categories"
      onBack={() => navigation.goBack()}
      footer={<Button label="New top-level category" leftIcon="add" onPress={() => dispatch(openCategorySheet({ id: '', parentId: null, name: '', icon: 'pricetag-outline' }))} fullWidth />}>
      {s.error.message && !s.sheet ? <InlineNotice message={s.error.message} /> : null}
      {s.status === 'loading' && !s.tree.length ? <SkeletonLines lines={8} /> : null}
      {s.tree.map((top, i) => (
        <Card key={top.id}>
          {renderRow(top, s.tree, i, null)}
          {top.children.map((child, j) => (
            <View key={child.id}>
              <Divider />
              {renderRow(child, top.children, j, top.id)}
            </View>
          ))}
        </Card>
      ))}

      <Sheet
        visible={!!s.sheet}
        onClose={() => dispatch(openCategorySheet(null))}
        title={s.sheet?.id ? 'Rename category' : s.sheet?.parentId ? 'New sub-category' : 'New category'}
        footer={
          <Button
            label="Save"
            disabled={!s.sheet || s.sheet.name.trim().length < 2}
            loading={s.busy}
            onPress={() => s.sheet && void dispatch(changeCategoryAsync({ kind: 'save', sheet: s.sheet }))}
            fullWidth
          />
        }>
        <TextField label="Name" value={s.sheet?.name ?? ''} onChangeText={t => dispatch(setCategorySheet({ name: t.slice(0, 40) }))} placeholder="Kurtas & sets" />
        <AppText variant="label">Icon</AppText>
        <View style={styles.icons}>
          {ICONS.map(icon => {
            const on = s.sheet?.icon === icon;
            return (
              <Pressable
                key={icon}
                onPress={() => dispatch(setCategorySheet({ icon }))}
                style={[styles.iconWell, { backgroundColor: on ? service.accent : service.accentSoft }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={icon.replace(/-outline$/, '').replace(/-/g, ' ')}>
                <IonIcon name={icon} size="md" color={on ? service.onAccent : service.accentDeep} />
              </Pressable>
            );
          })}
        </View>
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      </Sheet>
    </ScreenShell>
  );
};

export default ShopCategoriesScreen;
