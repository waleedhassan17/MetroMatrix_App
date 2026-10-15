// ═══════════════════════════════════════════════════════
// MetroMatrix — "I've paid" (a transfer to the store)
// ═══════════════════════════════════════════════════════
// The transaction ID from the bank or wallet app (any spacing or case), and
// optionally its screenshot. The store checks it against its own account,
// then ships.

import React, { useEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
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
  submitPaymentProofAsync,
  touchTransactionId,
} from './paymentProofSlice';

type Props = NativeStackScreenProps<OrdersStackParamList, 'PaymentProof'>;

const PaymentProofScreen: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <PaymentProofContent {...props} />
  </ServiceScope>
);

const PaymentProofContent: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const { orderId, groupCode } = route.params;
  const s = useAppSelector(selectPaymentProof);
  const order = useAppSelector(st => selectOrderGroup(st, groupCode)).group?.orders.find(o => o.id === orderId) ?? null;

  useEffect(() => {
    dispatch(startPaymentProof(orderId));
  }, [dispatch, orderId]);

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
    const r = await dispatch(submitPaymentProofAsync({ orderId, transactionId: s.transactionId, imageUrl: storedUrls(s.photos)[0] ?? null }));
    if (submitPaymentProofAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Sent to the store', text2: 'They’ll confirm once they see it in their account.' });
      navigation.goBack();
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title="I’ve paid"
      subtitle={order ? `${order.store.name} · ${formatPKR(order.total)}` : undefined}
      onBack={() => navigation.goBack()}
      footer={<Button label="Send to the store" onPress={() => void submit()} loading={s.status === 'loading'} disabled={busy} fullWidth />}>
      {order?.paymentProof?.rejectionReason && order.paymentStatus === 'proof_rejected' ? (
        <InlineNotice title="The store couldn’t find your last payment" message={order.paymentProof.rejectionReason} />
      ) : null}
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
        MetroMatrix never holds your money: you paid the store directly. They check their own account, then ship.
      </AppText>
    </ScreenShell>
  );
};

export default PaymentProofScreen;
