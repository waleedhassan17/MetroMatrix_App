// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: home banners
// ═══════════════════════════════════════════════════════
// The Shopping home's carousel in the order it plays. Move, switch on and
// off, edit, add.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { useStyles, useTheme, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, EmptyState, IconButton, InlineNotice, ScreenShell, SkeletonLines, StatusPill, TextAction } from '../../../../Custom-Components/index';
import type { AdminBanner, AdminShopStackParamList } from '../../../../types';
import { cdn } from '../../../../utils/cdn';
import { formatDate } from '../../../../utils/dates';
import { changeBannersAsync, loadBannersAsync, selectShopBanners } from './shopBannersSlice';

type Props = NativeStackScreenProps<AdminShopStackParamList, 'ShopBanners'>;

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    image: { width: '100%', aspectRatio: size.bannerAspect, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    text: { flex: 1, gap: space.s4 },
    actions: { flexDirection: 'row', gap: space.s16 },
  });

export const targetText = (b: AdminBanner) =>
  b.target.kind === 'store' ? `Store · ${b.target.slug}` : b.target.kind === 'category' ? `Category · ${b.target.name || b.target.id}` : `Product · ${b.target.id}`;

const ShopBannersScreen: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'ShopOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const s = useAppSelector(selectShopBanners);
  const list = [...s.banners].sort((a, b) => a.position - b.position);

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadBannersAsync());
    }, [dispatch]),
  );

  return (
    <ScreenShell
      title="Home banners"
      onBack={back}
      footer={<Button label="New banner" leftIcon="add" onPress={() => navigation.navigate('BannerForm')} fullWidth />}>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      {s.status === 'loading' && !list.length ? <SkeletonLines lines={6} /> : null}
      {s.status === 'succeeded' && !list.length ? <EmptyState icon="image" title="No banners" body="The Shopping home starts with categories until you add one." /> : null}
      {list.map((b, i) => (
        <Card key={b.id}>
          <Image source={{ uri: cdn(b.imageUrl, { w: size.storeCard * 1.5 }) ?? undefined }} style={styles.image} contentFit="cover" />
          <View style={styles.row}>
            <View style={styles.text}>
              <AppText variant="title">{b.headline}</AppText>
              <AppText variant="small" tone="muted">
                {targetText(b)} · from {formatDate(b.startsAt)}
                {b.endsAt ? ` to ${formatDate(b.endsAt)}` : ''}
              </AppText>
            </View>
            <StatusPill label={b.isActive ? 'On' : 'Off'} tone={b.isActive ? 'success' : 'neutral'} />
          </View>
          <View style={styles.row}>
            <View style={[styles.actions, styles.text]}>
              <TextAction label="Edit" onPress={() => navigation.navigate('BannerForm', { id: b.id })} />
              <TextAction label={b.isActive ? 'Switch off' : 'Switch on'} onPress={() => void dispatch(changeBannersAsync({ kind: 'toggle', banner: b }))} disabled={s.busy} />
            </View>
            <IconButton icon="arrow-up" tone="muted" disabled={i === 0 || s.busy} onPress={() => void dispatch(changeBannersAsync({ kind: 'swap', a: b, b: list[i - 1] }))} accessibilityLabel={`Move ${b.headline} earlier`} />
            <IconButton icon="arrow-down" tone="muted" disabled={i === list.length - 1 || s.busy} onPress={() => void dispatch(changeBannersAsync({ kind: 'swap', a: b, b: list[i + 1] }))} accessibilityLabel={`Move ${b.headline} later`} />
          </View>
        </Card>
      ))}
    </ScreenShell>
  );
};

export default ShopBannersScreen;
