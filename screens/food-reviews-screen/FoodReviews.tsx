// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: a kitchen's reviews
// ═══════════════════════════════════════════════════════
// Every visible review, newest first, with the kitchen's replies. Reviews
// staff hid for breaking the rules aren't here or in the rating.

import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBack } from '../../hooks/useBack';
import { usePagedList } from '../../hooks/usePagedList';
import { getKitchenReviewsAPI } from '../../networks/food/reviewsNetwork';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Divider, EmptyState, InlineNotice, ScreenShell, SkeletonLines } from '../../Custom-Components/index';
import { FoodReviewItem } from '../../Custom-Components/food/FoodReviewItem';
import type { FoodAppParamList } from '../../models';
import { foodReviewsPageSerializer } from '../../serializers/food/reviewSerializer';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodReviews'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { paddingBottom: space.s40 },
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
  const list = usePagedList((page, size) => getKitchenReviewsAPI(id, page, size), foodReviewsPageSerializer, `food-reviews|${id}`);
  const vendorName = name ?? 'The kitchen';

  return (
    <ScreenShell title="Reviews" subtitle={name} onBack={back} scroll={false}>
      <FlatList
        data={list.rows}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        onEndReached={list.loadMore}
        ItemSeparatorComponent={Divider}
        ListHeaderComponent={
          list.total ? (
            <AppText variant="caption" tone="muted">
              {`${list.total} ${list.total === 1 ? 'review' : 'reviews'}`}
            </AppText>
          ) : null
        }
        renderItem={({ item }) => <FoodReviewItem review={item} vendorName={vendorName} />}
        ListEmptyComponent={
          list.isLoading ? (
            <SkeletonLines lines={6} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState icon="message-square" title="No reviews yet" body="Reviews show here once customers rate their orders." />
          )
        }
      />
    </ScreenShell>
  );
};

export default FoodReviews;
