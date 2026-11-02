// ═══════════════════════════════════════════════════════
// MetroMatrix — A return (the store's side)
// ═══════════════════════════════════════════════════════
// Titled cards: where it stands (ONE pill), why it's coming back (with the
// customer's photos), the items (tick what can be sold again), and your
// answer; the one step it's at is pinned at the foot: approve or decline →
// mark received → record the refund you sent (amount and reference).

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { partnerReturnStatus } from '../../models/shopping/orderStatusModel';
import { returnReasonLabel } from '../../models/shopping/returnFormModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  BagGroupSkeleton,
  Button,
  Divider,
  ImageViewer,
  InlineNotice,
  IonIcon,
  LineItemRow,
  ScreenShell,
  SectionCard,
  StatusPill,
  TextAction,
  TextField,
} from '../../Custom-Components/index';
import type { StorePartnerStackParamList } from '../../models';
import { cdn } from '../../utils/cdn/cdn';
import { formatDateTime } from '../../utils/dates/dates';
import { haptics } from '../../utils/haptics/haptics';
import { formatPKR } from '../../utils/money/money';
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
    grow: { flex: 1, gap: space.s4 },
    photos: { gap: space.s8 },
    photo: { width: size.lineThumb, height: size.lineThumb, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    two: { flexDirection: 'row', gap: space.s12 },
    check: { minWidth: size.touch, minHeight: size.touch, alignItems: 'center', justifyContent: 'center' },
    decline: { alignSelf: 'center' },
  });

const StoreReturnDetail: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <StoreReturnDetailContent {...props} />
  </ServiceScope>
);

const StoreReturnDetailContent: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'StoreReturns' });
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
      <ScreenShell title="Return" onBack={back}>
        {s.status === 'failed' ? (
          <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadStoreReturnAsync(id)) }} />
        ) : (
          <BagGroupSkeleton />
        )}
      </ScreenShell>
    );
  }

  const st = partnerReturnStatus(r.status);
  const max = r.items.reduce((n, i) => n + i.unitPrice * i.quantity, 0);

  const refundOk = !!Number(s.amount) && Number(s.amount) <= max && s.reference.trim().length >= 4;
  const footer =
    r.status === 'requested' ? (
      <>
        <Button label="Approve return" onPress={() => void step({ kind: 'approve', note: s.note }, 'Approved. The customer has your instructions.')} loading={s.busy === 'approve'} fullWidth />
        <View style={styles.decline}>
          <TextAction
            label={s.busy === 'reject' ? 'Declining…' : 'Decline'}
            tone="danger"
            disabled={s.note.trim().length < 5 || s.busy === 'reject'}
            onPress={() => void step({ kind: 'reject', note: s.note }, 'Declined. The customer has your reason.')}
            accessibilityLabel="Decline the return. Needs a note to the customer"
          />
        </View>
      </>
    ) : r.status === 'approved' ? (
      <Button label="Mark items received" onPress={() => void step({ kind: 'receive', restock: s.restock }, 'Received')} loading={s.busy === 'receive'} fullWidth />
    ) : r.status === 'received' ? (
      <Button
        label="Record refund"
        disabled={!refundOk}
        onPress={() => void step({ kind: 'refund', amount: Number(s.amount), reference: s.reference }, 'Refund recorded')}
        loading={s.busy === 'refund'}
        fullWidth
      />
    ) : undefined;

  return (
    <ScreenShell title={`Return · ${r.orderCode}`} subtitle={`${r.customerName} · ${formatDateTime(r.createdAt)}`} onBack={back} footer={footer}>
      <SectionCard title="Return status" action={<StatusPill label={st.label} tone={st.tone} />}>
        <AppText variant="small" tone="muted">
          {st.description}
        </AppText>
      </SectionCard>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}

      <SectionCard title={returnReasonLabel(r.reason)} subtitle="Why it's coming back" icon="help-circle-outline">
        {r.details ? <AppText variant="body">{r.details}</AppText> : null}
        {r.photos.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
            {r.photos.map((p, i) => (
              <Pressable key={`${p}-${i}`} onPress={() => setPhoto(p)} accessibilityRole="imagebutton" accessibilityLabel={`Customer photo ${i + 1}`}>
                <Image source={{ uri: cdn(p, { w: size.lineThumb * 2, h: size.lineThumb * 2 }) ?? undefined }} style={styles.photo} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Items"
        subtitle={r.status === 'approved' ? 'Ticked items go back on sale when you mark them received. Untick anything damaged.' : undefined}
        icon="cube-outline">
        {r.items.map((it, i) => (
          <React.Fragment key={it.id}>
            {i > 0 ? <Divider /> : null}
            <LineItemRow
              imageUrl={it.imageUrl}
              name={it.name}
              meta={[it.variantLabel, `${it.quantity} × ${formatPKR(it.unitPrice)}`].filter(Boolean).join(' · ')}
              right={
                r.status === 'approved' ? (
                  <Pressable
                    onPress={() => dispatch(toggleRestock(it.id))}
                    style={styles.check}
                    accessibilityRole="checkbox"
                    aria-checked={!!s.restock[it.id]}
                    accessibilityLabel={`Put ${it.name} back in stock`}>
                    <IonIcon name={s.restock[it.id] ? 'checkbox' : 'square-outline'} size="lg" color={s.restock[it.id] ? service.accent : colors.lineStrong} />
                  </Pressable>
                ) : null
              }
            />
          </React.Fragment>
        ))}
      </SectionCard>

      {r.storeNote ? <InlineNotice tone="info" title="Your note to the customer" message={r.storeNote} /> : null}
      {r.refund ? (
        <InlineNotice tone="success" title={`Refunded ${formatPKR(r.refund.amount)}`} message={`Reference ${r.refund.reference} · ${formatDateTime(r.refund.recordedAt)}`} />
      ) : null}

      {r.status === 'requested' ? (
        <SectionCard title="Your answer" icon="chatbubble-outline">
          <TextField
            label="Note to the customer"
            value={s.note}
            onChangeText={t => dispatch(setReturnNote(t))}
            multiline
            placeholder="Send it to our Gulberg shop by TCS; we cover the courier."
            helper="Required to decline; instructions if you approve."
          />
        </SectionCard>
      ) : null}
      {r.status === 'received' ? (
        <SectionCard title="Record the refund you sent" subtitle="Send the money from your own account first; MetroMatrix only records it." icon="cash-outline">
          <View style={styles.two}>
            <View style={styles.grow}>
              <TextField label="Amount (Rs)" mode="numeric" value={s.amount} onChangeText={t => dispatch(setRefundAmount(t))} helper={`Up to ${formatPKR(max)}`} />
            </View>
            <View style={styles.grow}>
              <TextField label="Reference" value={s.reference} onChangeText={t => dispatch(setRefundReference(t))} autoCapitalize="characters" placeholder="IBFT-5521" />
            </View>
          </View>
        </SectionCard>
      ) : null}
      <ImageViewer visible={!!photo} uri={photo} title="Customer photo" onClose={() => setPhoto(null)} />
    </ScreenShell>
  );
};

export default StoreReturnDetail;
