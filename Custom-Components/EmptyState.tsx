// EmptyState — a serif headline, one line, one action.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

export interface EmptyStateProps {
  title: string;
  body: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
}

const makeStyles = ({ space, colors, size, radius }: Theme) =>
  StyleSheet.create({
    root: { alignItems: 'center', paddingVertical: space.s40, gap: space.s16 },
    badge: {
      width: size.avatar.lg,
      height: size.avatar.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSunk,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { gap: space.s8, alignItems: 'center' },
  });

export const EmptyState: React.FC<EmptyStateProps> = ({ title, body, icon, action }) => {
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  return (
    <View style={styles.root}>
      {icon ? (
        <View style={styles.badge}>
          <Icon name={icon} size="lg" color={service.accent} />
        </View>
      ) : null}
      <View style={styles.text}>
        <AppText variant="h2" align="center" accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant="body" tone="muted" align="center">
          {body}
        </AppText>
      </View>
      {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" /> : null}
    </View>
  );
};

export default EmptyState;
