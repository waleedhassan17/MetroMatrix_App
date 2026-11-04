// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: checkout (one screen)
// ═══════════════════════════════════════════════════════
// Where it goes (or where to collect it), how you'll pay the kitchen, a
// code, cutlery and notes, then exactly what you'll pay: the dishes, the
// deal, the kitchen's delivery fee — no other fee. Whatever stands in the
// way is said with its fix. MetroMatrix takes no commission and never holds
// the money: cash goes to the kitchen's rider or counter, transfers to the
// kitchen's own account. One page, three titled cards — Deliver to (or Pick
// up from), Payment, Your order — and the sticky CtaBar with the total.

import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector, useAppStore } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useDebouncedValue } from '../../hooks/usePagedList';
import { formatAddress } from '../../models/addressModel';
import { defaultPayment, fixOf, lineChoices, payChoices, validateCheckout, type IssueFix } from '../../models/food/bagModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, CheckoutSkeleton, CtaBar, Divider, EmptyState, IconButton, InlineNotice, IonIcon, LineItemRow, ListRow, MoneyRows, ScreenShell, SectionCard, Sheet, Skeleton, StoreHeadRow, TextAction, TextField, ToggleRow } from '../../Custom-Components/index';
import { TrustNote } from '../../Components/food/FoodParts';
import { customerTrustLine } from '../../models/food/trustModel';
import { PAYMENT_METHOD, TRANSFER_WINDOW_MINUTES, VENDOR_ORDER_LINE } from '../../models/food/foodStatusModel';
import { ChoiceLine } from '../../Custom-Components/food/ChoiceLine';
import type { FoodAppParamList, FoodIssue, FoodPaymentMethod } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import { formatPKR } from '../../utils/money/money';
import { formatPkPhoneForDisplay } from '../../utils/phone/phone';
import { selectFoodPoint, selectStoreSource, setStoreSource } from '../../store/preferencesSlice';
import { storeSourceFor } from '../../models/kitchen/reachModel';
import { EMPTY_FOOD_CART } from '../../serializers/food/orderSerializer';
import { loadAddressesAsync, selectAddressBook } from '../address-book-screen/addressBookSlice';
import { loadFoodBagAsync, selectFoodBag, setFoodBag, setFoodBagModeAsync } from '../food-bag-screen/foodBagSlice';
import { selectVendorPage } from '../food-vendor-screen/foodVendorSlice';
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

const makeStyles = ({ space, size, radius, gutter }: Theme) =>
  StyleSheet.create({
    content: { paddingHorizontal: gutter, paddingBottom: space.s40, gap: space.s16 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    halves: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1 },
    lines: { gap: space.s12 },
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
    addressRow: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s12, paddingHorizontal: space.s12, borderRadius: radius.md },
    payList: { gap: space.s4 },
  });

const FoodCheckout: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodCheckoutContent {...props} />
  </ServiceScope>
);

const FoodCheckoutContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'FoodBag' });
  const root = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const dispatch = useAppDispatch();
  const appStore = useAppStore();
  const styles = useStyles(makeStyles);
  const { service, colors, motion, size } = useTheme();
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
    const placed = placeFoodOrderAsync.fulfilled.match(r) ? selectFoodCheckout(appStore.getState()).placed : null;
    if (placed) {
      haptics.success();
      if (source) dispatch(setStoreSource(null));
      dispatch(setFoodBag(EMPTY_FOOD_CART));
      dispatch(newFoodCheckoutKey());
      // The bag and checkout leave the history: back from "Order placed"
      // returns to the menus, never to an empty bag or a used checkout.
      const code = placed.code;
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
        <EmptyState ion="bag-handle-outline" title="Your bag is empty" body="Add dishes from a kitchen’s menu, then check out here." action={{ label: 'Browse the Food Court', onPress: () => navigation.navigate('FoodTabs', { screen: 'FoodHomeTab' }) }} />
      </ScreenShell>
    );
  }

  const when = bag.cart.scheduledFor ? bag.cart.scheduledFor.label : preview?.eta ? `${delivery ? 'Arrives in' : 'Ready in'} about ${preview.eta.label}` : null;
  const kitchen = vendor?.name ?? 'the kitchen';
  const payNote = c.paymentMethod ? `${PAYMENT_METHOD[c.paymentMethod].label} · paid to ${kitchen}` : `Paid to ${kitchen} directly`;

  return (
    <ScreenShell
      title="Checkout"
      subtitle={vendor?.name}
      onBack={back}
      scroll
      padded={false}
      footer={
        <CtaBar
          label="Total"
          amount={preview?.totals.total ?? bag.cart.subtotal}
          note={stale ? 'Working out your total…' : payNote}
          action={{ label: 'Place order', onPress: () => void place(), loading: c.placeStatus === 'loading', disabled: !canPlace }}
        />
      }
    >
      <View style={styles.content}>
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

        {!preview && !book.addresses.length && book.status === 'loading' ? <CheckoutSkeleton /> : null}

        {/* 1 · Where */}
        <SectionCard
          title={delivery ? 'Deliver to' : 'Pick up from'}
          icon={delivery ? 'location-outline' : 'storefront-outline'}
          invalid={!!errors.address}
          action={delivery && address ? { label: 'Change', onPress: () => dispatch(setFoodAddressSheet(true)) } : undefined}
        >
          {delivery ? (
            book.status === 'loading' && !book.addresses.length ? (
              <Skeleton height={size.control.lg} shape="md" />
            ) : address ? (
              <>
                <View style={styles.grow} accessible accessibilityLabel={`Deliver to ${address.fullName}, ${formatAddress(address)}`}>
                  <AppText variant="bodyStrong">{address.fullName}</AppText>
                  <AppText variant="small" tone="muted">
                    {formatAddress(address)}
                  </AppText>
                  <AppText variant="small" tone="muted">
                    {formatPkPhoneForDisplay(address.phone)}
                  </AppText>
                </View>
                {errors.address ? (
                  <InlineNotice embedded tone="warning" message={errors.address} action={{ label: 'Drop a pin', onPress: () => root.navigate('AddressForm', { id: address.id }) }} />
                ) : null}
                <View style={styles.halves}>
                  <View style={styles.half}>
                    <TextField label="Building (optional)" value={c.building} onChangeText={v => dispatch(setCheckoutText({ field: 'building', value: v }))} />
                  </View>
                  <View style={styles.half}>
                    <TextField label="Floor or flat (optional)" value={c.floor} onChangeText={v => dispatch(setCheckoutText({ field: 'floor', value: v }))} />
                  </View>
                </View>
                <TextField
                  label="Note for the rider (optional)"
                  value={c.riderInstructions}
                  onChangeText={v => dispatch(setCheckoutText({ field: 'riderInstructions', value: v }))}
                  placeholder="Call when you reach the gate"
                />
              </>
            ) : (
              <>
                <AppText variant="body" tone="muted">
                  Add the address the kitchen’s rider should bring your food to.
                </AppText>
                <Button label="Add an address" leftIcon="add" variant="secondary" onPress={() => root.navigate('AddressForm')} />
              </>
            )
          ) : (
            <View style={styles.grow}>
              <AppText variant="bodyStrong">{vendor?.name ?? 'The kitchen'}</AppText>
              <AppText variant="small" tone="muted">
                {page?.location.addressLine ? [page.location.addressLine, page.location.area].filter(Boolean).join(', ') : 'Show your order code at the counter.'}
              </AppText>
            </View>
          )}
          {when ? <ListRow title={when} subtitle={bag.cart.scheduledFor ? 'Scheduled' : delivery ? 'Delivery time' : 'Pick-up time'} leftIcon="time-outline" value="Change" onPress={back} /> : null}
        </SectionCard>

        {/* 2 · Paying */}
        <SectionCard title="Payment" subtitle={`You pay ${kitchen} directly`} icon="wallet-outline">
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
            <>
              <Skeleton height={size.control.lg} shape="md" />
              <Skeleton height={size.control.lg} shape="md" />
            </>
          )}
          {c.paymentMethod === 'transfer' && preview?.payment.accounts.length ? (
            <InlineNotice embedded tone="info" message={`You’ll see ${kitchen}’s account once the order is placed, and have ${TRANSFER_WINDOW_MINUTES} minutes to send the money.`} />
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
        </SectionCard>

        {/* 3 · What you'll pay */}
        <SectionCard title="Your order" icon="receipt-outline">
          {vendor ? (
            <StoreHeadRow
              store={{ name: vendor.name, logoUrl: vendor.logoUrl, brandColor: service.accent }}
              meta={`${bag.cart.itemCount} ${bag.cart.itemCount === 1 ? 'item' : 'items'}`}
              chevron={false}
            />
          ) : null}
          {preview ? (
            <>
              <View style={styles.lines}>
                {preview.lines.map(l => (
                  <LineItemRow key={l.id} shape="square" imageUrl={l.photoUrl} name={`${l.quantity} × ${l.name}`} meta={lineChoices(l) || null} price={formatPKR(l.lineTotal)} priceTone="ink" />
                ))}
              </View>
              <Divider />
              <ToggleRow label={VENDOR_ORDER_LINE.cutlery} helper="Only if you need it — less plastic otherwise." value={c.cutlery} onChange={v => dispatch(setCutlery(v))} />
              <TextField label="Note for the kitchen (optional)" value={c.note} onChangeText={v => dispatch(setCheckoutText({ field: 'note', value: v }))} placeholder="Less spicy, no onions" />
              <Divider />
              <MoneyRows
                rows={[
                  { label: 'Subtotal', value: preview.totals.subtotal },
                  preview.deal ? { label: preview.deal.code ? `Code ${preview.deal.code}` : preview.deal.title, value: preview.totals.discount, kind: 'discount' } : null,
                  delivery ? { label: 'Delivery (the kitchen’s own rider)', value: preview.totals.deliveryFee, kind: 'free' } : null,
                  { label: `Pay ${kitchen}`, value: preview.totals.total, kind: 'total' },
                ]}
              />
              {delivery && preview.freeDeliveryOver && preview.totals.deliveryFee > 0 ? (
                <AppText variant="caption" tone="muted">{`Free delivery on orders over ${formatPKR(preview.freeDeliveryOver)}.`}</AppText>
              ) : null}
              <TrustNote text={`No service or platform fee. ${customerTrustLine(vendor?.name)}`} />
            </>
          ) : (
            <>
              <Skeleton height={size.lineThumb} shape="md" />
              <Skeleton width="60%" />
              <Skeleton width="40%" />
            </>
          )}
        </SectionCard>
      </View>

      <Sheet visible={c.addressSheetOpen} onClose={() => dispatch(setFoodAddressSheet(false))} title="Deliver to">
        {book.addresses.map((a, i) => (
          <View key={a.id}>
            {i > 0 ? <Divider /> : null}
            <Pressable
              onPress={() => dispatch(chooseFoodAddress(a.id))}
              style={[styles.addressRow, a.id === address?.id && { backgroundColor: service.accentSoft }]}
              accessibilityRole="radio"
              aria-checked={a.id === address?.id}
              accessibilityLabel={`${a.fullName}, ${formatAddress(a)}`}
            >
              <IonIcon name={a.id === address?.id ? 'checkmark-circle' : 'radio-button-off'} size="md" color={a.id === address?.id ? service.accentDeep : colors.lineStrong} />
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

export default FoodCheckout;
