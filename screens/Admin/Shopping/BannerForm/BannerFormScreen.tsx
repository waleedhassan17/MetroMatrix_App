// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: a home banner
// ═══════════════════════════════════════════════════════
// A wide photo, a headline (and a line under it), where a tap leads (a
// store, a category or a product), and when it shows.

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { useStyles, useTheme, type Theme } from '../../../../theme/index';
import {
  AppText,
  BottomSheetPicker,
  Button,
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
import type { AdminShopStackParamList } from '../../../../types';
import { Alert } from '../../../../utils/alert';
import { cdn } from '../../../../utils/cdn';
import { pickImageFromLibrary } from '../../../../utils/pickers';
import { selectShopBanners } from '../ShopBanners/shopBannersSlice';
import {
  deleteBannerAsync,
  emptyBannerForm,
  fromBanner,
  loadBannerChoicesAsync,
  markBannerSubmitted,
  saveBannerAsync,
  selectBannerForm,
  setBannerField,
  startBannerForm,
  toBannerInput,
  uploadBannerImageAsync,
  validateBannerForm,
  type BannerForm,
} from './bannerFormSlice';

type Props = NativeStackScreenProps<AdminShopStackParamList, 'BannerForm'>;

const KINDS: { key: BannerForm['kind']; label: string }[] = [
  { key: 'store', label: 'Store' },
  { key: 'category', label: 'Category' },
  { key: 'product', label: 'Product' },
];

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    image: { width: '100%', aspectRatio: size.bannerAspect, borderRadius: radius.lg, backgroundColor: colors.surfaceSunk, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    text: { position: 'absolute', left: space.s16, right: space.s16, bottom: space.s16, gap: space.s4 },
    two: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1 },
  });

const BannerFormScreen: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'ShopBanners' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, size } = useTheme();
  const list = useAppSelector(selectShopBanners);
  const s = useAppSelector(selectBannerForm);
  const [picker, setPicker] = useState(false);
  const id = route.params?.id ?? null;
  const f = s.form;

  useEffect(() => {
    const existing = id ? list.banners.find(b => b.id === id) : null;
    dispatch(startBannerForm({ id, form: existing ? fromBanner(existing) : emptyBannerForm(list.banners.length) }));
    void dispatch(loadBannerChoicesAsync());
    // Starts once, from the list as it was.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, id]);

  const errors = s.submitted ? validateBannerForm(f) : {};
  const set = <K extends keyof BannerForm>(field: K, value: BannerForm[K]) => dispatch(setBannerField({ field, value }));

  const options =
    f.kind === 'store'
      ? s.stores.map(st => ({ value: st.slug, label: st.name }))
      : s.categories.flatMap(c => [{ value: c.id, label: c.name }, ...c.children.map(x => ({ value: x.id, label: `${c.name} › ${x.name}` }))]);
  const refLabel = options.find(o => o.value === f.ref)?.label ?? null;

  const pick = async () => {
    const file = await pickImageFromLibrary();
    if (file) void dispatch(uploadBannerImageAsync(file));
  };

  const save = async () => {
    dispatch(markBannerSubmitted());
    if (Object.keys(validateBannerForm(f)).length) return;
    const r = await dispatch(saveBannerAsync({ id: s.id, input: toBannerInput(f, s.categories) }));
    if (saveBannerAsync.fulfilled.match(r)) {
      Toast.show({ type: 'success', text1: 'Banner saved' });
      back();
    }
  };

  const remove = () =>
    s.id &&
    Alert.alert('Delete this banner?', f.headline, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const r = await dispatch(deleteBannerAsync(s.id!));
          if (deleteBannerAsync.fulfilled.match(r)) back();
        },
      },
    ]);

  return (
    <ScreenShell title={id ? 'Edit banner' : 'New banner'} onBack={back} footer={<Button label="Save banner" onPress={() => void save()} loading={s.status === 'loading'} disabled={s.uploading} fullWidth />}>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      <Pressable onPress={() => void pick()} style={[styles.image, errors.imageUrl ? { borderWidth: size.focusBorder, borderColor: colors.danger } : null]} accessibilityRole="button" accessibilityLabel={f.imageUrl ? 'Change the image' : 'Add an image'}>
        {f.imageUrl ? (
          <>
            <Image source={{ uri: cdn(f.imageUrl, { w: size.storeCard * 1.5 }) ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <PhotoScrim />
            <View style={styles.text}>
              <AppText variant="h2" tone="onScrim">
                {f.headline || 'Your headline'}
              </AppText>
              {f.subhead ? (
                <AppText variant="small" style={{ color: colors.onScrimSoft }}>
                  {f.subhead}
                </AppText>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <IonIcon name="image-outline" size="xl" color={colors.inkFaint} />
            <AppText variant="small" tone="muted">
              {s.uploading ? 'Uploading…' : 'Add a wide photo (2:1)'}
            </AppText>
          </>
        )}
      </Pressable>
      <TextField label="Headline" value={f.headline} onChangeText={v => set('headline', v.slice(0, 60))} error={errors.headline} placeholder="The new lawn is here" />
      <TextField label="Line under it (optional)" value={f.subhead} onChangeText={v => set('subhead', v.slice(0, 80))} placeholder="Lawn & Loom · Summer '26" />
      <AppText variant="label">A tap opens</AppText>
      <SegmentTabs options={KINDS} value={f.kind} onChange={k => set('kind', k)} accessibilityLabel="Banner leads to" />
      {f.kind === 'product' ? (
        <TextField label="Product ID" value={f.ref} onChangeText={v => set('ref', v.trim())} error={errors.ref} autoCapitalize="none" helper="From the product's link (…/shop/product/ID)." />
      ) : (
        <PickerField label={f.kind === 'store' ? 'Store' : 'Category'} valueLabel={refLabel} placeholder="Choose one" onPress={() => setPicker(true)} error={errors.ref} />
      )}
      <View style={styles.two}>
        <View style={styles.half}>
          <DateField label="Shows from" value={f.startsAt} onChange={v => set('startsAt', v)} />
        </View>
        <View style={styles.half}>
          <DateField label="Until (optional)" value={f.endsAt} onChange={v => set('endsAt', v)} min={f.startsAt} error={errors.endsAt} />
        </View>
      </View>
      <ToggleRow label="On" helper="Off keeps it but hides it from the home." value={f.isActive} onChange={v => set('isActive', v)} />
      {s.id ? <Button label="Delete banner" variant="ghost" onPress={() => void remove()} fullWidth /> : null}
      <BottomSheetPicker
        visible={picker}
        onClose={() => setPicker(false)}
        title={f.kind === 'store' ? 'Store' : 'Category'}
        options={options}
        value={f.ref || null}
        onSelect={v => {
          set('ref', v);
          setPicker(false);
        }}
      />
    </ScreenShell>
  );
};

export default BannerFormScreen;
