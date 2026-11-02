// ═══════════════════════════════════════════════════════
// MetroMatrix — Checkout (one screen, three steps)
// ═══════════════════════════════════════════════════════
// The FYP's stepped checkout: where it goes; how you'll pay each store (a
// coupon of theirs, a note to them); then the whole order to check, with
// its photos and what each store charges, before placing it. The step card
// under the header says where you are; back (the header's, Android's, the
// browser's) steps back before it leaves. MetroMatrix takes no commission
// and never holds the money: cash goes to the rider, transfers go to the
// store's own account.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector, useAppStore } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useDebouncedValue } from '../../hooks/usePagedList';
import { CHECKOUT_STEPS, stepBlocker, type CheckoutStep } from '../../models/shopping/checkoutStepModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  Button,
  CheckoutSkeleton,
  Divider,
  InlineNotice,
  Sheet,
  SkeletonLines,
  StepCard,
  StickyCTA,
  TextAction,
  TextField,
} from '../../Custom-Components/index';
import { ShopTopBar } from '../../Components/shopping/ShopParts';
import type { ShopBrowseParamList } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import { formatPKR } from '../../utils/money/money';
import { AddressStep, PaymentStep, ReviewStep } from './CheckoutSteps';
import { loadAddressesAsync, selectAddressBook } from '../address-book-screen/addressBookSlice';
import { loadBagAsync, selectBag } from '../bag-screen/bagSlice';
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
  setCouponInput,
  setStoreNote,
  toCheckoutInput,
} from './checkoutSlice';

type Props = NativeStackScreenProps<ShopBrowseParamList, 'Checkout'>;

const makeStyles = ({ colors, space, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: gutter, paddingTop: space.s20, paddingBottom: space.s40, gap: space.s16 },
    couponRow: { gap: space.s4, paddingVertical: space.s12 },
    couponHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
  });

const Checkout: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <CheckoutContent {...props} />
  </ServiceScope>
);

const CheckoutContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'Bag' });
  const dispatch = useAppDispatch();
  const appStore = useAppStore();
  const styles = useStyles(makeStyles);
  const { motion } = useTheme();
  const c = useAppSelector(selectCheckout);
  const [step, setStep] = useState<CheckoutStep>(0);
  // Back walks the steps before it leaves (the place-order reset and a sold-out bounce go through).
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  const leaving = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const go = (next: CheckoutStep) => {
    setStep(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  useEffect(
    () =>
      navigation.addListener('beforeRemove', ev => {
        const type = ev.data.action.type;
        if (leaving.current || stepRef.current === 0 || (type !== 'GO_BACK' && type !== 'POP')) return;
        ev.preventDefault();
        setStep(s => (s > 0 ? ((s - 1) as CheckoutStep) : s));
      }),
    [navigation],
  );
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
  const stale = !preview || settled !== (input ? JSON.stringify(input) : '') || c.previewStatus === 'loading';
  const canPlace = !!address && !!preview?.canPlace && !stale && c.placeStatus !== 'loading';
  const blocker = stepBlocker(step, { hasAddress: !!address, preview, stale });

  const place = async () => {
    if (!input || !canPlace) return;
    haptics.press();
    const r = await dispatch(placeOrderAsync({ input, key: c.idempotencyKey }));
    const placed = placeOrderAsync.fulfilled.match(r) ? selectCheckout(appStore.getState()).placed : null;
    if (placed) {
      haptics.success();
      dispatch(newCheckoutKey());
      void dispatch(loadBagAsync());
      // The Bag and Checkout leave the history: back from "Order placed" returns
      // to where they were shopping, never to an empty Bag or a used checkout.
      const groupCode = placed.code;
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
      leaving.current = true;
      back();
    } else if (code === 'CHECKOUT_BLOCKED') {
      void dispatch(previewCheckoutAsync(input));
    }
  };

  const couponStore = c.couponSheet.storeId;
  useEffect(() => {
    if (couponStore) void dispatch(loadCouponsAsync(couponStore));
  }, [couponStore, dispatch]);

  const loadingAddresses = book.status === 'loading' && !book.addresses.length;

  return (
    <View style={styles.root}>
      <ShopTopBar
        title="Checkout"
        subtitle={`Step ${step + 1} of ${CHECKOUT_STEPS.length} · ${CHECKOUT_STEPS[step]}`}
        onBack={back}
        showBag={false}
      />
      <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <StepCard steps={[...CHECKOUT_STEPS]} index={step} onStep={i => go(i as CheckoutStep)} />

        {c.previewError.message ? <InlineNotice message={c.previewError.message} /> : null}
        {c.placeError.message && c.placeError.code !== 'OUT_OF_STOCK' ? <InlineNotice message={c.placeError.message} /> : null}

        {loadingAddresses ? (
          <CheckoutSkeleton />
        ) : step === 0 ? (
          <AddressStep
            addresses={book.addresses}
            chosenId={address?.id ?? null}
            onChoose={id => dispatch(chooseAddress(id))}
            onAdd={() => navigation.navigate('AddressForm')}
            preview={stale ? null : preview}
          />
        ) : !preview || !address ? (
          <CheckoutSkeleton />
        ) : step === 1 ? (
          <PaymentStep
            stores={preview.stores}
            choices={c.choices}
            onPay={(storeId, method) => dispatch(choosePayment({ storeId, method }))}
            onAddCoupon={storeId => dispatch(openCouponSheet(storeId))}
            onRemoveCoupon={storeId => dispatch(applyCoupon({ storeId, code: null }))}
            onNote={(storeId, note) => dispatch(setStoreNote({ storeId, note }))}
          />
        ) : (
          <ReviewStep address={address} preview={preview} choices={c.choices} onChangeAddress={() => go(0)} onChangePayment={() => go(1)} />
        )}
      </ScrollView>

      <StickyCTA>
        {blocker && !(stale && c.previewStatus === 'loading') ? (
          <AppText variant="caption" tone="muted" align="center">
            {blocker}
          </AppText>
        ) : null}
        {step < 2 ? (
          <Button label="Continue" rightIon="arrow-forward" onPress={() => go((step + 1) as CheckoutStep)} disabled={!!blocker} fullWidth />
        ) : (
          <Button
            label={preview && !stale ? `Place order · ${formatPKR(preview.total)}` : 'Place order'}
            onPress={() => void place()}
            loading={c.placeStatus === 'loading'}
            disabled={!canPlace}
            fullWidth
          />
        )}
      </StickyCTA>

      <Sheet
        visible={!!couponStore}
        onClose={() => dispatch(closeCouponSheet())}
        title="Coupons"
        subtitle={couponStore ? `From ${preview?.stores.find(s => s.store.id === couponStore)?.store.name ?? 'this store'}` : undefined}>
        <TextField label="Coupon code" value={c.couponSheet.input} onChangeText={t => dispatch(setCouponInput(t))} autoCapitalize="characters" placeholder="LAWN10" />
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

export default Checkout;
