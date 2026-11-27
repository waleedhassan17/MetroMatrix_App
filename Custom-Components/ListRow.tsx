// ListRow — a menu or settings row: a plain leading glyph, the title, one
// muted line, a trailing value and chevron. The glyph is slate and has no
// well (danger for a destructive row): rows never carry decorative colour
// (the owner, 2026-11-27). Every row is one height: the title and the line
// under it are one line each.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { IonIcon, type IonName } from './Icon';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Ionicons glyph, plain and slate, in a fixed slot so titles line up. */
  leftIcon?: IonName;
  left?: React.ReactNode;
  right?: React.ReactNode;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  chevron?: boolean;
  accessibilityHint?: string;
}

const makeStyles = ({ space, size }: Theme) =>
  StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: size.control.lg,
      paddingVertical: space.s12,
      gap: space.s12,
    },
    glyph: { width: size.icon.lg, alignItems: 'center' },
    body: { flex: 1, gap: space.s4 },
    value: { maxWidth: '40%' },
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
  const { colors, opacity } = useTheme();
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
          <View style={styles.glyph}>
            <IonIcon name={leftIcon} size="md" color={destructive ? colors.danger : colors.inkMuted} />
          </View>
        ) : null)}
      <View style={styles.body}>
        <AppText variant="title" tone={destructive ? 'danger' : 'ink'} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" tone="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="small" tone="muted" numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {right}
      {chevron ? <IonIcon name="chevron-forward" size="md" color={colors.inkFaint} /> : null}
    </Pressable>
  );
};

export default ListRow;
