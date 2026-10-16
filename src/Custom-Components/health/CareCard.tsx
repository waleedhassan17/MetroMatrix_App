// ═══════════════════════════════════════════════════════
// CareCard — "How can we help you today?"
// ═══════════════════════════════════════════════════════
// A soft-ground card led by a photo: the words sit on the card's own tint,
// and the photo rises out of it (the ground fades into the picture). `tall`
// is the bento's big card, photo below the words; the short cards keep the
// words on the left and the photo on the right. An arrow says it opens.

import React from 'react';
import { Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type CareTint, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IonIcon } from '../Icon';
import { PhotoScrim } from '../PhotoScrim';

export interface CareCardProps {
  title: string;
  body: string;
  image: ImageSourcePropType;
  tint: CareTint;
  tall?: boolean;
  onPress: () => void;
}

const makeStyles = ({ colors, space, radius, size, elevation }: Theme) =>
  StyleSheet.create({
    root: { borderRadius: radius.lg, overflow: 'hidden', ...elevation.card },
    tall: { height: size.careTall },
    short: { height: size.careShort },
    text: { padding: space.s16, gap: space.s4 },
    shortText: { width: '64%', paddingRight: space.s0 },
    tallPhoto: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
    shortPhoto: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '50%' },
    arrow: {
      position: 'absolute',
      right: space.s12,
      bottom: space.s12,
      width: size.icon.xl,
      height: size.icon.xl,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
  });

export const CareCard: React.FC<CareCardProps> = ({ title, body, image, tint, tall, onPress }) => {
  const styles = useStyles(makeStyles);
  const { careTint, opacity, motion } = useTheme();
  const t = careTint[tint];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      style={({ pressed }) => [styles.root, tall ? styles.tall : styles.short, { backgroundColor: t.bg }, pressed && { opacity: opacity.pressed }]}>
      <View style={tall ? styles.tallPhoto : styles.shortPhoto} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" transition={motion.imageFade} />
        {/* The ground runs into the photo from where the words are. */}
        <PhotoScrim ground={{ from: t.bg, to: t.fade, direction: tall ? 'down' : 'right' }} />
      </View>
      <View style={[styles.text, !tall && styles.shortText]}>
        <AppText variant="title" numberOfLines={2}>
          {title}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={tall ? 2 : 3}>
          {body}
        </AppText>
      </View>
      <View style={styles.arrow}>
        <IonIcon name="arrow-forward" size="sm" color={t.fg} />
      </View>
    </Pressable>
  );
};

export default CareCard;
