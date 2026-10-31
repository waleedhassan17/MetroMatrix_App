// ═══════════════════════════════════════════════════════
// FoodMap (native) — react-native-maps
// ═══════════════════════════════════════════════════════
// Google Maps on Android, Apple Maps on iOS. Expo Go brings its own Google
// key; a build reads GOOGLE_MAPS_ANDROID_KEY (app.config.ts, an EAS
// secret). Shared props, pins and the rider's glide: ./foodMapShared.

import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polygon, type Region } from 'react-native-maps';
import { useStyles, useTheme, type Theme } from '../../../theme';
import {
  CELL_MAX_OPACITY,
  CentrePin,
  FIT_PADDING,
  PinView,
  POINT_ZOOM,
  boundsOf,
  useGlidingPoint,
  withAlpha,
  type FoodMapProps,
  type MapPoint,
} from './foodMapShared';

export type { FoodMapProps, MapCell, MapPin, MapPoint } from './foodMapShared';

/** A latitude span that reads as street level (react-native-maps works in deltas, not zoom). */
const deltaForZoom = (zoom: number) => 360 / 2 ** zoom;

const makeStyles = ({ radius, colors }: Theme) =>
  StyleSheet.create({
    frame: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.surfaceSunk },
    centre: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  });

export const FoodMap: React.FC<FoodMapProps> = ({ pins, cells, view, rider, height, picker, interactive = true, accessibilityLabel }) => {
  const styles = useStyles(makeStyles);
  const { service, size } = useTheme();
  const map = useRef<MapView>(null);
  const shownRider = useGlidingPoint(rider ?? null);

  const initial: Region = useMemo(() => {
    const centre: MapPoint = picker?.initial ?? view?.center ?? pins[0]?.at ?? rider ?? { lat: 31.5204, lng: 74.3587 };
    const d = deltaForZoom(view?.zoom ?? POINT_ZOOM);
    return { latitude: centre.lat, longitude: centre.lng, latitudeDelta: d, longitudeDelta: d };
    // The first frame only; later changes fit or pan below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fit the fixed pins (and the rider) whenever the pins change.
  const pinKey = pins.map(p => `${p.id}:${p.at.lat},${p.at.lng}`).join('|');
  useEffect(() => {
    if (picker) return;
    const points = [...pins.map(p => p.at), ...(rider ? [rider] : [])];
    const box = boundsOf(points);
    if (!box || points.length < 2) return;
    map.current?.fitToCoordinates(
      points.map(p => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: FIT_PADDING, right: FIT_PADDING, bottom: FIT_PADDING, left: FIT_PADDING }, animated: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinKey, !!rider, !!picker]);

  return (
    <View style={[styles.frame, { height }]} accessible accessibilityLabel={accessibilityLabel}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={initial}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterest={false}
        onRegionChangeComplete={r => picker?.onCenterChange({ lat: r.latitude, lng: r.longitude })}
      >
        {(cells ?? []).map(c => (
          <Polygon
            key={c.id}
            coordinates={[
              { latitude: c.sw.lat, longitude: c.sw.lng },
              { latitude: c.sw.lat, longitude: c.ne.lng },
              { latitude: c.ne.lat, longitude: c.ne.lng },
              { latitude: c.ne.lat, longitude: c.sw.lng },
            ]}
            fillColor={withAlpha(service.accent, c.strength * CELL_MAX_OPACITY)}
            strokeColor={c.outlined ? service.accentDeep : withAlpha(service.accent, 0)}
            strokeWidth={c.outlined ? size.focusBorder : 0}
          />
        ))}
        {pins.map(p => (
          <Marker key={p.id} coordinate={{ latitude: p.at.lat, longitude: p.at.lng }} title={p.label} tracksViewChanges={false}>
            <PinView kind={p.kind} />
          </Marker>
        ))}
        {shownRider ? (
          <Marker coordinate={{ latitude: shownRider.lat, longitude: shownRider.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <PinView kind="rider" />
          </Marker>
        ) : null}
      </MapView>
      {picker ? (
        <View style={styles.centre} pointerEvents="none">
          <CentrePin />
        </View>
      ) : null}
    </View>
  );
};

export default FoodMap;
