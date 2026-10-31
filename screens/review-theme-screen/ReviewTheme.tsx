// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen assistant: the reviews behind a theme
// ═══════════════════════════════════════════════════════
// Every review of the week that said it ("Took too long"), newest first,
// with a way to the reviews page to reply. A paged list (usePagedList).

import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { usePagedList } from '../../hooks/usePagedList';
import { fetchReviewsByTheme } from '../../networks/food/vendor/reviews';
import { weekLabel } from '../../models/kitchen/assistantModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { Divider, EmptyState, InlineNotice, ScreenShell, SkeletonLines, TextAction } from '../../Custom-Components/index';
import { FoodReviewItem } from '../../Custom-Components/food/FoodReviewItem';
import type { FoodVendorStackParamList } from '../../models';
import { selectBusiness } from '../../store/authSlice';
import { vendorReviewsPageSerializer } from '../../serializers/food/reviewSerializer';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenReviewTheme'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { paddingBottom: space.s40, gap: space.s4 },
  });

const ReviewTheme: React.FC<Props> = props => (
  <ServiceScope service="food">
    <ReviewThemeContent {...props} />
  </ServiceScope>
);

const ReviewThemeContent: React.FC<Props> = ({ navigation, route }) => {
  const { theme, label, week } = route.params;
  const { back } = useBack({ name: 'KitchenReviewInsights' });
  const styles = useStyles(makeStyles);
  const name = useAppSelector(selectBusiness)?.name ?? 'Your kitchen';
  const list = usePagedList((page, size) => fetchReviewsByTheme(theme, week ?? null, page, size), vendorReviewsPageSerializer, `review-theme|${theme}|${week ?? ''}`);

  return (
    <ScreenShell title={label ?? 'Reviews'} subtitle={week ? weekLabel(week) : undefined} onBack={back} scroll={false}>
      <FlatList
        data={list.rows}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        onEndReached={list.loadMore}
        ItemSeparatorComponent={Divider}
        renderItem={({ item: r }) => <FoodReviewItem review={r} vendorName={name} context={r.orderCode ? `Order ${r.orderCode}` : undefined} />}
        ListEmptyComponent={
          list.isLoading ? (
            <SkeletonLines lines={6} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState icon="message-square" title="No reviews here" body="None of that week’s reviews said this." />
          )
        }
        ListFooterComponent={<TextAction label="Reply on your reviews page" icon="chatbubble-outline" onPress={() => navigation.navigate('VendorReviews')} />}
      />
    </ScreenShell>
  );
};

export default ReviewTheme;
