// ═══════════════════════════════════════════════════════
// MetroMatrix — Reviews of the store's products
// ═══════════════════════════════════════════════════════
// Filter by stars or "not replied yet"; reply once, publicly, under the
// review (editable for 24 hours).

import React from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector, useAppStore } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { usePagedList } from '../../hooks/usePagedList';
import { fetchPartnerReviews } from '../../networks/shopping/partner/partnerReviews';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, ChoiceChip, Divider, EmptyState, InlineNotice, ScreenShell, Sheet, SkeletonLines, TextAction, TextField } from '../../Custom-Components/index';
import { ReviewItem } from '../../Components/shopping/ReviewItem';
import type { PartnerReview, StorePartnerStackParamList } from '../../models';
import { cdn } from '../../utils/cdn/cdn';
import { openReply, postReplyAsync, selectStoreReviews, setReply, setReviewsRating, setUnrepliedOnly } from './storeReviewsSlice';
import { partnerReviewPageSerializer } from '../../serializers/shopping/partnerSerializer';

type Props = NativeStackScreenProps<StorePartnerStackParamList, 'StoreReviews'>;

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    chips: { gap: space.s8 },
    list: { paddingBottom: space.s40 },
    product: { flexDirection: 'row', alignItems: 'center', gap: space.s8, paddingTop: space.s16 },
    thumb: { width: size.storeLogoSmall, height: size.storeLogoSmall, borderRadius: radius.sm, backgroundColor: colors.surfaceSunk },
  });

const canEdit = (r: PartnerReview) => !!r.reply && new Date(r.reply.editableUntil).getTime() > Date.now();

const StoreReviews: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <StoreReviewsContent {...props} />
  </ServiceScope>
);

const StoreReviewsContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'StoreTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const appStore = useAppStore();
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const s = useAppSelector(selectStoreReviews);
  const list = usePagedList(
    (page, sz) => fetchPartnerReviews({ rating: s.rating, unreplied: s.unrepliedOnly || undefined }, page, sz),
    partnerReviewPageSerializer,
    `store-reviews|${s.rating}|${s.unrepliedOnly}`,
  );

  const post = async () => {
    if (!s.replyFor) return;
    const r = await dispatch(postReplyAsync({ id: s.replyFor, body: s.reply }));
    const replied = postReplyAsync.fulfilled.match(r) ? selectStoreReviews(appStore.getState()).replied : null;
    if (replied) {
      list.setRows(rows => rows.map(x => (x.id === replied.id ? replied : x)));
      Toast.show({ type: 'success', text1: 'Reply posted', text2: 'You can edit it for 24 hours.' });
    }
  };

  return (
    <ScreenShell title="Reviews" onBack={back} scroll={false}>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <ChoiceChip label="Not replied" selected={s.unrepliedOnly} onPress={() => dispatch(setUnrepliedOnly(!s.unrepliedOnly))} />
          {[5, 4, 3, 2, 1].map(n => (
            <ChoiceChip key={n} label={`${n} stars`} icon="star" selected={s.rating === n} onPress={() => dispatch(setReviewsRating(s.rating === n ? null : n))} />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={list.rows}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Divider}
        onEndReached={list.loadMore}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        renderItem={({ item: r }) => (
          <View>
            <View style={styles.product}>
              {r.productImage ? <Image source={{ uri: cdn(r.productImage, { w: size.storeLogoSmall }) ?? undefined }} style={styles.thumb} contentFit="cover" /> : null}
              <AppText variant="small" tone="muted" numberOfLines={1}>
                {r.productName}
              </AppText>
            </View>
            <ReviewItem review={r} storeName="You" />
            {!r.reply ? (
              <TextAction label="Reply" icon="chatbubble-outline" onPress={() => dispatch(openReply({ id: r.id, body: '' }))} />
            ) : canEdit(r) ? (
              <TextAction label="Edit reply" onPress={() => dispatch(openReply({ id: r.id, body: r.reply!.body }))} />
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          list.isLoading ? (
            <SkeletonLines lines={6} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState icon="message-circle" title="No reviews here" body="Customers review items after delivery." />
          )
        }
      />
      <Sheet
        visible={!!s.replyFor}
        onClose={() => dispatch(openReply(null))}
        title="Reply"
        subtitle="Everyone reading the review sees your reply."
        footer={<Button label="Post reply" disabled={s.reply.trim().length < 2} loading={s.status === 'loading'} onPress={() => void post()} fullWidth />}>
        <TextField label="Your reply" value={s.reply} onChangeText={t => dispatch(setReply(t))} multiline maxLength={600} placeholder="Thank you for shopping with us!" />
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      </Sheet>
    </ScreenShell>
  );
};

export default StoreReviews;
