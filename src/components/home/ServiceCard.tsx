// ═══════════════════════════════════════════════════════
// MetroMatrix — Service card (the FYP home's three cards)
// ═══════════════════════════════════════════════════════
// The FYP's card, unchanged in structure: a photo with the category badge
// top-left, a status badge top-right and the title on the photo; below it,
// two lines of description and an Explore chip. The whole card is the button
// (the FYP's lesson: a chip inside a card must not swallow the tap). Each
// card wears its own service's colour in its badge and chip.

import React from 'react';
import { Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { ServiceScope, useStyles, useTheme, type ServiceName, type Theme } from '../../theme';
import { AppText } from '../../Custom-Components/AppText';
import { IonIcon, MciIcon, type MciName } from '../../Custom-Components/Icon';
import { PhotoScrim } from '../../Custom-Components/PhotoScrim';

export interface ServiceCardData {
  service: Exclude<ServiceName, 'neutral'>;
  title: string;
  /** The badge on the photo: FOOD DELIVERY, MEDICAL, RETAIL. */
  category: string;
  description: string;
  /** Open now, or still on its way. */
  live: boolean;
  /** A bundled photo; without one the panel is the service's colour and glyph. */
  image: ImageSourcePropType | null;
  glyph: MciName;
}

const makeStyles = ({ colors, space, size, radius, elevation }: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      borderWidth: size.hairline,
      borderColor: colors.line,
      ...elevation.raised,
    },
    art: { height: size.serviceArt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    photo: { ...StyleSheet.absoluteFillObject },
    category: {
      position: 'absolute',
      top: space.s12,
      left: space.s12,
      paddingHorizontal: space.s12,
      paddingVertical: space.s4,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      ...elevation.input,
    },
    status: {
      position: 'absolute',
      top: space.s12,
      right: space.s12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      paddingHorizontal: space.s12,
      paddingVertical: space.s4,
      borderRadius: radius.sm,
    },
    statusDot: { width: space.s8 - space.s4 / 2, height: space.s8 - space.s4 / 2, borderRadius: radius.pill },
    title: { position: 'absolute', left: space.s16, right: space.s16, bottom: space.s12 },
    body: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingHorizontal: space.s16, paddingVertical: space.s12 },
    description: { flex: 1 },
    explore: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      paddingHorizontal: space.s12,
      paddingVertical: space.s8,
      borderRadius: radius.pill,
    },
  });

const Card: React.FC<{ data: ServiceCardData; onPress: () => void }> = ({ data, onPress }) => {
  const styles = useStyles(makeStyles);
  const { colors, service, motion, opacity } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: opacity.pressed }]}
      accessibilityRole="button"
      accessibilityLabel={`${data.title}. ${data.live ? 'Open now' : 'Coming soon'}. ${data.description}`}
      accessibilityHint="Opens this service">
      <View style={[styles.art, { backgroundColor: data.image ? colors.surfaceSunk : service.accent }]}>
        {data.image ? (
          <>
            <Image source={data.image} style={styles.photo} contentFit="cover" transition={motion.press.duration} />
            <PhotoScrim />
          </>
        ) : (
          <MciIcon name={data.glyph} size="hero" color={service.onAccent} />
        )}
        <View style={styles.category}>
          <AppText variant="micro" tone="muted">
            {data.category}
          </AppText>
        </View>
        <View style={[styles.status, { backgroundColor: data.live ? service.accent : colors.surface }]}>
          {data.live ? <View style={[styles.statusDot, { backgroundColor: service.onAccent }]} /> : null}
          <AppText variant="micro" style={{ color: data.live ? service.onAccent : colors.ink }}>
            {data.live ? 'Open now' : 'Coming soon'}
          </AppText>
        </View>
        <View style={styles.title}>
          <AppText variant="h2" tone="onScrim">
            {data.title}
          </AppText>
        </View>
      </View>
      <View style={styles.body}>
        <AppText variant="small" tone="muted" numberOfLines={2} style={styles.description}>
          {data.description}
        </AppText>
        <View style={[styles.explore, { backgroundColor: service.accentSoft }]}>
          <AppText variant="small" tone="accentDeep">
            Explore
          </AppText>
          <IonIcon name="chevron-forward" size="sm" color={service.accentDeep} />
        </View>
      </View>
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
