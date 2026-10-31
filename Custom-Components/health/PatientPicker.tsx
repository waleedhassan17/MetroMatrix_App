// PatientPicker — who the appointment is for: Me, or a family member, and a
// way to add one without leaving.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../../theme';
import type { FamilyMember } from '../../types/health';
import { ChoiceChip } from '../shopping/ChoiceChip';

const makeStyles = ({ space }: Theme) => StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 } });

export const PatientPicker: React.FC<{
  family: FamilyMember[];
  /** null = me. */
  selected: string | null;
  onSelect: (memberId: string | null) => void;
  onAdd?: () => void;
}> = ({ family, selected, onSelect, onAdd }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Who is the appointment for">
      <ChoiceChip label="Me" icon="person-outline" selected={selected === null} onPress={() => onSelect(null)} />
      {family.map(m => (
        <ChoiceChip key={m.id} label={m.name.split(' ')[0]} selected={selected === m.id} onPress={() => onSelect(m.id)} accessibilityHint={`Book for ${m.name}`} />
      ))}
      {onAdd ? <ChoiceChip label="Add family member" icon="add" onPress={onAdd} /> : null}
    </View>
  );
};

export default PatientPicker;
