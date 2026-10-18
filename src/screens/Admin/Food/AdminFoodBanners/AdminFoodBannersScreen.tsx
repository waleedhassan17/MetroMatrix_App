// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: the Food Court home's banners
// ═══════════════════════════════════════════════════════
// What the Food Court home leads with, in order: each opens a vendor, a
// cuisine or a search, for one city or everywhere, between two dates. The
// home shows only live ones whose vendor or cuisine is still there.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useStyles, useTheme, type Theme } from '@theme/index';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  IconButton,
  InlineNotice,
  ScreenShell,
  SkeletonLines,
  StatusPill,
  TextAction,
} from '@custom/index';
import type { AdminFoodBanner, AdminFoodStackParamList } from '@/types';
import { cdn } from '@utils/cdn';
import { formatDate } from '@utils/dates';
import {
  changeFoodBannersAsync,
  loadFoodBannersAsync,
  selectAdminFoodBanners,
} from './adminFoodBannersSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminFoodBanners'>;

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    image: {
      width: '100%',
      aspectRatio: size.bannerAspect,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceSunk,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    text: { flex: 1, gap: space.s4 },
    actions: { flexDirection: 'row', gap: space.s16 },
  });

const TARGET_WORD: Record<AdminFoodBanner['targetType'], string> = {
  vendor: 'Vendor',
  cuisine: 'Cuisine',
  search: 'Search',
};

const targetText = (b: AdminFoodBanner) =>
  b.targetType === 'search' ? `Search · “${b.targetQuery ?? ''}”` : `${TARGET_WORD[b.targetType]}`;

const AdminFoodBannersScreen: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'FoodOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const s = useAppSelector(selectAdminFoodBanners);
  const list = [...s.banners].sort((a, b) => a.sort - b.sort);
  const move = (i: number, by: -1 | 1) => {
    const next = [...list];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    void dispatch(changeFoodBannersAsync({ kind: 'order', banners: next }));
  };

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadFoodBannersAsync());
    }, [dispatch]),
  );

  return (
    <ScreenShell
      title="Home banners"
      subtitle="Food Court"
      onBack={back}
      footer={
        <Button
          label="New banner"
          leftIcon="add"
          onPress={() => navigation.navigate('AdminFoodBannerForm')}
          fullWidth
        />
      }>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      {s.status === 'loading' && !list.length ? <SkeletonLines lines={6} /> : null}
      {s.status === 'succeeded' && !list.length ? (
        <EmptyState
          icon="image"
          title="No banners"
          body="The Food Court home starts with cuisines until you add one."
        />
      ) : null}
      {list.map((b, i) => (
        <Card key={b.id}>
          <Image
            source={{ uri: cdn(b.imageUrl, { w: size.storeCard * 1.5 }) ?? undefined }}
            style={styles.image}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
          <View style={styles.row}>
            <View style={styles.text}>
              <AppText variant="title">{b.title}</AppText>
              <AppText variant="small" tone="muted">
                {`${targetText(b)} · ${b.city ?? 'Every city'} · from ${formatDate(b.startsAt)}${
                  b.endsAt ? ` to ${formatDate(b.endsAt)}` : ''
                }`}
              </AppText>
            </View>
            <StatusPill
              label={b.isActive ? 'On' : 'Off'}
              tone={b.isActive ? 'success' : 'neutral'}
            />
          </View>
          <View style={styles.row}>
            <View style={[styles.actions, styles.text]}>
              <TextAction
                label="Edit"
                onPress={() => navigation.navigate('AdminFoodBannerForm', { id: b.id })}
              />
              <TextAction
                label={b.isActive ? 'Switch off' : 'Switch on'}
                onPress={() => void dispatch(changeFoodBannersAsync({ kind: 'toggle', banner: b }))}
                disabled={s.busy}
              />
            </View>
            <IconButton
              icon="arrow-up"
              tone="muted"
              disabled={i === 0 || s.busy}
              onPress={() => move(i, -1)}
              accessibilityLabel={`Move ${b.title} earlier`}
            />
            <IconButton
              icon="arrow-down"
              tone="muted"
              disabled={i === list.length - 1 || s.busy}
              onPress={() => move(i, 1)}
              accessibilityLabel={`Move ${b.title} later`}
            />
          </View>
        </Card>
      ))}
    </ScreenShell>
  );
};

export default AdminFoodBannersScreen;
