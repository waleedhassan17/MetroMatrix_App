// ═══════════════════════════════════════════════════════
// MetroMatrix — Checkout's three steps (beside Checkout.tsx)
// ═══════════════════════════════════════════════════════
// Each step is a column of section cards: where it goes; how each store is
// paid (the method, a coupon of theirs, a note); then the whole order with
// its photos and totals, each part with a way back to change it. The store's
// name appears once per card, in its head row. Checkout owns the state; these
// only draw it and call back.

import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  Card,
  Divider,
  IconButton,
  InlineNotice,
  IonIcon,
  LineItemRow,
  MoneyRows,
  PaymentMethodPicker,
  SectionCard,
  StoreHeadRow,
  TextAction,
  TextField,
} from '../../Custom-Components/index';
import { formatAddress } from '../../models/addressModel';
import { PAYMENT_METHOD_LABEL } from '../../models/shopping/orderStatusModel';
import type { Address, CheckoutPreview, PaymentMethod, PreviewStore } from '../../models';
import { formatPKR } from '../../utils/money/money';
import { formatPkPhoneForDisplay } from '../../utils/phone/phone';
import type { StoreCheckoutChoice } from './checkoutSlice';

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    stack: { gap: space.s16 },
    address: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s12,
      padding: space.s12,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderColor: colors.line,
    },
    grow: { flex: 1, gap: space.s4 },
    coupon: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s8,
      paddingLeft: space.s12,
      minHeight: size.control.md,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderStyle: 'dashed',
    },
    couponAdd: { paddingRight: space.s12 },
    summary: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
  });

const shipsIn = (ps: PreviewStore) =>
  ps.dispatchMaxDays > 0
    ? `Ships in ${ps.dispatchMinDays === ps.dispatchMaxDays ? ps.dispatchMaxDays : `${ps.dispatchMinDays}–${ps.dispatchMaxDays}`} days`
    : null;

// ─── 1 · Deliver to ───────────────────────────────────
export const AddressStep: React.FC<{
  addresses: Address[];
  chosenId: string | null;
  onChoose: (id: string) => void;
  onAdd: () => void;
  preview: CheckoutPreview | null;
}> = ({ addresses, chosenId, onChoose, onAdd, preview }) => {
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  const unserved = preview?.stores.filter(s => s.error?.code === 'CITY_NOT_SERVED') ?? [];
  return (
    <SectionCard title="Deliver to" subtitle="Each store delivers its own items here." icon="location-outline">
      {addresses.length ? (
        <View style={styles.stack} accessibilityRole="radiogroup" accessibilityLabel="Deliver to">
          {addresses.map(a => {
            const on = a.id === chosenId;
            return (
              <Pressable
                key={a.id}
                onPress={() => onChoose(a.id)}
                accessibilityRole="radio"
                aria-checked={on}
                accessibilityLabel={`${a.fullName}, ${formatAddress(a)}`}
                style={[styles.address, on && { borderColor: service.accent, backgroundColor: service.accentSoft }]}>
                <View style={styles.grow}>
                  <AppText variant="bodyStrong">{a.fullName}</AppText>
                  <AppText variant="small" tone="muted">
                    {formatAddress(a)}
                  </AppText>
                  <AppText variant="small" tone="muted">
                    {formatPkPhoneForDisplay(a.phone)}
                  </AppText>
                </View>
                <IonIcon
                  name={on ? 'checkmark-circle' : 'ellipse-outline'}
                  size="lg"
                  color={on ? service.accent : colors.lineStrong}
                />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <AppText variant="body" tone="muted">
          Add the address the stores should deliver to.
        </AppText>
      )}
      {unserved.map(s => (
        <InlineNotice
          key={s.store.id}
          embedded
          title={s.error?.message ?? `${s.store.name} doesn't deliver here`}
          message="Choose another address, or remove this store's items from your bag."
        />
      ))}
      <TextAction label="Add a new address" icon="add" onPress={onAdd} />
    </SectionCard>
  );
};

// ─── 2 · Payment ──────────────────────────────────────
export const PaymentStep: React.FC<{
  stores: PreviewStore[];
  choices: Record<string, StoreCheckoutChoice>;
  onPay: (storeId: string, method: PaymentMethod) => void;
  onAddCoupon: (storeId: string) => void;
  onRemoveCoupon: (storeId: string) => void;
  onNote: (storeId: string, note: string) => void;
}> = ({ stores, choices, onPay, onAddCoupon, onRemoveCoupon, onNote }) => {
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  // A note opens on request (or when one was written).
  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({});
  return (
    <View style={styles.stack}>
      {stores.map(ps => {
        const choice = choices[ps.store.id];
        const noteOpen = notesOpen[ps.store.id] || !!choice?.note;
        return (
          <Card key={ps.store.id} invalid={!!ps.error}>
            <StoreHeadRow
              store={ps.store}
              meta={`${ps.lineCount} ${ps.lineCount === 1 ? 'item' : 'items'} · Pay ${formatPKR(ps.total)}`}
            />
            {ps.error ? (
              <InlineNotice
                embedded
                title={ps.error.message}
                message={ps.error.code === 'CITY_NOT_SERVED' ? 'Choose another address in the first step.' : 'Go back to your bag to fix it.'}
              />
            ) : null}
            <PaymentMethodPicker
              layout="tiles"
              options={ps.paymentOptions}
              value={choice?.paymentMethod ?? ps.paymentMethod}
              onChange={method => onPay(ps.store.id, method)}
            />
            {ps.couponCode ? (
              <View style={[styles.coupon, { borderColor: ps.couponError ? colors.danger : service.accent }]}>
                <IonIcon name="pricetag-outline" size="md" color={ps.couponError ? colors.danger : service.accentDeep} />
                <View style={styles.grow}>
                  <AppText variant="bodyStrong">{ps.couponCode}</AppText>
                  <AppText variant="caption" tone={ps.couponError ? 'danger' : 'success'}>
                    {ps.couponError ? ps.couponError.message : `You save ${formatPKR(ps.discount)}`}
                  </AppText>
                </View>
                <IconButton icon="close" tone="muted" onPress={() => onRemoveCoupon(ps.store.id)} accessibilityLabel={`Remove coupon ${ps.couponCode}`} />
              </View>
            ) : (
              <Pressable
                onPress={() => onAddCoupon(ps.store.id)}
                accessibilityRole="button"
                accessibilityLabel="Add a coupon"
                style={[styles.coupon, styles.couponAdd, { borderColor: colors.lineStrong }]}>
                <IonIcon name="pricetag-outline" size="md" color={service.accentDeep} />
                <AppText variant="bodyStrong" style={styles.grow}>
                  Add a coupon
                </AppText>
                <IonIcon name="chevron-forward" size="md" color={colors.inkFaint} />
              </Pressable>
            )}
            {noteOpen ? (
              <TextField
                label="Note for the store (optional)"
                value={choice?.note ?? ''}
                onChangeText={note => onNote(ps.store.id, note)}
                placeholder="Gift wrap, delivery time …"
                maxLength={300}
              />
            ) : (
              <TextAction
                label="Add a note for the store"
                icon="create-outline"
                onPress={() => setNotesOpen(o => ({ ...o, [ps.store.id]: true }))}
              />
            )}
          </Card>
        );
      })}
    </View>
  );
};

// ─── 3 · Review ───────────────────────────────────────
export const ReviewStep: React.FC<{
  address: Address;
  preview: CheckoutPreview;
  choices: Record<string, StoreCheckoutChoice>;
  onChangeAddress: () => void;
  onChangePayment: () => void;
}> = ({ address, preview, choices, onChangeAddress, onChangePayment }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.stack}>
      <SectionCard title="Deliver to" icon="location-outline" action={{ label: 'Change', onPress: onChangeAddress }}>
        <View style={styles.grow}>
          <AppText variant="bodyStrong">{address.fullName}</AppText>
          <AppText variant="small" tone="muted">
            {formatAddress(address)} · {formatPkPhoneForDisplay(address.phone)}
          </AppText>
        </View>
      </SectionCard>

      {preview.stores.map(ps => {
        const method = choices[ps.store.id]?.paymentMethod ?? ps.paymentMethod;
        return (
          <Card key={ps.store.id} invalid={!!ps.error}>
            <StoreHeadRow store={ps.store} meta={shipsIn(ps)} />
            {ps.lines.map((l, i) => (
              <React.Fragment key={l.id}>
                {i > 0 ? <Divider /> : null}
                <LineItemRow
                  imageUrl={l.imageUrl}
                  name={l.name}
                  meta={[l.variantLabel, `× ${l.quantity}`].filter(Boolean).join(' · ')}
                  price={formatPKR(l.lineTotal)}
                />
              </React.Fragment>
            ))}
            <Divider />
            <View style={styles.summary}>
              <View style={styles.grow}>
                <AppText variant="caption" tone="muted">
                  Paying by
                </AppText>
                <AppText variant="bodyStrong">{PAYMENT_METHOD_LABEL[method]}</AppText>
              </View>
              <TextAction label="Change" onPress={onChangePayment} accessibilityLabel={`Change how you pay ${ps.store.name}`} />
            </View>
            <MoneyRows
              rows={[
                { label: 'Items', value: ps.itemsTotal },
                { label: 'Delivery', value: ps.shippingFee, kind: 'free' },
                ps.discount ? { label: `Coupon ${ps.couponCode ?? ''}`.trim(), value: ps.discount, kind: 'discount' } : null,
                { label: `Pay ${ps.store.name}`, value: ps.total, kind: 'total' },
              ]}
            />
          </Card>
        );
      })}

      {preview.stores.length > 1 ? (
        <SectionCard title="Your order" subtitle="Each store confirms, ships and is paid separately." icon="receipt-outline">
          <MoneyRows
            rows={[
              { label: 'Items', value: preview.itemsTotal },
              { label: 'Delivery', value: preview.shippingTotal, kind: 'free' },
              preview.discountTotal ? { label: 'Coupons', value: preview.discountTotal, kind: 'discount' } : null,
              { label: 'Total', value: preview.total, kind: 'total' },
            ]}
          />
        </SectionCard>
      ) : null}
    </View>
  );
};
