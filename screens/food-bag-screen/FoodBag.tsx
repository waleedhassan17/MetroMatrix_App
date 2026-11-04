// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: your bag
// ═══════════════════════════════════════════════════════
// One kitchen's dishes: delivery or pick-up, as soon as possible or later,
// each line with its choices and note, and whatever changed since it went
// in (a price, a dish sold out, the kitchen closing) said where it happened.
// The subtotal is the server's; delivery and any deal come at checkout. The
// kitchen heads the bag once (StoreHeadRow), lines are LineItemRows with the
// stepper and trash in fixed places, and the sticky CtaBar says what's next.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useNow } from '../../hooks/useNow';
import { FULFILMENT_LABEL, bagBlocker, bagNotices, fixOf, lineChoices, whenChoices } from '../../models/food/bagModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, BagGroupSkeleton, Card, CtaBar, DangerRow, Divider, EmptyState, IconButton, InlineNotice, LineItemRow, ListRow, QuantityStepper, ScreenShell, SectionCard, SegmentTabs, Sheet, Skeleton, StoreHeadRow, TextAction } from '../../Custom-Components/index';
import { TrustNote } from '../../Components/food/FoodParts';
import { customerTrustLine } from '../../models/food/trustModel';
import { MAX_QUANTITY } from '../../models/food/itemSelectionModel';
import { ChoiceLine } from '../../Custom-Components/food/ChoiceLine';
import type { FoodAppParamList, FoodCartLine, FoodFulfilment } from '../../models';
import { formatPKR } from '../../utils/money/money';
import {
  clearFoodBagAsync,
  loadFoodBagAsync,
  loadFoodSlotsAsync,
  removeFoodLineAsync,
  selectFoodBag,
  setFoodBagModeAsync,
  setWhenSheet,
  updateFoodLineAsync,
} from './foodBagSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodBag'>;

const makeStyles = ({ space, gutter }: Theme) =>
  StyleSheet.create({
    content: { paddingHorizontal: gutter, paddingBottom: space.s40, gap: space.s16 },
    head: { paddingVertical: space.s12 },
    line: { paddingVertical: space.s12 },
    // The stepper, then the trash: always in the same places, so nothing shifts.
    actions: { flexDirection: 'row', alignItems: 'center', gap: space.s8, paddingTop: space.s4 },
    sheetList: { gap: space.s4 },
  });

const FoodBag: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodBagContent {...props} />
  </ServiceScope>
);

const FoodBagContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'FoodTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, size } = useTheme();
  const b = useAppSelector(selectFoodBag);
  const now = useNow(60_000);
  const cart = b.cart;
  const vendor = cart.vendor;

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadFoodBagAsync());
    }, [dispatch]),
  );

  const openWhen = () => {
    if (vendor) void dispatch(loadFoodSlotsAsync(vendor.id));
    dispatch(setWhenSheet(true));
  };

  const blocker = bagBlocker(cart);
  const notices = bagNotices(cart);
  const short = cart.issues.find(i => i.code === 'BELOW_MIN_ORDER');

  if (cart.empty) {
    return (
      <ScreenShell title="Your bag" onBack={back} scroll>
        {b.status === 'loading' || b.status === 'idle' ? (
          <BagGroupSkeleton />
        ) : b.status === 'failed' ? (
          <InlineNotice message={b.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadFoodBagAsync()) }} />
        ) : (
          <EmptyState
            ion="bag-handle-outline"
            title="Your bag is empty"
            body="Add dishes from a kitchen’s menu and they’ll wait here."
            action={{ label: 'Browse the Food Court', onPress: () => navigation.navigate('FoodTabs', { screen: 'FoodHomeTab' }) }}
          />
        )}
      </ScreenShell>
    );
  }

  const fulfilment: FoodFulfilment = cart.fulfilment ?? 'delivery';
  const both = !!vendor?.acceptsDelivery && !!vendor.acceptsPickup;
  const whenLabelNow = cart.scheduledFor ? cart.scheduledFor.label : 'As soon as possible';

  const renderLine = (l: FoodCartLine) => {
    const busy = b.busyLineId === l.id;
    const meta = [lineChoices(l), l.notes ? `“${l.notes}”` : null].filter(Boolean).join(' · ');
    return (
      <View key={l.id}>
        <Divider />
        <View style={styles.line}>
          <LineItemRow shape="square" imageUrl={l.photoUrl} name={l.name} meta={meta || null} price={formatPKR(l.lineTotal)} soldOut={!!l.error}>
            {l.error ? (
              <AppText variant="small" tone="warning">
                {l.error.message}
              </AppText>
            ) : l.priceChanged ? (
              <AppText variant="small" tone="warning">{`Now ${formatPKR(l.unitPrice)} each`}</AppText>
            ) : null}
            <View style={styles.actions}>
              {l.error ? (
                <TextAction label="Remove" onPress={() => void dispatch(removeFoodLineAsync(l.id))} disabled={busy} />
              ) : (
                <>
                  <QuantityStepper
                    value={l.quantity}
                    min={1}
                    max={MAX_QUANTITY}
                    disabled={busy}
                    label={`How many ${l.name}`}
                    onChange={quantity => void dispatch(updateFoodLineAsync({ lineId: l.id, quantity }))}
                  />
                  <IconButton icon="trash-outline" tone="muted" accessibilityLabel={`Remove ${l.name}`} disabled={busy} onPress={() => void dispatch(removeFoodLineAsync(l.id))} />
                </>
              )}
            </View>
          </LineItemRow>
        </View>
      </View>
    );
  };

  const opensAt = cart.issues.find(i => i.code === 'VENDOR_CLOSED')?.details?.opensAt;
  const choices = whenChoices(b.slotsFor === vendor?.id ? b.slots : null, now, typeof opensAt === 'string' ? opensAt : null);
  const needsTime = !!blocker && fixOf(blocker) === 'schedule';

  return (
    <ScreenShell
      title="Your bag"
      onBack={back}
      scroll
      padded={false}
      footer={
        <CtaBar
          label="Subtotal"
          amount={cart.subtotal}
          note={!blocker ? `${cart.itemCount} ${cart.itemCount === 1 ? 'item' : 'items'} · delivery and deals at checkout` : blocker.message}
          action={{
            label: !blocker ? 'Checkout' : needsTime ? 'Choose a time' : short && blocker.code === 'BELOW_MIN_ORDER' ? `Add ${formatPKR(Number(short.details?.shortfall ?? 0))} more` : 'Checkout',
            onPress: () => (needsTime ? openWhen() : blocker?.code === 'BELOW_MIN_ORDER' && vendor ? navigation.navigate('FoodVendor', { slug: vendor.slug }) : navigation.navigate('FoodCheckout')),
            disabled: !!blocker && !needsTime && blocker.code !== 'BELOW_MIN_ORDER',
            loading: b.modeBusy,
          }}
        />
      }
    >
      <View style={styles.content}>
        {b.actionError.message ? <InlineNotice message={b.actionError.message} /> : null}
        {notices.map(n => (
          <InlineNotice
            key={`${n.code}:${n.message}`}
            tone={n.code === 'PRICE_CHANGED' ? 'info' : 'warning'}
            message={n.message}
            action={fixOf(n) === 'schedule' ? { label: 'Schedule for later', onPress: openWhen } : fixOf(n) === 'pickup' && vendor?.acceptsPickup ? { label: 'Switch to pick-up', onPress: () => void dispatch(setFoodBagModeAsync({ fulfilment: 'pickup' })) } : undefined}
          />
        ))}

        <Card padded="horizontal">
          {vendor ? (
            <View style={styles.head}>
              <StoreHeadRow
                store={{ name: vendor.name, logoUrl: vendor.logoUrl, brandColor: service.accent }}
                meta={`${cart.itemCount} ${cart.itemCount === 1 ? 'item' : 'items'} · ${vendor.openState.label}`}
                onPress={() => navigation.navigate('FoodVendor', { slug: vendor.slug })}
                accessibilityLabel={`${vendor.name}, ${vendor.openState.label}. See the menu`}
              />
            </View>
          ) : null}
          {cart.lines.map(renderLine)}
          {vendor ? (
            <>
              <Divider />
              <ListRow title={`Add more from ${vendor.name}`} leftIcon="add-circle-outline" onPress={() => navigation.navigate('FoodVendor', { slug: vendor.slug })} />
            </>
          ) : null}
        </Card>

        <SectionCard title={fulfilment === 'pickup' ? 'Pick-up' : 'Delivery'} icon={fulfilment === 'pickup' ? 'bag-handle-outline' : 'bicycle-outline'}>
          {both ? (
            <SegmentTabs
              options={(['delivery', 'pickup'] as const).map(k => ({ key: k, label: FULFILMENT_LABEL[k] }))}
              value={fulfilment}
              onChange={k => k !== fulfilment && void dispatch(setFoodBagModeAsync({ fulfilment: k }))}
              accessibilityLabel="Delivery or pick-up"
            />
          ) : (
            <AppText variant="small" tone="muted">
              {vendor?.acceptsPickup ? 'Pick-up only: collect it from the kitchen.' : 'Delivered by the kitchen’s own rider.'}
            </AppText>
          )}
          <ListRow
            title={whenLabelNow}
            subtitle={fulfilment === 'pickup' ? 'Pick-up time' : 'Delivery time'}
            leftIcon="time-outline"
            value="Change"
            onPress={openWhen}
          />
        </SectionCard>

        {short ? (
          <AppText variant="small" tone="warning">
            {short.message}
          </AppText>
        ) : null}
        <TrustNote text={customerTrustLine(vendor?.name)} />
        <DangerRow
          label="Empty the bag"
          onConfirm={() => void dispatch(clearFoodBagAsync())}
          confirm={{ title: 'Empty your bag?', message: `This removes every dish from ${vendor?.name ?? 'the kitchen'}.`, action: 'Empty the bag' }}
        />
      </View>

      <Sheet visible={b.whenSheetOpen} onClose={() => dispatch(setWhenSheet(false))} title={fulfilment === 'pickup' ? 'When to collect' : 'When to deliver'} subtitle={vendor?.preorderOnly ? 'This kitchen takes pre-orders only.' : undefined}>
        <View style={styles.sheetList}>
          {vendor?.preorderOnly ? null : (
            <ChoiceLine label="As soon as possible" price={null} selected={!cart.scheduledFor} multiple={false} onPress={() => void dispatch(setFoodBagModeAsync({ scheduledFor: null }))} />
          )}
          {b.slotsFor === vendor?.id && !b.slots ? (
            <>
              <Skeleton height={size.control.lg} shape="md" />
              <Skeleton height={size.control.lg} shape="md" />
            </>
          ) : null}
          {choices.map(c => (
            <ChoiceLine
              key={c.at}
              label={c.label}
              price={null}
              note={c.note}
              selected={cart.scheduledFor?.at === c.at}
              disabled={c.disabled || b.modeBusy}
              multiple={false}
              onPress={() => void dispatch(setFoodBagModeAsync({ scheduledFor: c.at }))}
            />
          ))}
        </View>
        {b.actionError.message ? <InlineNotice message={b.actionError.message} /> : null}
      </Sheet>
    </ScreenShell>
  );
};

export default FoodBag;
