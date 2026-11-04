// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: saved kitchens
// ═══════════════════════════════════════════════════════
// The kitchens the customer saved with the heart on their page, newest
// first, with whether each is open now. A kitchen opens its page.

import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { Card, EmptyState, IonIcon, InlineNotice, RowCardsSkeleton, ScreenShell, StoreHeadRow } from '../../Custom-Components/index';
import { FoodBagDock, useBagDockInset } from '../../Components/food/FoodParts';
import type { FoodAppParamList, FoodFavourite } from '../../models';
import { loadFavouritesAsync, selectFoodFavourites, toggleFavouriteAsync } from './foodFavouritesSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodFavourites'>;

const makeStyles = ({ space, size, gutter }: Theme) =>
  StyleSheet.create({
    list: { paddingHorizontal: gutter, paddingBottom: space.s40, gap: space.s12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    grow: { flex: 1 },
    heart: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
  });

const FoodFavourites: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodFavouritesContent {...props} />
  </ServiceScope>
);

const FoodFavouritesContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'FoodTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, service, space, opacity } = useTheme();
  const dockInset = useBagDockInset();
  const s = useAppSelector(selectFoodFavourites);

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadFavouritesAsync());
    }, [dispatch]),
  );

  const row = (f: FoodFavourite) => {
    const meta = [f.ratingCount ? `Rated ${f.ratingAvg.toFixed(1)} (${f.ratingCount})` : null, f.openState.label].filter(Boolean).join(' · ');
    return (
      <Card key={f.id}>
        <View style={styles.row}>
          <View style={styles.grow}>
            <StoreHeadRow
              store={{ name: f.name, logoUrl: f.logoUrl, brandColor: service.accent }}
              meta={meta}
              onPress={() => navigation.navigate('FoodVendor', { slug: f.slug })}
              chevron={false}
            />
          </View>
          {/* The saved heart is red here as on the kitchen's page. */}
          <Pressable
            onPress={() => void dispatch(toggleFavouriteAsync({ vendorId: f.id, save: false }))}
            style={({ pressed }) => [styles.heart, pressed && { opacity: opacity.pressed }]}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${f.name} from saved`}>
            <IonIcon name="heart" size="md" color={colors.danger} />
          </Pressable>
        </View>
      </Card>
    );
  };

  return (
    <ScreenShell title="Saved kitchens" subtitle={s.items.length ? `${s.items.length} saved` : undefined} onBack={back} scroll={false} padded={false}>
      <FlatList
        data={s.items}
        keyExtractor={f => f.id}
        contentContainerStyle={[styles.list, { paddingBottom: space.s40 + dockInset }]}
        renderItem={({ item }) => row(item)}
        ListEmptyComponent={
          s.status === 'loading' || s.status === 'idle' ? (
            <RowCardsSkeleton />
          ) : s.status === 'failed' ? (
            <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadFavouritesAsync()) }} />
          ) : (
            <EmptyState ion="heart-outline" title="No saved kitchens yet" body="Tap the heart on a kitchen’s page to keep it here." action={{ label: 'Browse the Food Court', onPress: back }} />
          )
        }
      />
      <FoodBagDock />
    </ScreenShell>
  );
};

export default FoodFavourites;
