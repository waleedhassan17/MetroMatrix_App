// ═══════════════════════════════════════════════════════
// MetroMatrix — the staff console's shared pieces
// ═══════════════════════════════════════════════════════
// The customer app's look for staff screens (and the store's app): numbers
// on raised tiles with a tinted icon well (as on Profile), quick actions as
// tinted tiles, tool menus whose rows wear the FYP's categorical icon
// colours, and lists as raised cards with a mark, ONE status pill and the
// amount. Tokens only.

import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type RowTint, type Theme } from '../../theme/index';
import {
  AppText,
  Avatar,
  Card,
  Divider,
  IonIcon,
  ListRow,
  Skeleton,
  StatusPill,
  StoreMark,
  TextAction,
  type IonName,
} from '../../Custom-Components/index';
import { cdn } from '../../utils/cdn/cdn';

type Tint = RowTint | 'accent';
type PillTone = React.ComponentProps<typeof StatusPill>['tone'];

const makeStyles = ({ colors, space, size, radius, elevation }: Theme) =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s12 },
    compactTile: { padding: space.s12, gap: space.s4 },
    compactWell: { width: size.statWell, height: size.statWell },
    action: {
      alignItems: 'center',
      gap: space.s8,
      paddingVertical: space.s16,
      paddingHorizontal: space.s8,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      ...elevation.card,
    },
    actionWell: {
      width: size.actionTile,
      height: size.actionTile,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumb: { width: size.thumb, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surfaceSunk },
    thumbImage: { width: '100%', height: '100%' },
    foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    chevron: { alignSelf: 'center' },
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

/** A glyph in a soft, tinted square (`compact`: the store's 32 pt well). */
export const IconWell: React.FC<{ icon: IonName; tint: Tint; compact?: boolean }> = ({ icon, tint, compact }) => {
  const styles = useStyles(makeStyles);
  const t = useTint(tint);
  return (
    <View style={[styles.well, compact && styles.compactWell, { backgroundColor: t.bg }]}>
      <IonIcon name={icon} size={compact ? 'sm' : 'md'} color={t.fg} />
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

const StatTile: React.FC<{ stat: AdminStat; compact?: boolean; width?: number }> = ({ stat: s, compact, width }) => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const frame = [styles.tile, compact && styles.compactTile, width ? { flexGrow: 0, flexBasis: width, width } : null];
  const body = (
    <>
      <View style={styles.tileHead}>
        <IconWell icon={s.icon} tint={s.tint} compact={compact} />
        {compact ? null : (
          <AppText variant="small" tone="muted" numberOfLines={2} style={styles.grow}>
            {s.label}
          </AppText>
        )}
      </View>
      {s.value === null ? (
        <Skeleton width="50%" height={size.subTypeTile} />
      ) : (
        // One line: a value is a number or a short word; the words that explain it go in the hint.
        <AppText variant={compact ? 'h2' : 'h1'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {String(s.value)}
        </AppText>
      )}
      {compact ? (
        <AppText variant="caption" tone="muted" numberOfLines={2}>
          {s.label}
        </AppText>
      ) : null}
      {s.hint ? (
        <AppText variant="caption" tone="muted" numberOfLines={2}>
          {s.hint}
        </AppText>
      ) : null}
    </>
  );
  const label = `${s.label}: ${s.value ?? 'loading'}${s.hint ? `, ${s.hint}` : ''}`;
  return s.onPress ? (
    <Card onPress={s.onPress} padded={false} style={frame} accessibilityLabel={label}>
      {body}
    </Card>
  ) : (
    <View style={frame} accessible accessibilityLabel={label}>
      {body}
    </View>
  );
};

/**
 * Numbers in columns (two by default). Every tile keeps its column's width,
 * so an odd last tile never stretches across the row. `compact`: the store's
 * Today tiles (a 32 pt well, the number, the label under it).
 */
export const StatGrid: React.FC<{ stats: AdminStat[]; columns?: 2 | 3; compact?: boolean }> = ({ stats, columns = 2, compact }) => {
  const styles = useStyles(makeStyles);
  const { space } = useTheme();
  const [width, setWidth] = useState(0);
  const tile = width ? Math.floor((width - space.s12 * (columns - 1)) / columns) : undefined;
  return (
    <View style={styles.grid} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {stats.map(s => (
        <StatTile key={s.key} stat={s} compact={compact} width={tile} />
      ))}
    </View>
  );
};

export interface QuickAction {
  key: string;
  icon: IonName;
  tint: Tint;
  label: string;
  onPress: () => void;
}

/** The store's quick actions (the FYP's): three to a row (or four), a tinted tile and a label. */
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
  const t = useTint(action.tint);
  return (
    <Pressable
      onPress={action.onPress}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      style={({ pressed }) => [styles.action, width ? { width } : { flexBasis: '28%', flexGrow: 1 }, pressed && { opacity: pressedOpacity }]}>
      <View style={[styles.actionWell, { backgroundColor: t.bg }]}>
        <IonIcon name={action.icon} size="md" color={t.fg} />
      </View>
      <AppText variant="small" align="center" numberOfLines={2}>
        {action.label}
      </AppText>
    </Pressable>
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

export type RowMark =
  | { name: string }
  | { icon: IonName; tint: Tint }
  /** A product's photo: portrait (4:5) or square. */
  | { image: string | null; aspect?: 'portrait' | 'square' }
  | { store: { name: string; logoUrl: string | null; brandColor: string; onBrandColor?: string | null } };

const Mark: React.FC<{ mark: RowMark }> = ({ mark }) => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  if ('name' in mark) return <Avatar name={mark.name} size="md" />;
  if ('store' in mark) return <StoreMark store={mark.store} size="md" />;
  if ('image' in mark) {
    const aspect = mark.aspect === 'square' ? 1 : size.productAspect;
    const uri = cdn(mark.image, { w: size.thumb * 2, h: (size.thumb * 2) / aspect });
    return (
      <View style={[styles.thumb, { aspectRatio: aspect }]}>
        {uri ? <Image source={{ uri }} style={styles.thumbImage} contentFit="cover" /> : null}
      </View>
    );
  }
  return <IconWell icon={mark.icon} tint={mark.tint} />;
};

/**
 * One list entry as a raised card: a mark (initials, a glyph in a tinted
 * well, a product photo or a store's mark), the title with lines under it,
 * and at the end ONE status pill and an amount. `foot` is a ruled last line
 * ("3 items · Cash on delivery" … the total); `children` go under it (a
 * screen's own actions).
 */
export const RowCard: React.FC<{
  title: string;
  lines?: (string | null | undefined | false)[];
  mark?: RowMark;
  pill?: { label: string; tone: PillTone };
  amount?: string;
  foot?: { left: string; right?: string };
  chevron?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  children?: React.ReactNode;
}> = ({ title, lines = [], mark, pill, amount, foot, chevron, onPress, accessibilityLabel, children }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const shown = lines.filter((l): l is string => !!l);
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={
        accessibilityLabel ?? [title, ...shown, pill?.label, amount, foot?.left, foot?.right].filter(Boolean).join(', ')
      }>
      <View style={styles.row}>
        {mark ? <Mark mark={mark} /> : null}
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
        {chevron ? (
          <View style={styles.chevron}>
            <IonIcon name="chevron-forward" size="md" color={colors.inkFaint} />
          </View>
        ) : null}
      </View>
      {foot ? (
        <>
          <Divider />
          <View style={styles.foot}>
            <AppText variant="small" tone="muted" numberOfLines={1} style={styles.grow}>
              {foot.left}
            </AppText>
            {foot.right ? <AppText variant="bodyStrong">{foot.right}</AppText> : null}
          </View>
        </>
      ) : null}
      {children}
    </Card>
  );
};
