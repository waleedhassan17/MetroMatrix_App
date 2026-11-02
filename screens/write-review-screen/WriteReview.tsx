// ═══════════════════════════════════════════════════════
// MetroMatrix — Review an item you received
// ═══════════════════════════════════════════════════════
// Stars (each tap a small tick), a word for the rating, a few lines or a
// photo. One review per item; the store can reply under it.

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { MAX_REVIEW_PHOTOS, RATING_WORDS, validateReview } from '../../models/shopping/reviewFormModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  Button,
  Card,
  InlineNotice,
  IonIcon,
  LineItemRow,
  PhotoStrip,
  RowCardSkeleton,
  ScreenShell,
  SectionCard,
  TextField,
} from '../../Custom-Components/index';
import type { OrdersStackParamList, ReviewInput } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import { pickImageFromLibrary } from '../../utils/pickers/pickers';
import { loadOrderGroupAsync, selectOrderGroup } from '../order-detail-screen/orderDetailSlice';
import { photoKey, storedUrls, uploading } from '../shared/photoUploads';
import {
  addReviewPhotoAsync,
  markReviewSubmitted,
  removeReviewPhoto,
  selectWriteReview,
  setRating,
  setReviewBody,
  setReviewTitle,
  startReview,
  submitReviewAsync,
} from './writeReviewSlice';

type Props = NativeStackScreenProps<OrdersStackParamList, 'WriteReview'>;

const makeStyles = ({ space, size }: Theme) =>
  StyleSheet.create({
    stars: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    star: { minWidth: size.touch, minHeight: size.touch, alignItems: 'center', justifyContent: 'center' },
    group: { gap: space.s8, alignItems: 'center' },
  });

const WriteReview: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <WriteReviewContent {...props} />
  </ServiceScope>
);

const WriteReviewContent: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'OrderDetail', params: { groupCode: route.params.groupCode } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { orderId, itemId, groupCode } = route.params;
  const s = useAppSelector(selectWriteReview);
  const order = useAppSelector(st => selectOrderGroup(st, groupCode)).group?.orders.find(o => o.id === orderId) ?? null;
  const item = order?.items.find(i => i.id === itemId) ?? null;

  useEffect(() => {
    dispatch(startReview(itemId));
  }, [dispatch, itemId]);

  const input: ReviewInput = { rating: s.rating, title: s.title.trim() || null, body: s.body.trim(), photos: storedUrls(s.photos) };
  const errors = validateReview(input);
  const busy = uploading(s.photos);

  const addPhoto = async () => {
    const file = await pickImageFromLibrary();
    if (file) void dispatch(addReviewPhotoAsync({ key: photoKey(), file }));
  };

  const submit = async () => {
    dispatch(markReviewSubmitted());
    if (Object.keys(errors).length || busy) {
      haptics.warning();
      return;
    }
    const r = await dispatch(submitReviewAsync({ itemId, input }));
    if (submitReviewAsync.fulfilled.match(r)) {
      haptics.success();
      void dispatch(loadOrderGroupAsync(groupCode));
      Toast.show({ type: 'success', text1: 'Thanks for your review', text2: 'It helps other shoppers, and the store.' });
      back();
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title="Write a review"
      onBack={back}
      footer={<Button label="Post review" onPress={() => void submit()} loading={s.status === 'loading'} disabled={busy} fullWidth />}>
      {item ? (
        <Card>
          <LineItemRow imageUrl={item.imageUrl} name={item.name} meta={[item.variantLabel, order?.store.name].filter(Boolean).join(' · ')} />
        </Card>
      ) : (
        <RowCardSkeleton />
      )}
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}

      <SectionCard title="Your rating" icon="star-outline" invalid={s.submitted && !!errors.rating}>
        <View style={styles.group}>
          <View style={styles.stars} accessibilityRole="adjustable" accessibilityLabel="Rating" accessibilityValue={{ min: 0, max: 5, now: s.rating }}>
            {[1, 2, 3, 4, 5].map(n => (
              <Pressable
                key={n}
                onPress={() => {
                  haptics.press();
                  dispatch(setRating(n));
                }}
                style={styles.star}
                accessibilityRole="button"
                accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}, ${RATING_WORDS[n]}`}
                aria-selected={s.rating === n}>
                <IonIcon name={n <= s.rating ? 'star' : 'star-outline'} size="xl" color={n <= s.rating ? colors.star : colors.lineStrong} />
              </Pressable>
            ))}
          </View>
          <AppText variant="bodyStrong" tone={s.submitted && errors.rating ? 'danger' : 'muted'}>
            {s.rating ? RATING_WORDS[s.rating] : s.submitted && errors.rating ? errors.rating : 'Tap to rate'}
          </AppText>
        </View>
      </SectionCard>

      <SectionCard title="Your review" icon="create-outline">
        <TextField label="Headline (optional)" value={s.title} onChangeText={t => dispatch(setReviewTitle(t))} placeholder="Sum it up in a few words" maxLength={80} />
        <TextField
          label="Your review"
          value={s.body}
          onChangeText={t => dispatch(setReviewBody(t))}
          error={s.submitted ? errors.body : undefined}
          helper="How was the fit, the quality, the delivery?"
          multiline
          maxLength={1000}
        />
      </SectionCard>

      <SectionCard title="Photos" subtitle="Optional. Show the fit or the finish." icon="camera-outline">
        <PhotoStrip photos={s.photos} max={MAX_REVIEW_PHOTOS} onAdd={() => void addPhoto()} onRemove={key => dispatch(removeReviewPhoto(key))} />
      </SectionCard>
    </ScreenShell>
  );
};

export default WriteReview;
