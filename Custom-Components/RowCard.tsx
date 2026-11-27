// ═══════════════════════════════════════════════════════
// RowCard — the app's ONE list card
// ═══════════════════════════════════════════════════════
// Every list entry (an order, a patient, a review, a store, a vendor …) is
// this card, so every list reads the same and every card in a list is the
// same height (the owner, 2026-11-27):
//   • a fixed 44 pt leading slot: initials, a photo, a store's mark, a time,
//     or a glyph in a neutral well;
//   • the title on ONE line;
//   • exactly the meta lines the screen passes, each ONE line, and a line
//     with nothing to say keeps its space, so a list never goes ragged;
//   • at the end, at most ONE status pill and one amount, then a chevron;
//   • an optional ruled foot ("3 items · Cash on delivery" … the total), and
//     `children` under it for a screen's own actions.
// RowCardSkeleton is built from the same measures, so nothing jumps when
// the list lands. Tokens only.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../theme';

/** Holds an empty line's height: a plain space collapses to nothing in a browser. */
const NBSP = '\u00A0';
import { cdn } from '../utils/cdn/cdn';
import { AppText } from './AppText';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { Divider } from './Divider';
import { IonIcon, type IonName } from './Icon';
import { IconWell } from './IconWell';
import { Skeleton } from './Skeleton';
import { StatusPill, type PillTone } from './StatusPill';
import { StoreMark } from './shopping/StoreCard';

export type RowMark =
  /** Initials (or the person's photo). */
  | { name: string; uri?: string | null }
  /** A glyph in a neutral well. */
  | { icon: IonName }
  /** A product's photo: portrait (4:5) or square. */
  | { image: string | null; aspect?: 'portrait' | 'square' }
  | { store: { name: string; logoUrl: string | null; brandColor: string; onBrandColor?: string | null } }
  /** A visit's time: "10:30" over "AM". */
  | { time: string; sub?: string };

export interface RowCardProps {
  title: string;
  /** One line each; a falsy entry keeps its line's space. */
  lines?: (string | null | undefined | false)[];
  mark?: RowMark;
  pill?: { label: string; tone: PillTone };
  amount?: string;
  foot?: { left: string; right?: string };
  chevron?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Selected or highlighted: the accent line. */
  selected?: boolean;
  children?: React.ReactNode;
}

const makeStyles = ({ colors, space, size, radius, listGap }: Theme) =>
  StyleSheet.create({
    stack: { gap: listGap },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    mark: { width: size.listMark, minHeight: size.listMark, alignItems: 'center', justifyContent: 'center' },
    thumb: { width: size.listMark, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surfaceSunk },
    thumbImage: { width: '100%', height: '100%' },
    time: {
      width: size.listMark,
      height: size.listMark,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceSunk,
    },
    text: { flex: 1, gap: space.s4 },
    end: { alignItems: 'flex-end', gap: space.s4, maxWidth: '45%' },
    foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    grow: { flex: 1 },
    skeletonLine: { justifyContent: 'center' },
  });

const Mark: React.FC<{ mark: RowMark }> = ({ mark }) => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  if ('name' in mark) return <Avatar name={mark.name} uri={mark.uri} size="md" />;
  if ('store' in mark) return <StoreMark store={mark.store} size="md" />;
  if ('time' in mark)
    return (
      <View style={styles.time}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {mark.time}
        </AppText>
        {mark.sub ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {mark.sub}
          </AppText>
        ) : null}
      </View>
    );
  if ('image' in mark) {
    const aspect = mark.aspect === 'square' ? 1 : size.productAspect;
    const uri = cdn(mark.image, { w: size.listMark * 2, h: (size.listMark * 2) / aspect });
    return (
      <View style={[styles.thumb, { aspectRatio: aspect }]}>
        {uri ? <Image source={{ uri }} style={styles.thumbImage} contentFit="cover" /> : null}
      </View>
    );
  }
  return <IconWell icon={mark.icon} size="md" />;
};

export const RowCard: React.FC<RowCardProps> = ({
  title,
  lines = [],
  mark,
  pill,
  amount,
  foot,
  chevron,
  onPress,
  accessibilityLabel,
  selected,
  children,
}) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const said = lines.filter((l): l is string => !!l);
  return (
    <Card
      onPress={onPress}
      selected={selected}
      accessibilityLabel={
        accessibilityLabel ?? [title, ...said, pill?.label, amount, foot?.left, foot?.right].filter(Boolean).join(', ')
      }>
      <View style={styles.row}>
        {mark ? (
          <View style={styles.mark}>
            <Mark mark={mark} />
          </View>
        ) : null}
        <View style={styles.text}>
          <AppText variant="title" numberOfLines={1}>
            {title}
          </AppText>
          {lines.map((l, i) => (
            // A line with nothing to say keeps its height: every card in a list matches.
            <AppText key={i} variant="small" tone="muted" numberOfLines={1}>
              {l || NBSP}
            </AppText>
          ))}
        </View>
        {pill || amount ? (
          <View style={styles.end}>
            {pill ? <StatusPill label={pill.label} tone={pill.tone} /> : null}
            {amount ? (
              <AppText variant="bodyStrong" numberOfLines={1}>
                {amount}
              </AppText>
            ) : null}
          </View>
        ) : null}
        {chevron ? <IonIcon name="chevron-forward" size="md" color={colors.inkFaint} /> : null}
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

/** A bar the height of a line of `role`, so a skeleton stands exactly where its text will. */
const SkeletonLine: React.FC<{ lineHeight: number; width: `${number}%` }> = ({ lineHeight, width }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.skeletonLine, { height: lineHeight }]}>
      <Skeleton width={width} height={Math.round(lineHeight * 0.6)} />
    </View>
  );
};

/** One list card while it loads: the mark, the title and `lines` meta lines, at the card's real height. */
export const RowCardSkeleton: React.FC<{ lines?: number; mark?: boolean; pill?: boolean }> = ({ lines = 1, mark = true, pill = false }) => {
  const styles = useStyles(makeStyles);
  const { size, type, space } = useTheme();
  return (
    <Card>
      <View style={styles.row}>
        {mark ? <Skeleton width={size.listMark} height={size.listMark} shape="pill" /> : null}
        <View style={styles.text}>
          <SkeletonLine lineHeight={type.title.lineHeight as number} width="60%" />
          {Array.from({ length: lines }, (_, i) => (
            <SkeletonLine key={i} lineHeight={type.small.lineHeight as number} width={i === lines - 1 ? '35%' : '50%'} />
          ))}
        </View>
        {pill ? <Skeleton width={size.tile} height={(type.micro.lineHeight as number) + space.s8} shape="pill" /> : null}
      </View>
    </Card>
  );
};

/** A list's first page while it loads: `count` cards at the list's own gap. */
export const RowCardsSkeleton: React.FC<{ count?: number; lines?: number; mark?: boolean; pill?: boolean }> = ({
  count = 4,
  lines,
  mark,
  pill,
}) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.stack} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <RowCardSkeleton key={i} lines={lines} mark={mark} pill={pill} />
      ))}
    </View>
  );
};

export default RowCard;
