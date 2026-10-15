// ListRow — title, optional subtitle, leading icon tile, trailing value/chevron.
// The leading icon sits in a soft tile of the service accent (danger for a
// destructive row), the settings-list pattern people read at a glance.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { IonIcon, type IonName } from './Icon';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Ionicons glyph, shown in a tinted tile. */
  leftIcon?: IonName;
  left?: React.ReactNode;
  right?: React.ReactNode;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  chevron?: boolean;
  accessibilityHint?: string;
}

const makeStyles = ({ space, size, radius }: Theme) =>
  StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: size.control.lg,
      paddingVertical: space.s12,
      gap: space.s12,
    },
    tile: {
      width: size.subTypeTile,
      height: size.subTypeTile,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { flex: 1, gap: space.s4 },
  });

export const ListRow: React.FC<ListRowProps> = ({
  title,
  subtitle,
  leftIcon,
  left,
  right,
  value,
  onPress,
  destructive,
  chevron = !!onPress,
  accessibilityHint,
}) => {
  const styles = useStyles(makeStyles);
  const { colors, service, opacity } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.root, pressed && { opacity: opacity.pressed }]}>
      {left ??
        (leftIcon ? (
          <View
            style={[
              styles.tile,
              { backgroundColor: destructive ? colors.dangerSoft : service.accentSoft },
            ]}>
            <IonIcon
              name={leftIcon}
              size="md"
              color={destructive ? colors.danger : service.accent}
            />
          </View>
        ) : null)}
      <View style={styles.body}>
        <AppText variant="title" tone={destructive ? 'danger' : 'ink'} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" tone="muted" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="small" tone="muted" numberOfLines={1}>
          {value}
        </AppText>
      ) : null}
      {right}
      {chevron ? <IonIcon name="chevron-forward" size="md" color={colors.inkFaint} /> : null}
    </Pressable>
  );
};

export default ListRow;
