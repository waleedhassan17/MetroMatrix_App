// ═══════════════════════════════════════════════════════
// MetroMatrix — "I've paid" (a transfer to the store, the doctor or the kitchen)
// ═══════════════════════════════════════════════════════
// The transaction ID from the bank or wallet app (any spacing or case), and
// optionally its screenshot. The store checks it against its own account,
// then ships; the doctor checks theirs, then confirms the appointment; the
// kitchen checks, then cooks. One screen for every service: `appointmentCode`
// in the params means a doctor, `foodOrderCode` a kitchen.

import React, { useEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { validatePaymentProof } from '@models/shopping/paymentProofModel';
import { ServiceScope } from '@theme/index';
import { AppText, Button, Card, InlineNotice, PhotoStrip, ScreenShell, TextField } from '@custom/index';
import type { OrdersStackParamList } from '@/types';
import { haptics } from '@utils/haptics';
import { formatPKR } from '@utils/money';
import { pickImageFromLibrary } from '@utils/pickers';
import { selectOrderGroup } from '../OrderDetail/orderDetailSlice';
import { storedUrls, uploading } from '../shared/photoUploads';
import {
  addProofPhotoAsync,
  photoKey,
  removeProofPhoto,
  selectPaymentProof,
  setTransactionId,
  startPaymentProof,
  submitAppointmentProofAsync,
  submitFoodProofAsync,
  submitPaymentProofAsync,
  touchTransactionId,
} from './paymentProofSlice';
import { loadFoodOrderAsync, selectFoodOrderEntry } from '../../../Food/Customer/FoodOrder/foodOrderSlice';
import { selectAppointmentEntry } from '../../../Health/Patient/AppointmentDetail/appointmentDetailSlice';

type Props = NativeStackScreenProps<OrdersStackParamList, 'PaymentProof'>;

const PaymentProofScreen: React.FC<Props> = props => (
  <ServiceScope service={'appointmentCode' in props.route.params ? 'healthcare' : 'foodOrderCode' in props.route.params ? 'food' : 'shopping'}>
    <PaymentProofContent {...props} />
  </ServiceScope>
);

const PaymentProofContent: React.FC<Props> = ({ route }) => {
  const p = route.params;
  const appointmentCode = 'appointmentCode' in p ? p.appointmentCode : null;
  const foodOrderCode = 'foodOrderCode' in p ? p.foodOrderCode : null;
  const orderId = 'orderId' in p ? p.orderId : null;
  const groupCode = 'groupCode' in p ? p.groupCode : '';
  const { back } = useBack(
    appointmentCode
      ? { name: 'AppointmentDetail', params: { code: appointmentCode } }
      : foodOrderCode
        ? { name: 'FoodOrder', params: { code: foodOrderCode } }
        : { name: 'OrderDetail', params: { groupCode } },
  );
  const dispatch = useAppDispatch();
  const s = useAppSelector(selectPaymentProof);
  const order = useAppSelector(st => selectOrderGroup(st, groupCode)).group?.orders.find(o => o.id === orderId) ?? null;
  const appointment = useAppSelector(st => (appointmentCode ? selectAppointmentEntry(st, appointmentCode).appointment : null));
  const foodOrder = useAppSelector(st => (foodOrderCode ? selectFoodOrderEntry(st, foodOrderCode).order : null));
  const payee = appointmentCode ? 'the doctor' : foodOrderCode ? 'the kitchen' : 'the store';

  useEffect(() => {
    dispatch(startPaymentProof(appointmentCode ?? foodOrderCode ?? orderId ?? ''));
  }, [dispatch, orderId, appointmentCode, foodOrderCode]);

  const error = validatePaymentProof(s.transactionId).transactionId;
  const busy = uploading(s.photos);

  const addPhoto = async () => {
    const file = await pickImageFromLibrary();
    if (file) void dispatch(addProofPhotoAsync({ key: photoKey(), file }));
  };

  const submit = async () => {
    dispatch(touchTransactionId());
    if (error || busy) {
      haptics.warning();
      return;
    }
    const imageUrl = storedUrls(s.photos)[0] ?? null;
    const r = appointmentCode
      ? await dispatch(submitAppointmentProofAsync({ code: appointmentCode, transactionId: s.transactionId, imageUrl }))
      : foodOrderCode
        ? await dispatch(submitFoodProofAsync({ code: foodOrderCode, transactionId: s.transactionId, imageUrl }))
        : await dispatch(submitPaymentProofAsync({ orderId: orderId ?? '', transactionId: s.transactionId, imageUrl }));
    if (submitPaymentProofAsync.fulfilled.match(r) || submitAppointmentProofAsync.fulfilled.match(r) || submitFoodProofAsync.fulfilled.match(r)) {
      if (foodOrderCode) void dispatch(loadFoodOrderAsync(foodOrderCode));
      haptics.success();
      Toast.show({ type: 'success', text1: `Sent to ${payee}`, text2: 'They’ll confirm once they see it in their account.' });
      back();
    } else haptics.warning();
  };

  const subtitle = appointment
    ? `${appointment.doctor.name} · ${formatPKR(appointment.payment.amount)}`
    : foodOrder
      ? `${foodOrder.vendor.name} · ${formatPKR(foodOrder.totals.total)}`
      : order
        ? `${order.store.name} · ${formatPKR(order.total)}`
        : undefined;
  const rejected = appointment
    ? appointment.payment.status === 'proof_rejected'
      ? appointment.payment.proof?.rejectionReason
      : null
    : foodOrder
      ? foodOrder.payment.rejectedReason
      : order?.paymentStatus === 'proof_rejected'
        ? order.paymentProof?.rejectionReason
        : null;

  return (
    <ScreenShell
      title="I’ve paid"
      subtitle={subtitle}
      onBack={back}
      footer={<Button label={`Send to ${payee}`} onPress={() => void submit()} loading={s.status === 'loading'} disabled={busy} fullWidth />}>
      {rejected ? <InlineNotice title={`${payee === 'the store' ? 'The store' : payee === 'the kitchen' ? 'The kitchen' : 'The doctor'} couldn’t find your last payment`} message={rejected} /> : null}
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      <TextField
        label="Transaction ID"
        value={s.transactionId}
        onChangeText={t => dispatch(setTransactionId(t))}
        onBlur={() => dispatch(touchTransactionId())}
        error={s.touched ? error : undefined}
        helper="From your bank or wallet app’s receipt (TID, reference or transaction number)."
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="RX99887766"
      />
      <Card>
        <AppText variant="label">Screenshot of the receipt (optional)</AppText>
        <PhotoStrip photos={s.photos} max={1} onAdd={() => void addPhoto()} onRemove={key => dispatch(removeProofPhoto(key))} addLabel="Add the receipt" />
      </Card>
      <AppText variant="small" tone="muted">
        {appointmentCode
          ? 'MetroMatrix never holds your money: you paid the doctor directly. They check their own account, then confirm your appointment.'
          : foodOrderCode
            ? 'MetroMatrix never holds your money: you paid the kitchen directly. They check their own account, then start cooking.'
            : 'MetroMatrix never holds your money: you paid the store directly. They check their own account, then ship.'}
      </AppText>
    </ScreenShell>
  );
};

export default PaymentProofScreen;
