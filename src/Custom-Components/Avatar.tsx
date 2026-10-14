// Avatar — a photo, or initials on the accent soft. Editable avatars carry a
// camera badge and show upload progress as a ring of opacity.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

export interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onPress?: () => void;
  editable?: boolean;
  uploading?: boolean;
}

export const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

const makeStyles = ({ colors, radius, size, service }: Theme) =>
  StyleSheet.create({
    root: { borderRadius: radius.pill, overflow: 'hidden', backgroundColor: service.accentSoft },
    center: { alignItems: 'center', justifyContent: 'center' },
    badge: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: size.icon.xl,
      height: size.icon.xl,
      borderRadius: radius.pill,
      backgroundColor: service.accent,
      borderWidth: size.focusBorder,
      borderColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export const Avatar: React.FC<AvatarProps> = ({
  name,
  uri,
  size = 'md',
  onPress,
  editable = false,
  uploading = false,
}) => {
  const styles = useStyles(makeStyles);
  const { size: sizes, service, opacity, motion } = useTheme();
  const dim = sizes.avatar[size];
  const variant = size === 'xl' ? 'h1' : size === 'lg' ? 'h2' : size === 'md' ? 'bodyStrong' : 'small';

  const body = (
    <View>
      <View style={[styles.root, styles.center, { width: dim, height: dim }, uploading && { opacity: opacity.disabled }]}>
        {uri ? (
          <Image source={{ uri }} style={{ width: dim, height: dim }} contentFit="cover" transition={motion.press.duration} />
        ) : (
          <AppText variant={variant} tone="accentDeep">
            {initialsOf(name)}
          </AppText>
        )}
      </View>
      {editable ? (
        <View style={styles.badge}>
          <Icon name={uploading ? 'loader' : 'camera'} size="sm" color={service.onAccent} />
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      disabled={uploading}
      accessibilityRole="button"
      accessibilityLabel={editable ? 'Change profile photo' : name}
      accessibilityState={{ busy: uploading }}>
      {body}
    </Pressable>
  );
};

export default Avatar;
