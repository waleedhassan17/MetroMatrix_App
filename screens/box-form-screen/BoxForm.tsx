// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen: make a Bachat Box
// ═══════════════════════════════════════════════════════
// Tonight's surplus, sold for pickup at a lower price: a short name, roughly
// what is inside, what it is worth and what it costs (at least 20% less),
// how many boxes, and the pickup window today. From the end-of-day
// suggestion it arrives filled in to check. A photo helps but is optional.

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector, useAppStore } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { BACHAT_BOX, MAX_BOX_QUANTITY, boxInput, discountLabel, pickupTimes, validateBox, withPickupFrom } from '../../models/kitchen/surplusModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, BottomSheetPicker, Button, Card, IconButton, InlineNotice, ScreenShell, SkeletonLines, TextAction, TextField } from '../../Custom-Components/index';
import type { FoodVendorStackParamList } from '../../models';
import { formatSlot } from '../../utils/health-time/healthTime';
import { formatPKR, parseRupees } from '../../utils/money/money';
import { pickImageFromLibrary, takePhoto } from '../../utils/pickers/pickers';
import { haptics } from '../../utils/haptics/haptics';
import { createBoxAsync, editBoxForm, selectBoxForm, setBoxErrors, startBoxForm, suggestBoxAsync, uploadBoxPhotoAsync } from './boxFormSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenBoxForm'>;

const TZ = 'Asia/Karachi';

const BASIS: Record<string, string> = {
  portions_left: 'From the portions you have left today. Check the numbers before it goes up.',
  end_of_day: 'A mix of today’s popular dishes. Change it to what you actually have left.',
};

const makeStyles = ({ space, radius, colors, size }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    two: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1, flexBasis: 0, minWidth: 0 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    photo: { width: '100%', aspectRatio: size.railPhotoAspect, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    photoActions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s16 },
    times: { flexDirection: 'row', gap: space.s12 },
  });

const BoxForm: React.FC<Props> = props => (
  <ServiceScope service="food">
    <BoxFormContent {...props} />
  </ServiceScope>
);

const BoxFormContent: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'KitchenWaste' });
  const dispatch = useAppDispatch();
  const appStore = useAppStore();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectBoxForm);
  const f = s.form;
  const suggest = !!route.params?.suggest;
  const [timeFor, setTimeFor] = useState<'from' | 'to' | null>(null);
  const [opened] = useState(() => Date.now());
  const times = useMemo(() => pickupTimes(opened, TZ), [opened]);

  useEffect(() => {
    dispatch(startBoxForm(Date.now()));
    if (suggest) void dispatch(suggestBoxAsync());
  }, [dispatch, suggest]);

  const value = parseRupees(f.value);
  const price = parseRupees(f.price);
  const saving = value && price && price < value ? discountLabel(value, price) : null;

  const addPhoto = async (how: 'camera' | 'library') => {
    const file = how === 'camera' ? await takePhoto() : await pickImageFromLibrary();
    if (file) void dispatch(uploadBoxPhotoAsync(file));
  };

  const save = async () => {
    const errors = validateBox(f, Date.now());
    if (Object.keys(errors).length) {
      dispatch(setBoxErrors(errors));
      haptics.warning();
      return;
    }
    const r = await dispatch(createBoxAsync(boxInput(f)));
    const box = createBoxAsync.fulfilled.match(r) ? selectBoxForm(appStore.getState()).created : null;
    if (box) {
      haptics.success();
      Toast.show({ type: 'success', text1: `${BACHAT_BOX} is live`, text2: `Customers nearby can reserve it until ${formatSlot(box.pickupTo, TZ)}.` });
      navigation.replace('KitchenBox', { id: box.id });
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title={`Make a ${BACHAT_BOX}`}
      subtitle="Tonight’s food at a lower price, for pickup"
      onBack={back}
      footer={<Button label="Put it up" onPress={() => void save()} loading={s.saving} disabled={s.uploading} fullWidth />}>
      {s.suggesting === 'loading' ? <SkeletonLines lines={3} /> : null}
      {s.basis ? <InlineNotice tone="info" title="Suggested for tonight" message={BASIS[s.basis] ?? BASIS.end_of_day} /> : null}
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}

      <TextField label="Name" value={f.title} onChangeText={title => dispatch(editBoxForm({ title }))} placeholder="Tonight’s handi box" maxLength={60} error={s.errors.title} />
      <TextField
        label="Roughly what is inside"
        value={f.contentsHint}
        onChangeText={contentsHint => dispatch(editBoxForm({ contentsHint }))}
        placeholder="Some of today’s biryani, karahi and naan"
        maxLength={200}
        multiline
        error={s.errors.contentsHint}
        helper="Customers know it is a surprise: say what it usually is."
      />

      <View style={styles.two}>
        <View style={styles.half}>
          <TextField label="Worth (Rs)" value={f.value} onChangeText={v => dispatch(editBoxForm({ value: v }))} keyboardType="number-pad" placeholder="1,200" error={s.errors.value} />
        </View>
        <View style={styles.half}>
          <TextField label="Box price (Rs)" value={f.price} onChangeText={p => dispatch(editBoxForm({ price: p }))} keyboardType="number-pad" placeholder="450" error={s.errors.price} />
        </View>
      </View>
      {saving ? (
        <AppText variant="small" tone="success">
          {`${saving}: customers pay ${formatPKR(price!)} for ${formatPKR(value!)} of food.`}
        </AppText>
      ) : (
        <AppText variant="small" tone="muted">
          At least 20% under what the food would usually cost.
        </AppText>
      )}

      <Card>
        <View style={styles.row}>
          <View>
            <AppText variant="title">Boxes</AppText>
            <AppText variant="caption" tone="muted">
              Up to 2 per customer
            </AppText>
          </View>
          <View style={styles.stepper}>
            <IconButton icon="remove" tone="muted" onPress={() => dispatch(editBoxForm({ quantity: Math.max(1, f.quantity - 1) }))} disabled={f.quantity <= 1} accessibilityLabel="One box fewer" />
            <AppText variant="h2" accessibilityLabel={`${f.quantity} boxes`}>
              {String(f.quantity)}
            </AppText>
            <IconButton icon="add" tone="muted" onPress={() => dispatch(editBoxForm({ quantity: Math.min(MAX_BOX_QUANTITY, f.quantity + 1) }))} disabled={f.quantity >= MAX_BOX_QUANTITY} accessibilityLabel="One box more" />
          </View>
        </View>
        {s.errors.quantity ? (
          <AppText variant="small" tone="danger">
            {s.errors.quantity}
          </AppText>
        ) : null}
      </Card>

      <Card>
        <View style={styles.gap}>
          <AppText variant="title">Pickup today</AppText>
          <View style={styles.times}>
            <View style={styles.half}>
              <Button label={`From ${formatSlot(f.pickupFrom, TZ)}`} variant="secondary" onPress={() => setTimeFor('from')} fullWidth />
            </View>
            <View style={styles.half}>
              <Button label={`Until ${formatSlot(f.pickupTo, TZ)}`} variant="secondary" onPress={() => setTimeFor('to')} fullWidth />
            </View>
          </View>
          {s.errors.pickupTo ? (
            <AppText variant="small" tone="danger">
              {s.errors.pickupTo}
            </AppText>
          ) : (
            <AppText variant="caption" tone="muted">
              Customers can reserve until the window ends. Anyone who hasn’t come an hour after it is marked as a no-show.
            </AppText>
          )}
        </View>
      </Card>

      <Card>
        <View style={styles.gap}>
          <AppText variant="title">Photo (optional)</AppText>
          {f.photoUrl ? <Image source={{ uri: f.photoUrl }} style={styles.photo} contentFit="cover" accessibilityLabel="The box’s photo" /> : null}
          {s.uploading ? <SkeletonLines lines={1} /> : null}
          <View style={styles.photoActions}>
            <TextAction label={f.photoUrl ? 'Retake' : 'Take a photo'} icon="camera-outline" onPress={() => void addPhoto('camera')} disabled={s.uploading} />
            <TextAction label="From your photos" icon="image-outline" onPress={() => void addPhoto('library')} disabled={s.uploading} />
            {f.photoUrl ? <TextAction label="Remove" tone="muted" onPress={() => dispatch(editBoxForm({ photoUrl: null }))} /> : null}
          </View>
        </View>
      </Card>

      <BottomSheetPicker
        visible={!!timeFor}
        onClose={() => setTimeFor(null)}
        title={timeFor === 'from' ? 'Pickup from' : 'Pickup until'}
        options={times.filter(t => timeFor !== 'to' || Date.parse(t.iso) > Date.parse(f.pickupFrom)).map(t => ({ value: t.iso, label: t.label }))}
        value={timeFor === 'from' ? f.pickupFrom : timeFor === 'to' ? f.pickupTo : null}
        onSelect={iso => {
          dispatch(editBoxForm(timeFor === 'from' ? withPickupFrom(f, iso, TZ, Date.now()) : { pickupTo: iso }));
          setTimeFor(null);
        }}
      />
    </ScreenShell>
  );
};

export default BoxForm;
