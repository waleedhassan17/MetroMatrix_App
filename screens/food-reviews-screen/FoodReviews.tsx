// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: a kitchen's reviews
// ═══════════════════════════════════════════════════════
// The rating breakdown (from the kitchen's page), then every visible review,
// newest first, each in its card with the kitchen's reply. Reviews staff hid
// for breaking the rules aren't here or in the rating.

import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBack } from '../../hooks/useBack';
import { useAppSelector } from '../../hooks/useReduxHooks';
import { selectVendorPage } from '../food-vendor-screen/foodVendorSlice';
import { usePagedList } from '../../hooks/usePagedList';
import { fetchKitchenReviews } from '../../networks/food/reviews';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { Card, EmptyState, InlineNotice, RowCardsSkeleton, ScreenShell } from '../../Custom-Components/index';
import { RatingSummary } from '../../Custom-Components/food/RatingSummary';
import { FoodReviewItem } from '../../Custom-Components/food/FoodReviewItem';
import type { FoodAppParamList } from '../../models';
import { foodReviewsPageSerializer } from '../../serializers/food/reviewSerializer';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodReviews'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { paddingBottom: space.s40, gap: space.s12 },
    summary: { paddingBottom: space.s4 },
  });

const FoodReviews: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodReviewsContent {...props} />
  </ServiceScope>
);

const FoodReviewsContent: React.FC<Props> = ({ route }) => {
  const { id, name, slug } = route.params;
  const { back } = useBack(slug ? { name: 'FoodVendor', params: { slug } } : { name: 'FoodTabs' });
  const styles = useStyles(makeStyles);
  const list = usePagedList((page, size) => fetchKitchenReviews(id, page, size), foodReviewsPageSerializer, `food-reviews|${id}`);
  const vendorName = name ?? 'The kitchen';
  const summary = useAppSelector(st => (slug ? selectVendorPage(st, slug).page?.ratingSummary ?? null : null));

  return (
    <ScreenShell title="Reviews" subtitle={[name, list.total ? `${list.total} ${list.total === 1 ? 'review' : 'reviews'}` : null].filter(Boolean).join(' · ') || undefined} onBack={back} scroll={false}>
      <FlatList
        data={list.rows}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        onEndReached={list.loadMore}
        ListHeaderComponent={
          summary ? (
            <View style={styles.summary}>
              <Card>
                <RatingSummary summary={summary} />
              </Card>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Card>
            <FoodReviewItem review={item} vendorName={vendorName} inCard />
          </Card>
        )}
        ListEmptyComponent={
          list.isLoading ? (
            <RowCardsSkeleton />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState ion="chatbox-ellipses-outline" title="No reviews yet" body="Reviews show here once customers rate their orders." />
          )
        }
      />
    </ScreenShell>
  );
};

export default FoodReviews;
