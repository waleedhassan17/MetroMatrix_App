// ═══════════════════════════════════════════════════════
// MetroMatrix — Store profile (what customers see)
// ═══════════════════════════════════════════════════════
// The cover and logo, a one-line tagline, the story, the brand colour (with
// a live preview and a readability check), how customers reach you, and
// your socials.

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { BRAND_PRESETS, ON_BRAND_CHOICES, brandContrast, validateStoreProfile } from '@models/shopping/storeModel';
import { ServiceScope, StoreBrandScope, useStyles, useTheme, type Theme } from '@theme/index';
import {
  AppText,
  Button,
  Card,
  ChoiceChip,
  IonIcon,
  InlineNotice,
  ScreenShell,
  SkeletonLines,
  StoreMark,
  TextAction,
  TextField,
} from '@custom/index';
import type { StorePartnerStackParamList } from '@/types';
import { cdn } from '@utils/cdn';
import { haptics } from '@utils/haptics';
import { pickImageFromLibrary } from '@utils/pickers';
import { loadStoreProfileAsync, saveStoreProfileAsync, selectStoreProfile, setProfileField, setSocial, uploadStoreImageAsync } from './storeProfileSlice';

type Props = NativeStackScreenProps<StorePartnerStackParamList, 'StoreProfile'>;

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    cover: { width: '100%', aspectRatio: size.coverAspect, borderRadius: radius.md, backgroundColor: colors.surfaceSunk, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    coverImage: { ...StyleSheet.absoluteFillObject },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    swatch: { width: size.swatch, height: size.swatch, borderRadius: radius.pill, borderWidth: size.focusBorder, borderColor: colors.surface },
    preview: { gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
  });

const StoreProfileScreen: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <StoreProfileContent {...props} />
  </ServiceScope>
);

const StoreProfileContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'StoreTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, size } = useTheme();
  const s = useAppSelector(selectStoreProfile);
  const f = s.form;

  useEffect(() => {
    void dispatch(loadStoreProfileAsync());
  }, [dispatch]);

  if (!f || !s.profile) {
    return (
      <ScreenShell title="Store profile" onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} /> : <SkeletonLines lines={8} />}
      </ScreenShell>
    );
  }

  const errors = validateStoreProfile(f);
  const contrast = brandContrast(f.brandColor, f.onBrandColor);

  const pick = async (kind: 'logo' | 'cover') => {
    const file = await pickImageFromLibrary({ square: kind === 'logo' });
    if (file) void dispatch(uploadStoreImageAsync({ kind, file }));
  };

  const save = async () => {
    if (Object.keys(errors).length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(saveStoreProfileAsync(f));
    if (saveStoreProfileAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Profile saved', text2: 'Customers see it on your store page now.' });
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title="Store profile"
      subtitle={s.profile.name}
      onBack={back}
      footer={<Button label="Save profile" onPress={() => void save()} loading={s.saveStatus === 'loading'} disabled={!!s.uploading} fullWidth />}>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}

      <Pressable onPress={() => void pick('cover')} style={styles.cover} accessibilityRole="button" accessibilityLabel="Change the cover photo">
        {f.coverUrl ? <Image source={{ uri: cdn(f.coverUrl, { w: size.storeCard * 1.5 }) ?? undefined }} style={styles.coverImage} contentFit="cover" /> : null}
        {!f.coverUrl ? <IonIcon name="image-outline" size="xl" color={colors.inkFaint} /> : null}
      </Pressable>
      <TextAction label={s.uploading === 'cover' ? 'Uploading the cover…' : f.coverUrl ? 'Change the cover' : 'Add a cover photo'} icon="image-outline" onPress={() => void pick('cover')} disabled={!!s.uploading} />

      <View style={styles.row}>
        <StoreMark store={{ name: s.profile.name, logoUrl: f.logoUrl, brandColor: f.brandColor, onBrandColor: f.onBrandColor }} />
        <TextAction label={s.uploading === 'logo' ? 'Uploading…' : f.logoUrl ? 'Change logo' : 'Add a logo'} icon="camera-outline" onPress={() => void pick('logo')} disabled={!!s.uploading} />
      </View>

      <TextField label="Tagline" value={f.tagline} onChangeText={v => dispatch(setProfileField({ field: 'tagline', value: v }))} error={errors.tagline} maxLength={80} placeholder="Hand-finished eastern wear from Lahore" />
      <TextField label="About your store" value={f.about} onChangeText={v => dispatch(setProfileField({ field: 'about', value: v }))} error={errors.about} multiline maxLength={1200} />

      <Card>
        <AppText variant="title">Brand colour</AppText>
        <AppText variant="small" tone="muted">
          Your store page, buttons and product pages use it.
        </AppText>
        <View style={styles.swatches}>
          {BRAND_PRESETS.map(hex => (
            <Pressable
              key={hex}
              onPress={() => dispatch(setProfileField({ field: 'brandColor', value: hex }))}
              accessibilityRole="radio"
              aria-checked={f.brandColor === hex}
              accessibilityLabel={`Brand colour ${hex}`}
              style={[styles.swatch, { backgroundColor: hex }, f.brandColor === hex && { borderColor: colors.ink }]}
            />
          ))}
        </View>
        <TextField label="Or any colour (hex)" value={f.brandColor} onChangeText={v => dispatch(setProfileField({ field: 'brandColor', value: v }))} autoCapitalize="characters" autoCorrect={false} error={errors.brandColor} />
        <View style={styles.swatches}>
          {ON_BRAND_CHOICES.map(c => (
            <ChoiceChip key={c.value} label={c.label} selected={f.onBrandColor === c.value} onPress={() => dispatch(setProfileField({ field: 'onBrandColor', value: c.value }))} />
          ))}
        </View>
        <StoreBrandScope brand={f.brandColor} onBrand={f.onBrandColor}>
          <View style={styles.preview}>
            <Button label="Add to bag" leftIcon="bag-add-outline" onPress={() => undefined} fullWidth />
            <AppText variant="small" tone={contrast.passes ? 'success' : 'danger'}>
              {contrast.passes ? `Easy to read (${contrast.ratio}:1)` : `Hard to read (${contrast.ratio}:1). Customers will see a readable text colour instead.`}
            </AppText>
          </View>
        </StoreBrandScope>
      </Card>

      <TextField label="Phone" mode="phone" value={(f.phone ?? '').replace(/^\+92/, '')} onChangeText={v => dispatch(setProfileField({ field: 'phone', value: v ? `+92${v}` : null }))} placeholder="300 1112233" />
      <TextField label="WhatsApp" mode="phone" value={(f.whatsapp ?? '').replace(/^\+92/, '')} onChangeText={v => dispatch(setProfileField({ field: 'whatsapp', value: v ? `+92${v}` : null }))} placeholder="300 1112233" />
      <TextField label="Instagram" value={f.socials.instagram ?? ''} onChangeText={v => dispatch(setSocial({ key: 'instagram', value: v }))} autoCapitalize="none" placeholder="@yourstore" />
      <TextField label="Website" value={f.socials.website ?? ''} onChangeText={v => dispatch(setSocial({ key: 'website', value: v }))} autoCapitalize="none" keyboardType="url" placeholder="yourstore.pk" />
    </ScreenShell>
  );
};

export default StoreProfileScreen;
