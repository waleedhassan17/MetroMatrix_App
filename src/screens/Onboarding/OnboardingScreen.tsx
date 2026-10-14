// ═══════════════════════════════════════════════════════
// MetroMatrix — Onboarding
// ═══════════════════════════════════════════════════════
// Three full-bleed pages — Shopping, Healthcare, Food — each previewing its
// service accent. A solid scrim (not a gradient) carries the serif headline
// over the photo. Skip and Get started both mark onboarding seen; the gate
// then drops this route and Welcome shows.

import React, { useRef } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { ServiceScope, useStyles, useTheme, type ServiceName, type Theme } from '@theme/index';
import { AppText, Button } from '@custom/index';
import { setOnboardingSeen } from '../Auth/authSlice';
import { selectOnboardingPage, setPage } from './onboardingSlice';

interface Page {
  service: Exclude<ServiceName, 'neutral'>;
  overline: string;
  headline: string;
  line: string;
  image: ImageSourcePropType;
}

// TODO: replace the placeholder photos in assets/onboarding/.
const PAGES: Page[] = [
  {
    service: 'shopping',
    overline: 'Shopping',
    headline: 'Every shop on your street, in one place.',
    line: 'Order from local stores. No commission added, ever.',
    image: require('../../../assets/onboarding/shopping.png'),
  },
  {
    service: 'healthcare',
    overline: 'Healthcare',
    headline: 'See a doctor without the waiting room.',
    line: 'Book PMDC-verified doctors near you.',
    image: require('../../../assets/onboarding/healthcare.png'),
  },
  {
    service: 'food',
    overline: 'Food',
    headline: 'Home cooking from the next street over.',
    line: 'Restaurants, home kitchens and cloud kitchens.',
    image: require('../../../assets/onboarding/food.png'),
  },
];

const makeStyles = ({ colors, space, gutter, size, radius, opacity }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.viewer },
    page: { flex: 1, justifyContent: 'flex-end' },
    scrim: { backgroundColor: colors.scrim, paddingHorizontal: gutter, paddingTop: space.s32, gap: space.s12 },
    skip: {
      position: 'absolute',
      right: space.s16,
      minHeight: size.touch,
      justifyContent: 'center',
      paddingHorizontal: space.s16,
      borderRadius: radius.pill,
      backgroundColor: colors.scrim,
    },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.s16 },
    dots: { flexDirection: 'row', gap: space.s8 },
    dot: { width: size.pageDot, height: size.pageDot, borderRadius: radius.pill, backgroundColor: colors.onScrim, opacity: opacity.disabled },
    dotActive: { width: size.pageDotActive, opacity: 1 },
  });

const OnboardingScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const page = useAppSelector(selectOnboardingPage);
  const styles = useStyles(makeStyles);
  const { space } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<Page>>(null);
  const last = page === PAGES.length - 1;

  const finish = () => dispatch(setOnboardingSeen());
  const next = () => {
    const to = Math.min(page + 1, PAGES.length - 1);
    list.current?.scrollToIndex({ index: to, animated: true });
    dispatch(setPage(to));
  };

  return (
    <View style={styles.root}>
      <FlatList
        ref={list}
        data={PAGES}
        keyExtractor={p => p.service}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onMomentumScrollEnd={e => dispatch(setPage(Math.round(e.nativeEvent.contentOffset.x / width)))}
        renderItem={({ item }) => (
          <View style={[styles.page, { width, height }]} accessible accessibilityLabel={`${item.overline}. ${item.headline} ${item.line}`}>
            <Image source={item.image} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
            <View style={[styles.scrim, { paddingBottom: insets.bottom + space.s40 + space.s56 }]}>
              <AppText variant="micro" tone="onScrim">
                {item.overline}
              </AppText>
              <AppText variant="display" tone="onScrim">
                {item.headline}
              </AppText>
              <AppText variant="body" tone="onScrim">
                {item.line}
              </AppText>
            </View>
          </View>
        )}
      />

      <Pressable
        onPress={finish}
        style={[styles.skip, { top: insets.top + space.s8 }]}
        accessibilityRole="button"
        accessibilityLabel="Skip"
        accessibilityHint="Go to sign in">
        <AppText variant="bodyStrong" tone="onScrim">
          Skip
        </AppText>
      </Pressable>

      <ServiceScope service={PAGES[page]?.service ?? 'neutral'}>
        <View
          style={[
            styles.footer,
            { position: 'absolute', left: space.s24, right: space.s24, bottom: insets.bottom + space.s24 },
          ]}>
          <View style={styles.dots} accessibilityRole="adjustable" accessibilityLabel={`Page ${page + 1} of ${PAGES.length}`}>
            {PAGES.map((p, i) => (
              <View key={p.service} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>
          {last ? (
            <Button label="Get started" onPress={finish} size="lg" />
          ) : (
            <Button label="Next" onPress={next} variant="secondary" />
          )}
        </View>
      </ServiceScope>
    </View>
  );
};

export default OnboardingScreen;
