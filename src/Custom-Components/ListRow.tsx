// ListRow — title, optional subtitle, leading slot, trailing value/chevron.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  leftIcon?: IconName;
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
  const { colors, opacity } = useTheme();
  const tint = destructive ? colors.danger : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.root, pressed && { opacity: opacity.pressed }]}>
      {left ?? (leftIcon ? <Icon name={leftIcon} size="md" color={tint} /> : null)}
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
      {chevron ? <Icon name="chevron-right" size="md" color={colors.inkFaint} /> : null}
    </Pressable>
  );
};

export default ListRow;
