// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: rate your order
// ═══════════════════════════════════════════════════════
// Stars for the food (and for the delivery, when the kitchen's rider
// brought it), what stood out, a few words and photos. One review per
// order; it goes on the kitchen's page and the kitchen can reply.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { MAX_FOOD_REVIEW_PHOTOS, FOOD_REVIEW_TAG_LABEL, reviewTagsFor, validateFoodReview } from '../../models/food/reviewModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, Card, ChoiceChip, InlineNotice, PhotoStrip, ScreenShell, SectionCard, Skeleton, StoreHeadRow, TextField } from '../../Custom-Components/index';
import { StarInput } from '../../Custom-Components/food/StarInput';
import type { FoodAppParamList, FoodReviewInput } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import { pickImageFromLibrary } from '../../utils/pickers/pickers';
import { photoKey, storedUrls, uploading } from '../shared/photoUploads';
import { loadFoodOrderAsync, selectFoodOrderEntry } from '../food-order-screen/foodOrderSlice';
import {
  addFoodReviewPhotoAsync,
  markFoodRatingSubmitted,
  removeFoodReviewPhoto,
  selectFoodRateOrder,
  setDeliveryStars,
  setFoodReviewText,
  setFoodStars,
  startFoodRating,
  submitFoodRatingAsync,
  toggleFoodTag,
} from './foodRateOrderSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodRateOrder'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    left: { gap: space.s8 },
  });

const FoodRateOrder: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodRateOrderContent {...props} />
  </ServiceScope>
);

const FoodRateOrderContent: React.FC<Props> = ({ route }) => {
  const { code, stars } = route.params;
  const { back } = useBack({ name: 'FoodOrder', params: { code } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, size } = useTheme();
  const s = useAppSelector(selectFoodRateOrder);
  const { order: o, status } = useAppSelector(st => selectFoodOrderEntry(st, code));

  useEffect(() => {
    dispatch(startFoodRating({ code, stars }));
    if (!o) void dispatch(loadFoodOrderAsync(code));
    // Starts once for this order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, code]);

  const delivery = o?.fulfilment === 'delivery';
  const input: FoodReviewInput = {
    foodRating: s.foodRating,
    deliveryRating: delivery && s.deliveryRating ? s.deliveryRating : null,
    tags: s.tags,
    text: s.text,
    photos: storedUrls(s.photos),
  };
  const errors = s.submitted ? validateFoodReview(input) : {};
  const busy = uploading(s.photos);

  const addPhoto = async () => {
    const file = await pickImageFromLibrary();
    if (file) void dispatch(addFoodReviewPhotoAsync({ key: photoKey(), file }));
  };

  const submit = async () => {
    dispatch(markFoodRatingSubmitted());
    if (Object.keys(validateFoodReview(input)).length || busy) {
      haptics.warning();
      return;
    }
    const r = await dispatch(submitFoodRatingAsync({ code, input }));
    if (submitFoodRatingAsync.fulfilled.match(r)) {
      haptics.success();
      void dispatch(loadFoodOrderAsync(code));
      Toast.show({ type: 'success', text1: 'Thanks for rating your order', text2: o ? `It helps ${o.vendor.name}, and other customers.` : undefined });
      back();
    } else haptics.warning();
  };

  if (!o) {
    return (
      <ScreenShell title="Rate your order" subtitle={code} onBack={back}>
        {status === 'failed' ? (
          <InlineNotice message="We couldn't load this order." action={{ label: 'Try again', onPress: () => void dispatch(loadFoodOrderAsync(code)) }} />
        ) : (
          <>
            <Skeleton height={size.control.lg} shape="md" />
            <Skeleton height={size.control.lg * 2} shape="lg" />
          </>
        )}
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Rate your order"
      subtitle={code}
      onBack={back}
      footer={<Button label="Post review" onPress={() => void submit()} loading={s.status === 'loading'} disabled={busy} fullWidth />}>
      <Card>
        <StoreHeadRow
          store={{ name: o.vendor.name, logoUrl: o.vendor.logoUrl, brandColor: service.accent }}
          meta={o.items.map(i => `${i.quantity} × ${i.name}`).join(', ')}
          chevron={false}
        />
      </Card>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}

      <SectionCard title="How was it?" icon="star-outline" invalid={!!errors.foodRating || !!errors.deliveryRating}>
        <StarInput label="The food" value={s.foodRating} onChange={n => dispatch(setFoodStars(n))} error={errors.foodRating} />
        {delivery ? <StarInput label={o.handedToExternal || o.rider ? `The delivery by ${o.vendor.name}’s rider` : 'The delivery'} value={s.deliveryRating} onChange={n => dispatch(setDeliveryStars(n))} error={errors.deliveryRating} /> : null}
        <View style={styles.left}>
          <AppText variant="label">What stood out (optional)</AppText>
          <View style={styles.tags}>
            {reviewTagsFor(o.fulfilment).map(t => (
              <ChoiceChip key={t} label={FOOD_REVIEW_TAG_LABEL[t]} selected={s.tags.includes(t)} onPress={() => dispatch(toggleFoodTag(t))} />
            ))}
          </View>
        </View>
      </SectionCard>

      <SectionCard title="Tell others" subtitle={`Your first name shows with your review. ${o.vendor.name} can reply to it.`} icon="chatbox-ellipses-outline" invalid={!!errors.text}>
        <TextField
          label="A few words (optional)"
          value={s.text}
          onChangeText={t => dispatch(setFoodReviewText(t))}
          error={errors.text}
          placeholder="Tell the kitchen what you thought"
          helper="How was the taste, the portion, the packing?"
          multiline
          maxLength={1000}
        />
        <View style={styles.left}>
          <AppText variant="label">Photos (optional)</AppText>
          <PhotoStrip photos={s.photos} max={MAX_FOOD_REVIEW_PHOTOS} onAdd={() => void addPhoto()} onRemove={key => dispatch(removeFoodReviewPhoto(key))} />
        </View>
      </SectionCard>
    </ScreenShell>
  );
};

export default FoodRateOrder;
