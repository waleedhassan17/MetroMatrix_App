// ═══════════════════════════════════════════════════════
// MetroMatrix — Service card (the FYP home's card)
// ═══════════════════════════════════════════════════════
// The FYP's card at the FYP's measurements (userHome.tsx): a 160 pt photo
// with the category badge top-left and the status badge top-right (12 pt
// in, 12×6 padding, radius 8, 10 pt bold tracked text), the title on the
// photo (20 pt bold, 12 pt in); below it, the description (12 pt) and the
// Explore chip (14×8 padding) in 14×12 padding. Radius 20.
// The premium layer is in the finish, not in extra content: a legibility
// scrim instead of the FYP's text shadow, each service's own colour on its
// status badge and chip, a live pulse on what is open, and a card that
// sinks a little under the finger. The whole card is the button (the FYP's
// lesson: a chip inside a card must not swallow the tap).

import React, { useState } from 'react';
import { Animated, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { ServiceScope, useStyles, useTheme, type ServiceName, type Theme } from '../../theme';
import { AppText } from '../../Custom-Components/AppText';
import { IonIcon, MciIcon, type MciName } from '../../Custom-Components/Icon';
import { LiveDot } from '../../Custom-Components/LiveDot';
import { PhotoScrim } from '../../Custom-Components/PhotoScrim';

export interface ServiceCardData {
  service: Exclude<ServiceName, 'neutral'>;
  title: string;
  /** The badge on the photo: FOOD COURT, MEDICAL, RETAIL. */
  category: string;
  description: string;
  /** Open now, or still on its way. */
  live: boolean;
  cta: string;
  /** A bundled photo; without one the panel is the service's colour and glyph. */
  image: ImageSourcePropType | null;
  glyph: MciName;
}

const makeStyles = ({ colors, space, size, radius, elevation }: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      ...elevation.raised,
    },
    clip: { borderRadius: radius.xl, overflow: 'hidden' },
    art: {
      height: size.serviceArt,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    photo: { ...StyleSheet.absoluteFillObject },
    badge: {
      position: 'absolute',
      top: space.s12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4 + space.s4 / 2,
      paddingHorizontal: space.s12,
      paddingVertical: space.s4 + space.s4 / 2,
      borderRadius: radius.sm,
    },
    title: { position: 'absolute', left: space.s12, right: space.s16, bottom: space.s12 },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s12,
      paddingHorizontal: space.s12 + space.s4 / 2,
      paddingVertical: space.s12,
    },
    description: { flex: 1 },
    explore: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      paddingHorizontal: space.s12 + space.s4 / 2,
      paddingVertical: space.s8,
      borderRadius: radius.xl,
    },
  });

const Card: React.FC<{ data: ServiceCardData; onPress: () => void }> = ({ data, onPress }) => {
  const styles = useStyles(makeStyles);
  const { colors, service, motion, size, space, elevation } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const springTo = (toValue: number) =>
    Animated.spring(scale, { toValue, ...motion.spring, useNativeDriver: true }).start();
  const fg = data.live ? service.onAccent : service.accentDeep;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => springTo(motion.press.scale + (1 - motion.press.scale) / 2)}
      onPressOut={() => springTo(1)}
      accessibilityRole="button"
      accessibilityLabel={`${data.title}. ${data.live ? 'Open now' : 'Coming soon'}. ${
        data.description
      }`}
      accessibilityHint={data.live ? 'Opens this service' : 'Shows what is coming'}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <View style={styles.clip}>
          <View
            style={[
              styles.art,
              { backgroundColor: data.image ? colors.surfaceSunk : service.accent },
            ]}>
            {data.image ? (
              <>
                <Image
                  source={data.image}
                  style={styles.photo}
                  contentFit="cover"
                  transition={motion.press.duration}
                />
                <PhotoScrim />
              </>
            ) : (
              <MciIcon name={data.glyph} size="hero" color={service.onAccent} />
            )}

            {/* Category — top left */}
            <View
              style={[
                styles.badge,
                { left: space.s12, backgroundColor: colors.surface, ...elevation.input },
              ]}>
              <AppText variant="tag" tone="muted">
                {data.category}
              </AppText>
            </View>

            {/* Status — top right */}
            <View
              style={[
                styles.badge,
                { right: space.s12, backgroundColor: data.live ? service.accent : colors.glass },
              ]}>
              {data.live ? (
                <LiveDot color={service.onAccent} size={size.eyebrowDot} />
              ) : (
                <IonIcon name="time-outline" size="sm" color={colors.inkMuted} />
              )}
              <AppText
                variant="tag"
                style={{ color: data.live ? service.onAccent : colors.inkMuted }}>
                {data.live ? 'OPEN NOW' : 'COMING SOON'}
              </AppText>
            </View>

            {/* Title — bottom left */}
            <View style={styles.title}>
              <AppText variant="cardTitle" tone="onScrim" numberOfLines={1}>
                {data.title}
              </AppText>
            </View>
          </View>

          {/* Description and Explore — below the photo */}
          <View style={styles.content}>
            <AppText variant="caption" tone="muted" numberOfLines={2} style={styles.description}>
              {data.description}
            </AppText>
            <View
              style={[
                styles.explore,
                { backgroundColor: data.live ? service.accent : service.accentSoft },
              ]}>
              <AppText variant="chip" style={{ color: fg }}>
                {data.cta}
              </AppText>
              <IonIcon name="chevron-forward" size="sm" color={fg} />
            </View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
};

/** The card in its own service's colours. */
export const ServiceCard: React.FC<{ data: ServiceCardData; onPress: () => void }> = props => (
  <ServiceScope service={props.data.service}>
    <Card {...props} />
  </ServiceScope>
);

export default ServiceCard;
