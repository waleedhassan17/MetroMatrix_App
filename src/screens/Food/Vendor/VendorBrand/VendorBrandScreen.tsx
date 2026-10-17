// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor brand
// ═══════════════════════════════════════════════════════
// What customers see first: the name, a one-line tagline, the logo and the
// cover photo, up to three cuisines, a price level and the brand colour
// (painted on the vendor's own page; it must keep its text readable).

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { MAX_CUISINES, PRICE_LEVELS, validateVendorBrand } from '@models/food/vendorModel';
import { BRAND_PRESETS } from '@models/shopping/storeModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, Card, ChoiceChip, IonIcon, InlineNotice, ScreenShell, SkeletonLines, TextAction, TextField } from '@custom/index';
import type { FoodVendorStackParamList } from '@/types';
import { cdn } from '@utils/cdn';
import { haptics } from '@utils/haptics';
import { pickImageFromLibrary } from '@utils/pickers';
import {
  loadVendorBrandAsync,
  markBrandSubmitted,
  saveVendorBrandAsync,
  selectVendorBrand,
  setBrandField,
  toggleCuisine,
  uploadBrandImageAsync,
} from './vendorBrandSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'VendorBrand'>;

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    cover: {
      width: '100%',
      aspectRatio: size.coverAspect,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceSunk,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    fill: { ...StyleSheet.absoluteFillObject },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s16 },
    logo: {
      width: size.storeLogo,
      height: size.storeLogo,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSunk,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: size.border,
      borderColor: colors.line,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    swatch: { width: size.swatch, height: size.swatch, borderRadius: radius.pill, borderWidth: size.focusBorder, borderColor: colors.surface },
    card: { gap: space.s12 },
  });

const VendorBrandScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <VendorBrandContent {...props} />
  </ServiceScope>
);

const VendorBrandContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, size } = useTheme();
  const s = useAppSelector(selectVendorBrand);
  const f = s.form;

  useEffect(() => {
    void dispatch(loadVendorBrandAsync());
  }, [dispatch]);

  if (!f) {
    return (
      <ScreenShell title="Your brand" onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadVendorBrandAsync()) }} /> : <SkeletonLines lines={8} />}
      </ScreenShell>
    );
  }

  const errors = s.submitted ? validateVendorBrand(f) : {};

  const pick = async (kind: 'logo' | 'cover') => {
    const file = await pickImageFromLibrary({ square: kind === 'logo' });
    if (file) void dispatch(uploadBrandImageAsync({ kind, file }));
  };

  const save = async () => {
    dispatch(markBrandSubmitted());
    if (Object.keys(validateVendorBrand(f)).length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(saveVendorBrandAsync(f));
    if (saveVendorBrandAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Brand saved' });
      back();
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title="Your brand"
      subtitle="What customers see on every card and on your page"
      onBack={back}
      footer={<Button label="Save brand" onPress={() => void save()} loading={s.saving} disabled={!!s.uploading} fullWidth />}
    >
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}

      <Pressable onPress={() => void pick('cover')} style={styles.cover} accessibilityRole="button" accessibilityLabel={f.coverUrl ? 'Change the cover photo' : 'Add a cover photo'}>
        {f.coverUrl ? <Image source={{ uri: cdn(f.coverUrl, { w: size.storeCard * 2 }) ?? undefined }} style={styles.fill} contentFit="cover" /> : null}
        {!f.coverUrl ? <IonIcon name="image-outline" size="xl" color={colors.inkFaint} /> : null}
      </Pressable>
      <TextAction
        label={s.uploading === 'cover' ? 'Uploading the cover…' : f.coverUrl ? 'Change the cover' : 'Add a cover photo of your best dish'}
        icon="image-outline"
        onPress={() => void pick('cover')}
        disabled={!!s.uploading}
      />

      <View style={styles.row}>
        <Pressable onPress={() => void pick('logo')} style={styles.logo} accessibilityRole="button" accessibilityLabel={f.logoUrl ? 'Change the logo' : 'Add a logo'}>
          {f.logoUrl ? <Image source={{ uri: cdn(f.logoUrl, { w: size.storeLogo * 2 }) ?? undefined }} style={styles.fill} contentFit="cover" /> : <IonIcon name="camera-outline" size="lg" color={colors.inkFaint} />}
        </Pressable>
        <View style={{ flex: 1 }}>
          <TextAction label={s.uploading === 'logo' ? 'Uploading…' : f.logoUrl ? 'Change logo' : 'Add your logo'} icon="camera-outline" onPress={() => void pick('logo')} disabled={!!s.uploading} />
          {errors.logoUrl ? (
            <AppText variant="small" tone="danger">
              {errors.logoUrl}
            </AppText>
          ) : null}
        </View>
      </View>

      <TextField label="Name" value={f.name} onChangeText={v => dispatch(setBrandField({ field: 'name', value: v }))} error={errors.name} maxLength={120} />
      <TextField
        label="Tagline (optional)"
        value={f.tagline}
        onChangeText={v => dispatch(setBrandField({ field: 'tagline', value: v }))}
        error={errors.tagline}
        maxLength={140}
        placeholder="Karachi-style biryani, slow-cooked every morning"
      />

      <Card style={styles.card}>
        <AppText variant="title">Cuisines</AppText>
        <AppText variant="small" tone="muted">{`Up to ${MAX_CUISINES}. Customers find you under them.`}</AppText>
        <View style={styles.chips}>
          {s.cuisines.map(c => {
            const on = f.cuisineIds.includes(c.id);
            return (
              <ChoiceChip
                key={c.id}
                label={c.name}
                selected={on}
                disabled={!on && f.cuisineIds.length >= MAX_CUISINES}
                onPress={() => dispatch(toggleCuisine(c.id))}
              />
            );
          })}
        </View>
        {errors.cuisineIds ? (
          <AppText variant="small" tone="danger">
            {errors.cuisineIds}
          </AppText>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <AppText variant="title">Price level</AppText>
        <View style={styles.chips}>
          {PRICE_LEVELS.map(p => (
            <ChoiceChip key={p.value} label={`${p.label} · ${p.hint}`} selected={f.priceLevel === p.value} onPress={() => dispatch(setBrandField({ field: 'priceLevel', value: p.value }))} />
          ))}
        </View>
      </Card>

      <Card style={styles.card}>
        <AppText variant="title">Brand colour</AppText>
        <AppText variant="small" tone="muted">
          Your page, its add buttons and deal ribbons use it.
        </AppText>
        <View style={styles.swatches}>
          {BRAND_PRESETS.map(hex => (
            <Pressable
              key={hex}
              onPress={() => dispatch(setBrandField({ field: 'brandColor', value: hex }))}
              accessibilityRole="radio"
              accessibilityState={{ checked: f.brandColor.toUpperCase() === hex.toUpperCase() }}
              accessibilityLabel={`Brand colour ${hex}`}
              style={[styles.swatch, { backgroundColor: hex }, f.brandColor.toUpperCase() === hex.toUpperCase() && { borderColor: colors.ink }]}
            />
          ))}
        </View>
        <TextField
          label="Or any colour (hex)"
          value={f.brandColor}
          onChangeText={v => dispatch(setBrandField({ field: 'brandColor', value: v }))}
          autoCapitalize="characters"
          autoCorrect={false}
          error={errors.brandColor}
        />
      </Card>
    </ScreenShell>
  );
};

export default VendorBrandScreen;
