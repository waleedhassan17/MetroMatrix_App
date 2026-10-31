// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: a tiffin plan
// ═══════════════════════════════════════════════════════
// A kitchen's plan: the meal and days, the time it arrives, what is cooked
// each day, the price for the period and per meal, places left; how
// skipping works. Asking to join it: the first day, where it goes, how you
// pay the kitchen (directly; MetroMatrix takes no cut). The kitchen
// approves the request.

import React, { useCallback, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { TIFFIN_PAY, WEEKDAY_LONG } from '../../models/kitchen/kitchenStatusModel';
import { perMealLabel, priceLabel, scheduleLabel, startChoices } from '../../models/kitchen/tiffinModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, Card, ChoiceChip, Divider, IonIcon, InlineNotice, ScreenShell, SkeletonLines, StatusPill, TextAction } from '../../Custom-Components/index';
import { ChoiceLine } from '../../Custom-Components/food/ChoiceLine';
import type { FoodAppParamList } from '../../models';
import { cdn } from '../../utils/cdn/cdn';
import { formatDayChip } from '../../utils/health-time/healthTime';
import { haptics } from '../../utils/haptics/haptics';
import { loadAddressesAsync, selectAddressBook } from '../address-book-screen/addressBookSlice';
import { chooseTiffin, loadTiffinPlanAsync, newTiffinKey, selectFoodTiffinPlan, subscribeTiffinAsync } from './foodTiffinPlanSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodTiffinPlan'>;

const makeStyles = ({ space, gutter, colors, size }: Theme) =>
  StyleSheet.create({
    photo: { width: '100%', aspectRatio: size.railPhotoAspect, backgroundColor: colors.surfaceSunk },
    content: { padding: gutter, gap: space.s16 },
    gap: { gap: space.s8 },
    line: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    grow: { flex: 1, gap: space.s4, minWidth: 0 },
    day: { flexDirection: 'row', gap: space.s12, paddingVertical: space.s8 },
    dayName: { width: size.avatar.lg + space.s20 },
    chipBar: { flexGrow: 0 },
    chips: { flexDirection: 'row', gap: space.s8 },
  });

const FoodTiffinPlan: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodTiffinPlanContent {...props} />
  </ServiceScope>
);

const FoodTiffinPlanContent: React.FC<Props> = ({ navigation, route }) => {
  const { id } = route.params;
  const { back } = useBack({ name: 'FoodTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, size } = useTheme();
  const s = useAppSelector(selectFoodTiffinPlan);
  const book = useAppSelector(selectAddressBook);

  useEffect(() => {
    dispatch(newTiffinKey());
    void dispatch(loadAddressesAsync());
  }, [dispatch]);
  const load = useCallback(() => void dispatch(loadTiffinPlanAsync(id)), [dispatch, id]);
  useFocusEffect(load);

  const p = s.plan?.id === id ? s.plan : null;
  const pinned = book.addresses.filter(a => a.lat !== null && a.lng !== null);
  // The default pinned address, unless one was picked.
  useEffect(() => {
    if (!s.addressId && pinned.length) dispatch(chooseTiffin({ addressId: (pinned.find(a => a.isDefault) ?? pinned[0]).id }));
  }, [dispatch, s.addressId, pinned]);

  if (!p) {
    return (
      <ScreenShell title="Tiffin" onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={s.error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: load }} /> : <SkeletonLines lines={10} />}
      </ScreenShell>
    );
  }

  const starts = startChoices(p);
  const full = p.seatsLeft === 0;
  const needsAddress = p.mode === 'delivery' && !s.addressId;

  const subscribe = async () => {
    haptics.press();
    const r = await dispatch(subscribeTiffinAsync());
    if (subscribeTiffinAsync.fulfilled.match(r) && r.payload) {
      haptics.success();
      navigation.replace('FoodTiffin', { code: r.payload.code, fresh: true });
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title={p.name}
      subtitle={p.vendor.name}
      onBack={back}
      scroll
      padded={false}
      refreshing={s.status === 'loading'}
      onRefresh={load}
      footer={
        full ? (
          <Button label="This plan is full" disabled onPress={() => undefined} fullWidth />
        ) : (
          <Button label={`Ask to join · ${priceLabel(p)}`} onPress={() => void subscribe()} loading={s.subscribing} disabled={!s.startDate || needsAddress} fullWidth />
        )
      }>
      {p.photoUrl ? <Image source={cdn(p.photoUrl, { w: size.surplusCard * 2 }) ?? undefined} style={styles.photo} contentFit="cover" accessibilityLabel={`${p.name}: photo`} /> : null}
      <View style={styles.content}>
        {s.subscribeError.message ? <InlineNotice message={s.subscribeError.message} /> : null}
        <View style={styles.gap}>
          <View style={styles.line}>
            <StatusPill label={scheduleLabel(p)} tone="accent" />
            <StatusPill label={full ? 'Full' : `${p.seatsLeft} places left`} tone={full ? 'warning' : 'success'} />
          </View>
          <AppText variant="h2">{`${priceLabel(p)}`}</AppText>
          <AppText variant="small" tone="muted">
            {`${perMealLabel(p)} · ${p.mealsPerPeriod} meals · ${p.mode === 'delivery' ? 'Delivered' : 'Collected'} ${p.window.label}`}
          </AppText>
          {p.description ? <AppText variant="body">{p.description}</AppText> : null}
        </View>

        <Card>
          <AppText variant="title">What’s cooked</AppText>
          {p.rotation.map((r, n) => (
            <View key={r.weekday}>
              {n > 0 ? <Divider /> : null}
              <View style={styles.day}>
                <AppText variant="bodyStrong" style={styles.dayName}>
                  {WEEKDAY_LONG[r.weekday]}
                </AppText>
                <AppText variant="body" style={styles.grow}>
                  {[...r.dishes.map(d => d.name), ...(r.note ? [r.note] : [])].join(', ')}
                </AppText>
              </View>
            </View>
          ))}
        </Card>

        <Card>
          <View style={styles.gap}>
            {[
              ['calendar-outline', `Skip any day until ${p.skipCutoffHours} hours before it arrives. Skipped meals come off your next period.`],
              ['pause-outline', 'Pause it while you travel, or cancel any time.'],
              ['wallet-outline', 'You pay the kitchen directly for each period. MetroMatrix takes no commission.'],
            ].map(([icon, text]) => (
              <View key={text} style={styles.line}>
                <IonIcon name={icon as 'calendar-outline'} size="md" color={colors.inkMuted} />
                <AppText variant="small" style={styles.grow}>
                  {text}
                </AppText>
              </View>
            ))}
          </View>
        </Card>

        {!full ? (
          <>
            <AppText variant="sectionTitle">Start on</AppText>
            {starts.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
                {starts.map(d => (
                  <ChoiceChip key={d} label={`${formatDayChip(d).weekday} ${formatDayChip(d).day} ${formatDayChip(d).month}`} selected={s.startDate === d} onPress={() => dispatch(chooseTiffin({ startDate: d }))} />
                ))}
              </ScrollView>
            ) : (
              <AppText variant="small" tone="muted">
                No start days are open right now.
              </AppText>
            )}

            {p.mode === 'delivery' ? (
              <View style={styles.gap}>
                <AppText variant="sectionTitle">Deliver to</AppText>
                {pinned.map(a => (
                  <ChoiceLine
                    key={a.id}
                    label={a.label === 'work' ? 'Work' : a.label === 'home' ? 'Home' : 'Other'}
                    note={[a.line1, a.area].filter(Boolean).join(', ')}
                    price={null}
                    selected={s.addressId === a.id}
                    multiple={false}
                    onPress={() => dispatch(chooseTiffin({ addressId: a.id }))}
                  />
                ))}
                {!pinned.length ? (
                  <AppText variant="small" tone="muted">
                    Add an address with its pin on the map, so the kitchen knows where to bring it.
                  </AppText>
                ) : null}
                <TextAction label="Add an address" icon="add" onPress={() => navigation.getParent()?.navigate('AddressForm')} />
              </View>
            ) : null}

            <View style={styles.gap}>
              <AppText variant="sectionTitle">How you pay the kitchen</AppText>
              {(['transfer', 'cash'] as const).map(m => (
                <ChoiceLine key={m} label={TIFFIN_PAY[m].label} note={TIFFIN_PAY[m].hint} price={null} selected={s.payMethod === m} multiple={false} onPress={() => dispatch(chooseTiffin({ payMethod: m }))} />
              ))}
            </View>
          </>
        ) : null}
      </View>
    </ScreenShell>
  );
};

export default FoodTiffinPlan;
