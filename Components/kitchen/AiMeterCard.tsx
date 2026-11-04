// ═══════════════════════════════════════════════════════
// MetroMatrix — The assistant's meter (Kitchen hub, Assistant)
// ═══════════════════════════════════════════════════════
// How many assistant actions are left this month, as one card: a tinted
// well, the line, why (or the reset date when they're used up) and the bar.
// Tapping it opens the assistant when `onPress` is given.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../../theme';
import { AppText } from '../../Custom-Components/AppText';
import { Card } from '../../Custom-Components/Card';
import { ProgressBar } from '../../Custom-Components/ProgressBar';
import { IconWell } from '../admin/AdminParts';
import { usageFill, usageLine, usageNote } from '../../models/kitchen/aiModel';
import type { AiUsage } from '../../models';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s8 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
  });

export const AiMeterCard: React.FC<{ usage: AiUsage; onPress?: () => void; hint?: string }> = ({ usage, onPress, hint }) => {
  const styles = useStyles(makeStyles);
  const note = usageNote(usage);
  return (
    <Card onPress={onPress} accessibilityLabel={onPress ? `${usageLine(usage)}. Opens the assistant.` : undefined}>
      <View style={styles.gap}>
        <View style={styles.head}>
          <IconWell icon="sparkles-outline" tint="teal" />
          <View style={styles.grow}>
            <AppText variant="title">{usageLine(usage)}</AppText>
            <AppText variant="small" tone="muted">
              {note ?? hint ?? 'Voice entry, receipt scans and drafts count. Nothing is saved until you confirm it.'}
            </AppText>
          </View>
        </View>
        <ProgressBar progress={1 - usageFill(usage)} accessibilityLabel={usageLine(usage)} />
      </View>
    </Card>
  );
};

export default AiMeterCard;
