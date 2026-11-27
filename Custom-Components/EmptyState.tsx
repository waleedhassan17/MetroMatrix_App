// EmptyState — an Ionicons glyph in a soft neutral well, a headline, one
// line, one action. The well is grey in every service: colour is for status
// and the primary action, never decoration (the owner, 2026-11-27).

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { type IonName } from './Icon';
import { IconWell } from './IconWell';

export interface EmptyStateProps {
  title: string;
  body: string;
  icon?: IonName;
  action?: { label: string; onPress: () => void };
}

const makeStyles = ({ space, size }: Theme) =>
  StyleSheet.create({
    root: { alignItems: 'center', paddingVertical: space.s40, gap: space.s16 },
    text: { gap: space.s8, alignItems: 'center', maxWidth: size.prose },
  });

export const EmptyState: React.FC<EmptyStateProps> = ({ title, body, icon, action }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.root}>
      {icon ? <IconWell icon={icon} size="xl" /> : null}
      <View style={styles.text}>
        <AppText variant="sectionTitle" align="center" accessibilityRole="header">
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
