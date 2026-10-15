// ═══════════════════════════════════════════════════════
// MetroMatrix — A return (the store's side)
// ═══════════════════════════════════════════════════════
// What came back and why (with the customer's photos), then the one step
// it's at: approve or decline → mark received (restock what can be sold
// again) → record the refund you sent (amount and reference).

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { RETURN_STATUS } from '@models/shopping/orderStatusModel';
import { returnReasonLabel } from '@models/shopping/returnFormModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, Card, Divider, ImageViewer, InlineNotice, IonIcon, ScreenShell, SkeletonLines, StatusPill, TextField } from '@custom/index';
import type { StorePartnerStackParamList } from '@/types';
import { cdn } from '@utils/cdn';
import { formatDateTime } from '@utils/dates';
import { haptics } from '@utils/haptics';
import { formatPKR } from '@utils/money';
import {
  loadStoreReturnAsync,
  returnStepAsync,
  selectStoreReturnDetail,
  setRefundAmount,
  setRefundReference,
  setReturnNote,
  toggleRestock,
  type ReturnStep,
} from './storeReturnDetailSlice';

type Props = NativeStackScreenProps<StorePartnerStackParamList, 'StoreReturnDetail'>;

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    item: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    thumb: { width: size.thumb, aspectRatio: size.productAspect, borderRadius: radius.sm, backgroundColor: colors.surfaceSunk },
    grow: { flex: 1, gap: space.s4 },
    photos: { gap: space.s8 },
    photo: { width: size.tile, height: size.tile, borderRadius: radius.sm, backgroundColor: colors.surfaceSunk },
    two: { flexDirection: 'row', gap: space.s12 },
  });

const StoreReturnDetailScreen: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <StoreReturnDetailContent {...props} />
  </ServiceScope>
);

const StoreReturnDetailContent: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, colors, size } = useTheme();
  const s = useAppSelector(selectStoreReturnDetail);
  const [photo, setPhoto] = useState<string | null>(null);
  const { id } = route.params;
  const r = s.ret?.id === id ? s.ret : null;

  useEffect(() => {
    void dispatch(loadStoreReturnAsync(id));
  }, [dispatch, id]);

  const step = async (st: ReturnStep, done: string) => {
    const res = await dispatch(returnStepAsync({ id, step: st }));
    if (returnStepAsync.fulfilled.match(res)) {
      haptics.success();
      Toast.show({ type: 'success', text1: done });
    } else haptics.warning();
  };

  if (!r) {
    return (
      <ScreenShell title="Return" onBack={() => navigation.goBack()}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} /> : <SkeletonLines lines={8} />}
      </ScreenShell>
    );
  }

  const st = RETURN_STATUS[r.status];
  const max = r.items.reduce((n, i) => n + i.unitPrice * i.quantity, 0);

  return (
    <ScreenShell title={`Return · ${r.orderCode}`} onBack={() => navigation.goBack()}>
      <StatusPill label={st.label} tone={st.tone} />
      <AppText variant="small" tone="muted">
        {r.customerName} · {formatDateTime(r.createdAt)}
      </AppText>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}

      <Card>
        <AppText variant="title">{returnReasonLabel(r.reason)}</AppText>
        <AppText variant="body">{r.details}</AppText>
        {r.photos.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
            {r.photos.map((p, i) => (
              <Pressable key={`${p}-${i}`} onPress={() => setPhoto(p)} accessibilityRole="imagebutton" accessibilityLabel={`Customer photo ${i + 1}`}>
                <Image source={{ uri: cdn(p, { w: size.tile, h: size.tile }) ?? undefined }} style={styles.photo} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </Card>

      <Card>
        {r.items.map((it, i) => (
          <View key={it.orderItemId}>
            {i > 0 ? <Divider /> : null}
            <View style={styles.item}>
              {it.imageUrl ? <Image source={{ uri: cdn(it.imageUrl, { w: size.thumb }) ?? undefined }} style={styles.thumb} contentFit="cover" /> : <View style={styles.thumb} />}
              <View style={styles.grow}>
                <AppText variant="small" numberOfLines={2}>
                  {it.name}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {[it.variantLabel, `${it.quantity} × ${formatPKR(it.unitPrice)}`].filter(Boolean).join(' · ')}
                </AppText>
              </View>
              {r.status === 'approved' ? (
                <Pressable
                  onPress={() => dispatch(toggleRestock(it.orderItemId))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !!s.restock[it.orderItemId] }}
                  accessibilityLabel={`Put ${it.name} back in stock`}>
                  <IonIcon name={s.restock[it.orderItemId] ? 'checkbox' : 'square-outline'} size="lg" color={s.restock[it.orderItemId] ? service.accent : colors.lineStrong} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
        {r.status === 'approved' ? (
          <AppText variant="caption" tone="muted">
            Ticked items go back on sale when you mark them received. Untick anything damaged.
          </AppText>
        ) : null}
      </Card>

      {r.storeNote ? <InlineNotice tone="info" title="Your note to the customer" message={r.storeNote} /> : null}
      {r.refund ? (
        <InlineNotice tone="success" title={`Refunded ${formatPKR(r.refund.amount)}`} message={`Reference ${r.refund.reference} · ${formatDateTime(r.refund.recordedAt)}`} />
      ) : null}

      {r.status === 'requested' ? (
        <>
          <TextField
            label="Note to the customer"
            value={s.note}
            onChangeText={t => dispatch(setReturnNote(t))}
            multiline
            placeholder="Send it to our Gulberg shop by TCS; we cover the courier."
            helper="Required to decline; instructions if you approve."
          />
          <Button label="Approve return" onPress={() => void step({ kind: 'approve', note: s.note }, 'Approved. The customer has your instructions.')} loading={s.busy === 'approve'} fullWidth />
          <Button
            label="Decline"
            variant="ghost"
            disabled={s.note.trim().length < 5}
            onPress={() => void step({ kind: 'reject', note: s.note }, 'Declined. The customer has your reason.')}
            loading={s.busy === 'reject'}
            fullWidth
          />
        </>
      ) : null}
      {r.status === 'approved' ? (
        <Button label="Mark items received" onPress={() => void step({ kind: 'receive', restock: s.restock }, 'Received')} loading={s.busy === 'receive'} fullWidth />
      ) : null}
      {r.status === 'received' ? (
        <Card>
          <AppText variant="title">Record the refund you sent</AppText>
          <View style={styles.two}>
            <View style={styles.grow}>
              <TextField label="Amount (Rs)" mode="numeric" value={s.amount} onChangeText={t => dispatch(setRefundAmount(t))} helper={`Up to ${formatPKR(max)}`} />
            </View>
            <View style={styles.grow}>
              <TextField label="Reference" value={s.reference} onChangeText={t => dispatch(setRefundReference(t))} autoCapitalize="characters" placeholder="IBFT-5521" />
            </View>
          </View>
          <Button
            label="Record refund"
            disabled={!Number(s.amount) || Number(s.amount) > max || s.reference.trim().length < 4}
            onPress={() => void step({ kind: 'refund', amount: Number(s.amount), reference: s.reference }, 'Refund recorded')}
            loading={s.busy === 'refund'}
            fullWidth
          />
          <AppText variant="caption" tone="muted">
            Send the money from your own account first; MetroMatrix only records it.
          </AppText>
        </Card>
      ) : null}
      <ImageViewer visible={!!photo} uri={photo} title="Customer photo" onClose={() => setPhoto(null)} />
    </ScreenShell>
  );
};

export default StoreReturnDetailScreen;
