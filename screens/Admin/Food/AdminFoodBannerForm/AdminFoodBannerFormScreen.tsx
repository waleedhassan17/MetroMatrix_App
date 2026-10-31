// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: a Food Court home banner
// ═══════════════════════════════════════════════════════
// A wide photo, a title (and a line under it), what a tap opens (a vendor,
// a cuisine or a search), the city it shows in, and when.

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { validateFoodBanner } from '../../../../models/food/adminFoodModel';
import { useStyles, useTheme, type Theme } from '../../../../theme/index';
import {
  AppText,
  BottomSheetPicker,
  Button,
  ChoiceChip,
  DateField,
  InlineNotice,
  IonIcon,
  PhotoScrim,
  PickerField,
  ScreenShell,
  SegmentTabs,
  TextField,
  ToggleRow,
} from '../../../../Custom-Components/index';
import type { AdminFoodStackParamList, FoodBannerTargetType } from '../../../../types';
import { Alert } from '../../../../utils/alert';
import { cdn } from '../../../../utils/cdn';
import { pickImageFromLibrary } from '../../../../utils/pickers';
import { selectAdminFoodBanners } from '../AdminFoodBanners/adminFoodBannersSlice';
import {
  deleteFoodBannerAsync,
  emptyFoodBannerForm,
  fromFoodBanner,
  loadFoodBannerChoicesAsync,
  markFoodBannerSubmitted,
  saveFoodBannerAsync,
  selectAdminFoodBannerForm,
  setFoodBannerField,
  startFoodBannerForm,
  toFoodBannerInput,
  uploadFoodBannerImageAsync,
  type FoodBannerForm,
} from './adminFoodBannerFormSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminFoodBannerForm'>;

const KINDS: { key: FoodBannerTargetType; label: string }[] = [
  { key: 'vendor', label: 'Vendor' },
  { key: 'cuisine', label: 'Cuisine' },
  { key: 'search', label: 'Search' },
];

const CITIES = ['', 'Lahore', 'Karachi', 'Islamabad'];

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    image: {
      width: '100%',
      aspectRatio: size.bannerAspect,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceSunk,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: {
      position: 'absolute',
      left: space.s16,
      right: space.s16,
      bottom: space.s16,
      gap: space.s4,
    },
    chips: { gap: space.s8 },
    two: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1 },
  });

const AdminFoodBannerFormScreen: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'AdminFoodBanners' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, size } = useTheme();
  const list = useAppSelector(selectAdminFoodBanners);
  const s = useAppSelector(selectAdminFoodBannerForm);
  const [picker, setPicker] = useState(false);
  const id = route.params?.id ?? null;
  const f = s.form;

  useEffect(() => {
    const existing = id ? list.banners.find(b => b.id === id) : null;
    dispatch(
      startFoodBannerForm({
        id,
        form: existing
          ? fromFoodBanner(existing)
          : emptyFoodBannerForm((list.banners.length || 0) * 10),
      }),
    );
    void dispatch(loadFoodBannerChoicesAsync());
    // Starts once, from the list as it was.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, id]);

  const input = toFoodBannerInput(f);
  const errors = s.submitted ? validateFoodBanner(input) : {};
  const set = <K extends keyof FoodBannerForm>(field: K, value: FoodBannerForm[K]) =>
    dispatch(setFoodBannerField({ field, value }));

  const options =
    f.targetType === 'vendor'
      ? s.vendors.map(v => ({ value: v.id, label: `${v.name}${v.city ? ` · ${v.city}` : ''}` }))
      : s.cuisines.map(c => ({ value: c.id, label: c.name }));
  const targetLabel = options.find(o => o.value === f.targetId)?.label ?? null;

  const pick = async () => {
    const file = await pickImageFromLibrary();
    if (file) void dispatch(uploadFoodBannerImageAsync(file));
  };

  const save = async () => {
    dispatch(markFoodBannerSubmitted());
    if (Object.keys(validateFoodBanner(input)).length) return;
    const r = await dispatch(saveFoodBannerAsync({ id: s.id, input }));
    if (saveFoodBannerAsync.fulfilled.match(r)) {
      Toast.show({ type: 'success', text1: 'Banner saved' });
      back();
    }
  };

  const remove = () =>
    s.id &&
    Alert.alert('Delete this banner?', f.title, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const r = await dispatch(deleteFoodBannerAsync(s.id!));
          if (deleteFoodBannerAsync.fulfilled.match(r)) back();
        },
      },
    ]);

  return (
    <ScreenShell
      title={id ? 'Edit banner' : 'New banner'}
      subtitle="Food Court home"
      onBack={back}
      footer={
        <Button
          label="Save banner"
          onPress={() => void save()}
          loading={s.status === 'loading'}
          disabled={s.uploading}
          fullWidth
        />
      }>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      <Pressable
        onPress={() => void pick()}
        style={[
          styles.image,
          errors.imageUrl ? { borderWidth: size.focusBorder, borderColor: colors.danger } : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={f.imageUrl ? 'Change the picture' : 'Add a picture'}>
        {f.imageUrl ? (
          <>
            <Image
              source={{ uri: cdn(f.imageUrl, { w: size.storeCard * 1.5 }) ?? undefined }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            <PhotoScrim />
            <View style={styles.text}>
              <AppText variant="h2" tone="onScrim">
                {f.title || 'Your title'}
              </AppText>
              {f.subtitle ? (
                <AppText variant="small" style={{ color: colors.onScrimSoft }}>
                  {f.subtitle}
                </AppText>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <IonIcon name="image-outline" size="xl" color={colors.inkFaint} />
            <AppText variant="small" tone={errors.imageUrl ? 'danger' : 'muted'}>
              {s.uploading ? 'Uploading…' : errors.imageUrl ?? 'Add a wide photo (2:1)'}
            </AppText>
          </>
        )}
      </Pressable>
      <TextField
        label="Title"
        value={f.title}
        onChangeText={v => set('title', v.slice(0, 80))}
        error={errors.title}
        placeholder="Biryani week"
      />
      <TextField
        label="Line under it (optional)"
        value={f.subtitle}
        onChangeText={v => set('subtitle', v.slice(0, 160))}
        error={errors.subtitle}
        placeholder="Slow-cooked, from kitchens near you"
      />
      <AppText variant="label">A tap opens</AppText>
      <SegmentTabs
        options={KINDS}
        value={f.targetType}
        onChange={k => set('targetType', k)}
        accessibilityLabel="Banner opens"
      />
      {f.targetType === 'search' ? (
        <TextField
          label="Search for"
          value={f.targetQuery}
          onChangeText={v => set('targetQuery', v.slice(0, 60))}
          error={errors.targetQuery}
          placeholder="karahi"
          autoCapitalize="none"
        />
      ) : (
        <PickerField
          label={f.targetType === 'vendor' ? 'Vendor' : 'Cuisine'}
          valueLabel={targetLabel}
          placeholder="Choose one"
          onPress={() => setPicker(true)}
          error={errors.targetId}
        />
      )}
      <AppText variant="label">Shows in</AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}>
        {CITIES.map(c => (
          <ChoiceChip
            key={c || 'all'}
            label={c || 'Every city'}
            selected={f.city === c}
            onPress={() => set('city', c)}
          />
        ))}
      </ScrollView>
      <View style={styles.two}>
        <View style={styles.half}>
          <DateField label="Shows from" value={f.startsAt} onChange={v => set('startsAt', v)} />
        </View>
        <View style={styles.half}>
          <DateField
            label="Until (optional)"
            value={f.endsAt}
            onChange={v => set('endsAt', v)}
            min={f.startsAt}
            error={errors.endsAt}
          />
        </View>
      </View>
      <ToggleRow
        label="On"
        helper="Off keeps it but hides it from the home."
        value={f.isActive}
        onChange={v => set('isActive', v)}
      />
      {s.id ? (
        <Button label="Delete banner" variant="ghost" onPress={() => void remove()} fullWidth />
      ) : null}
      <BottomSheetPicker
        visible={picker}
        onClose={() => setPicker(false)}
        title={f.targetType === 'vendor' ? 'Vendor' : 'Cuisine'}
        options={options}
        value={f.targetId || null}
        onSelect={v => {
          set('targetId', v);
          setPicker(false);
        }}
      />
    </ScreenShell>
  );
};

export default AdminFoodBannerFormScreen;
