// ═══════════════════════════════════════════════════════
// MetroMatrix — the staff console's shared pieces
// ═══════════════════════════════════════════════════════
// The customer app's look for staff screens (and the store's, the doctor's
// and the kitchen's apps): numbers on white tiles (StatGrid), quick actions
// as white tiles with a glyph in a neutral well, tool menus of plain rows,
// and lists as the one list card (RowCard). No categorical colours anywhere
// (the owner, 2026-11-27). Tokens only.

import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Card, Divider, IconWell, ListRow, TextAction, type IonName } from '../../Custom-Components/index';

// The list card, the stat grid and the well live in the kit, so every app's
// lists match; re-exported here for the screens that import them from the console.
export { IconWell, RowCard, RowCardSkeleton, RowCardsSkeleton, StatGrid, StatGridSkeleton } from '../../Custom-Components/index';
export type { AdminStat, RowMark } from '../../Custom-Components/index';

const makeStyles = ({ colors, space, radius, elevation, type }: Theme) =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s12 },
    // Every tile keeps room for a two-line label, with the glyphs on one line
    // across the row, so a grid of quick actions is one height whatever the
    // labels say.
    action: {
      alignItems: 'center',
      gap: space.s8,
      paddingVertical: space.s16,
      paddingHorizontal: space.s8,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      ...elevation.card,
    },
    actionLabel: { minHeight: (type.small.lineHeight as number) * 2 },
    section: { gap: space.s12 },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s12,
    },
    grow: { flex: 1 },
  });

export interface QuickAction {
  key: string;
  icon: IonName;
  label: string;
  onPress: () => void;
}

/** Quick actions: three to a row (or four), a glyph in a neutral well and a label (two lines at most). */
export const QuickActionGrid: React.FC<{ actions: QuickAction[]; columns?: 3 | 4 }> = ({ actions, columns = 3 }) => {
  const styles = useStyles(makeStyles);
  const { space, opacity } = useTheme();
  const [width, setWidth] = useState(0);
  const tile = width ? Math.floor((width - space.s12 * (columns - 1)) / columns) : undefined;
  return (
    <View style={styles.grid} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {actions.map(a => (
        <QuickActionTile key={a.key} action={a} width={tile} pressedOpacity={opacity.pressed} />
      ))}
    </View>
  );
};

const QuickActionTile: React.FC<{ action: QuickAction; width?: number; pressedOpacity: number }> = ({ action, width, pressedOpacity }) => {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={action.onPress}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      style={({ pressed }) => [styles.action, width ? { width } : { flexBasis: '28%', flexGrow: 1 }, pressed && { opacity: pressedOpacity }]}>
      <IconWell icon={action.icon} size="md" />
      <AppText variant="small" align="center" numberOfLines={2} style={styles.actionLabel}>
        {action.label}
      </AppText>
    </Pressable>
  );
};

/** A section's name (the one heading style, never an eyebrow), with an optional action at its end. */
export const SectionHead: React.FC<{
  title: string;
  action?: { label: string; onPress: () => void };
}> = ({ title, action }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.sectionHead}>
      <AppText variant="sectionTitle" accessibilityRole="header" numberOfLines={1} style={styles.grow}>
        {title}
      </AppText>
      {action ? <TextAction label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
};

export interface AdminTool {
  key: string;
  title: string;
  subtitle?: string;
  icon: IonName;
  /** A count or state at the row's end ("3 waiting"). */
  value?: string;
  onPress: () => void;
}

/** A titled menu of tools: plain rows (a slate glyph, the title, one line, a count). */
export const ToolSection: React.FC<{ title: string; tools: AdminTool[] }> = ({ title, tools }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.section}>
      <SectionHead title={title} />
      <Card padded="horizontal">
        {tools.map((t, i) => (
          <React.Fragment key={t.key}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              title={t.title}
              subtitle={t.subtitle}
              leftIcon={t.icon}
              value={t.value}
              onPress={t.onPress}
            />
          </React.Fragment>
        ))}
      </Card>
    </View>
  );
};
