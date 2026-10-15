// ═══════════════════════════════════════════════════════
// MetroMatrix — Health / Shopping, before they open
// ═══════════════════════════════════════════════════════
// Opened from the home's service cards. Says plainly what is coming and
// offers the one service that is live. Stateless.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch } from '@hooks/useReduxHooks';
import { setLastService } from '@store/preferencesSlice';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, IonIcon, MciIcon, PhotoScrim } from '@custom/index';
import { SERVICE_CARDS } from '@components/home/serviceCatalog';
import type { HomeStackParamList } from '@/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'ServicePreview'>;

const POINTS: Record<'healthcare' | 'shopping', string[]> = {
  healthcare: ['PMDC-verified doctors only', 'Clinic visits and video consultations', 'Your health records in one place'],
  shopping: ['Local stores, local prices', 'Same-day delivery in your city', 'Zero commission for sellers, ever'],
};

const makeStyles = ({ colors, space, gutter, size, radius }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingBottom: space.s40, gap: space.s20 },
    hero: { height: size.serviceArt + space.s56, justifyContent: 'flex-end', overflow: 'hidden' },
    photo: { ...StyleSheet.absoluteFillObject },
    back: {
      position: 'absolute',
      left: gutter - space.s8,
      width: size.touch,
      height: size.touch,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    heroText: { padding: gutter, gap: space.s4 },
    body: { paddingHorizontal: gutter, gap: space.s16 },
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: space.s12,
      paddingVertical: space.s4,
      borderRadius: radius.sm,
    },
    point: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
  });

const ServicePreviewScreen: React.FC<Props> = props => (
  <ServiceScope service={props.route.params.service}>
    <Preview {...props} />
  </ServiceScope>
);

const Preview: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, colors, motion } = useTheme();
  const insets = useSafeAreaInsets();
  const key = route.params.service;
  const card = SERVICE_CARDS.find(c => c.service === key) ?? SERVICE_CARDS[0];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { paddingTop: insets.top, backgroundColor: service.accent }]}>
          {card.image ? (
            <>
              <Image source={card.image} style={styles.photo} contentFit="cover" transition={motion.press.duration} />
              <PhotoScrim />
            </>
          ) : null}
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.back, { top: insets.top + 8 }]}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}>
            <IonIcon name="arrow-back" size="lg" color={colors.ink} />
          </Pressable>
          <View style={styles.heroText}>
            <AppText variant="small" tone="onScrim">
              {card.category}
            </AppText>
            <AppText variant="h1" tone="onScrim" accessibilityRole="header">
              {card.title}
            </AppText>
          </View>
        </View>

        <View style={styles.body}>
          <View style={[styles.badge, { backgroundColor: service.accentSoft }]}>
            <AppText variant="small" tone="accentDeep">
              Coming soon
            </AppText>
          </View>
          <AppText variant="body" tone="muted">
            {`${card.description} We're onboarding verified partners in your city now.`}
          </AppText>
          {POINTS[key].map(p => (
            <View key={p} style={styles.point}>
              <MciIcon name="check-circle" size="md" color={service.accent} />
              <AppText variant="body">{p}</AppText>
            </View>
          ))}
          <Button
            label="Visit the Food Court meanwhile"
            variant="secondary"
            onPress={() => {
              dispatch(setLastService('food'));
              navigation.replace('FoodHome');
            }}
            fullWidth
          />
        </View>
      </ScrollView>
    </View>
  );
};

export default ServicePreviewScreen;
