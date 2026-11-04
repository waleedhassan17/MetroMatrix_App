// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: a Bachat Box
// ═══════════════════════════════════════════════════════
// Tonight's surplus from a kitchen nearby, at a lower price, for pickup:
// what it is worth against what it costs, roughly what is inside (a
// surprise), when and where to collect it, how many are left. Reserve one
// or two, paying at pickup or by transfer to the kitchen's own account
// (MetroMatrix takes no cut). The pickup code comes next.

import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useAppDispatch, useAppSelector, useAppStore } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { BOX_PAYMENT, BOX_STATUS } from '../../models/kitchen/kitchenStatusModel';
import { BACHAT_BOX, discountLabel } from '../../models/kitchen/surplusModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, CtaBar, Divider, IconButton, InlineNotice, ListRow, QuantityStepper, ScreenShell, SectionCard, Skeleton, StatusPill, TextAction } from '../../Custom-Components/index';
import { TrustNote } from '../../Components/food/FoodParts';
import { customerTrustLine } from '../../models/food/trustModel';
import { distanceLabel } from '../../models/food/discoveryModel';
import { ChoiceLine } from '../../Custom-Components/food/ChoiceLine';
import type { FoodAppParamList } from '../../models';
import { selectFoodPoint } from '../../store/preferencesSlice';
import { cdn } from '../../utils/cdn/cdn';
import { callNumber, navigateTo } from '../../utils/maps/maps';
import { formatPKR } from '../../utils/money/money';
import { haptics } from '../../utils/haptics/haptics';
import { loadSurplusAsync, newSurplusKey, reserveSurplusAsync, selectFoodSurplus, setSurplusMethod, setSurplusQuantity } from './foodSurplusSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodSurplus'>;

const makeStyles = ({ space, colors, size, radius, gutter }: Theme) =>
  StyleSheet.create({
    photo: { width: '100%', aspectRatio: size.railPhotoAspect, borderRadius: radius.lg, backgroundColor: colors.surfaceSunk },
    content: { paddingHorizontal: gutter, paddingBottom: space.s40, gap: space.s16 },
    gap: { gap: space.s8 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    grow: { flex: 1, gap: space.s4, minWidth: 0 },
    price: { flexDirection: 'row', alignItems: 'baseline', gap: space.s8, flexWrap: 'wrap' },
    links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s16 },
    loading: { gap: space.s16 },
  });

const FoodSurplus: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodSurplusContent {...props} />
  </ServiceScope>
);

const FoodSurplusContent: React.FC<Props> = ({ navigation, route }) => {
  const { id } = route.params;
  const { back } = useBack({ name: 'FoodTabs' });
  const dispatch = useAppDispatch();
  const appStore = useAppStore();
  const styles = useStyles(makeStyles);
  const { size, motion } = useTheme();
  const s = useAppSelector(selectFoodSurplus);
  const point = useAppSelector(selectFoodPoint);

  useEffect(() => {
    dispatch(newSurplusKey());
  }, [dispatch]);
  const load = useCallback(() => void dispatch(loadSurplusAsync({ id, at: point ? { lat: point.lat, lng: point.lng } : null })), [dispatch, id, point]);
  useFocusEffect(load);

  const b = s.box?.id === id ? s.box : null;
  if (!b) {
    return (
      <ScreenShell title={BACHAT_BOX} onBack={back}>
        {s.status === 'failed' ? (
          <InlineNotice message={s.error.message} action={s.error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: load }} />
        ) : (
          <View style={styles.loading} accessibilityLabel="Loading" accessibilityRole="progressbar">
            <View style={styles.photo} />
            <Skeleton width="70%" height={size.icon.lg} />
            <Skeleton width="40%" />
            <Skeleton height={size.control.lg * 2} shape="lg" />
          </View>
        )}
      </ScreenShell>
    );
  }

  const open = b.status === 'live' && b.left > 0;
  const max = Math.max(1, Math.min(b.maxPerCustomer, b.left));
  const total = b.price * s.quantity;
  const where = [b.pickup.addressLine, b.pickup.area, b.pickup.city].filter(Boolean).join(', ');

  const reserve = async () => {
    haptics.press();
    const r = await dispatch(reserveSurplusAsync());
    const reserved = reserveSurplusAsync.fulfilled.match(r) ? selectFoodSurplus(appStore.getState()).reserved : null;
    if (reserved) {
      haptics.success();
      navigation.replace('FoodSurplusReserved', { code: reserved.code, fresh: true });
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title={b.vendor.name}
      subtitle={`${BACHAT_BOX} · ${b.pickupLabel}`}
      onBack={back}
      scroll
      padded={false}
      refreshing={s.status === 'loading'}
      onRefresh={load}
      footer={
        open ? (
          <CtaBar label="Total" amount={total} note={`${s.quantity} × ${formatPKR(b.price)} · pay the kitchen`} action={{ label: 'Reserve', onPress: () => void reserve(), loading: s.reserving }} />
        ) : (
          <Button label={BOX_STATUS[b.status === 'live' ? 'sold_out' : b.status].customerLabel} disabled onPress={() => undefined} fullWidth />
        )
      }>
      <View style={styles.content}>
        <Image source={cdn(b.photoUrl, { w: size.surplusCard * 2 }) ?? undefined} style={styles.photo} contentFit="cover" transition={motion.imageFade} accessibilityLabel={`${b.title}: photo`} />
        {s.reserveError.message ? <InlineNotice title={s.reserveError.code === 'SURPLUS_SOLD_OUT' ? 'Just missed it' : undefined} message={s.reserveError.message} /> : null}
        {b.myReservations.length ? (
          <InlineNotice
            tone="info"
            title="You have this one reserved"
            message={`Your pickup code: ${b.myReservations.join(', ')}`}
            action={{ label: 'Show the code', onPress: () => navigation.navigate('FoodSurplusReserved', { code: b.myReservations[0] }) }}
          />
        ) : null}

        <View style={styles.gap}>
          <StatusPill label={`${BACHAT_BOX} · ${discountLabel(b.value, b.price)}`} tone="accent" />
          <AppText variant="cardTitle" accessibilityRole="header">
            {b.title}
          </AppText>
          <View style={styles.price}>
            <AppText variant="title" tone="accentDeep">
              {formatPKR(b.price)}
            </AppText>
            <AppText variant="small" tone="muted">
              {`${formatPKR(b.value)} of food`}
            </AppText>
            <AppText variant="small" tone={b.left <= 2 ? 'warning' : 'muted'}>
              {open ? `· ${b.left} left` : `· ${BOX_STATUS[b.status === 'live' ? 'sold_out' : b.status].customerLabel}`}
            </AppText>
          </View>
          <AppText variant="body">{b.contentsHint}</AppText>
          <AppText variant="small" tone="muted">
            {b.whatToExpect}
          </AppText>
        </View>

        <SectionCard title={`Pick up ${b.pickupLabel}`} subtitle="At the kitchen. No delivery for Bachat Boxes." icon="time-outline">
          <Divider />
          <ListRow
            title={b.vendor.name}
            subtitle={[where, distanceLabel(b.vendor.distanceKm) ? `${distanceLabel(b.vendor.distanceKm)} from you` : null].filter(Boolean).join(' · ') || undefined}
            leftIcon="location-outline"
            chevron={false}
            right={b.pickup.phone ? <IconButton icon="call-outline" accessibilityLabel={`Call ${b.vendor.name}`} onPress={() => callNumber(b.pickup.phone!)} /> : undefined}
          />
          <View style={styles.links}>
            {b.pickup.lat !== null && b.pickup.lng !== null ? <TextAction label="Directions" icon="navigate-outline" onPress={() => navigateTo(b.pickup.lat!, b.pickup.lng!)} /> : null}
            <TextAction label="See the kitchen’s menu" icon="restaurant-outline" onPress={() => navigation.navigate('FoodVendor', { slug: b.vendor.slug })} />
          </View>
        </SectionCard>

        {open ? (
          <>
            <SectionCard title="How many" subtitle={`Up to ${b.maxPerCustomer} each, so more people get one`} icon="layers-outline">
              <QuantityStepper value={s.quantity} onChange={n => dispatch(setSurplusQuantity(n))} min={1} max={max} label="How many boxes" />
            </SectionCard>
            <SectionCard title="Payment" subtitle={`You pay ${b.vendor.name} directly`} icon="wallet-outline">
              {b.paymentMethods.map(m => (
                <ChoiceLine key={m} label={BOX_PAYMENT[m].label} note={BOX_PAYMENT[m].hint} price={null} selected={s.method === m} multiple={false} onPress={() => dispatch(setSurplusMethod(m))} />
              ))}
            </SectionCard>
          </>
        ) : null}
        <TrustNote text={customerTrustLine(b.vendor.name)} />
      </View>
    </ScreenShell>
  );
};

export default FoodSurplus;
