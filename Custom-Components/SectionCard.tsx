// SectionCard — a titled part of a long page (the FYP's section cards):
// checkout's steps, an order's customer and items, a form's Photos or Price.
// The FYP card with a head row: an optional plain slate glyph (no well, no
// colour), the title (a header for screen readers), a muted line under it,
// and one quiet action.
// A form's bare fields go in one of these, never loose on the canvas.

import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { Card } from './Card';
import { IonIcon, type IonName } from './Icon';
import { TextAction } from './TextAction';

export interface SectionCardProps {
  title: string;
  subtitle?: string;
  icon?: IonName;
  /** One quiet action at the head's end ("Change", "Edit"), or anything else. */
  action?: { label: string; onPress: () => void } | React.ReactNode;
  /** A section that needs attention (a missing photo): the danger line. */
  invalid?: boolean;
  /** Selected or highlighted: the accent line. */
  selected?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    text: { flex: 1, gap: space.s4 },
    body: { gap: space.s12 },
  });

const isAction = (a: SectionCardProps['action']): a is { label: string; onPress: () => void } =>
  !!a && typeof a === 'object' && 'label' in a && 'onPress' in a;

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  icon,
  action,
  invalid,
  selected,
  children,
  style,
}) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Card invalid={invalid} selected={selected} style={style}>
      <View style={styles.head}>
        {icon ? <IonIcon name={icon} size="md" color={colors.inkMuted} /> : null}
        <View style={styles.text}>
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="small" tone="muted">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {isAction(action) ? <TextAction label={action.label} onPress={action.onPress} /> : action ?? null}
      </View>
      {children ? <View style={styles.body}>{children}</View> : null}
    </Card>
  );
};

export default SectionCard;
