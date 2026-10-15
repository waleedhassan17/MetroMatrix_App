// ═══════════════════════════════════════════════════════
// MetroMatrix — Checkout (one screen)
// ═══════════════════════════════════════════════════════
// Where it goes, then each store's part: how you'll pay that store, a coupon
// of theirs, a note to them, and what they charge. MetroMatrix takes no
// commission and never holds the money: cash goes to the rider, transfers
// go to the store's own account.

import React, { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useDebouncedValue } from '@hooks/usePagedList';
import { formatAddress } from '@models/addressModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import {
  AppText,
  Button,
  Card,
  Divider,
  IconButton,
  InlineNotice,
  IonIcon,
  PaymentMethodPicker,
  Sheet,
  SkeletonLines,
  StickyCTA,
  StoreMark,
  TextAction,
  TextField,
} from '@custom/index';
import { ShopTopBar } from '@components/shopping/ShopParts';
import type { CartGroup, PreviewStore, ShopBrowseParamList } from '@/types';
import { haptics } from '@utils/haptics';
import { formatPKR } from '@utils/money';
import { formatPkPhoneForDisplay } from '@utils/phone';
import { loadAddressesAsync, selectAddressBook } from '../../../Account/AddressBook/addressBookSlice';
import { loadBagAsync, selectBag } from '../Bag/bagSlice';
import {
  applyCoupon,
  chooseAddress,
  choosePayment,
  closeCouponSheet,
  loadCouponsAsync,
  newCheckoutKey,
  openCouponSheet,
  placeOrderAsync,
  previewCheckoutAsync,
  selectCheckout,
  setAddressSheet,
  setCouponInput,
  setStoreNote,
  toCheckoutInput,
} from './checkoutSlice';

type Props = NativeStackScreenProps<ShopBrowseParamList, 'Checkout'>;

const makeStyles = ({ colors, space, size, radius, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: gutter, paddingTop: space.s8, paddingBottom: space.s40, gap: space.s16 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1 },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s12 },
    coupon: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s8,
      paddingHorizontal: space.s12,
      minHeight: size.control.md,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderStyle: 'dashed',
      borderColor: colors.lineStrong,
    },
    thumbs: { flexDirection: 'row', gap: space.s4 },
    couponRow: { gap: space.s4, paddingVertical: space.s12 },
    couponHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    applyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8 },
    addressRow: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s12 },
    sectionTitle: { marginTop: space.s8 },
  });

const Money: React.FC<{ label: string; value: number; tone?: 'success'; strong?: boolean; free?: boolean }> = ({ label, value, tone, strong, free }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.row}>
      <AppText variant={strong ? 'title' : 'body'} tone={strong ? 'ink' : 'muted'}>
        {label}
      </AppText>
      <AppText variant={strong ? 'title' : 'body'} tone={tone ?? 'ink'}>
        {free && value === 0 ? 'Free' : formatPKR(value)}
      </AppText>
    </View>
  );
};

const CheckoutScreen: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <CheckoutContent {...props} />
  </ServiceScope>
);

const CheckoutContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'Bag' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, colors, motion } = useTheme();
  const c = useAppSelector(selectCheckout);
  const bag = useAppSelector(selectBag);
  const book = useAppSelector(selectAddressBook);

  // Arrival: a key for this checkout, the addresses, a fresh Bag.
  useEffect(() => {
    if (!c.idempotencyKey) dispatch(newCheckoutKey());
    void dispatch(loadAddressesAsync());
    void dispatch(loadBagAsync());
  }, [dispatch, c.idempotencyKey]);

  // The default address, unless one is chosen (or the chosen one was deleted).
  const address = book.addresses.find(a => a.id === c.addressId) ?? book.addresses.find(a => a.isDefault) ?? book.addresses[0] ?? null;
  useEffect(() => {
    if (address && address.id !== c.addressId) dispatch(chooseAddress(address.id));
  }, [address, c.addressId, dispatch]);

  const storeIds = useMemo(() => bag.cart.groups.map(g => g.store.id), [bag.cart.groups]);
  const input = useMemo(() => (address ? toCheckoutInput(address.id, storeIds, c.choices) : null), [address, storeIds, c.choices]);
  // Re-price once changes settle (a typed note shouldn't fire a request per key).
  const settled = useDebouncedValue(input ? JSON.stringify(input) : '', motion.previewDebounce);
  useEffect(() => {
    if (settled && storeIds.length) void dispatch(previewCheckoutAsync(JSON.parse(settled)));
  }, [settled, storeIds.length, dispatch]);

  const preview = c.preview;
  const groupOf = (storeId: string): CartGroup | undefined => bag.cart.groups.find(g => g.store.id === storeId);
  const stale = !preview || settled !== (input ? JSON.stringify(input) : '') || c.previewStatus === 'loading';
  const canPlace = !!address && !!preview?.canPlace && !stale && c.placeStatus !== 'loading';

  const place = async () => {
    if (!input || !canPlace) return;
    haptics.press();
    const r = await dispatch(placeOrderAsync({ input, key: c.idempotencyKey }));
    if (placeOrderAsync.fulfilled.match(r)) {
      haptics.success();
      dispatch(newCheckoutKey());
      void dispatch(loadBagAsync());
      // The Bag and Checkout leave the history: back from "Order placed" returns
      // to where they were shopping, never to an empty Bag or a used checkout.
      const groupCode = r.payload.code;
      navigation.dispatch(state => {
        const routes = state.routes.filter(rt => rt.name !== 'Bag' && rt.name !== 'Checkout');
        return CommonActions.reset({
          ...state,
          routes: [...routes, { key: `OrderPlaced-${groupCode}`, name: 'OrderPlaced', params: { groupCode } }],
          index: routes.length,
        });
      });
      return;
    }
    haptics.warning();
    const code = (r.payload as { code?: string } | undefined)?.code;
    if (code === 'OUT_OF_STOCK') {
      Toast.show({ type: 'error', text1: 'Something just sold out', text2: 'Check your bag, then try again.' });
      void dispatch(loadBagAsync());
      back();
    } else if (code === 'CHECKOUT_BLOCKED') {
      void dispatch(previewCheckoutAsync(input));
    }
  };

  const couponStore = c.couponSheet.storeId;
  useEffect(() => {
    if (couponStore) void dispatch(loadCouponsAsync(couponStore));
  }, [couponStore, dispatch]);

  // A render function, not a component: a component made here would remount
  // on every keystroke and drop the note field's focus.
  const renderStore = (ps: PreviewStore) => {
    const group = groupOf(ps.store.id);
    const choice = c.choices[ps.store.id];
    return (
      <Card key={ps.store.id} invalid={!!ps.error}>
        <View style={styles.head}>
          <StoreMark store={ps.store} small />
          <AppText variant="title" style={styles.grow} numberOfLines={1}>
            {ps.store.name}
          </AppText>
          <AppText variant="small" tone="muted">
            {ps.lineCount} {ps.lineCount === 1 ? 'item' : 'items'}
          </AppText>
        </View>
        {group ? (
          <AppText variant="small" tone="muted" numberOfLines={2}>
            {group.lines.map(l => `${l.quantity} × ${l.name}${l.variantLabel ? ` (${l.variantLabel})` : ''}`).join(', ')}
          </AppText>
        ) : null}
        {ps.error ? <InlineNotice title={ps.error.message} message={ps.error.code === 'CITY_NOT_SERVED' ? 'Choose another address, or remove this store’s items from your bag.' : 'Go back to your bag to fix it.'} /> : null}

        <AppText variant="label">How you’ll pay {ps.store.name}</AppText>
        <PaymentMethodPicker
          options={ps.paymentOptions}
          value={choice?.paymentMethod ?? ps.paymentMethod}
          onChange={method => dispatch(choosePayment({ storeId: ps.store.id, method }))}
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
            <IconButton icon="close" tone="muted" onPress={() => dispatch(applyCoupon({ storeId: ps.store.id, code: null }))} accessibilityLabel={`Remove coupon ${ps.couponCode}`} />
          </View>
        ) : (
          <TextAction label={`Add a ${ps.store.name} coupon`} icon="pricetag-outline" onPress={() => dispatch(openCouponSheet(ps.store.id))} />
        )}

        <TextField
          label={`Note for ${ps.store.name} (optional)`}
          value={choice?.note ?? ''}
          onChangeText={note => dispatch(setStoreNote({ storeId: ps.store.id, note }))}
          placeholder="Gift wrap, delivery time …"
          maxLength={300}
        />

        <Divider />
        <Money label="Items" value={ps.itemsTotal} />
        <Money label="Delivery" value={ps.shippingFee} free tone={ps.shippingFee === 0 ? 'success' : undefined} />
        {ps.discount ? <Money label="Coupon" value={-ps.discount} tone="success" /> : null}
        <Money label={`Pay ${ps.store.name}`} value={ps.total} strong />
        <AppText variant="caption" tone="muted">
          Ships in {ps.dispatchMinDays === ps.dispatchMaxDays ? ps.dispatchMaxDays : `${ps.dispatchMinDays}–${ps.dispatchMaxDays}`} days.
        </AppText>
      </Card>
    );
  };

  return (
    <View style={styles.root}>
      <ShopTopBar title="Checkout" onBack={back} showBag={false} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="h2">Deliver to</AppText>
        {book.status === 'loading' && !book.addresses.length ? (
          <SkeletonLines lines={3} />
        ) : address ? (
          <Card onPress={() => dispatch(setAddressSheet(true))} accessibilityLabel={`Deliver to ${address.fullName}, ${formatAddress(address)}. Change`}>
            <View style={styles.head}>
              <IonIcon name="location-outline" size="lg" color={service.accentDeep} />
              <View style={styles.grow}>
                <AppText variant="bodyStrong">{address.fullName}</AppText>
                <AppText variant="small" tone="muted">
                  {formatAddress(address)}
                </AppText>
                <AppText variant="small" tone="muted">
                  {formatPkPhoneForDisplay(address.phone)}
                </AppText>
              </View>
              <AppText variant="small" tone="accentDeep">
                Change
              </AppText>
            </View>
          </Card>
        ) : (
          <Card>
            <AppText variant="body" tone="muted">
              Add the address the stores should deliver to.
            </AppText>
            <Button label="Add an address" leftIcon="add" variant="secondary" onPress={() => navigation.navigate('AddressForm')} />
          </Card>
        )}

        {c.previewError.message ? <InlineNotice message={c.previewError.message} /> : null}
        {c.placeError.message && c.placeError.code !== 'OUT_OF_STOCK' ? <InlineNotice message={c.placeError.message} /> : null}

        <AppText variant="h2" style={styles.sectionTitle}>
          Your order
        </AppText>
        {preview ? preview.stores.map(renderStore) : address ? <SkeletonLines lines={8} /> : null}

        {preview && preview.stores.length > 1 ? (
          <Card>
            <Money label="Items" value={preview.itemsTotal} />
            <Money label="Delivery" value={preview.shippingTotal} free tone={preview.shippingTotal === 0 ? 'success' : undefined} />
            {preview.discountTotal ? <Money label="Coupons" value={-preview.discountTotal} tone="success" /> : null}
            <Divider />
            <Money label="Total" value={preview.total} strong />
            <AppText variant="caption" tone="muted">
              Each store confirms, ships and is paid separately.
            </AppText>
          </Card>
        ) : null}
      </ScrollView>

      <StickyCTA>
        <Button
          label={preview && !stale ? `Place order · ${formatPKR(preview.total)}` : 'Place order'}
          onPress={() => void place()}
          loading={c.placeStatus === 'loading'}
          disabled={!canPlace}
          fullWidth
        />
      </StickyCTA>

      <Sheet visible={c.addressSheetOpen} onClose={() => dispatch(setAddressSheet(false))} title="Deliver to">
        {book.addresses.map((a, i) => (
          <View key={a.id}>
            {i > 0 ? <Divider /> : null}
            <Pressable
              onPress={() => dispatch(chooseAddress(a.id))}
              style={styles.addressRow}
              accessibilityRole="radio"
              accessibilityState={{ checked: a.id === address?.id }}
              accessibilityLabel={`${a.fullName}, ${formatAddress(a)}`}>
              <IonIcon name={a.id === address?.id ? 'radio-button-on' : 'radio-button-off'} size="md" color={a.id === address?.id ? service.accent : colors.lineStrong} />
              <View style={styles.grow}>
                <AppText variant="bodyStrong">{a.fullName}</AppText>
                <AppText variant="small" tone="muted">
                  {formatAddress(a)}
                </AppText>
              </View>
            </Pressable>
          </View>
        ))}
        <TextAction
          label="Add a new address"
          icon="add"
          onPress={() => {
            dispatch(setAddressSheet(false));
            navigation.navigate('AddressForm');
          }}
        />
      </Sheet>

      <Sheet
        visible={!!couponStore}
        onClose={() => dispatch(closeCouponSheet())}
        title="Coupons"
        subtitle={couponStore ? `From ${preview?.stores.find(s => s.store.id === couponStore)?.store.name ?? 'this store'}` : undefined}>
        <View style={styles.applyRow}>
          <View style={styles.grow}>
            <TextField label="Coupon code" value={c.couponSheet.input} onChangeText={t => dispatch(setCouponInput(t))} autoCapitalize="characters" placeholder="LAWN10" />
          </View>
        </View>
        <Button
          label="Apply"
          variant="secondary"
          disabled={c.couponSheet.input.length < 4}
          onPress={() => couponStore && dispatch(applyCoupon({ storeId: couponStore, code: c.couponSheet.input }))}
          fullWidth
        />
        {c.couponSheet.status === 'loading' ? <SkeletonLines lines={3} /> : null}
        {c.couponSheet.coupons.map((cp, i) => (
          <View key={cp.code}>
            {i > 0 ? <Divider /> : null}
            <View style={styles.couponRow}>
              <View style={styles.couponHead}>
                <AppText variant="bodyStrong">{cp.code}</AppText>
                <TextAction
                  label={cp.shortBy > 0 ? 'Not yet' : 'Use'}
                  disabled={cp.shortBy > 0}
                  onPress={() => couponStore && dispatch(applyCoupon({ storeId: couponStore, code: cp.code }))}
                  accessibilityLabel={`Use ${cp.code}`}
                />
              </View>
              <AppText variant="small">{cp.label}</AppText>
              <AppText variant="caption" tone={cp.shortBy > 0 ? 'warning' : 'muted'}>
                {cp.shortBy > 0
                  ? `Add ${formatPKR(cp.shortBy)} more from this store to use it.`
                  : cp.minOrder
                    ? `On orders of ${formatPKR(cp.minOrder)} or more.`
                    : 'On any order.'}
              </AppText>
            </View>
          </View>
        ))}
        {c.couponSheet.status === 'succeeded' && !c.couponSheet.coupons.length ? (
          <AppText variant="body" tone="muted">
            No coupons from this store right now. Have a code? Enter it above.
          </AppText>
        ) : null}
      </Sheet>
    </View>
  );
};

export default CheckoutScreen;
