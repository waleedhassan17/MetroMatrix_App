// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: a kitchen's own page (its link or QR code)
// ═══════════════════════════════════════════════════════
// metromatrix.app/s/<slug> (or a scan of the kitchen's QR code), signed out:
// the kitchen's page to read (its photo, rating, story, hygiene and menu),
// with "Order" leading to sign in, after which the home opens the kitchen.
// (Signed in, the link opens the kitchen's ordinary Food page instead: see
// AppContainer's linking.) The visit is remembered on the device, so the
// order that follows counts as one the kitchen brought ("Orders you
// brought"). Customers pay the kitchen directly.

import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { cuisineLine, ratingLabel } from '@models/food/discoveryModel';
import { categoryWindowLabel } from '@models/food/menuModel';
import { HYGIENE_STATUS } from '@models/kitchen/kitchenStatusModel';
import { windowText } from '@models/kitchen/reachModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, BadgeRow, Button, Card, Divider, IonIcon, InlineNotice, ScreenShell, Sheet, SkeletonLines, TextAction } from '@custom/index';
import { MenuDishRow } from '@custom/food/MenuDishRow';
import type { RootStackParamList } from '@/types';
import { setStoreSource } from '@store/preferencesSlice';
import { cdn } from '@utils/cdn';
import { loadPublicStoreAsync, selectPublicStore } from './publicStoreSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'PublicStore'>;

const makeStyles = ({ colors, space, radius, size }: Theme) =>
  StyleSheet.create({
    cover: { width: '100%', aspectRatio: size.vendorPhotoAspect, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceSunk },
    fill: { ...StyleSheet.absoluteFillObject },
    gap: { gap: space.s8 },
    line: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    section: { gap: space.s4 },
  });

const PublicStoreScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <PublicStoreContent {...props} />
  </ServiceScope>
);

const PublicStoreContent: React.FC<Props> = ({ navigation, route }) => {
  const { slug, via } = route.params;
  const { back } = useBack({ name: 'RoleSelection' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, size } = useTheme();
  const s = useAppSelector(selectPublicStore);
  const [asking, setAsking] = useState(false);

  // Remember where this visit came from: after sign-in the home opens this
  // kitchen, and the order that follows counts as one it brought.
  useEffect(() => {
    dispatch(setStoreSource({ kind: via === 'qr' ? 'qr' : 'link', slug, at: Date.now(), opened: false }));
  }, [dispatch, slug, via]);

  const load = useCallback(() => void dispatch(loadPublicStoreAsync(slug)), [dispatch, slug]);
  useFocusEffect(load);

  const page = s.slug === slug ? s.page : null;
  if (!page) {
    return (
      <ScreenShell title="Food Court" onBack={back}>
        {s.status === 'failed' ? (
          <InlineNotice title={s.error.code === 'NOT_FOUND' ? 'This kitchen isn’t on Food Court now' : undefined} message={s.error.message} action={s.error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: load }} />
        ) : (
          <SkeletonLines lines={10} />
        )}
      </ScreenShell>
    );
  }

  const order = () => setAsking(true);

  return (
    <ScreenShell title={page.name} subtitle={page.tagline ?? cuisineLine(page)} onBack={back}>
      <View style={styles.cover}>{page.coverUrl ? <Image source={{ uri: cdn(page.coverUrl, { w: size.storeCard * 1.6 }) ?? undefined }} style={styles.fill} contentFit="cover" accessibilityLabel={`${page.name}: food photo`} /> : null}</View>
      <View style={styles.gap}>
        <View style={styles.line}>
          <IonIcon name="star" size="sm" color={colors.star} />
          <AppText variant="small">{`${ratingLabel(page)} · ${cuisineLine(page)}${page.isHomeKitchen ? ' · Home kitchen' : ''}`}</AppText>
        </View>
        <BadgeRow badges={page.badges.filter(b => b !== 'home_kitchen')} />
        <AppText variant="small" tone="muted">
          {[page.location.area, page.location.city].filter(Boolean).join(', ')}
        </AppText>
      </View>
      {page.paused ? (
        <InlineNotice tone="warning" title="Not taking orders right now" message={page.pauseMessage ?? 'Check back soon.'} />
      ) : !page.openState.open ? (
        <InlineNotice tone="info" title={page.openState.label} message="Look through the menu now and order when it opens." />
      ) : null}
      {page.ramadan ? (
        <Card>
          <View style={styles.section}>
            <AppText variant="title">Ramadan hours</AppText>
            <AppText variant="small">{`Sehri ${windowText(page.ramadan.sehri)} · Iftar ${windowText(page.ramadan.iftar)}`}</AppText>
          </View>
        </Card>
      ) : null}

      <Button label={`Order from ${page.name}`} onPress={order} fullWidth />
      {Platform.OS === 'web' ? <TextAction label="Open in the MetroMatrix app" icon="phone-portrait-outline" onPress={() => void Linking.openURL(`metromatrix://s/${encodeURIComponent(slug)}`)} /> : null}

      {page.story ? (
        <Card>
          <View style={styles.section}>
            <AppText variant="title">Our story</AppText>
            {page.story.cookName ? <AppText variant="bodyStrong">{`Cooked by ${page.story.cookName}`}</AppText> : null}
            <AppText variant="body">{page.story.text}</AppText>
          </View>
        </Card>
      ) : null}
      {page.hygiene.status !== 'none' ? (
        <View style={styles.line}>
          <IonIcon name={page.hygiene.status === 'verified' ? 'shield-checkmark-outline' : 'shield-outline'} size="sm" color={colors.inkMuted} />
          <AppText variant="small" tone="muted">
            {page.hygiene.status === 'verified' ? `${HYGIENE_STATUS.verified.label} by MetroMatrix` : `${HYGIENE_STATUS.self_declared.label} by the kitchen`}
          </AppText>
        </View>
      ) : null}

      {page.menu.map(sec => (
        <View key={sec.id} style={styles.gap}>
          <AppText variant="sectionTitle" accessibilityRole="header">
            {sec.name}
          </AppText>
          {sec.availableFrom && sec.availableTo ? (
            <AppText variant="small" tone="muted">
              {categoryWindowLabel(sec.availableFrom, sec.availableTo)}
            </AppText>
          ) : null}
          <Card padded="horizontal">
            {sec.items.map((d, n) => (
              <View key={d.id}>
                {n ? <Divider /> : null}
                <MenuDishRow dish={d} windowFrom={sec.availableFrom} onPress={order} />
              </View>
            ))}
          </Card>
        </View>
      ))}

      <AppText variant="caption" tone="muted">
        Food Court on MetroMatrix takes no commission. You pay the kitchen directly, and its own riders deliver.
      </AppText>

      <Sheet
        visible={asking}
        onClose={() => setAsking(false)}
        title={`Order from ${page.name}`}
        subtitle="Sign in or create an account to order"
        footer={
          <Button
            label="Sign in to order"
            onPress={() => {
              setAsking(false);
              navigation.navigate('SignIn');
            }}
            fullWidth
          />
        }>
        <View style={styles.gap}>
          <AppText variant="body">{`After you sign in, ${page.name}’s page opens and you can order.`}</AppText>
          <TextAction
            label="New here? Create an account"
            onPress={() => {
              setAsking(false);
              navigation.navigate('SignUp');
            }}
          />
        </View>
      </Sheet>
    </ScreenShell>
  );
};

export default PublicStoreScreen;
