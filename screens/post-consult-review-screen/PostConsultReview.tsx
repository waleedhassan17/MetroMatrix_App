// ═══════════════════════════════════════════════════════
// MetroMatrix — Rate your visit
// ═══════════════════════════════════════════════════════
// Overall stars, would you recommend the doctor, the parts of the visit
// (diagnosis; staff and the clinic for clinic visits), tags, a few words —
// posted with your initials unless you choose your name. Skippable; it's
// waiting on the appointment until you do it.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, ChoiceChip, InlineNotice, ScreenShell, SkeletonLines, StarInput, TextField, ToggleRow } from '../../Custom-Components/index';
import { MAX_REVIEW_TEXT, RATING_WORDS, REVIEW_TAGS, dimensionsFor, validateDoctorReview } from '../../models/health/reviewFormModel';
import type { OrdersStackParamList } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import { appointmentReceived, loadAppointmentAsync, selectAppointmentEntry } from '../appointment-detail-screen/appointmentDetailSlice';
import {
  selectVisitReview,
  setAnonymous,
  setDimension,
  setRecommend,
  setReviewText,
  setVisitRating,
  startVisitReview,
  submitVisitReviewAsync,
  toggleReviewTag,
} from './postConsultReviewSlice';

type Props = NativeStackScreenProps<OrdersStackParamList, 'PostConsultReview'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    group: { gap: space.s8 },
    center: { alignItems: 'center', gap: space.s4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    dim: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.s8 },
  });

const PostConsultReview: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <PostConsultReviewContent {...props} />
  </ServiceScope>
);

const PostConsultReviewContent: React.FC<Props> = ({ route }) => {
  const { code } = route.params;
  const { back } = useBack({ name: 'AppointmentDetail', params: { code } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVisitReview);
  const entry = useAppSelector(st => selectAppointmentEntry(st, code));
  const a = entry.appointment;
  const errors = validateDoctorReview(s.form);

  useEffect(() => {
    dispatch(startVisitReview(code));
    if (!a) void dispatch(loadAppointmentAsync(code));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, code]);

  const submit = async () => {
    if (Object.keys(errors).length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(submitVisitReviewAsync({ code, form: s.form }));
    if (submitVisitReviewAsync.fulfilled.match(r)) {
      dispatch(appointmentReceived(r.payload));
      haptics.success();
      Toast.show({ type: 'success', text1: 'Thank you for your review', text2: 'It helps other patients choose.' });
      back();
    } else haptics.warning();
  };

  if (!a) {
    return (
      <ScreenShell title="Rate your visit" onBack={back}>
        {entry.status === 'failed' ? <InlineNotice message={entry.error.message} /> : <SkeletonLines lines={8} />}
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Rate your visit"
      subtitle={`${a.doctor.name} · ${a.kind === 'video' ? 'Video consultation' : a.location.name}`}
      onBack={back}
      footer={<Button label="Post review" onPress={() => void submit()} loading={s.status === 'loading'} disabled={!s.form.rating} fullWidth />}>
      {a.reviewed ? <InlineNotice tone="info" message="You have already rated this visit. Thank you." /> : null}
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      <View style={styles.center}>
        <StarInput value={s.form.rating} onChange={n => dispatch(setVisitRating(n))} label="Overall" words={RATING_WORDS} />
        <AppText variant="small" tone="muted">
          {s.form.rating ? RATING_WORDS[s.form.rating] : 'Tap a star'}
        </AppText>
      </View>
      <View style={styles.group}>
        <AppText variant="label">Would you recommend this doctor?</AppText>
        <View style={styles.chips}>
          <ChoiceChip label="Yes" selected={s.form.recommend} onPress={() => dispatch(setRecommend(true))} />
          <ChoiceChip label="No" selected={!s.form.recommend} onPress={() => dispatch(setRecommend(false))} />
        </View>
      </View>
      {dimensionsFor(a.kind).map(d => (
        <View key={d.key} style={styles.dim}>
          <AppText variant="body">{d.label}</AppText>
          <StarInput value={s.form.dimensions[d.key] ?? 0} onChange={n => dispatch(setDimension({ key: d.key, value: n }))} label={d.label} size="lg" />
        </View>
      ))}
      <View style={styles.group}>
        <AppText variant="label">What stood out (optional)</AppText>
        <View style={styles.chips}>
          {REVIEW_TAGS.filter(t => a.kind === 'clinic' || (t !== 'Clean clinic' && t !== 'Friendly staff')).map(t => (
            <ChoiceChip key={t} label={t} selected={s.form.tags.includes(t)} onPress={() => dispatch(toggleReviewTag(t))} />
          ))}
        </View>
      </View>
      <TextField
        label="Your review (optional)"
        value={s.form.text ?? ''}
        onChangeText={t => dispatch(setReviewText(t))}
        multiline
        maxLength={MAX_REVIEW_TEXT}
        error={s.touched ? errors.text : undefined}
        placeholder="How was the consultation?"
      />
      <ToggleRow
        label="Post anonymously"
        helper={s.form.anonymous ? 'Shown with your initials only.' : 'Shown with your name.'}
        value={s.form.anonymous}
        onChange={v => dispatch(setAnonymous(v))}
      />
      <Button label="Not now" variant="ghost" onPress={back} fullWidth />
    </ScreenShell>
  );
};

export default PostConsultReview;
