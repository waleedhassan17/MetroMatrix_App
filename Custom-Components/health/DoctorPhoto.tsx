// DoctorPhoto — the doctor's photo as a rounded square, or their initials on
// the soft accent ground. The photo is the one the doctor uploaded; only the
// demo seed's fictional doctors wear licensed stock portraits, and their
// profiles say so.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { cdn } from '../../utils/cdn/cdn';

/** "Dr. Ayesha Siddiqui" → "AS" (titles skipped). */
export const doctorInitials = (name: string) =>
  name
    .replace(/^(prof\.|assoc\.|asst\.|dr\.|\s)+/gi, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('') || 'Dr';

const makeStyles = ({ radius, service }: Theme) =>
  StyleSheet.create({
    root: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: service.accentSoft, alignItems: 'center', justifyContent: 'center' },
    image: { ...StyleSheet.absoluteFillObject },
  });

export const DoctorPhoto: React.FC<{ name: string; uri: string | null; size?: 'sm' | 'md' | 'lg' }> = ({ name, uri, size = 'md' }) => {
  const styles = useStyles(makeStyles);
  const { size: sizes, motion } = useTheme();
  const dim = sizes.doctorPhoto[size];
  return (
    <View style={[styles.root, { width: dim, height: dim }]} accessible={false} importantForAccessibility="no-hide-descendants">
      {uri ? (
        <Image source={{ uri: cdn(uri, { w: dim * 2, h: dim * 2, fit: 'fill' }) ?? undefined }} style={styles.image} contentFit="cover" transition={motion.imageFade} />
      ) : (
        <AppText variant={size === 'lg' ? 'h1' : size === 'md' ? 'h2' : 'title'} tone="accentDeep" maxFontSizeMultiplier={1}>
          {doctorInitials(name)}
        </AppText>
      )}
    </View>
  );
};

export default DoctorPhoto;
