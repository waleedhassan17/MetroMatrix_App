// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: saved kitchens
// ═══════════════════════════════════════════════════════
// The kitchens the customer saved with the heart on their page, newest
// first, with whether each is open now. A kitchen opens its page.

import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Card, EmptyState, IconButton, IonIcon, InlineNotice, ScreenShell, SkeletonLines } from '@custom/index';
import type { FoodAppParamList, FoodFavourite } from '@/types';
import { cdn } from '@utils/cdn';
import { loadFavouritesAsync, selectFoodFavourites, toggleFavouriteAsync } from './foodFavouritesSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodFavourites'>;

const makeStyles = ({ colors, space, size, radius, gutter }: Theme) =>
  StyleSheet.create({
    list: { paddingHorizontal: gutter, paddingTop: space.s16, paddingBottom: space.s40, gap: space.s12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    logo: { width: size.avatar.md, height: size.avatar.md, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceSunk },
    fill: { ...StyleSheet.absoluteFillObject },
    grow: { flex: 1, gap: space.s4 },
    rating: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
  });

const FoodFavouritesScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodFavouritesContent {...props} />
  </ServiceScope>
);

const FoodFavouritesContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'FoodTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, size } = useTheme();
  const s = useAppSelector(selectFoodFavourites);

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadFavouritesAsync());
    }, [dispatch]),
  );

  const row = (f: FoodFavourite) => (
    <Card key={f.id}>
      <View style={styles.row}>
        <Pressable onPress={() => navigation.navigate('FoodVendor', { slug: f.slug })} style={[styles.row, styles.grow]} accessibilityRole="button" accessibilityLabel={`${f.name}, ${f.openState.label}`}>
          <View style={styles.logo}>{f.logoUrl ? <Image source={{ uri: cdn(f.logoUrl, { w: size.avatar.md }) ?? undefined }} style={styles.fill} contentFit="cover" /> : null}</View>
          <View style={styles.grow}>
            <AppText variant="bodyStrong">{f.name}</AppText>
            <View style={styles.rating}>
              {f.ratingCount ? <IonIcon name="star" size="sm" color={colors.star} /> : null}
              <AppText variant="small" tone={f.openState.open ? 'muted' : 'warning'}>
                {[f.ratingCount ? `${f.ratingAvg.toFixed(1)} (${f.ratingCount})` : null, f.openState.label].filter(Boolean).join(' · ')}
              </AppText>
            </View>
          </View>
        </Pressable>
        <IconButton icon="heart" accessibilityLabel={`Remove ${f.name} from saved`} onPress={() => void dispatch(toggleFavouriteAsync({ vendorId: f.id, save: false }))} />
      </View>
    </Card>
  );

  return (
    <ScreenShell title="Saved kitchens" onBack={back} scroll={false} padded={false}>
      <FlatList
        data={s.items}
        keyExtractor={f => f.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => row(item)}
        ListEmptyComponent={
          s.status === 'loading' || s.status === 'idle' ? (
            <SkeletonLines lines={6} />
          ) : s.status === 'failed' ? (
            <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadFavouritesAsync()) }} />
          ) : (
            <EmptyState icon="heart" title="No saved kitchens yet" body="Tap the heart on a kitchen’s page to keep it here." action={{ label: 'Browse the Food Court', onPress: back }} />
          )
        }
      />
    </ScreenShell>
  );
};

export default FoodFavouritesScreen;
