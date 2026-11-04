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
import { useAppDispatch, useAppSelector, useAppStore } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { TIFFIN_PAY, WEEKDAY_LONG, placesHeadline } from '../../models/kitchen/kitchenStatusModel';
import { cutoffChoiceLabel, perMealLabel, priceLabel, scheduleLabel, startChoices } from '../../models/kitchen/tiffinModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, ChoiceChip, CtaBar, Divider, IonIcon, InlineNotice, ScreenShell, SectionCard, Skeleton, StatusPill, TextAction } from '../../Custom-Components/index';
import { TrustNote } from '../../Components/food/FoodParts';
import { customerTrustLine } from '../../models/food/trustModel';
import { ChoiceLine } from '../../Custom-Components/food/ChoiceLine';
import type { FoodAppParamList } from '../../models';
import { cdn } from '../../utils/cdn/cdn';
import { formatDayChip } from '../../utils/health-time/healthTime';
import { haptics } from '../../utils/haptics/haptics';
import { loadAddressesAsync, selectAddressBook } from '../address-book-screen/addressBookSlice';
import { PICKUP, chooseTiffin, loadTiffinPlanAsync, newTiffinKey, selectFoodTiffinPlan, subscribeTiffinAsync } from './foodTiffinPlanSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodTiffinPlan'>;

const makeStyles = ({ space, gutter, colors, size, radius }: Theme) =>
  StyleSheet.create({
    photo: { width: '100%', aspectRatio: size.railPhotoAspect, borderRadius: radius.lg, backgroundColor: colors.surfaceSunk },
    content: { paddingHorizontal: gutter, paddingBottom: space.s40, gap: space.s16 },
    gap: { gap: space.s8 },
    line: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    grow: { flex: 1, gap: space.s4, minWidth: 0 },
    day: { flexDirection: 'row', gap: space.s12, paddingVertical: space.s8 },
    // A least width, so "Wednesday" fits and large text can still wrap.
    dayName: { minWidth: size.weekdayColumn, maxWidth: '40%' },
    chipBar: { flexGrow: 0 },
    chips: { flexDirection: 'row', gap: space.s8 },
    loading: { gap: space.s16 },
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
  const appStore = useAppStore();
  const styles = useStyles(makeStyles);
  const { colors, size, motion } = useTheme();
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
        {s.status === 'failed' ? (
          <InlineNotice message={s.error.message} action={s.error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: load }} />
        ) : (
          <View style={styles.loading} accessibilityLabel="Loading" accessibilityRole="progressbar">
            <Skeleton height={size.storeHero} shape="lg" />
            <Skeleton width="50%" height={size.icon.lg} />
            <Skeleton height={size.control.lg * 3} shape="lg" />
          </View>
        )}
      </ScreenShell>
    );
  }

  const starts = startChoices(p);
  const full = p.seatsLeft === 0;
  const needsAddress = p.mode === 'delivery' && !s.addressId;

  const subscribe = async () => {
    haptics.press();
    const r = await dispatch(subscribeTiffinAsync());
    const subscribed = subscribeTiffinAsync.fulfilled.match(r) ? selectFoodTiffinPlan(appStore.getState()).subscribed : null;
    if (subscribed) {
      haptics.success();
      navigation.replace('FoodTiffin', { code: subscribed.code, fresh: true });
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
        full ? undefined : (
          <CtaBar
            label={p.period === 'week' ? 'Each week' : 'Each month'}
            amount={p.price}
            note={`${perMealLabel(p)} · paid to the kitchen`}
            action={{ label: 'Ask to join', onPress: () => void subscribe(), loading: s.subscribing, disabled: !s.startDate || needsAddress }}
          />
        )
      }>
      <View style={styles.content}>
        {p.photoUrl ? <Image source={cdn(p.photoUrl, { w: size.surplusCard * 2 }) ?? undefined} style={styles.photo} contentFit="cover" transition={motion.imageFade} accessibilityLabel={`${p.name}: photo`} /> : null}
        {s.subscribeError.message ? <InlineNotice message={s.subscribeError.message} /> : null}
        {full ? <InlineNotice tone="warning" title="This plan is full" message={`${p.vendor.name} isn’t taking anyone new on it right now. Ask the kitchen, or look at its other plans.`} /> : null}
        <View style={styles.gap}>
          {placesHeadline(p.seatsLeft) ? <StatusPill label={placesHeadline(p.seatsLeft)!.label} tone={placesHeadline(p.seatsLeft)!.tone} /> : null}
          <AppText variant="cardTitle" tone="accentDeep">
            {priceLabel(p)}
          </AppText>
          <AppText variant="small" tone="muted">
            {`${scheduleLabel(p)} · ${perMealLabel(p)} · ${p.mealsPerPeriod} meals · ${p.mode === 'delivery' ? 'Delivered' : p.mode === 'pickup' ? 'Collected' : 'Delivered or collected'} ${p.window.label}`}
          </AppText>
          {p.description ? <AppText variant="body">{p.description}</AppText> : null}
        </View>

        <SectionCard title="What’s cooked" icon="restaurant-outline">
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
        </SectionCard>

        <SectionCard title="How it works" icon="information-circle-outline">
          {[
            ['calendar-outline', `Skip any day until ${cutoffChoiceLabel(p.skipCutoffHour)}.`],
            ['pause-outline', 'Pause it while you travel, or cancel any time.'],
          ].map(([icon, text]) => (
            <View key={text} style={styles.line}>
              <IonIcon name={icon as 'calendar-outline'} size="md" color={colors.inkMuted} />
              <AppText variant="small" style={styles.grow}>
                {text}
              </AppText>
            </View>
          ))}
        </SectionCard>

        {!full ? (
          <>
            <SectionCard title="Start on" icon="today-outline" invalid={!s.startDate && !starts.length}>
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
            </SectionCard>

            {p.mode !== 'pickup' ? (
              <SectionCard title={p.mode === 'both' ? 'Delivered, or collected' : 'Deliver to'} icon="location-outline" invalid={needsAddress && !pinned.length}>
                {p.mode === 'both' ? (
                  <ChoiceLine
                    label="I’ll collect it"
                    note={`From ${p.vendor.name}, ${p.window.label}`}
                    price={null}
                    selected={s.addressId === PICKUP}
                    multiple={false}
                    onPress={() => dispatch(chooseTiffin({ addressId: PICKUP }))}
                  />
                ) : null}
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
              </SectionCard>
            ) : null}

            <SectionCard title="How you pay the kitchen" icon="wallet-outline">
              {(['transfer', 'cash'] as const).map(m => (
                <ChoiceLine key={m} label={TIFFIN_PAY[m].label} note={TIFFIN_PAY[m].hint} price={null} selected={s.payMethod === m} multiple={false} onPress={() => dispatch(chooseTiffin({ payMethod: m }))} />
              ))}
            </SectionCard>
          </>
        ) : null}
        <TrustNote text={customerTrustLine(p.vendor.name)} />
      </View>
    </ScreenShell>
  );
};

export default FoodTiffinPlan;
