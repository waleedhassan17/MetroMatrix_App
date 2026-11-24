// The sheet's props and parts, shared by ModalSheet (which Sheet is) and the
// pickers built on it.

import type React from 'react';
import { StyleSheet } from 'react-native';
import type { Theme } from '../theme';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const makeSheetStyles = ({ space, gutter }: Theme) =>
  StyleSheet.create({
    head: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: gutter,
      paddingBottom: space.s12,
      gap: space.s8,
    },
    headText: { flex: 1, gap: space.s4, paddingTop: space.s8 },
    body: { paddingHorizontal: gutter, gap: space.s16 },
    footer: { paddingHorizontal: gutter, paddingTop: space.s16, gap: space.s8 },
  });

