// ═══════════════════════════════════════════════════════
// FoodMap — what the native and web maps share
// ═══════════════════════════════════════════════════════
// One interface for every Food map: the checkout's mini-map, order tracking
// (kitchen, drop-off and the moving rider), the rider's live map for the
// vendor, and the address picker (a fixed centre pin over a moving map).
// Native draws with react-native-maps (Google on Android, Apple on iOS;
// FoodMap.tsx); the web with MapLibre on free OpenFreeMap tiles
// (FoodMap.web.tsx). Screens import `FoodMap` and never know which.
//
// The pins are React Native views on both, painted from the theme. The
// rider's marker glides to each new position (motion.markerGlide) and jumps
// under reduce motion (useCalmMotion).
// Kept apart from FoodMap(.web) on purpose: a .web file must never import
// its own name (CLAUDE.md, sheetShared.ts).

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IonIcon } from '../../Icon';
import { useStyles, useTheme, type Theme } from '../../../theme';
import { useCalmMotion } from '../../../hooks/useCalmMotion';

export interface MapPoint {
  lat: number;
  lng: number;
}

export type MapPinKind = 'vendor' | 'drop' | 'rider';

export interface MapPin {
  id: string;
  kind: Exclude<MapPinKind, 'rider'>;
  at: MapPoint;
  /** Read out by screen readers ("Karachi Biryani House", "Your address"). */
  label: string;
}

/** A shaded box on the map (the demand map's grid cells): how strongly to fill it, and whether to outline it. */
export interface MapCell {
  id: string;
  sw: MapPoint;
  ne: MapPoint;
  /** 0–1. */
  strength: number;
  outlined: boolean;
}

export interface FoodMapProps {
  /** Fixed pins: the kitchen, the drop-off. */
  pins: MapPin[];
  /** Shaded boxes over the map (the demand map). */
  cells?: MapCell[];
  /** Where to look when there is no pin to fit (an area overview). */
  view?: { center: MapPoint; zoom: number };
  /** The moving rider; null hides the marker. */
  rider?: (MapPoint & { heading?: number | null }) | null;
  height: number;
  /** The address picker: the map moves under a fixed centre pin and reports its centre. */
  picker?: { initial: MapPoint; onCenterChange: (p: MapPoint) => void };
  /** False for a static mini-map (no panning). */
  interactive?: boolean;
  accessibilityLabel: string;
}

/** A cell's fill: the scope's accent at up to this opacity (the strongest cells). */
export const CELL_MAX_OPACITY = 0.55;

/** "#RRGGBB" + an opacity → "#RRGGBBAA" (react-native-maps fills take alpha in the colour). */
export const withAlpha = (hex: string, opacity: number) =>
  `${hex.slice(0, 7)}${Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** OpenFreeMap's light style: free, no key (the FYP's tile source). */
export const WEB_MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
/** Street level, for a single point or the picker. */
export const POINT_ZOOM = 16;
/** Padding (px) kept around the fitted pins. */
export const FIT_PADDING = 48;

/** The box around every point to show (fixed pins and the rider). */
export const boundsOf = (points: MapPoint[]): { sw: MapPoint; ne: MapPoint } | null => {
  if (!points.length) return null;
  const lats = points.map(p => p.lat);
  const lngs = points.map(p => p.lng);
  return { sw: { lat: Math.min(...lats), lng: Math.min(...lngs) }, ne: { lat: Math.max(...lats), lng: Math.max(...lngs) } };
};

/**
 * The rider's shown position: glides from the last one to `target` over
 * motion.markerGlide, frame by frame; jumps under calm motion.
 */
export const useGlidingPoint = (target: MapPoint | null | undefined): MapPoint | null => {
  const { motion } = useTheme();
  const calm = useCalmMotion();
  const [shown, setShown] = useState<MapPoint | null>(target ?? null);
  // Where the marker is drawn now (read by the next glide; written after render).
  const drawn = useRef<MapPoint | null>(shown);
  useEffect(() => {
    drawn.current = shown;
  }, [shown]);

  const lat = target?.lat;
  const lng = target?.lng;
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    const to = { lat, lng };
    const from = drawn.current;
    const began = Date.now();
    let frame = 0;
    const step = () => {
      const t = !from || calm ? 1 : Math.min(1, (Date.now() - began) / motion.markerGlide);
      const ease = 1 - (1 - t) ** 3;
      setShown(from && !calm ? { lat: from.lat + (to.lat - from.lat) * ease, lng: from.lng + (to.lng - from.lng) * ease } : to);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [lat, lng, calm, motion.markerGlide]);

  return target ? shown : null;
};

const makeStyles = ({ colors, service, size, radius, elevation }: Theme) =>
  StyleSheet.create({
    pin: {
      width: size.mapPin,
      height: size.mapPin,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: size.focusBorder,
      borderColor: colors.surface,
      ...elevation.card,
    },
    vendor: { backgroundColor: service.accent },
    drop: { backgroundColor: colors.ink },
    rider: {
      width: size.mapRider,
      height: size.mapRider,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: service.accent,
      borderWidth: size.avatarRing,
      borderColor: colors.surface,
      ...elevation.float,
    },
    centre: { alignItems: 'center' },
  });

/** A pin's look (both maps). */
export const PinView: React.FC<{ kind: MapPinKind }> = ({ kind }) => {
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  if (kind === 'rider') {
    return (
      <View style={styles.rider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <IonIcon name="bicycle" size="md" color={service.onAccent} />
      </View>
    );
  }
  return (
    <View style={[styles.pin, kind === 'vendor' ? styles.vendor : styles.drop]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <IonIcon name={kind === 'vendor' ? 'restaurant' : 'home'} size="sm" color={kind === 'vendor' ? service.onAccent : colors.surface} />
    </View>
  );
};

/** The address picker's fixed centre pin: its tip marks the chosen point. */
export const CentrePin: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { service, size } = useTheme();
  return (
    <View style={styles.centre} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Ionicons name="location" size={size.mapCentrePin} color={service.accent} />
    </View>
  );
};
