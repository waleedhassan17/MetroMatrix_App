// PortionStepper — how many plates a home kitchen cooks of a dish today, and
// how many are sold and left. "No limit" until the first portions are set.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { QuantityStepper } from '../shopping/QuantityStepper';
import { TextAction } from '../TextAction';

export interface PortionStepperProps {
  /** Portions cooked today, or null for no limit. */
  portions: number | null;
  sold: number | null;
  onChange: (next: number | null) => void;
  name: string;
  disabled?: boolean;
}

const MAX = 5000;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    root: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    text: { flex: 1, gap: space.s4 },
  });

export const PortionStepper: React.FC<PortionStepperProps> = ({ portions, sold, onChange, name, disabled }) => {
  const styles = useStyles(makeStyles);
  const used = sold ?? 0;
  const left = portions === null ? null : Math.max(0, portions - used);
  return (
    <View style={styles.root}>
      <View style={styles.text}>
        <AppText variant="small" tone={left === 0 ? 'warning' : 'muted'}>
          {portions === null ? 'No limit on portions' : left === 0 ? `Sold out · ${used} sold` : `${left} left · ${used} sold`}
        </AppText>
        {portions !== null ? <TextAction label="Remove the limit" tone="muted" onPress={() => onChange(null)} disabled={disabled} /> : null}
      </View>
      {portions === null ? (
        <TextAction label="Set portions" icon="add" onPress={() => onChange(Math.max(10, used))} disabled={disabled} />
      ) : (
        <QuantityStepper value={portions} onChange={onChange} min={Math.min(used, MAX)} max={MAX} disabled={disabled} label={`Portions of ${name}`} />
      )}
    </View>
  );
};

export default PortionStepper;
