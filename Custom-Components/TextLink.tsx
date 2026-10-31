// TextLink — "New here? Create account": a muted lead-in and a ghost action.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: space.s4 },
  });

export const TextLink: React.FC<{ lead?: string; label: string; onPress: () => void }> = ({ lead, label, onPress }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.row}>
      {lead ? (
        <AppText variant="small" tone="muted">
          {lead}
        </AppText>
      ) : null}
      <Button label={label} variant="ghost" size="sm" onPress={onPress} />
    </View>
  );
};

export default TextLink;
