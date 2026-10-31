// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: review moderation
// ═══════════════════════════════════════════════════════
// Patients' reviews of doctors, newest first. Hide one that breaks the rules
// (abuse, personal details, not about the visit) with a reason; a hidden
// review leaves the doctor's profile and rating. Unhide puts it back.

import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { usePagedList } from '../../hooks/usePagedList';
import { getReviewsForModerationAPI } from '../../networks/admin/adminHealthNetwork';
import { useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, ChoiceChip, DoctorReviewItem, EmptyState, InlineNotice, ScreenShell, SegmentTabs, Sheet, SkeletonLines, TextField } from '../../Custom-Components/index';
import { validateHideReason } from '../../models/health/adminHealthModel';
import type { AdminHealthStackParamList, DoctorReview } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import { moderateReviewAsync, openHide, selectReviewModeration, setHideReason, setShowHidden, touchHideReason } from './reviewModerationSlice';
import { doctorReviewPageSerializer } from '../../serializers/health/discoverySerializer';

type Props = NativeStackScreenProps<AdminHealthStackParamList, 'ReviewModeration'>;

const SEGMENTS: { key: 'visible' | 'hidden'; label: string }[] = [
  { key: 'visible', label: 'On profiles' },
  { key: 'hidden', label: 'Hidden' },
];

/** Quick reasons; staff can write their own. */
const REASONS = ['Abusive language', 'Shares personal details', 'Not about the visit', 'Advertising or spam'];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s12, paddingTop: space.s4, paddingBottom: space.s40 },
    about: { paddingTop: space.s4 },
    actions: { flexDirection: 'row', gap: space.s12 },
    reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const ReviewModeration: React.FC<Props> = () => {
  const { back } = useBack({ name: 'HealthOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectReviewModeration);
  const list = usePagedList((page, size) => getReviewsForModerationAPI(s.hidden, page, size), doctorReviewPageSerializer, `modreviews|${s.hidden}`);
  const reasonError = s.reasonTouched ? validateHideReason(s.reason).reason : undefined;

  const moderate = async (r: DoctorReview, hide: boolean) => {
    if (hide && Object.keys(validateHideReason(s.reason)).length) {
      dispatch(touchHideReason());
      haptics.warning();
      return;
    }
    const res = await dispatch(moderateReviewAsync({ id: r.id, hide, reason: hide ? s.reason : null }));
    if (moderateReviewAsync.fulfilled.match(res)) {
      haptics.success();
      list.setRows(rows => rows.filter(x => x.id !== r.id));
      Toast.show({ type: 'success', text1: hide ? 'Review hidden' : 'Review back on the profile', text2: hide ? "It no longer counts toward the doctor's rating." : undefined });
    } else haptics.warning();
  };

  const hiding = list.rows.find(r => r.id === s.hiding) ?? null;

  return (
    <ScreenShell
      title="Reviews"
      subtitle="Health · what patients say about doctors"
      onBack={back}
      scroll={false}
      headerContent={<SegmentTabs options={SEGMENTS} value={s.hidden ? 'hidden' : 'visible'} onChange={k => dispatch(setShowHidden(k === 'hidden'))} accessibilityLabel="Reviews" />}>
      {s.error.message && !s.hiding ? <InlineNotice message={s.error.message} /> : null}
      <FlatList
        data={list.rows}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        onEndReached={list.loadMore}
        renderItem={({ item: r }) => (
          <Card>
            {r.doctorName ? (
              <AppText variant="caption" tone="muted" style={styles.about}>
                About {r.doctorName}
              </AppText>
            ) : null}
            <DoctorReviewItem
              review={r}
              doctorName={r.doctorName ?? undefined}
              footer={
                <View style={styles.actions}>
                  {r.isHidden ? (
                    <Button label="Unhide" variant="secondary" onPress={() => void moderate(r, false)} loading={s.busy === r.id} />
                  ) : (
                    <Button label="Hide" variant="secondary" leftIcon="eye-off-outline" onPress={() => dispatch(openHide(r.id))} />
                  )}
                </View>
              }
            />
          </Card>
        )}
        ListEmptyComponent={
          list.isLoading ? (
            <SkeletonLines lines={6} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState icon="message-square" title={s.hidden ? 'Nothing hidden' : 'No reviews yet'} body="Patients' reviews of doctors show here." />
          )
        }
      />
      <Sheet
        visible={!!s.hiding}
        onClose={() => dispatch(openHide(null))}
        title="Hide this review?"
        subtitle="It leaves the doctor's profile and rating. The doctor is not told who hid it."
        footer={<Button label="Hide review" variant="destructive" loading={!!s.busy} onPress={() => hiding && void moderate(hiding, true)} fullWidth />}>
        <View style={styles.reasons}>
          {REASONS.map(reason => (
            <ChoiceChip key={reason} label={reason} selected={s.reason === reason} onPress={() => dispatch(setHideReason(reason))} />
          ))}
        </View>
        <TextField label="Reason" value={s.reason} onChangeText={t => dispatch(setHideReason(t))} multiline placeholder="Why it breaks the rules" error={reasonError} helper="Kept with the review for other staff." />
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      </Sheet>
    </ScreenShell>
  );
};

export default ReviewModeration;
