// StatusTimeline — a vertical sequence of steps: done, current, upcoming, failed.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

export type TimelineState = 'done' | 'current' | 'upcoming' | 'failed';

export interface TimelineStep {
  label: string;
  description?: string;
  state: TimelineState;
}

const makeStyles = ({ space, size, radius, colors }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: space.s12 },
    rail: { alignItems: 'center', width: size.icon.lg },
    dot: {
      width: size.icon.lg,
      height: size.icon.lg,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: size.timelineLine,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    line: { flex: 1, width: size.timelineLine, backgroundColor: colors.line, minHeight: space.s24 },
    body: { flex: 1, paddingBottom: space.s24, gap: space.s4 },
  });

export const StatusTimeline: React.FC<{ steps: TimelineStep[] }> = ({ steps }) => {
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  return (
    <View accessibilityRole="list">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const dotLook =
          step.state === 'done'
            ? { backgroundColor: service.accent, borderColor: service.accent }
            : step.state === 'current'
              ? { borderColor: service.accent }
              : step.state === 'failed'
                ? { backgroundColor: colors.danger, borderColor: colors.danger }
                : null;
        return (
          <View
            key={step.label}
            style={styles.row}
            accessible
            accessibilityLabel={`${step.label}: ${step.state}${step.description ? `. ${step.description}` : ''}`}>
            <View style={styles.rail}>
              <View style={[styles.dot, dotLook]}>
                {step.state === 'done' ? <Icon name="check" size="sm" color={service.onAccent} /> : null}
                {step.state === 'failed' ? <Icon name="x" size="sm" color={colors.onDanger} /> : null}
              </View>
              {!last ? (
                <View style={[styles.line, step.state === 'done' && { backgroundColor: service.accent }]} />
              ) : null}
            </View>
            <View style={styles.body}>
              <AppText variant="title" tone={step.state === 'upcoming' ? 'muted' : 'ink'}>
                {step.label}
              </AppText>
              {step.description ? (
                <AppText variant="small" tone="muted">
                  {step.description}
                </AppText>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default StatusTimeline;
