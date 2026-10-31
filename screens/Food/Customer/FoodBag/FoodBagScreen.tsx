// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: your bag
// ═══════════════════════════════════════════════════════
// One kitchen's dishes: delivery or pick-up, as soon as possible or later,
// each line with its choices and note, and whatever changed since it went
// in (a price, a dish sold out, the kitchen closing) said where it happened.
// The subtotal is the server's; delivery and any deal come at checkout.

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { useNow } from '../../../../hooks/useNow';
import { FULFILMENT_LABEL, bagBlocker, bagNotices, fixOf, lineChoices, whenChoices } from '../../../../models/food/bagModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, Divider, EmptyState, IconButton, IonIcon, InlineNotice, QuantityStepper, ScreenShell, SegmentTabs, Sheet, SkeletonLines, TextAction } from '../../../../Custom-Components/index';
import { ChoiceLine } from '../../../../Custom-Components/food/ChoiceLine';
import type { FoodAppParamList, FoodCartLine, FoodFulfilment } from '../../../../types';
import { cdn } from '../../../../utils/cdn';
import { formatPKR } from '../../../../utils/money';
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

const makeStyles = ({ colors, space, size, radius, gutter }: Theme) =>
  StyleSheet.create({
    content: { paddingHorizontal: gutter, paddingTop: space.s16, paddingBottom: space.s40, gap: space.s16 },
    vendor: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    logo: { width: size.avatar.md, height: size.avatar.md, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceSunk },
    fill: { ...StyleSheet.absoluteFillObject },
    grow: { flex: 1, gap: space.s4 },
    when: { flexDirection: 'row', alignItems: 'center', gap: space.s12, minHeight: size.touch },
    line: { flexDirection: 'row', gap: space.s12, paddingVertical: space.s12 },
    lineSide: { alignItems: 'flex-end', gap: space.s8 },
    total: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    sheetList: { gap: space.s4 },
  });

const FoodBagScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodBagContent {...props} />
  </ServiceScope>
);

const FoodBagContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'FoodTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, service, size } = useTheme();
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
        {b.status === 'loading' ? (
          <SkeletonLines lines={6} />
        ) : b.status === 'failed' ? (
          <InlineNotice message={b.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadFoodBagAsync()) }} />
        ) : (
          <EmptyState
            icon="shopping-bag"
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

  const renderLine = (l: FoodCartLine, i: number) => {
    const busy = b.busyLineId === l.id;
    return (
      <View key={l.id}>
        {i > 0 ? <Divider /> : null}
        <View style={styles.line}>
          <View style={styles.grow}>
            <AppText variant="bodyStrong">{l.name}</AppText>
            {lineChoices(l) ? (
              <AppText variant="small" tone="muted">
                {lineChoices(l)}
              </AppText>
            ) : null}
            {l.notes ? (
              <AppText variant="small" tone="muted">{`“${l.notes}”`}</AppText>
            ) : null}
            {l.error ? (
              <AppText variant="small" tone="warning">
                {l.error.message}
              </AppText>
            ) : l.priceChanged ? (
              <AppText variant="small" tone="warning">{`Now ${formatPKR(l.unitPrice)} each`}</AppText>
            ) : null}
          </View>
          <View style={styles.lineSide}>
            <AppText variant="bodyStrong">{formatPKR(l.lineTotal)}</AppText>
            {l.error ? (
              <TextAction label="Remove" onPress={() => void dispatch(removeFoodLineAsync(l.id))} disabled={busy} />
            ) : (
              <View style={styles.vendor}>
                {l.quantity === 1 ? (
                  <IconButton icon="trash-outline" tone="muted" accessibilityLabel={`Remove ${l.name}`} onPress={() => void dispatch(removeFoodLineAsync(l.id))} />
                ) : null}
                <QuantityStepper
                  value={l.quantity}
                  min={1}
                  max={50}
                  disabled={busy}
                  label={`How many ${l.name}`}
                  onChange={quantity => void dispatch(updateFoodLineAsync({ lineId: l.id, quantity }))}
                />
              </View>
            )}
          </View>
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
        <>
          <View style={styles.total}>
            <AppText variant="body" tone="muted">
              Subtotal
            </AppText>
            <AppText variant="title">{formatPKR(cart.subtotal)}</AppText>
          </View>
          <Button
            label={
              !blocker
                ? 'Go to checkout'
                : needsTime
                  ? 'Choose a time to order'
                  : short && blocker.code === 'BELOW_MIN_ORDER'
                    ? `Add ${formatPKR(Number(short.details?.shortfall ?? 0))} more`
                    : 'Fix your bag first'
            }
            onPress={() => (needsTime ? openWhen() : blocker?.code === 'BELOW_MIN_ORDER' && vendor ? navigation.navigate('FoodVendor', { slug: vendor.slug }) : navigation.navigate('FoodCheckout'))}
            disabled={!!blocker && !needsTime && blocker.code !== 'BELOW_MIN_ORDER'}
            loading={b.modeBusy}
            fullWidth
          />
        </>
      }
    >
      <View style={styles.content}>
        {vendor ? (
          <Pressable onPress={() => navigation.navigate('FoodVendor', { slug: vendor.slug })} style={styles.vendor} accessibilityRole="button" accessibilityLabel={`${vendor.name}, see the menu`}>
            <View style={styles.logo}>{vendor.logoUrl ? <Image source={{ uri: cdn(vendor.logoUrl, { w: size.avatar.md }) ?? undefined }} style={styles.fill} contentFit="cover" /> : null}</View>
            <View style={styles.grow}>
              <AppText variant="title">{vendor.name}</AppText>
              <AppText variant="small" tone={vendor.openState.open ? 'muted' : 'warning'}>
                {vendor.openState.label}
              </AppText>
            </View>
            <IonIcon name="chevron-forward" size="md" color={colors.inkFaint} />
          </Pressable>
        ) : null}

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

        <Card onPress={openWhen} accessibilityLabel={`${fulfilment === 'pickup' ? 'Pick-up' : 'Delivery'} time: ${whenLabelNow}. Change`}>
          <View style={styles.when}>
            <IonIcon name="time-outline" size="lg" color={service.accentDeep} />
            <View style={styles.grow}>
              <AppText variant="small" tone="muted">
                {fulfilment === 'pickup' ? 'Pick-up time' : 'Delivery time'}
              </AppText>
              <AppText variant="bodyStrong">{whenLabelNow}</AppText>
            </View>
            <AppText variant="small" tone="accentDeep">
              Change
            </AppText>
          </View>
        </Card>

        {b.actionError.message ? <InlineNotice message={b.actionError.message} /> : null}
        {notices.map(n => (
          <InlineNotice
            key={`${n.code}:${n.message}`}
            tone={n.code === 'PRICE_CHANGED' ? 'info' : 'warning'}
            message={n.message}
            action={fixOf(n) === 'schedule' ? { label: 'Schedule for later', onPress: openWhen } : fixOf(n) === 'pickup' && vendor?.acceptsPickup ? { label: 'Switch to pick-up', onPress: () => void dispatch(setFoodBagModeAsync({ fulfilment: 'pickup' })) } : undefined}
          />
        ))}

        <Card padded="horizontal">{cart.lines.map(renderLine)}</Card>

        {vendor ? <TextAction label="Add more dishes" icon="add" onPress={() => navigation.navigate('FoodVendor', { slug: vendor.slug })} /> : null}
        {short ? (
          <AppText variant="small" tone="warning">
            {short.message}
          </AppText>
        ) : null}
        <AppText variant="small" tone="muted">
          {`Delivery and any deal are worked out at checkout. You pay ${vendor?.name ?? 'the kitchen'} directly; MetroMatrix takes no commission.`}
        </AppText>
        <TextAction label="Empty the bag" icon="trash-outline" onPress={() => void dispatch(clearFoodBagAsync())} />
      </View>

      <Sheet visible={b.whenSheetOpen} onClose={() => dispatch(setWhenSheet(false))} title={fulfilment === 'pickup' ? 'When to collect' : 'When to deliver'} subtitle={vendor?.preorderOnly ? 'This kitchen takes pre-orders only.' : undefined}>
        <View style={styles.sheetList}>
          {vendor?.preorderOnly ? null : (
            <ChoiceLine label="As soon as possible" price={null} selected={!cart.scheduledFor} multiple={false} onPress={() => void dispatch(setFoodBagModeAsync({ scheduledFor: null }))} />
          )}
          {b.slotsFor === vendor?.id && !b.slots ? <SkeletonLines lines={4} /> : null}
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

export default FoodBagScreen;
