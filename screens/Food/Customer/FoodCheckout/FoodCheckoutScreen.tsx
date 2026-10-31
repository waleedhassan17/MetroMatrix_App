// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: checkout (one screen)
// ═══════════════════════════════════════════════════════
// Where it goes (or where to collect it), how you'll pay the kitchen, a
// code, cutlery and notes, then exactly what you'll pay: the dishes, the
// deal, the kitchen's delivery fee — no other fee. Whatever stands in the
// way is said with its fix. MetroMatrix takes no commission and never holds
// the money: cash goes to the kitchen's rider or counter, transfers to the
// kitchen's own account.

import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { useDebouncedValue } from '../../../../hooks/usePagedList';
import { formatAddress } from '../../../../models/addressModel';
import { defaultPayment, fixOf, lineChoices, payChoices, validateCheckout, type IssueFix } from '../../../../models/food/bagModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, Divider, IconButton, InlineNotice, IonIcon, ScreenShell, Sheet, SkeletonLines, TextAction, TextField, ToggleRow } from '../../../../Custom-Components/index';
import { ChoiceLine } from '../../../../Custom-Components/food/ChoiceLine';
import type { FoodAppParamList, FoodIssue, FoodPaymentMethod } from '../../../../types';
import { haptics } from '../../../../utils/haptics';
import { formatPKR } from '../../../../utils/money';
import { formatPkPhoneForDisplay } from '../../../../utils/phone';
import { selectFoodPoint, selectStoreSource, setStoreSource } from '../../../../store/preferencesSlice';
import { storeSourceFor } from '../../../../models/kitchen/reachModel';
import { EMPTY_FOOD_CART } from '../../../../serializers/food/orderSerializer';
import { loadAddressesAsync, selectAddressBook } from '../../../Account/AddressBook/addressBookSlice';
import { loadFoodBagAsync, selectFoodBag, setFoodBag, setFoodBagModeAsync } from '../FoodBag/foodBagSlice';
import { selectVendorPage } from '../FoodVendor/foodVendorSlice';
import {
  applyFoodCode,
  chooseFoodAddress,
  chooseFoodPayment,
  clearFoodPlaceError,
  newFoodCheckoutKey,
  placeFoodOrderAsync,
  previewFoodCheckoutAsync,
  removeFoodCode,
  selectFoodCheckout,
  setCheckoutText,
  setCodeInput,
  setCutlery,
  setFoodAddressSheet,
  toFoodCheckoutInput,
} from './foodCheckoutSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodCheckout'>;

const makeStyles = ({ colors, space, size, radius, gutter }: Theme) =>
  StyleSheet.create({
    content: { paddingHorizontal: gutter, paddingTop: space.s16, paddingBottom: space.s40, gap: space.s16 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s12 },
    code: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s8,
      paddingHorizontal: space.s12,
      minHeight: size.control.md,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderStyle: 'dashed',
    },
    codeEntry: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s8 },
    addressRow: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s12 },
    sectionTitle: { marginTop: space.s8 },
    payList: { gap: space.s4 },
    muted: { color: colors.inkMuted },
  });

const Money: React.FC<{ label: string; value: number; tone?: 'success'; strong?: boolean; free?: boolean }> = ({ label, value, tone, strong, free }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.row}>
      <AppText variant={strong ? 'title' : 'body'} tone={strong ? 'ink' : 'muted'}>
        {label}
      </AppText>
      <AppText variant={strong ? 'title' : 'body'} tone={tone ?? 'ink'}>
        {free && value === 0 ? 'Free' : value < 0 ? `− ${formatPKR(-value)}` : formatPKR(value)}
      </AppText>
    </View>
  );
};

const FoodCheckoutScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodCheckoutContent {...props} />
  </ServiceScope>
);

const FoodCheckoutContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'FoodBag' });
  const root = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, colors, motion } = useTheme();
  const c = useAppSelector(selectFoodCheckout);
  const bag = useAppSelector(selectFoodBag);
  const book = useAppSelector(selectAddressBook);
  const point = useAppSelector(selectFoodPoint);
  const storeSource = useAppSelector(selectStoreSource);
  const vendor = bag.cart.vendor;
  const page = useAppSelector(st => (vendor ? selectVendorPage(st, vendor.slug).page : null));
  const delivery = (bag.cart.fulfilment ?? 'delivery') === 'delivery';

  // Arrival: a key for this checkout, the addresses, a fresh bag.
  useEffect(() => {
    if (!c.idempotencyKey) dispatch(newFoodCheckoutKey());
  }, [dispatch, c.idempotencyKey]);
  useEffect(() => {
    void dispatch(loadAddressesAsync());
    void dispatch(loadFoodBagAsync());
  }, [dispatch]);

  // The address browsing used, else the default, unless one is chosen.
  const address =
    book.addresses.find(a => a.id === c.addressId) ??
    book.addresses.find(a => a.id === point?.addressId) ??
    book.addresses.find(a => a.isDefault) ??
    book.addresses[0] ??
    null;
  useEffect(() => {
    if (address && address.id !== c.addressId) dispatch(chooseFoodAddress(address.id));
  }, [address, c.addressId, dispatch]);

  const input = useMemo(() => toFoodCheckoutInput({ ...c, addressId: address?.id ?? null }, delivery), [c, address, delivery]);
  // What the price depends on (typing a note shouldn't re-price).
  const priceKey = JSON.stringify({ a: input.addressId, p: c.paymentMethod, k: input.promoCode, f: bag.cart.fulfilment, s: bag.cart.scheduledFor?.at ?? null, n: bag.cart.itemCount, t: bag.cart.subtotal });
  const settled = useDebouncedValue(priceKey, motion.previewDebounce);
  useEffect(() => {
    if (bag.cart.empty || !settled) return;
    const k = JSON.parse(settled) as { a: string | null; p: FoodPaymentMethod | null; k: string | null };
    void dispatch(previewFoodCheckoutAsync({ addressId: k.a, paymentMethod: k.p ?? undefined, promoCode: k.k }));
  }, [settled, bag.cart.empty, dispatch]);

  const preview = c.preview;
  // Start on a way to pay that works for this order.
  useEffect(() => {
    if (!preview) return;
    const m = defaultPayment(preview, c.paymentMethod);
    if (m && m !== c.paymentMethod) dispatch(chooseFoodPayment(m));
  }, [preview, c.paymentMethod, dispatch]);

  const stale = !preview || settled !== priceKey || c.previewStatus === 'loading';
  const errors = validateCheckout({ fulfilment: delivery ? 'delivery' : 'pickup', addressId: address?.id ?? null, addressPinned: !!address && address.lat !== null && address.lng !== null, paymentMethod: c.paymentMethod, promoCode: c.promoCode });
  const first: FoodIssue | null = preview?.issues[0] ?? null;
  const canPlace = !stale && !!preview?.ok && !Object.keys(errors).length && c.placeStatus !== 'loading';

  const fix = (f: IssueFix) => {
    switch (f) {
      case 'pickup':
        void dispatch(setFoodBagModeAsync({ fulfilment: 'pickup' }));
        return;
      case 'schedule':
      case 'bag':
        back();
        return;
      case 'menu':
        if (vendor) navigation.navigate('FoodVendor', { slug: vendor.slug });
        return;
      case 'address':
        if (address && (address.lat === null || address.lng === null)) root.navigate('AddressForm', { id: address.id });
        else dispatch(setFoodAddressSheet(true));
        return;
      case 'code':
        dispatch(removeFoodCode());
        return;
      default:
    }
  };
  const FIX_LABEL: Partial<Record<NonNullable<IssueFix>, string>> = {
    pickup: 'Switch to pick-up',
    schedule: 'Choose a time',
    bag: 'Back to your bag',
    menu: 'Add more dishes',
    address: 'Change the address',
    code: 'Remove the code',
  };

  const place = async () => {
    if (!canPlace || !preview) return;
    haptics.press();
    // Came through the kitchen's own link or QR: the order says so (it counts as theirs).
    const source = storeSourceFor(storeSource, vendor?.slug, Date.now());
    const r = await dispatch(placeFoodOrderAsync({ input: { ...input, source }, key: c.idempotencyKey }));
    if (placeFoodOrderAsync.fulfilled.match(r)) {
      haptics.success();
      if (source) dispatch(setStoreSource(null));
      dispatch(setFoodBag(EMPTY_FOOD_CART));
      dispatch(newFoodCheckoutKey());
      // The bag and checkout leave the history: back from "Order placed"
      // returns to the menus, never to an empty bag or a used checkout.
      const code = r.payload.code;
      navigation.dispatch(state => {
        const routes = state.routes.filter(rt => rt.name !== 'FoodBag' && rt.name !== 'FoodCheckout');
        return CommonActions.reset({ ...state, routes: [...routes, { key: `FoodOrderPlaced-${code}`, name: 'FoodOrderPlaced', params: { code } }], index: routes.length });
      });
      return;
    }
    haptics.warning();
    const code = (r.payload as { code?: string } | undefined)?.code;
    if (code && ['ITEM_UNAVAILABLE', 'PORTIONS_SOLD_OUT', 'SLOT_FULL', 'PROMO_LIMIT_REACHED', 'VENDOR_CLOSED', 'VENDOR_PAUSED'].includes(code)) {
      Toast.show({ type: 'error', text1: 'Something just changed', text2: 'Check your order, then try again.' });
      void dispatch(loadFoodBagAsync());
    }
  };

  if (bag.cart.empty && bag.status !== 'loading') {
    return (
      <ScreenShell title="Checkout" onBack={back} scroll>
        <InlineNotice tone="info" message="Your bag is empty." action={{ label: 'Browse the Food Court', onPress: () => navigation.navigate('FoodTabs', { screen: 'FoodHomeTab' }) }} />
      </ScreenShell>
    );
  }

  const when = bag.cart.scheduledFor ? bag.cart.scheduledFor.label : preview?.eta ? `${delivery ? 'Arrives in' : 'Ready in'} about ${preview.eta.label}` : null;

  return (
    <ScreenShell
      title="Checkout"
      subtitle={vendor?.name}
      onBack={back}
      scroll
      padded={false}
      footer={
        <Button
          label={preview && !stale ? `Place order · ${formatPKR(preview.totals.total)}` : 'Place order'}
          onPress={() => void place()}
          loading={c.placeStatus === 'loading'}
          disabled={!canPlace}
          fullWidth
        />
      }
    >
      <View style={styles.content}>
        {/* Where */}
        <AppText variant="sectionTitle">{delivery ? 'Deliver to' : 'Collect from'}</AppText>
        {delivery ? (
          book.status === 'loading' && !book.addresses.length ? (
            <SkeletonLines lines={3} />
          ) : address ? (
            <Card onPress={() => dispatch(setFoodAddressSheet(true))} invalid={!!errors.address} accessibilityLabel={`Deliver to ${address.fullName}, ${formatAddress(address)}. Change`}>
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
              {errors.address ? (
                <InlineNotice tone="warning" message={errors.address} action={{ label: 'Drop a pin', onPress: () => root.navigate('AddressForm', { id: address.id }) }} />
              ) : null}
            </Card>
          ) : (
            <Card>
              <AppText variant="body" tone="muted">
                Add the address the kitchen’s rider should bring your food to.
              </AppText>
              <Button label="Add an address" leftIcon="add" variant="secondary" onPress={() => root.navigate('AddressForm')} />
            </Card>
          )
        ) : (
          <Card>
            <View style={styles.head}>
              <IonIcon name="storefront-outline" size="lg" color={service.accentDeep} />
              <View style={styles.grow}>
                <AppText variant="bodyStrong">{vendor?.name ?? 'The kitchen'}</AppText>
                <AppText variant="small" tone="muted">
                  {page?.location.addressLine ? [page.location.addressLine, page.location.area].filter(Boolean).join(', ') : 'Show your order code at the counter.'}
                </AppText>
              </View>
            </View>
          </Card>
        )}
        {when ? (
          <View style={styles.head}>
            <IonIcon name="time-outline" size="md" color={colors.inkMuted} />
            <AppText variant="small" tone="muted">
              {when}
            </AppText>
          </View>
        ) : null}

        {delivery && address ? (
          <>
            <TextField label="Building or house name (optional)" value={c.building} onChangeText={v => dispatch(setCheckoutText({ field: 'building', value: v }))} />
            <TextField label="Floor or flat (optional)" value={c.floor} onChangeText={v => dispatch(setCheckoutText({ field: 'floor', value: v }))} />
            <TextField
              label="Note for the rider (optional)"
              value={c.riderInstructions}
              onChangeText={v => dispatch(setCheckoutText({ field: 'riderInstructions', value: v }))}
              placeholder="Call when you reach the gate"
            />
          </>
        ) : null}

        {/* What stands in the way, first problem first */}
        {c.previewError.message ? <InlineNotice message={c.previewError.message} /> : null}
        {first && !stale ? (
          <InlineNotice
            tone="warning"
            message={first.message}
            action={FIX_LABEL[fixOf(first) as NonNullable<IssueFix>] ? { label: FIX_LABEL[fixOf(first) as NonNullable<IssueFix>]!, onPress: () => fix(fixOf(first)) } : undefined}
          />
        ) : null}
        {c.placeError.message ? <InlineNotice message={c.placeError.message} action={{ label: 'Dismiss', onPress: () => dispatch(clearFoodPlaceError()) }} /> : null}

        {/* Paying */}
        <AppText variant="sectionTitle" style={styles.sectionTitle}>
          {`How you’ll pay ${vendor?.name ?? 'the kitchen'}`}
        </AppText>
        {preview ? (
          <View style={styles.payList} accessibilityRole="radiogroup" accessibilityLabel="Payment method">
            {payChoices(preview).map(p => (
              <ChoiceLine
                key={p.method}
                label={p.label}
                price={null}
                note={p.hint}
                selected={c.paymentMethod === p.method}
                disabled={!p.available}
                multiple={false}
                onPress={() => dispatch(chooseFoodPayment(p.method))}
              />
            ))}
          </View>
        ) : (
          <SkeletonLines lines={2} />
        )}
        {c.paymentMethod === 'transfer' && preview?.payment.accounts.length ? (
          <AppText variant="small" tone="muted">
            You’ll see the kitchen’s account after placing the order, and have 10 minutes to send the money.
          </AppText>
        ) : null}

        {/* A code */}
        {c.promoCode ? (
          <View style={[styles.code, { borderColor: preview?.deal?.code ? service.accent : colors.lineStrong }]}>
            <IonIcon name="pricetag-outline" size="md" color={service.accentDeep} />
            <View style={styles.grow}>
              <AppText variant="bodyStrong">{c.promoCode}</AppText>
              <AppText variant="caption" tone={preview?.deal?.code ? 'success' : 'muted'}>
                {preview?.deal?.code ? `You save ${formatPKR(preview.deal.discount)}` : preview?.deal ? 'A better deal is applied instead' : 'Checking…'}
              </AppText>
            </View>
            <IconButton icon="close" tone="muted" onPress={() => dispatch(removeFoodCode())} accessibilityLabel={`Remove code ${c.promoCode}`} />
          </View>
        ) : (
          <View style={styles.codeEntry}>
            <View style={styles.grow}>
              <TextField label="Promo code (optional)" value={c.codeInput} onChangeText={v => dispatch(setCodeInput(v))} autoCapitalize="characters" placeholder="A code from the kitchen" error={errors.promoCode} />
            </View>
            <Button label="Apply" variant="secondary" disabled={c.codeInput.length < 3} onPress={() => dispatch(applyFoodCode())} />
          </View>
        )}

        <ToggleRow label="Send cutlery" helper="Only if you need it — less plastic otherwise." value={c.cutlery} onChange={v => dispatch(setCutlery(v))} />
        <TextField label="Note for the kitchen (optional)" value={c.note} onChangeText={v => dispatch(setCheckoutText({ field: 'note', value: v }))} placeholder="Ring the bell twice" />

        {/* What you'll pay */}
        <AppText variant="sectionTitle" style={styles.sectionTitle}>
          Your order
        </AppText>
        {preview ? (
          <Card>
            {preview.lines.map(l => (
              <View key={l.id} style={styles.row}>
                <View style={styles.grow}>
                  <AppText variant="body">{`${l.quantity} × ${l.name}`}</AppText>
                  {lineChoices(l) ? (
                    <AppText variant="caption" tone="muted">
                      {lineChoices(l)}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="body">{formatPKR(l.lineTotal)}</AppText>
              </View>
            ))}
            <Divider />
            <Money label="Subtotal" value={preview.totals.subtotal} />
            {preview.deal ? <Money label={preview.deal.code ? `Code ${preview.deal.code}` : preview.deal.title} value={-preview.totals.discount} tone="success" /> : null}
            {delivery ? <Money label="Delivery (the kitchen’s own rider)" value={preview.totals.deliveryFee} free tone={preview.totals.deliveryFee === 0 ? 'success' : undefined} /> : null}
            <Divider />
            <Money label={`Pay ${vendor?.name ?? 'the kitchen'}`} value={preview.totals.total} strong />
            {delivery && preview.freeDeliveryOver && preview.totals.deliveryFee > 0 ? (
              <AppText variant="caption" tone="muted">{`Free delivery on orders over ${formatPKR(preview.freeDeliveryOver)}.`}</AppText>
            ) : null}
            <AppText variant="caption" tone="muted">
              No service or platform fee. MetroMatrix takes no commission.
            </AppText>
          </Card>
        ) : (
          <SkeletonLines lines={6} />
        )}
      </View>

      <Sheet visible={c.addressSheetOpen} onClose={() => dispatch(setFoodAddressSheet(false))} title="Deliver to">
        {book.addresses.map((a, i) => (
          <View key={a.id}>
            {i > 0 ? <Divider /> : null}
            <Pressable
              onPress={() => dispatch(chooseFoodAddress(a.id))}
              style={styles.addressRow}
              accessibilityRole="radio"
              aria-checked={a.id === address?.id}
              accessibilityLabel={`${a.fullName}, ${formatAddress(a)}`}
            >
              <IonIcon name={a.id === address?.id ? 'radio-button-on' : 'radio-button-off'} size="md" color={a.id === address?.id ? service.accent : colors.lineStrong} />
              <View style={styles.grow}>
                <AppText variant="bodyStrong">{a.fullName}</AppText>
                <AppText variant="small" tone="muted">
                  {formatAddress(a)}
                </AppText>
                {a.lat === null || a.lng === null ? (
                  <AppText variant="caption" tone="warning">
                    Needs a map pin
                  </AppText>
                ) : null}
              </View>
            </Pressable>
          </View>
        ))}
        <TextAction
          label="Add a new address"
          icon="add"
          onPress={() => {
            dispatch(setFoodAddressSheet(false));
            root.navigate('AddressForm');
          }}
        />
      </Sheet>
    </ScreenShell>
  );
};

export default FoodCheckoutScreen;
