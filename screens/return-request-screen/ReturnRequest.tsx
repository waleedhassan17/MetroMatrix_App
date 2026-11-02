// ═══════════════════════════════════════════════════════
// MetroMatrix — Return items
// ═══════════════════════════════════════════════════════
// Choose the items (and how many), say why and what happened, add photos if
// it arrived damaged or wrong. The store approves, you send it back, they
// refund you directly.

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { MAX_RETURN_PHOTOS, RETURN_REASONS, returnDaysLeft, validateReturn } from '../../models/shopping/returnFormModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  Button,
  BagGroupSkeleton,
  ChoiceChip,
  Divider,
  InlineNotice,
  IonIcon,
  LineItemRow,
  PhotoStrip,
  QuantityStepper,
  ScreenShell,
  SectionCard,
  TextField,
} from '../../Custom-Components/index';
import type { OrdersStackParamList, ReturnInput } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import { pickImageFromLibrary } from '../../utils/pickers/pickers';
import { loadOrderGroupAsync, selectOrderGroup } from '../order-detail-screen/orderDetailSlice';
import { photoKey, storedUrls, uploading } from '../shared/photoUploads';
import {
  addReturnPhotoAsync,
  markReturnSubmitted,
  removeReturnPhoto,
  selectReturnRequest,
  setReturnDetails,
  setReturnQuantity,
  setReturnReason,
  startReturn,
  submitReturnAsync,
} from './returnRequestSlice';

type Props = NativeStackScreenProps<OrdersStackParamList, 'ReturnRequest'>;

const makeStyles = ({ space, size }: Theme) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    check: { minWidth: size.touch, minHeight: size.touch, alignItems: 'center', justifyContent: 'center' },
  });

const ReturnRequest: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <ReturnRequestContent {...props} />
  </ServiceScope>
);

const ReturnRequestContent: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'OrderDetail', params: { groupCode: route.params.groupCode } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  const { orderId, groupCode } = route.params;
  const s = useAppSelector(selectReturnRequest);
  const order = useAppSelector(st => selectOrderGroup(st, groupCode)).group?.orders.find(o => o.id === orderId) ?? null;

  useEffect(() => {
    dispatch(startReturn(orderId));
  }, [dispatch, orderId]);

  if (!order) {
    return (
      <ScreenShell title="Return items" onBack={back}>
        <BagGroupSkeleton />
      </ScreenShell>
    );
  }

  const items = order.items.filter(i => i.returnableQuantity > 0);
  const input: ReturnInput = {
    items: Object.entries(s.quantities)
      .filter(([, q]) => q > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
    reason: s.reason ?? 'other',
    details: s.details,
    photos: storedUrls(s.photos),
  };
  const errors = { ...validateReturn(input, order.items), ...(s.reason ? {} : { reason: 'Choose a reason' }) };
  const show = (k: string) => (s.submitted ? (errors as Record<string, string>)[k] : undefined);
  const days = returnDaysLeft(order.returnWindowEndsAt);
  const busy = uploading(s.photos);

  const addPhoto = async () => {
    const file = await pickImageFromLibrary();
    if (file) void dispatch(addReturnPhotoAsync({ key: photoKey(), file }));
  };

  const submit = async () => {
    dispatch(markReturnSubmitted());
    if (Object.keys(errors).length || busy) {
      haptics.warning();
      return;
    }
    const r = await dispatch(submitReturnAsync({ orderId, input }));
    if (submitReturnAsync.fulfilled.match(r)) {
      haptics.success();
      void dispatch(loadOrderGroupAsync(groupCode));
      Toast.show({ type: 'success', text1: 'Return requested', text2: `${order.store.name} will reply soon.` });
      back();
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title="Return items"
      subtitle={`${order.store.name}${days !== null && days >= 0 ? ` · ${days === 0 ? 'last day to return' : `${days} days left to return`}` : ''}`}
      onBack={back}
      footer={<Button label="Request return" onPress={() => void submit()} loading={s.status === 'loading'} disabled={busy} fullWidth />}>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}

      <SectionCard title="Which items?" subtitle="Tick each one you're sending back." icon="cube-outline" invalid={!!show('items')}>
        {items.map((it, i) => {
          const q = s.quantities[it.id] ?? 0;
          return (
            <React.Fragment key={it.id}>
              {i > 0 ? <Divider /> : null}
              <LineItemRow
                imageUrl={it.imageUrl}
                name={it.name}
                meta={it.variantLabel || null}
                right={
                  <Pressable
                    onPress={() => dispatch(setReturnQuantity({ itemId: it.id, quantity: q ? 0 : it.returnableQuantity }))}
                    style={styles.check}
                    accessibilityRole="checkbox"
                    aria-checked={q > 0}
                    accessibilityLabel={`Return ${it.name}`}>
                    <IonIcon name={q ? 'checkbox' : 'square-outline'} size="lg" color={q ? service.accent : colors.lineStrong} />
                  </Pressable>
                }>
                {q > 0 && it.returnableQuantity > 1 ? (
                  <QuantityStepper
                    value={q}
                    min={1}
                    max={it.returnableQuantity}
                    onChange={n => dispatch(setReturnQuantity({ itemId: it.id, quantity: n }))}
                    label={`How many ${it.name} to return`}
                  />
                ) : null}
              </LineItemRow>
            </React.Fragment>
          );
        })}
        {show('items') ? (
          <AppText variant="small" tone="danger">
            {show('items')}
          </AppText>
        ) : null}
      </SectionCard>

      <SectionCard title="Why are you returning it?" icon="help-circle-outline" invalid={!!show('reason')}>
        <View style={styles.chips}>
          {RETURN_REASONS.map(r => (
            <ChoiceChip key={r.key} label={r.label} selected={s.reason === r.key} onPress={() => dispatch(setReturnReason(r.key))} />
          ))}
        </View>
        {show('reason') ? (
          <AppText variant="small" tone="danger">
            {show('reason')}
          </AppText>
        ) : null}
        <TextField
          label="What happened?"
          value={s.details}
          onChangeText={t => dispatch(setReturnDetails(t))}
          error={show('details')}
          multiline
          helper="The store reads this before approving."
        />
      </SectionCard>

      <SectionCard title="Photos" subtitle="Helpful if it arrived damaged or wrong." icon="camera-outline">
        <PhotoStrip photos={s.photos} max={MAX_RETURN_PHOTOS} onAdd={() => void addPhoto()} onRemove={key => dispatch(removeReturnPhoto(key))} />
      </SectionCard>
    </ScreenShell>
  );
};

export default ReturnRequest;
