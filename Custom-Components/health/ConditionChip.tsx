// ConditionChip — a condition patients know by name ("Acne"); tap for the
// doctors who treat it.

import React from 'react';
import type { Condition } from '../../models/health';
import { ChoiceChip } from '../shopping/ChoiceChip';

export const ConditionChip: React.FC<{ condition: Pick<Condition, 'name'>; onPress: () => void }> = ({ condition, onPress }) => (
  <ChoiceChip label={condition.name} onPress={onPress} accessibilityHint={`Doctors who treat ${condition.name}`} />
);

export default ConditionChip;
