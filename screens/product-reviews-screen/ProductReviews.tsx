// ═══════════════════════════════════════════════════════
// MetroMatrix — Every review of a product
// ═══════════════════════════════════════════════════════
// The breakdown doubles as the filter (tap a star row); "With photos" shows
// only reviews you can see. Paged by the server, newest first.

import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { usePagedList } from '../../hooks/usePagedList';
import { fetchReviews } from '../../networks/shopping/catalog';
import { ServiceScope, StoreBrandScope, useStyles, type Theme } from '../../theme/index';
import { ChoiceChip, Divider, EmptyState, ImageViewer, InlineNotice, RatingBreakdown, SkeletonLines } from '../../Custom-Components/index';
import { ReviewItem } from '../../Components/shopping/ReviewItem';
import { ShopTopBar } from '../../Components/shopping/ShopParts';
import type { ShopBrowseParamList } from '../../models';
import { loadProductAsync, selectProductEntry } from '../product-detail-screen/productDetailSlice';
import { selectReviewFilter, setReviewPhotos, setReviewRating } from './productReviewsSlice';
import { productReviewsSerializer } from '../../serializers/shopping/catalogSerializer';

type Props = NativeStackScreenProps<ShopBrowseParamList, 'ProductReviews'>;

const makeStyles = ({ colors, space, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    list: { paddingHorizontal: gutter, paddingBottom: space.s40 },
    header: { gap: space.s16, paddingVertical: space.s16 },
    chips: { flexDirection: 'row', gap: space.s8, flexWrap: 'wrap' },
    state: { paddingTop: space.s16 },
  });

const ProductReviews: React.FC<Props> = props => {
  const entry = useAppSelector(s => selectProductEntry(s, props.route.params.productId));
  return (
    <ServiceScope service="shopping">
      <StoreBrandScope brand={entry.product?.store.brandColor} onBrand={entry.product?.store.onBrandColor}>
        <ProductReviewsContent {...props} />
      </StoreBrandScope>
    </ServiceScope>
  );
};

const ProductReviewsContent: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'ProductDetail', params: { id: route.params.productId } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { productId } = route.params;
  const entry = useAppSelector(s => selectProductEntry(s, productId));
  const filter = useAppSelector(s => selectReviewFilter(s, productId));
  const [photo, setPhoto] = useState<string | null>(null);

  // Opened from a link, the product (and its rating summary) may not be loaded.
  useEffect(() => {
    if (entry.status === 'idle') void dispatch(loadProductAsync(productId));
  }, [entry.status, productId, dispatch]);

  const list = usePagedList(
    (page, size) => fetchReviews(productId, { rating: filter.rating, withPhotos: filter.withPhotos || undefined }, page, size),
    productReviewsSerializer,
    `reviews|${productId}|${filter.rating}|${filter.withPhotos}`,
  );
  const summary = entry.product?.reviewSummary;
  const storeName = entry.product?.store.name ?? 'The store';

  return (
    <View style={styles.root}>
      <ShopTopBar title={route.params.name ? `Reviews · ${route.params.name}` : 'Reviews'} onBack={back} />
      <FlatList
        data={list.rows}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Divider}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        ListHeaderComponent={
          <View style={styles.header}>
            {summary ? (
              <RatingBreakdown summary={summary} selected={filter.rating} onSelect={rating => dispatch(setReviewRating({ productId, rating }))} />
            ) : null}
            <View style={styles.chips}>
              <ChoiceChip
                label="All"
                selected={!filter.rating && !filter.withPhotos}
                onPress={() => {
                  dispatch(setReviewRating({ productId, rating: null }));
                  dispatch(setReviewPhotos({ productId, withPhotos: false }));
                }}
              />
              <ChoiceChip
                label={summary ? `With photos (${summary.withPhotos})` : 'With photos'}
                icon="image-outline"
                selected={filter.withPhotos}
                onPress={() => dispatch(setReviewPhotos({ productId, withPhotos: !filter.withPhotos }))}
              />
              {filter.rating ? (
                <ChoiceChip label={`${filter.rating} stars`} icon="close" selected onPress={() => dispatch(setReviewRating({ productId, rating: null }))} />
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item }) => <ReviewItem review={item} storeName={storeName} onPhoto={setPhoto} />}
        ListEmptyComponent={
          <View style={styles.state}>
            {list.isLoading ? (
              <SkeletonLines lines={6} />
            ) : list.error ? (
              <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
            ) : (
              <EmptyState
                icon="message-square"
                title={filter.rating || filter.withPhotos ? 'No reviews match' : 'No reviews yet'}
                body={filter.rating || filter.withPhotos ? 'Try another filter.' : 'Buyers can review it once it is delivered.'}
              />
            )}
          </View>
        }
        ListFooterComponent={list.isLoadingMore ? <SkeletonLines lines={2} /> : null}
      />
      <ImageViewer visible={!!photo} uri={photo} title="Review photo" onClose={() => setPhoto(null)} />
    </View>
  );
};

export default ProductReviews;
