// ═══════════════════════════════════════════════════════
// MetroMatrix — Onboarding (ported from the FYP app)
// ═══════════════════════════════════════════════════════
// Four slides on white, each previewing one real part of the product with a
// card showing a fragment of that service's UI — an order, an appointment, a
// basket — rather than an icon standing in for it. The card's head is the
// service's own page header (headerGradient), so the pink, blue and orange a
// user meets here are the ones waiting inside. The overview card wears the
// logo's emerald → teal.
//
// The brand stays in the top bar (logo and wordmark). Everything that
// belongs to a slide wears that slide's colour — the card, the eyebrow, the
// accent line of the title, the page indicator AND the primary button — so a
// pink Food card never sits above an emerald button: emerald on the overview,
// pink on Food, blue on Healthcare, orange on Shopping.
//
// No entrance animation: the only moving element is the page indicator, and
// it moves because the user's finger moves. Shown once (hasSeenOnboarding);
// every exit opens Role Selection.

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch } from '@hooks/useReduxHooks';
import {
  BRAND_GRADIENT,
  SERVICE_PALETTES,
  ServiceScope,
  headerGradient,
  useStyles,
  useTheme,
  type ServiceName,
  type Theme,
} from '@theme/index';
import { AppText, Button, IonIcon, type IonName } from '@custom/index';
import { BrandMark, BrandWordmark } from '@components/brand';
import { setOnboardingSeen } from '../Auth/authSlice';

// ── Slide data ───────────────────────────────────────

interface CardRow {
  icon?: IonName;
  /** A service dot instead of an icon (the overview). */
  dot?: string;
  primary: string;
  secondary?: string;
  trailing?: string;
  trailingIcon?: IonName;
  /** Hairline above this row — separates a total or a status line. */
  rule?: boolean;
}

interface Slide {
  key: string;
  service: ServiceName;
  eyebrow: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  card: { title: string; chip: string; rows: CardRow[] };
  badges: [{ value: string; label: string }, { value: string; label: string }];
}

const FOOD = SERVICE_PALETTES.light.food;
const HEALTH = SERVICE_PALETTES.light.healthcare;
const SHOP = SERVICE_PALETTES.light.shopping;

const SLIDES: Slide[] = [
  {
    key: 'overview',
    service: 'neutral',
    eyebrow: 'Welcome',
    title: 'Your city,',
    titleAccent: 'one app.',
    subtitle: 'Food, healthcare and shopping — ordered, booked and paid for in a single place.',
    card: {
      title: 'Services',
      chip: 'All in one',
      rows: [
        { dot: FOOD.highlight, primary: 'Food', trailing: 'Order a meal' },
        { dot: HEALTH.highlight, primary: 'Healthcare', trailing: 'Consult a doctor' },
        { dot: SHOP.highlight, primary: 'Shopping', trailing: 'Order essentials' },
      ],
    },
    badges: [
      { value: '3', label: 'Services' },
      { value: '1', label: 'Account' },
    ],
  },
  {
    key: 'food',
    service: 'food',
    eyebrow: 'Food',
    title: 'Your favourite meals,',
    titleAccent: 'delivered hot.',
    subtitle: 'Restaurants, home kitchens and cloud kitchens near you, tracked to your door.',
    card: {
      title: 'Order',
      chip: 'On the way',
      rows: [
        {
          icon: 'restaurant-outline',
          primary: 'Smash Street',
          secondary: 'Burgers · 1.4 km',
          trailing: '4.8',
          trailingIcon: 'star',
        },
        {
          icon: 'bicycle-outline',
          primary: 'Arriving in 25 min',
          secondary: 'Your rider picked it up',
          rule: true,
        },
      ],
    },
    badges: [
      { value: '25 min', label: 'Avg delivery' },
      { value: 'Live', label: 'Tracking' },
    ],
  },
  {
    key: 'healthcare',
    service: 'healthcare',
    eyebrow: 'Healthcare',
    title: 'Care, without',
    titleAccent: 'the waiting room.',
    subtitle: 'Consult verified doctors, book appointments, and keep your records in one place.',
    card: {
      title: 'Appointment',
      chip: 'Verified',
      rows: [
        {
          icon: 'medkit-outline',
          primary: 'Dr. Ayesha Khan',
          secondary: 'Cardiologist',
          trailing: '4.8',
          trailingIcon: 'star',
        },
        {
          icon: 'videocam-outline',
          primary: 'Video consult',
          secondary: 'Today, 6:00 PM',
          rule: true,
        },
      ],
    },
    badges: [
      { value: '24/7', label: 'Consults' },
      { value: 'Secure', label: 'Records' },
    ],
  },
  {
    key: 'shopping',
    service: 'shopping',
    eyebrow: 'Shopping',
    title: 'Trusted brands,',
    titleAccent: 'secure checkout.',
    subtitle: 'Shop verified sellers and pay securely, with every order tracked to delivery.',
    card: {
      title: 'Order',
      chip: 'Paid',
      rows: [
        { icon: 'headset-outline', primary: 'Wireless earbuds', trailing: 'Rs 4,200' },
        { icon: 'shirt-outline', primary: 'Cotton kurta', trailing: 'Rs 2,800' },
        { icon: 'card-outline', primary: 'Total', trailing: 'Rs 7,000', rule: true },
      ],
    },
    badges: [
      { value: 'Secure', label: 'Checkout' },
      { value: 'Free', label: 'Returns' },
    ],
  },
];

const headerFor = (service: ServiceName): [string, string] =>
  service === 'neutral' ? BRAND_GRADIENT : headerGradient(service);

// ── Styles ───────────────────────────────────────────

const makeStyles = ({ colors, space, gutter, radius, size, type, elevation }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: gutter,
      paddingVertical: space.s12,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    list: { flex: 1 },
    slide: { flex: 1, justifyContent: 'center', overflow: 'hidden' },
    slideBody: { paddingHorizontal: space.s32, alignItems: 'center' },
    cardWrap: {
      width: '100%',
      maxWidth: size.previewCard,
      marginTop: space.s32,
      marginBottom: space.s40,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: size.hairline,
      borderColor: colors.line,
      borderRadius: radius.xl,
      ...elevation.raised,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s8,
      paddingHorizontal: space.s16,
      paddingVertical: space.s12,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
    },
    cardChip: {
      backgroundColor: colors.surface,
      paddingHorizontal: space.s8,
      paddingVertical: space.s4,
      borderRadius: radius.sm,
    },
    cardBody: { paddingHorizontal: space.s16, paddingTop: space.s8, paddingBottom: space.s20 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.s8 },
    rowRuled: {
      borderTopWidth: size.hairline,
      borderTopColor: colors.lineSoft,
      marginTop: space.s4,
      paddingTop: space.s12,
    },
    rowLead: { width: size.previewRowIcon, alignItems: 'center', justifyContent: 'center' },
    rowIcon: { height: size.previewRowIcon, borderRadius: radius.sm },
    rowDot: { width: space.s8, height: space.s8, borderRadius: radius.pill },
    rowText: { flex: 1, marginLeft: space.s12 },
    rowTrail: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    badge: {
      position: 'absolute',
      backgroundColor: colors.surface,
      borderWidth: size.hairline,
      borderRadius: radius.md,
      paddingVertical: space.s8,
      paddingHorizontal: space.s12,
      ...elevation.raised,
    },
    badgeTop: { top: -space.s24 - space.s4, right: -space.s8 },
    badgeBottom: { bottom: -space.s24 - space.s4, left: -space.s8 },
    eyebrow: { flexDirection: 'row', alignItems: 'center', gap: space.s8, marginBottom: space.s16 },
    eyebrowDot: { width: size.eyebrowDot, height: size.eyebrowDot, borderRadius: radius.pill },
    title: { ...type.h1, color: colors.ink, textAlign: 'center', marginBottom: space.s12 },
    subtitle: { maxWidth: size.prose },
    footer: { paddingHorizontal: gutter, paddingTop: space.s20, alignItems: 'center' },
    track: { height: size.pageDot, marginBottom: space.s24, justifyContent: 'center' },
    dot: {
      position: 'absolute',
      width: size.pageDot,
      height: size.pageDot,
      borderRadius: radius.pill,
      backgroundColor: colors.disabled,
    },
    worm: {
      position: 'absolute',
      left: 0,
      width: size.pageDotActive,
      height: size.pageDot,
      borderRadius: radius.pill,
    },
    link: { paddingTop: space.s12, paddingBottom: space.s8 },
    linkRow: { flexDirection: 'row', alignItems: 'center' },
  });

// ── Preview card ─────────────────────────────────────

const PreviewCard: React.FC<{ slide: Slide }> = ({ slide }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const palette = SERVICE_PALETTES.light[slide.service];
  return (
    <View style={styles.cardWrap}>
      <View style={styles.card}>
        {/* A miniature of the service's own page header. */}
        <LinearGradient
          colors={headerFor(slide.service)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardHead}>
          <AppText variant="small" tone="onAccent">
            {slide.card.title}
          </AppText>
          <View style={styles.cardChip}>
            <AppText variant="caption">{slide.card.chip}</AppText>
          </View>
        </LinearGradient>
        <View style={styles.cardBody}>
          {slide.card.rows.map((row, i) => (
            <View key={`${slide.key}-${i}`} style={[styles.row, row.rule && styles.rowRuled]}>
              {row.dot ? (
                <View style={styles.rowLead}>
                  <View style={[styles.rowDot, { backgroundColor: row.dot }]} />
                </View>
              ) : (
                <View
                  style={[styles.rowLead, styles.rowIcon, { backgroundColor: palette.accentSoft }]}>
                  <IonIcon
                    name={row.icon ?? 'ellipse-outline'}
                    size="sm"
                    color={palette.accentDeep}
                  />
                </View>
              )}
              <View style={styles.rowText}>
                <AppText variant="caption" numberOfLines={1}>
                  {row.primary}
                </AppText>
                {row.secondary ? (
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {row.secondary}
                  </AppText>
                ) : null}
              </View>
              {row.trailing ? (
                <View style={styles.rowTrail}>
                  {row.trailingIcon ? (
                    <IonIcon name={row.trailingIcon} size="sm" color={colors.star} />
                  ) : null}
                  <AppText variant="caption">{row.trailing}</AppText>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </View>
      {/* Stat pills overhanging the card — data lifted out of the product. */}
      <View style={[styles.badge, styles.badgeTop, { borderColor: palette.accentLine }]}>
        <AppText variant="bodyStrong">{slide.badges[0].value}</AppText>
        <AppText variant="caption" tone="muted">
          {slide.badges[0].label}
        </AppText>
      </View>
      <View style={[styles.badge, styles.badgeBottom, { borderColor: palette.accentLine }]}>
        <AppText variant="bodyStrong">{slide.badges[1].value}</AppText>
        <AppText variant="caption" tone="muted">
          {slide.badges[1].label}
        </AppText>
      </View>
    </View>
  );
};

// ── Screen ───────────────────────────────────────────

const OnboardingScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size, space } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  // Horizontal list items fill their height on native but not on web —
  // measured once and handed to every slide so both centre the same way.
  const [pageHeight, setPageHeight] = useState(0);
  const [scrollX] = useState(() => new Animated.Value(0));
  const listRef = useRef<FlatList<Slide>>(null);
  const isLast = index === SLIDES.length - 1;
  const pitch = size.pagePitch;

  const fades = useMemo(
    () =>
      SLIDES.map((_, i) =>
        scrollX.interpolate({
          inputRange: [(i - 1) * width, i * width, (i + 1) * width],
          outputRange: [0, 1, 0],
          extrapolate: 'clamp',
        }),
      ),
    [scrollX, width],
  );
  const wormX = useMemo(
    () =>
      scrollX.interpolate({
        inputRange: [0, (SLIDES.length - 1) * width],
        outputRange: [0, (SLIDES.length - 1) * pitch],
        extrapolate: 'clamp',
      }),
    [scrollX, width, pitch],
  );
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
      }),
    [scrollX],
  );
  const onSettle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      setIndex(prev => (prev === next ? prev : next));
    },
    [width],
  );

  /** The ONE way out — Get started, Skip and Sign in all open Role Selection. */
  const finish = useCallback(() => dispatch(setOnboardingSeen()), [dispatch]);

  const onPrimary = () => {
    if (isLast) return finish();
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    // Web fires no scroll-end event for a programmatic scroll.
    setIndex(index + 1);
  };

  const renderSlide = ({ item }: { item: Slide }) => {
    const palette = SERVICE_PALETTES.light[item.service];
    return (
      <View style={[styles.slide, { width }, pageHeight > 0 && { height: pageHeight }]}>
        <View style={styles.slideBody}>
          <PreviewCard slide={item} />
          <View style={styles.eyebrow}>
            <View
              style={[
                styles.eyebrowDot,
                {
                  backgroundColor: item.service === 'neutral' ? palette.accent : palette.highlight,
                },
              ]}
            />
            <AppText variant="small" tone="muted">
              {item.eyebrow}
            </AppText>
          </View>
          <AppText variant="h1" align="center" style={styles.title} accessibilityRole="header">
            {item.title}
            {'\n'}
            <AppText variant="h1" style={{ color: palette.accentDeep }}>
              {item.titleAccent}
            </AppText>
          </AppText>
          <AppText variant="body" tone="muted" align="center" style={styles.subtitle}>
            {item.subtitle}
          </AppText>
        </View>
      </View>
    );
  };

  const trackWidth = size.pageDotActive + pitch * (SLIDES.length - 1);

  return (
    <View
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + space.s16 }]}>
      <View style={styles.topBar}>
        <View style={styles.brandRow} accessible accessibilityLabel="MetroMatrix">
          <BrandMark size={size.markSmall} />
          <BrandWordmark variant="compact" />
        </View>
        {!isLast ? (
          <Pressable
            onPress={finish}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Skip the introduction">
            <AppText variant="small" tone="muted">
              Skip
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <Animated.FlatList
        ref={listRef as never}
        style={styles.list}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={item => item.key}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onLayout={(e: LayoutChangeEvent) => setPageHeight(e.nativeEvent.layout.height)}
        onScroll={onScroll}
        onMomentumScrollEnd={onSettle}
        onScrollEndDrag={onSettle}
      />

      <ServiceScope service={SLIDES[index]?.service ?? 'neutral'}>
        <View style={styles.footer}>
          {/* Idle dots sit still; one pill per slide, in its colour, cross-fades
            as it slides across them. */}
          <View
            style={[styles.track, { width: trackWidth }]}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Step ${index + 1} of ${SLIDES.length}`}>
            {SLIDES.map((slide, i) => (
              <View
                key={`dot-${slide.key}`}
                style={[styles.dot, { left: (size.pageDotActive - size.pageDot) / 2 + i * pitch }]}
              />
            ))}
            {SLIDES.map((slide, i) => {
              const palette = SERVICE_PALETTES.light[slide.service];
              return (
                <Animated.View
                  key={`worm-${slide.key}`}
                  style={[
                    styles.worm,
                    {
                      backgroundColor:
                        slide.service === 'neutral' ? palette.accent : palette.highlight,
                      opacity: fades[i],
                      transform: [{ translateX: wormX }],
                    },
                  ]}
                />
              );
            })}
          </View>

          <Button
            size="lg"
            fullWidth
            label={isLast ? 'Get started' : 'Continue'}
            onPress={onPrimary}
            accessibilityLabel={isLast ? 'Get started' : 'Continue to the next slide'}
          />

          <Pressable
            onPress={finish}
            style={styles.link}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="I already have an account. Sign in">
            <AppText variant="body" tone="muted">
              I already have an account{'  ·  '}
              <AppText variant="bodyStrong" tone="accentDeep">
                Sign in
              </AppText>
            </AppText>
          </Pressable>
        </View>
      </ServiceScope>
    </View>
  );
};

export default OnboardingScreen;
