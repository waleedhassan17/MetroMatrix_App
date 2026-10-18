// ═══════════════════════════════════════════════════════
// MetroMatrix — the staff console's shared pieces
// ═══════════════════════════════════════════════════════
// The customer app's look for staff screens: numbers on raised tiles with a
// tinted icon well (as on Profile), tool menus whose rows wear the FYP's
// categorical icon colours, and lists as raised cards with a mark, a status
// pill and the amount. Tokens only.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type RowTint, type Theme } from '@theme/index';
import {
  AppText,
  Avatar,
  Card,
  Divider,
  IonIcon,
  ListRow,
  Skeleton,
  StatusPill,
  TextAction,
  type IonName,
} from '@custom/index';

type Tint = RowTint | 'accent';
type PillTone = React.ComponentProps<typeof StatusPill>['tone'];

const makeStyles = ({ colors, space, size, radius, elevation }: Theme) =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s12 },
    tile: {
      flexGrow: 1,
      flexBasis: '40%',
      gap: space.s8,
      padding: space.s16,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      ...elevation.card,
    },
    tileHead: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    well: {
      width: size.subTypeTile,
      height: size.subTypeTile,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    grow: { flex: 1 },
    section: { gap: space.s8 },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s12,
    },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s12 },
    text: { flex: 1, gap: space.s4 },
    end: { alignItems: 'flex-end', gap: space.s8 },
  });

/** The well's colours: a categorical tint, or the scope's accent. */
const useTint = (tint: Tint) => {
  const { rowTint, service } = useTheme();
  return tint === 'accent' ? { bg: service.accentSoft, fg: service.accentDeep } : rowTint[tint];
};

/** A glyph in a soft, tinted square. */
export const IconWell: React.FC<{ icon: IonName; tint: Tint }> = ({ icon, tint }) => {
  const styles = useStyles(makeStyles);
  const t = useTint(tint);
  return (
    <View style={[styles.well, { backgroundColor: t.bg }]}>
      <IonIcon name={icon} size="md" color={t.fg} />
    </View>
  );
};

export interface AdminStat {
  key: string;
  icon: IonName;
  tint: Tint;
  /** null while loading. */
  value: string | number | null;
  label: string;
  /** A line under the number ("of 12 placed"). */
  hint?: string | null;
  onPress?: () => void;
}

const StatTile: React.FC<{ stat: AdminStat }> = ({ stat: s }) => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const body = (
    <>
      <View style={styles.tileHead}>
        <IconWell icon={s.icon} tint={s.tint} />
        <AppText variant="small" tone="muted" numberOfLines={2} style={styles.grow}>
          {s.label}
        </AppText>
      </View>
      {s.value === null ? (
        <Skeleton width="50%" height={size.subTypeTile} />
      ) : (
        <AppText variant="h1">{String(s.value)}</AppText>
      )}
      {s.hint ? (
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {s.hint}
        </AppText>
      ) : null}
    </>
  );
  const label = `${s.label}: ${s.value ?? 'loading'}${s.hint ? `, ${s.hint}` : ''}`;
  return s.onPress ? (
    <Card onPress={s.onPress} padded={false} style={styles.tile} accessibilityLabel={label}>
      {body}
    </Card>
  ) : (
    <View style={styles.tile} accessible accessibilityLabel={label}>
      {body}
    </View>
  );
};

/** Two columns of numbers. */
export const StatGrid: React.FC<{ stats: AdminStat[] }> = ({ stats }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.grid}>
      {stats.map(s => (
        <StatTile key={s.key} stat={s} />
      ))}
    </View>
  );
};

/** An overline section title, with an optional action at its end. */
export const SectionHead: React.FC<{
  title: string;
  action?: { label: string; onPress: () => void };
}> = ({ title, action }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.sectionHead}>
      <AppText variant="overline" tone="muted" accessibilityRole="header">
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
  tint: RowTint;
  /** A count or state at the row's end ("3 waiting"). */
  value?: string;
  onPress: () => void;
}

/** A titled menu of staff tools, each row with its own icon colour. */
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
              tint={t.tint}
              value={t.value}
              onPress={t.onPress}
            />
          </React.Fragment>
        ))}
      </Card>
    </View>
  );
};

export type RowMark = { name: string } | { icon: IonName; tint: Tint };

/**
 * One list entry as a raised card: a mark (initials, or a glyph in a tinted
 * well), the title with lines under it, and at the end a status pill and an
 * amount. `children` go under it (a screen's own actions).
 */
export const RowCard: React.FC<{
  title: string;
  lines?: (string | null | undefined | false)[];
  mark?: RowMark;
  pill?: { label: string; tone: PillTone };
  amount?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  children?: React.ReactNode;
}> = ({ title, lines = [], mark, pill, amount, onPress, accessibilityLabel, children }) => {
  const styles = useStyles(makeStyles);
  const shown = lines.filter((l): l is string => !!l);
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={
        accessibilityLabel ?? [title, ...shown, pill?.label, amount].filter(Boolean).join(', ')
      }>
      <View style={styles.row}>
        {mark ? (
          'name' in mark ? (
            <Avatar name={mark.name} size="md" />
          ) : (
            <IconWell icon={mark.icon} tint={mark.tint} />
          )
        ) : null}
        <View style={styles.text}>
          <AppText variant="title" numberOfLines={1}>
            {title}
          </AppText>
          {shown.map((l, i) => (
            <AppText key={i} variant="small" tone="muted" numberOfLines={2}>
              {l}
            </AppText>
          ))}
        </View>
        {pill || amount ? (
          <View style={styles.end}>
            {pill ? <StatusPill label={pill.label} tone={pill.tone} /> : null}
            {amount ? <AppText variant="bodyStrong">{amount}</AppText> : null}
          </View>
        ) : null}
      </View>
      {children}
    </Card>
  );
};
