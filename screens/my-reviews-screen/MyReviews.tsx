// ═══════════════════════════════════════════════════════
// MetroMatrix — Reviews of you
// ═══════════════════════════════════════════════════════
// How patients rate you, and every review — filter to the ones you haven't
// answered. A reply shows under the review on your profile; you can change
// it for 24 hours.

import React, { useEffect } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector, useAppStore } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { usePagedList } from '../../hooks/usePagedList';
import { fetchOwnReviews } from '../../networks/health/doctor/doctorReviews';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import {
  AppText,
  Button,
  Card,
  ChoiceChip,
  DoctorReviewItem,
  EmptyState,
  InlineNotice,
  PageHeader,
  ReviewSummary,
  RowCardsSkeleton,
  Sheet,
  TextAction,
  TextField,
} from '../../Custom-Components/index';
import { Stars } from '../../Custom-Components/shopping/Stars';
import { MAX_REPLY, validateReply } from '../../models/health/reviewFormModel';
import type { DoctorPartnerStackParamList } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import { useNow } from '../../hooks/useNow';
import { loadReviewSummaryAsync, openReply, selectMyReviews, sendReplyAsync, setReplyText, setUnreplied } from './myReviewsSlice';
import { doctorReviewPageSerializer } from '../../serializers/health/discoverySerializer';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'MyReviews'>;

const makeStyles = ({ colors, space, gutter, radius }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    list: { paddingHorizontal: gutter, paddingBottom: space.s40 },
    head: { gap: space.s16, paddingTop: space.s20, paddingBottom: space.s12 },
    chips: { flexDirection: 'row', gap: space.s8 },
    gap: { height: space.s12 },
    quote: { gap: space.s8, padding: space.s12, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
  });

const MyReviews: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <MyReviewsContent {...props} />
  </ServiceScope>
);

const MyReviewsContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'DoctorTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const appStore = useAppStore();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectMyReviews);
  const now = useNow();
  const list = usePagedList((page, size) => fetchOwnReviews(s.unreplied, page, size), doctorReviewPageSerializer, `myreviews|${s.unreplied}`);
  const [tried, setTried] = React.useState(false);
  const replyError = tried ? validateReply(s.text).reply : undefined;
  const Gap = React.useCallback(() => <View style={styles.gap} />, [styles.gap]);

  useEffect(() => {
    void dispatch(loadReviewSummaryAsync());
  }, [dispatch]);

  const send = async () => {
    setTried(true);
    if (!s.replying || Object.keys(validateReply(s.text)).length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(sendReplyAsync({ id: s.replying.id, text: s.text }));
    const replied = sendReplyAsync.fulfilled.match(r) ? selectMyReviews(appStore.getState()).replied : null;
    if (replied) {
      haptics.success();
      list.setRows(rows => (s.unreplied ? rows.filter(x => x.id !== replied.id) : rows.map(x => (x.id === replied.id ? replied : x))));
      Toast.show({ type: 'success', text1: 'Reply posted', text2: 'Patients see it under the review.' });
    }
  };

  const header = (
    <View style={styles.head}>
      {s.summary ? (
        <Card>
          <ReviewSummary summary={s.summary} />
        </Card>
      ) : s.summaryStatus === 'failed' ? (
        <InlineNotice message={s.summaryError.message} action={{ label: 'Try again', onPress: () => void dispatch(loadReviewSummaryAsync()) }} />
      ) : (
        <RowCardsSkeleton count={1} />
      )}
      <View style={styles.chips}>
        <ChoiceChip label="All reviews" selected={!s.unreplied} onPress={() => dispatch(setUnreplied(false))} />
        <ChoiceChip label="Not replied" selected={s.unreplied} onPress={() => dispatch(setUnreplied(true))} />
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <PageHeader title="Reviews" subtitle="What your patients say" onBack={back} />
      <FlatList
        data={list.rows}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        ItemSeparatorComponent={Gap}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        renderItem={({ item }) => {
          // A reply can always be changed (the API replaces it); a deadline only applies when one is given.
          const canEdit = !!item.reply && (!item.replyEditableUntil || Date.parse(item.replyEditableUntil) > now);
          const open = () => {
            setTried(false);
            dispatch(openReply(item));
          };
          return (
            <Card padded="horizontal">
              <DoctorReviewItem
                review={item}
                doctorName="you"
                footer={!item.reply ? <TextAction label="Reply" icon="chatbubble-outline" onPress={open} /> : canEdit ? <TextAction label="Edit reply" icon="create-outline" onPress={open} /> : null}
              />
            </Card>
          );
        }}
        ListEmptyComponent={
          list.isLoading ? (
            <RowCardsSkeleton count={3} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : s.unreplied ? (
            <EmptyState ion="checkmark-done-outline" title="All answered" body="Every review has your reply." />
          ) : (
            <EmptyState ion="chatbubbles-outline" title="No reviews yet" body="Patients can review you after a completed visit." />
          )
        }
        ListFooterComponent={list.isLoadingMore ? <RowCardsSkeleton count={1} /> : null}
      />
      <Sheet
        visible={!!s.replying}
        onClose={() => dispatch(openReply(null))}
        title={s.replying?.reply ? 'Edit your reply' : 'Reply to this review'}
        footer={<Button label="Post reply" onPress={() => void send()} loading={s.status === 'loading'} fullWidth />}>
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
        {s.replying ? (
          <View style={styles.quote} accessible accessibilityLabel={`${s.replying.authorName}, ${s.replying.rating} stars: ${s.replying.text ?? ''}`}>
            <Stars rating={s.replying.rating} />
            <AppText variant="small" tone="muted">
              {s.replying.authorName}
            </AppText>
            {s.replying.text ? <AppText variant="body">{s.replying.text}</AppText> : null}
          </View>
        ) : null}
        <TextField
          label="Your reply"
          value={s.text}
          onChangeText={t => dispatch(setReplyText(t))}
          multiline
          maxLength={MAX_REPLY}
          placeholder="Thank you for your kind words."
          error={replyError}
          helper="Patients see it under the review, on your profile."
        />
      </Sheet>
    </View>
  );
};

export default MyReviews;
