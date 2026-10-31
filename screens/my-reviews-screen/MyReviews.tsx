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
import { Button, ChoiceChip, Divider, DoctorReviewItem, EmptyState, InlineNotice, PageHeader, ReviewSummary, Sheet, SkeletonLines, TextAction, TextField } from '../../Custom-Components/index';
import { MAX_REPLY, validateReply } from '../../models/health/reviewFormModel';
import type { DoctorPartnerStackParamList } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import { useNow } from '../../hooks/useNow';
import { loadReviewSummaryAsync, openReply, selectMyReviews, sendReplyAsync, setReplyText, setUnreplied } from './myReviewsSlice';
import { doctorReviewPageSerializer } from '../../serializers/health/discoverySerializer';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'MyReviews'>;

const makeStyles = ({ colors, space, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    list: { paddingHorizontal: gutter, paddingBottom: space.s40 },
    head: { gap: space.s16, paddingTop: space.s20 },
    chips: { flexDirection: 'row', gap: space.s8 },
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

  useEffect(() => {
    void dispatch(loadReviewSummaryAsync());
  }, [dispatch]);

  const send = async () => {
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
      {s.summary ? <ReviewSummary summary={s.summary} /> : <SkeletonLines lines={4} />}
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
        ItemSeparatorComponent={Divider}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        renderItem={({ item }) => {
          // A reply can always be changed (the API replaces it); a deadline only applies when one is given.
          const canEdit = !!item.reply && (!item.replyEditableUntil || Date.parse(item.replyEditableUntil) > now);
          return (
            <DoctorReviewItem
              review={item}
              doctorName="you"
              footer={!item.reply ? <TextAction label="Reply" icon="chatbubble-outline" onPress={() => dispatch(openReply(item))} /> : canEdit ? <TextAction label="Edit reply" icon="create-outline" onPress={() => dispatch(openReply(item))} /> : null}
            />
          );
        }}
        ListEmptyComponent={list.isLoading ? <SkeletonLines lines={6} /> : list.error ? <InlineNotice message={list.error} /> : <EmptyState icon="message-square" title={s.unreplied ? 'All answered' : 'No reviews yet'} body="Reviews come from patients after completed visits." />}
      />
      <Sheet
        visible={!!s.replying}
        onClose={() => dispatch(openReply(null))}
        title={s.replying?.reply ? 'Edit your reply' : 'Reply to this review'}
        subtitle={s.replying?.text ?? undefined}
        footer={<Button label="Post reply" onPress={() => void send()} loading={s.status === 'loading'} disabled={!!Object.keys(validateReply(s.text)).length} fullWidth />}>
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
        <TextField label="Your reply" value={s.text} onChangeText={t => dispatch(setReplyText(t))} multiline maxLength={MAX_REPLY} placeholder="Thank you for your kind words." />
      </Sheet>
    </View>
  );
};

export default MyReviews;
