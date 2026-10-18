// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: Food Court cuisines
// ═══════════════════════════════════════════════════════
// What customers browse on the Food Court home, in order: add one, rename
// it, give it an icon, turn it off. A cuisine vendors use can't be deleted
// (turn it off instead); an unused one can.

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { validateCuisine } from '@models/food/adminFoodModel';
import { CUISINE_ICON_KEYS, cuisineGlyph } from '@components/food/FoodParts';
import { useStyles, useTheme, type Theme } from '@theme/index';
import {
  AppText,
  Button,
  Card,
  Divider,
  InlineNotice,
  MciIcon,
  ScreenShell,
  Sheet,
  SkeletonLines,
  TextAction,
  TextField,
} from '@custom/index';
import type { AdminCuisine, AdminFoodStackParamList } from '@/types';
import { Alert } from '@utils/alert';
import { haptics } from '@utils/haptics';
import {
  changeCuisineAsync,
  loadAdminCuisinesAsync,
  markCuisineSubmitted,
  openCuisineSheet,
  selectAdminFoodCuisines,
  setCuisineSheet,
} from './adminFoodCuisinesSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminFoodCuisines'>;

const makeStyles = ({ space, size, radius }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s8 },
    well: {
      width: size.touch,
      height: size.touch,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    grow: { flex: 1, gap: space.s4 },
    actions: { flexDirection: 'row', gap: space.s16 },
    icons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const AdminFoodCuisinesScreen: React.FC<Props> = () => {
  const { back } = useBack({ name: 'FoodOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const s = useAppSelector(selectAdminFoodCuisines);
  const sheet = s.sheet;
  const errors =
    sheet && s.submitted
      ? validateCuisine({
          name: sheet.name,
          slug: sheet.slug,
          icon: sheet.icon,
          sort: Number(sheet.sort),
        })
      : {};

  useEffect(() => {
    void dispatch(loadAdminCuisinesAsync());
  }, [dispatch]);

  const save = () => {
    if (!sheet) return;
    dispatch(markCuisineSubmitted());
    if (
      Object.keys(
        validateCuisine({
          name: sheet.name,
          slug: sheet.slug,
          icon: sheet.icon,
          sort: Number(sheet.sort),
        }),
      ).length
    )
      return haptics.warning();
    void dispatch(changeCuisineAsync({ kind: 'save', sheet }));
  };

  const remove = (c: AdminCuisine) =>
    c.vendors
      ? Alert.alert(
          `${c.name} is in use`,
          `${c.vendors} ${
            c.vendors === 1 ? 'vendor lists' : 'vendors list'
          } it. Turn it off instead: it leaves the home, and vendors keep their other cuisines.`,
        )
      : Alert.alert(`Delete ${c.name}?`, 'No vendor lists it.', [
          { text: 'Keep it', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => void dispatch(changeCuisineAsync({ kind: 'delete', id: c.id })),
          },
        ]);

  return (
    <ScreenShell
      title="Cuisines"
      subtitle="Food Court"
      onBack={back}
      footer={
        <Button
          label="New cuisine"
          leftIcon="add"
          onPress={() => dispatch(openCuisineSheet('new'))}
          fullWidth
        />
      }>
      {s.error.message && !sheet ? <InlineNotice message={s.error.message} /> : null}
      {s.status === 'loading' && !s.cuisines.length ? <SkeletonLines lines={8} /> : null}
      {s.cuisines.length ? (
        <Card>
          {s.cuisines.map((c, i) => (
            <View key={c.id}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.row}>
                <View style={[styles.well, { backgroundColor: service.accentSoft }]}>
                  <MciIcon
                    name={cuisineGlyph(c.icon || c.slug)}
                    size="md"
                    color={service.accentDeep}
                  />
                </View>
                <View style={styles.grow}>
                  <AppText variant="bodyStrong">{`${c.name}${c.isActive ? '' : ' (off)'}`}</AppText>
                  <AppText variant="caption" tone="muted">
                    {`${c.slug} · ${c.vendors} ${c.vendors === 1 ? 'vendor' : 'vendors'} · order ${
                      c.sort
                    }`}
                  </AppText>
                  <View style={styles.actions}>
                    <TextAction label="Edit" onPress={() => dispatch(openCuisineSheet(c))} />
                    <TextAction
                      label={c.isActive ? 'Turn off' : 'Turn on'}
                      onPress={() =>
                        void dispatch(
                          changeCuisineAsync({ kind: 'active', id: c.id, isActive: !c.isActive }),
                        )
                      }
                    />
                    <TextAction label="Delete" tone="danger" onPress={() => remove(c)} />
                  </View>
                </View>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <Sheet
        visible={!!sheet}
        onClose={() => dispatch(openCuisineSheet(null))}
        title={sheet?.id ? 'Edit cuisine' : 'New cuisine'}
        footer={<Button label="Save" loading={s.busy} onPress={save} fullWidth />}>
        <TextField
          label="Name"
          value={sheet?.name ?? ''}
          onChangeText={t => dispatch(setCuisineSheet({ name: t.slice(0, 60) }))}
          placeholder="Seafood"
          error={errors.name}
        />
        <TextField
          label="Link"
          value={sheet?.slug ?? ''}
          onChangeText={t =>
            dispatch(
              setCuisineSheet({
                slug: t
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, '')
                  .slice(0, 40),
              }),
            )
          }
          autoCapitalize="none"
          helper="In the app's links, e.g. /food/restaurants?cuisine=seafood"
          error={errors.slug}
        />
        <TextField
          label="Order on the home"
          value={sheet?.sort ?? ''}
          onChangeText={t =>
            dispatch(setCuisineSheet({ sort: t.replace(/[^0-9]/g, '').slice(0, 3) }))
          }
          keyboardType="number-pad"
          error={errors.sort}
        />
        <AppText variant="label">Icon</AppText>
        <View style={styles.icons}>
          {CUISINE_ICON_KEYS.map(key => {
            // Keys that share a glyph (fast_food, burger) read as the same choice.
            const on = !!sheet && cuisineGlyph(sheet.icon) === cuisineGlyph(key);
            return (
              <Pressable
                key={key}
                onPress={() => dispatch(setCuisineSheet({ icon: key }))}
                style={[styles.well, { backgroundColor: on ? service.accent : service.accentSoft }]}
                accessibilityRole="radio"
                aria-checked={on}
                accessibilityLabel={key.replace(/_/g, ' ')}>
                <MciIcon
                  name={cuisineGlyph(key)}
                  size="md"
                  color={on ? service.onAccent : service.accentDeep}
                />
              </Pressable>
            );
          })}
        </View>
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      </Sheet>
    </ScreenShell>
  );
};

export default AdminFoodCuisinesScreen;
