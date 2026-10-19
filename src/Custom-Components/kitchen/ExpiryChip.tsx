// ExpiryChip — "Expires tomorrow", "3 days", "Expired", in its tone.

import React from 'react';
import { StatusPill } from '../StatusPill';
import { expiryLabel } from '../../models/kitchen/stockModel';

export const ExpiryChip: React.FC<{ on: string; today: string }> = ({ on, today }) => {
  const e = expiryLabel(on, today);
  return <StatusPill label={e.label} tone={e.tone} />;
};

export default ExpiryChip;
