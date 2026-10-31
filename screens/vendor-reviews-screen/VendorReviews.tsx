// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: reviews
// ═══════════════════════════════════════════════════════
// What customers said about their orders, newest first: the ones still
// waiting for a reply, or all. A reply shows under the review on the
// kitchen's page, and the customer is told.

import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector, useAppStore } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { usePagedList } from '../../hooks/usePagedList';
import { fetchMyReviews } from '../../networks/food/vendor/reviews';
import { validateReply } from '../../models/food/reviewModel';
import { selectBusiness } from '../../store/authSlice';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { Button, Divider, EmptyState, InlineNotice, ScreenShell, SegmentTabs, Sheet, SkeletonLines, TextField } from '../../Custom-Components/index';
import { FoodReviewItem } from '../../Custom-Components/food/FoodReviewItem';
import type { FoodVendorStackParamList, VendorReview } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import { openReply, selectVendorReviews, sendReplyAsync, setReply, setUnrepliedOnly, touchReply } from './vendorReviewsSlice';
import { vendorReviewsPageSerializer } from '../../serializers/food/reviewSerializer';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'VendorReviews'>;

const SEGMENTS: { key: 'waiting' | 'all'; label: string }[] = [
  { key: 'waiting', label: 'Waiting for a reply' },
  { key: 'all', label: 'All' },
];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { paddingBottom: space.s40 },
    actions: { flexDirection: 'row', gap: space.s12 },
  });

const VendorReviews: React.FC<Props> = props => (
  <ServiceScope service="food">
    <VendorReviewsContent {...props} />
  </ServiceScope>
);

const VendorReviewsContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'VendorTabs' });
  const dispatch = useAppDispatch();
  const appStore = useAppStore();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVendorReviews);
  const business = useAppSelector(selectBusiness);
  const list = usePagedList((page, size) => fetchMyReviews(s.unreplied, page, size), vendorReviewsPageSerializer, `vendor-reviews|${s.unreplied}`);
  const replyError = s.replyTouched ? validateReply(s.reply).reply : undefined;
  const replying = list.rows.find(r => r.id === s.replying) ?? null;
  const name = business?.name ?? 'Your kitchen';

  const send = async (r: VendorReview) => {
    if (Object.keys(validateReply(s.reply)).length) {
      dispatch(touchReply());
      haptics.warning();
      return;
    }
    const res = await dispatch(sendReplyAsync({ id: r.id, reply: s.reply }));
    const replied = sendReplyAsync.fulfilled.match(res) ? selectVendorReviews(appStore.getState()).replied : null;
    if (replied) {
      haptics.success();
      list.setRows(rows => (s.unreplied ? rows.filter(x => x.id !== r.id) : rows.map(x => (x.id === r.id ? { ...x, vendorReply: replied.vendorReply, repliedAt: replied.repliedAt } : x))));
      Toast.show({ type: 'success', text1: 'Reply posted', text2: 'It shows under the review on your page.' });
    } else haptics.warning();
  };

  return (
    <ScreenShell title="Reviews" onBack={back} scroll={false}>
      <SegmentTabs options={SEGMENTS} value={s.unreplied ? 'waiting' : 'all'} onChange={k => dispatch(setUnrepliedOnly(k === 'waiting'))} accessibilityLabel="Reviews" />
      <FlatList
        data={list.rows}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        onEndReached={list.loadMore}
        ItemSeparatorComponent={Divider}
        renderItem={({ item: r }) => (
          <FoodReviewItem
            review={r}
            vendorName={name}
            context={r.orderCode ? `Order ${r.orderCode}` : undefined}
            footer={
              <View style={styles.actions}>
                <Button
                  label={r.vendorReply ? 'Edit reply' : 'Reply'}
                  variant="secondary"
                  leftIcon="chatbubble-outline"
                  onPress={() => dispatch(openReply({ id: r.id, current: r.vendorReply }))}
                />
              </View>
            }
          />
        )}
        ListEmptyComponent={
          list.isLoading ? (
            <SkeletonLines lines={6} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState
              icon="message-square"
              title={s.unreplied ? 'Nothing waiting for a reply' : 'No reviews yet'}
              body="Customers can rate an order once it was delivered or collected."
            />
          )
        }
      />
      <Sheet
        visible={!!s.replying}
        onClose={() => dispatch(openReply(null))}
        title="Reply to this review"
        subtitle="Your reply is public, under the review. Thank them, or say what you'll do about it."
        footer={<Button label="Post reply" loading={s.busy} onPress={() => replying && void send(replying)} fullWidth />}>
        {replying?.text ? <FoodReviewItem review={replying} vendorName={name} /> : null}
        <TextField label="Your reply" value={s.reply} onChangeText={t => dispatch(setReply(t))} multiline placeholder="Thank you for ordering…" error={replyError} maxLength={1000} />
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      </Sheet>
    </ScreenShell>
  );
};

export default VendorReviews;
