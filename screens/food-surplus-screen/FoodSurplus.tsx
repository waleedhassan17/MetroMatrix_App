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
import { AppText, Button, Card, Divider, IconButton, InlineNotice, IonIcon, ScreenShell, SkeletonLines, StatusPill, TextAction } from '../../Custom-Components/index';
import { ChoiceLine } from '../../Custom-Components/food/ChoiceLine';
import type { FoodAppParamList } from '../../models';
import { selectFoodPoint } from '../../store/preferencesSlice';
import { cdn } from '../../utils/cdn/cdn';
import { callNumber, navigateTo } from '../../utils/maps/maps';
import { formatPKR } from '../../utils/money/money';
import { haptics } from '../../utils/haptics/haptics';
import { loadSurplusAsync, newSurplusKey, reserveSurplusAsync, selectFoodSurplus, setSurplusMethod, setSurplusQuantity } from './foodSurplusSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodSurplus'>;

const makeStyles = ({ space, colors, size }: Theme) =>
  StyleSheet.create({
    photo: { width: '100%', aspectRatio: size.railPhotoAspect, backgroundColor: colors.surfaceSunk },
    content: { padding: space.s20, gap: space.s16 },
    gap: { gap: space.s8 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    line: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    grow: { flex: 1, gap: space.s4, minWidth: 0 },
    price: { flexDirection: 'row', alignItems: 'baseline', gap: space.s8, flexWrap: 'wrap' },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
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
  const { colors, size } = useTheme();
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
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={s.error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: load }} /> : <SkeletonLines lines={8} />}
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
          <Button label={`Reserve · ${formatPKR(total)}`} onPress={() => void reserve()} loading={s.reserving} fullWidth />
        ) : (
          <Button label={BOX_STATUS[b.status === 'live' ? 'sold_out' : b.status].customerLabel} disabled onPress={() => undefined} fullWidth />
        )
      }>
      <Image source={cdn(b.photoUrl, { w: size.surplusCard * 2 }) ?? undefined} style={styles.photo} contentFit="cover" accessibilityLabel={`${b.title}: photo`} />
      <View style={styles.content}>
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
          <StatusPill label={`${BACHAT_BOX} · ${discountLabel(b.value, b.price)}`} tone="success" />
          <AppText variant="h2">{b.title}</AppText>
          <View style={styles.price}>
            <AppText variant="title">{formatPKR(b.price)}</AppText>
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

        <Card>
          <View style={styles.line}>
            <IonIcon name="time-outline" size="md" color={colors.inkMuted} />
            <View style={styles.grow}>
              <AppText variant="bodyStrong">{`Pick up ${b.pickupLabel}`}</AppText>
              <AppText variant="small" tone="muted">
                At the kitchen. No delivery for Bachat Boxes.
              </AppText>
            </View>
          </View>
          <Divider />
          <View style={styles.line}>
            <IonIcon name="location-outline" size="md" color={colors.inkMuted} />
            <View style={styles.grow}>
              <AppText variant="bodyStrong">{b.vendor.name}</AppText>
              {where ? (
                <AppText variant="small" tone="muted">
                  {where}
                </AppText>
              ) : null}
              {b.vendor.distanceKm !== null ? (
                <AppText variant="caption" tone="muted">
                  {`${b.vendor.distanceKm} km from you`}
                </AppText>
              ) : null}
            </View>
            {b.pickup.phone ? <IconButton icon="call-outline" accessibilityLabel={`Call ${b.vendor.name}`} onPress={() => callNumber(b.pickup.phone!)} /> : null}
          </View>
          {b.pickup.lat !== null && b.pickup.lng !== null ? <TextAction label="Directions" icon="navigate-outline" onPress={() => navigateTo(b.pickup.lat!, b.pickup.lng!)} /> : null}
          <TextAction label="See the kitchen’s menu" onPress={() => navigation.navigate('FoodVendor', { slug: b.vendor.slug })} />
        </Card>

        {open ? (
          <>
            <Card>
              <View style={styles.row}>
                <View style={styles.grow}>
                  <AppText variant="title">How many</AppText>
                  <AppText variant="caption" tone="muted">
                    {`Up to ${b.maxPerCustomer} each, so more people get one`}
                  </AppText>
                </View>
                <View style={styles.stepper}>
                  <IconButton icon="remove" tone="muted" onPress={() => dispatch(setSurplusQuantity(s.quantity - 1))} disabled={s.quantity <= 1} accessibilityLabel="One fewer" />
                  <AppText variant="h2" accessibilityLabel={`${s.quantity} boxes`}>
                    {String(s.quantity)}
                  </AppText>
                  <IconButton icon="add" tone="muted" onPress={() => dispatch(setSurplusQuantity(s.quantity + 1))} disabled={s.quantity >= max} accessibilityLabel="One more" />
                </View>
              </View>
            </Card>
            <View style={styles.gap}>
              <AppText variant="sectionTitle">How you pay</AppText>
              {b.paymentMethods.map(m => (
                <ChoiceLine key={m} label={BOX_PAYMENT[m].label} note={BOX_PAYMENT[m].hint} price={null} selected={s.method === m} multiple={false} onPress={() => dispatch(setSurplusMethod(m))} />
              ))}
              <AppText variant="caption" tone="muted">
                You pay the kitchen directly. MetroMatrix takes no commission.
              </AppText>
            </View>
          </>
        ) : null}
      </View>
    </ScreenShell>
  );
};

export default FoodSurplus;
