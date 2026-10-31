// Shared by DateField.tsx and DateField.web.tsx. Its own module because on
// web './DateField' resolves to DateField.web.tsx — a file importing itself.

import { StyleSheet } from 'react-native';
import type { Theme } from '../theme';

export interface DateFieldProps {
  label: string;
  /** Local `YYYY-MM-DD`, or '' for none. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest / latest selectable day, `YYYY-MM-DD`. */
  min?: string;
  max?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const dateKeyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dateFromKey = (key: string | undefined): Date | undefined => {
  const m = key ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(key) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
};
/** "15 August 2001" */
export const formatDateKey = (key: string): string => {
  const d = dateFromKey(key);
  return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
};

export const makeDateFieldStyles = ({ colors, space, size, radius, elevation }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s8 },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s12,
      minHeight: size.control.lg,
      paddingHorizontal: space.s16,
      borderRadius: radius.md,
      borderWidth: size.border,
      backgroundColor: colors.surface,
      ...elevation.input,
    },
    value: { flex: 1 },
  });

