// EmptyState — a glyph in the service's soft well (the FYP's), a headline,
// one line, one action. `ion` takes an Ionicons glyph (Shopping's set).

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, IonIcon, type IconName, type IonName } from './Icon';

export interface EmptyStateProps {
  title: string;
  body: string;
  icon?: IconName;
  ion?: IonName;
  action?: { label: string; onPress: () => void };
}

const makeStyles = ({ space, size, radius }: Theme) =>
  StyleSheet.create({
    root: { alignItems: 'center', paddingVertical: space.s40, gap: space.s16 },
    badge: {
      width: size.avatar.lg,
      height: size.avatar.lg,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { gap: space.s8, alignItems: 'center' },
  });

export const EmptyState: React.FC<EmptyStateProps> = ({ title, body, icon, ion, action }) => {
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  return (
    <View style={styles.root}>
      {icon || ion ? (
        <View style={[styles.badge, { backgroundColor: service.accentSoft }]}>
          {ion ? (
            <IonIcon name={ion} size="xl" color={service.accentDeep} />
          ) : icon ? (
            <Icon name={icon} size="lg" color={service.accentDeep} />
          ) : null}
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
