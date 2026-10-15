// ═══════════════════════════════════════════════════════
// MetroMatrix — Service card (the FYP home's card, premium)
// ═══════════════════════════════════════════════════════
// The FYP's anatomy, refined: a tall photo with the category badge top-left
// and the status top-right, the title and a one-line promise set on the
// photo; below it, three highlights, the description and a call to action
// in the service's own colour. The whole card is the button (the FYP's
// lesson: a chip inside a card must not swallow the tap) and sinks a
// little under the finger.

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
  /** One line under the title, on the photo. */
  tagline: string;
  /** The badge on the photo: FOOD, MEDICAL, RETAIL. */
  category: string;
  categoryIcon: MciName;
  description: string;
  /** Open now, or still on its way. */
  live: boolean;
  cta: string;
  highlights: { icon: MciName; label: string }[];
  /** A bundled photo; without one the panel is the service's colour and glyph. */
  image: ImageSourcePropType | null;
  glyph: MciName;
}

const makeStyles = ({ colors, space, size, radius, elevation }: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      borderWidth: size.hairline,
      borderColor: colors.line,
      ...elevation.raised,
    },
    clip: { borderRadius: radius.xl, overflow: 'hidden' },
    art: { height: size.serviceArt, justifyContent: 'flex-end', overflow: 'hidden' },
    photo: { ...StyleSheet.absoluteFillObject },
    badges: {
      position: 'absolute',
      top: space.s12,
      left: space.s12,
      right: space.s12,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4 + space.s4 / 2,
      paddingHorizontal: space.s12 - space.s4 / 2,
      paddingVertical: space.s4 + space.s4 / 2,
      borderRadius: radius.pill,
    },
    onPhoto: { padding: space.s16, gap: space.s4 },
    body: { padding: space.s16, gap: space.s16 },
    highlights: { flexDirection: 'row', alignItems: 'center' },
    highlight: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.s4 + space.s4 / 2,
      paddingHorizontal: space.s4,
    },
    highlightRule: { width: size.hairline, height: space.s16, backgroundColor: colors.line },
    rule: { height: size.hairline, backgroundColor: colors.line },
    foot: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    description: { flex: 1 },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      paddingLeft: space.s16,
      paddingRight: space.s12,
      height: size.control.sm,
      borderRadius: radius.pill,
    },
  });

const Card: React.FC<{ data: ServiceCardData; onPress: () => void }> = ({ data, onPress }) => {
  const styles = useStyles(makeStyles);
  const { colors, service, motion, size } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const springTo = (toValue: number) =>
    Animated.spring(scale, { toValue, ...motion.spring, useNativeDriver: true }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => springTo(motion.press.scale + (1 - motion.press.scale) / 2)}
      onPressOut={() => springTo(1)}
      accessibilityRole="button"
      accessibilityLabel={`${data.title}. ${data.live ? 'Open now' : 'Coming soon'}. ${data.tagline}.`}
      accessibilityHint={data.live ? 'Opens this service' : 'Shows what is coming'}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <View style={styles.clip}>
          {/* Photo, badges, title */}
          <View style={[styles.art, { backgroundColor: data.image ? colors.surfaceSunk : service.accent }]}>
            {data.image ? (
              <>
                <Image source={data.image} style={styles.photo} contentFit="cover" transition={motion.press.duration} />
                <PhotoScrim />
              </>
            ) : null}
            <View style={styles.badges}>
              <View style={[styles.badge, { backgroundColor: colors.glass }]}>
                <MciIcon name={data.categoryIcon} size="sm" color={service.accent} />
                <AppText variant="micro">{data.category}</AppText>
              </View>
              {data.live ? (
                <View style={[styles.badge, { backgroundColor: service.accent }]}>
                  <LiveDot color={service.onAccent} size={size.eyebrowDot} />
                  <AppText variant="micro" style={{ color: service.onAccent }}>
                    Open now
                  </AppText>
                </View>
              ) : (
                <View style={[styles.badge, { backgroundColor: colors.glass }]}>
                  <IonIcon name="time-outline" size="sm" color={colors.inkMuted} />
                  <AppText variant="micro" tone="muted">
                    Coming soon
                  </AppText>
                </View>
              )}
            </View>
            <View style={styles.onPhoto}>
              <AppText variant="h1" tone="onScrim">
                {data.title}
              </AppText>
              <AppText variant="small" style={{ color: colors.onScrimSoft }} numberOfLines={1}>
                {data.tagline}
              </AppText>
            </View>
          </View>

          {/* Highlights, description, call to action */}
          <View style={styles.body}>
            <View style={styles.highlights}>
              {data.highlights.map((h, i) => (
                <React.Fragment key={h.label}>
                  {i > 0 ? <View style={styles.highlightRule} /> : null}
                  <View style={styles.highlight}>
                    <MciIcon name={h.icon} size="sm" color={service.accent} />
                    <AppText variant="caption" numberOfLines={1}>
                      {h.label}
                    </AppText>
                  </View>
                </React.Fragment>
              ))}
            </View>
            <View style={styles.rule} />
            <View style={styles.foot}>
              <AppText variant="small" tone="muted" numberOfLines={2} style={styles.description}>
                {data.description}
              </AppText>
              <View style={[styles.cta, { backgroundColor: data.live ? service.accent : service.accentSoft }]}>
                <AppText variant="small" style={{ color: data.live ? service.onAccent : service.accentDeep }}>
                  {data.cta}
                </AppText>
                <IonIcon name="arrow-forward" size="sm" color={data.live ? service.onAccent : service.accentDeep} />
              </View>
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
