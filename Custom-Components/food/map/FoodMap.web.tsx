// ═══════════════════════════════════════════════════════
// FoodMap (web) — MapLibre on OpenFreeMap tiles
// ═══════════════════════════════════════════════════════
// react-native-maps has no web build, so the browser draws the same map with
// MapLibre GL (free, no key; OpenFreeMap's light style, with its attribution).
// The pins are the same React Native views as on the phone, laid over the
// map at their projected positions and moved with it. If the tiles can't be
// loaded the map gives way to an "Open in Google Maps" card.
// Must never import './FoodMap' (on web that resolves to this file); shared
// code lives in ./foodMapShared.

import React, { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AppText } from '../../AppText';
import { TextLink } from '../../TextLink';
import { useStyles, useTheme, type Theme } from '../../../theme';
import { useCalmMotion } from '../../../hooks/useCalmMotion';
import { directionsUrl } from '../../../utils/maps';
import {
  CELL_MAX_OPACITY,
  CentrePin,
  FIT_PADDING,
  PinView,
  POINT_ZOOM,
  WEB_MAP_STYLE,
  boundsOf,
  useGlidingPoint,
  type FoodMapProps,
  type MapCell,
  type MapPoint,
} from './foodMapShared';

export type { FoodMapProps, MapCell, MapPin, MapPoint } from './foodMapShared';

/** The demand map's cells as GeoJSON boxes. */
const cellsGeoJson = (cells: MapCell[]) => ({
  type: 'FeatureCollection' as const,
  features: cells.map(c => ({
    type: 'Feature' as const,
    properties: { id: c.id, strength: c.strength, outlined: c.outlined },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [c.sw.lng, c.sw.lat],
          [c.ne.lng, c.sw.lat],
          [c.ne.lng, c.ne.lat],
          [c.sw.lng, c.ne.lat],
          [c.sw.lng, c.sw.lat],
        ],
      ],
    },
  })),
});

type Projected = Record<string, { x: number; y: number }>;

/** The app is in English: label places with their English (or Latin) name where the map has one. */
const englishLabels = (m: maplibregl.Map) => {
  for (const layer of m.getStyle().layers ?? []) {
    if (layer.type !== 'symbol' || !m.getLayoutProperty(layer.id, 'text-field')) continue;
    try {
      m.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']]);
    } catch {
      /* a layer that can't take it keeps its own label */
    }
  }
};

/** The credit stays one tap away (the ⓘ button) instead of covering the map's foot. */
const collapseAttribution = (host: HTMLElement) => {
  host.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
};

const makeStyles = ({ radius, colors, space, size }: Theme) =>
  StyleSheet.create({
    frame: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.surfaceSunk },
    // MapLibre's stylesheet makes its container `position: relative`, which
    // beats an absolute fill: an explicit full size keeps it the frame's size.
    canvas: { width: '100%', height: '100%' },
    pin: { position: 'absolute' },
    centre: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s8, padding: space.s16 },
    // The centre pin's tip sits on the point: lift it by half its height.
    lift: { marginBottom: size.mapCentrePin },
  });

export const FoodMap: React.FC<FoodMapProps> = ({ pins, cells, view, rider, height, picker, interactive = true, accessibilityLabel }) => {
  const styles = useStyles(makeStyles);
  const { size, service } = useTheme();
  const [loaded, setLoaded] = useState(false);
  const calm = useCalmMotion();
  const host = useRef<View>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [failed, setFailed] = useState(false);
  const [projected, setProjected] = useState<Projected>({});
  const shownRider = useGlidingPoint(rider ?? null);

  // Pin positions follow the map (and the gliding rider).
  const latest = useRef({ pins, shownRider });
  useEffect(() => {
    latest.current = { pins, shownRider };
  });
  const reproject = () => {
    const m = map.current;
    if (!m) return;
    const next: Projected = {};
    for (const p of latest.current.pins) next[p.id] = m.project([p.at.lng, p.at.lat]);
    const r = latest.current.shownRider;
    if (r) next.__rider = m.project([r.lng, r.lat]);
    setProjected(next);
  };

  useEffect(() => {
    const el = host.current as unknown as HTMLElement | null;
    if (!el) return;
    const centre: MapPoint = picker?.initial ?? view?.center ?? pins[0]?.at ?? rider ?? { lat: 31.5204, lng: 74.3587 };
    const m = new maplibregl.Map({
      container: el,
      style: WEB_MAP_STYLE,
      center: [centre.lng, centre.lat],
      zoom: view?.zoom ?? POINT_ZOOM,
      interactive,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.current = m;
    m.on('move', reproject);
    m.on('load', () => {
      englishLabels(m);
      collapseAttribution(el);
      reproject();
      setLoaded(true);
    });
    m.on('error', e => {
      // Only a style that never loads means no map; a missing tile is not fatal.
      if (!m.isStyleLoaded()) setFailed(true);
      void e;
    });
    if (picker) m.on('moveend', () => picker.onCenterChange({ lat: m.getCenter().lat, lng: m.getCenter().lng }));
    return () => {
      m.remove();
      map.current = null;
    };
    // The map is built once; pins and the rider update below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fit the fixed pins (and the rider) whenever the pins change.
  const pinKey = pins.map(p => `${p.id}:${p.at.lat},${p.at.lng}`).join('|');
  useEffect(() => {
    const m = map.current;
    if (!m || picker) return;
    const points = [...pins.map(p => p.at), ...(rider ? [rider] : [])];
    const box = boundsOf(points);
    if (!box) return;
    if (points.length < 2) m.jumpTo({ center: [points[0].lng, points[0].lat], zoom: POINT_ZOOM });
    else
      m.fitBounds(
        [
          [box.sw.lng, box.sw.lat],
          [box.ne.lng, box.ne.lat],
        ],
        { padding: FIT_PADDING, maxZoom: POINT_ZOOM, duration: calm ? 0 : 600 },
      );
    reproject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinKey, !!rider]);

  useEffect(reproject, [shownRider?.lat, shownRider?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // The demand map's cells: one GeoJSON source, a fill by strength and an outline where marked.
  const cellKey = (cells ?? []).map(c => `${c.id}:${c.strength}:${c.outlined}`).join('|');
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    const data = cellsGeoJson(cells ?? []);
    const source = m.getSource('cells') as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      m.addSource('cells', { type: 'geojson', data });
      m.addLayer({ id: 'cells-fill', type: 'fill', source: 'cells', paint: { 'fill-color': service.accent, 'fill-opacity': ['*', ['get', 'strength'], CELL_MAX_OPACITY] } });
      m.addLayer({ id: 'cells-line', type: 'line', source: 'cells', filter: ['==', ['get', 'outlined'], true], paint: { 'line-color': service.accentDeep, 'line-width': size.focusBorder } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellKey, loaded]);

  if (failed) {
    const target = pins.find(p => p.kind === 'drop') ?? pins[0];
    return (
      <View style={[styles.frame, { height }]}>
        <View style={styles.fallback}>
          <AppText variant="body" tone="muted" align="center">
            The map can’t load right now.
          </AppText>
          {target ? (
            <TextLink
              label="Open in Google Maps"
              onPress={() =>
                void Linking.openURL(directionsUrl({ lat: target.at.lat, lng: target.at.lng, address: null, name: target.label }))
              }
            />
          ) : null}
        </View>
      </View>
    );
  }

  const pinSize = (kind: 'vendor' | 'drop' | 'rider') => (kind === 'rider' ? size.mapRider : size.mapPin);
  return (
    <View style={[styles.frame, { height }]} accessible accessibilityLabel={accessibilityLabel}>
      <View ref={host} style={styles.canvas} />
      {pins.map(p => {
        const at = projected[p.id];
        if (!at) return null;
        const half = pinSize(p.kind) / 2;
        return (
          <View key={p.id} style={[styles.pin, { left: at.x - half, top: at.y - half }]} pointerEvents="none">
            <PinView kind={p.kind} />
          </View>
        );
      })}
      {shownRider && projected.__rider ? (
        <View
          style={[styles.pin, { left: projected.__rider.x - size.mapRider / 2, top: projected.__rider.y - size.mapRider / 2 }]}
          pointerEvents="none"
        >
          <PinView kind="rider" />
        </View>
      ) : null}
      {picker ? (
        <View style={styles.centre} pointerEvents="none">
          <View style={styles.lift}>
            <CentrePin />
          </View>
        </View>
      ) : null}
    </View>
  );
};

export default FoodMap;
