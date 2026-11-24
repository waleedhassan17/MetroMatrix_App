// ═══════════════════════════════════════════════════════
// ImageViewer — full-screen document image with pinch, pan, double-tap
// ═══════════════════════════════════════════════════════
// The Modal renders outside the app's GestureHandlerRootView on Android, so
// it carries its own.
//
// A PDF comes as pages (`pageUrl`, Cloudinary renders each one as an image:
// utils/cdn `pdfPage`): Previous / Next under the page, "Page n". The next
// page is fetched ahead; when it doesn't exist, Next turns off and that page
// is the last.

import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { IconButton } from './IconButton';

export interface ImageViewerProps {
  visible: boolean;
  uri: string | null;
  title?: string;
  onClose: () => void;
  /** A PDF: the image of page n (1-based), or null past what can be shown. */
  pageUrl?: ((page: number) => string | null) | null;
}

const MAX_ZOOM = 4;

const makeStyles = ({ colors, space, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.viewer },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: space.s8,
      gap: space.s8,
    },
    title: { flex: 1, paddingRight: gutter },
    stage: { flex: 1, overflow: 'hidden' },
    image: { flex: 1 },
    pager: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: gutter,
      paddingTop: space.s12,
      gap: space.s12,
    },
    failed: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: gutter },
  });

export const ImageViewer: React.FC<ImageViewerProps> = ({ visible, uri, title, onClose, pageUrl }) => {
  const styles = useStyles(makeStyles);
  const { motion, space } = useTheme();
  const insets = useSafeAreaInsets();

  // A PDF's page belongs to the document it was turned on: another document
  // (or the same one opened again) starts on page 1.
  const [turned, setTurned] = useState<{ uri: string | null; page: number }>({ uri: null, page: 1 });
  const page = turned.uri === uri && visible ? turned.page : 1;
  const turnTo = (p: number) => setTurned({ uri, page: Math.max(1, p) });
  const [failedFor, setFailedFor] = useState<string | null>(null);
  // Which page images exist, learnt by fetching each next page ahead.
  const [exists, setExists] = useState<Record<string, boolean>>({});
  const paged = !!pageUrl;
  const source = paged ? pageUrl(page) : uri;
  const failed = paged && !!source && failedFor === source;
  const nextUrl = paged && visible ? pageUrl(page + 1) : null;
  const hasNext = nextUrl ? (exists[nextUrl] ?? null) : false;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // .get()/.set() rather than `.value =`: the React Compiler lint cannot tell
  // a shared value from React state and flags direct writes.
  useEffect(() => {
    if (!visible) {
      for (const v of [scale, savedScale]) v.set(1);
      for (const v of [tx, ty, savedTx, savedTy]) v.set(0);
    }
  }, [visible, scale, savedScale, tx, ty, savedTx, savedTy]);

  // Each page starts unzoomed.
  useEffect(() => {
    for (const v of [scale, savedScale]) v.set(1);
    for (const v of [tx, ty, savedTx, savedTy]) v.set(0);
  }, [page, scale, savedScale, tx, ty, savedTx, savedTy]);

  // Is there a next page? Fetch it ahead: it then also shows at once.
  useEffect(() => {
    if (!nextUrl || nextUrl in exists) return undefined;
    let live = true;
    const learn = (ok: boolean) => {
      if (live) setExists(known => ({ ...known, [nextUrl]: ok }));
    };
    Image.prefetch(nextUrl).then(learn, () => learn(false));
    return () => {
      live = false;
    };
  }, [nextUrl, exists]);

  const pinch = Gesture.Pinch()
    .onUpdate(e => {
      scale.set(Math.min(MAX_ZOOM, Math.max(1, savedScale.get() * e.scale)));
    })
    .onEnd(() => {
      savedScale.set(scale.get());
    });

  const pan = Gesture.Pan()
    .onUpdate(e => {
      if (scale.get() <= 1) return;
      tx.set(savedTx.get() + e.translationX);
      ty.set(savedTy.get() + e.translationY);
    })
    .onEnd(() => {
      savedTx.set(tx.get());
      savedTy.set(ty.get());
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const zoomIn = scale.get() <= 1;
      const target = zoomIn ? 2 : 1;
      scale.set(withTiming(target, { duration: motion.sheet.duration }));
      savedScale.set(target);
      if (!zoomIn) {
        tx.set(withTiming(0, { duration: motion.sheet.duration }));
        ty.set(withTiming(0, { duration: motion.sheet.duration }));
        savedTx.set(0);
        savedTy.set(0);
      }
    });

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="fade" statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <View style={[styles.bar, { paddingTop: insets.top }]}>
          <IconButton
            icon="close"
            onPress={onClose}
            accessibilityLabel="Close document"
            tone="onScrim"
          />
          {title ? (
            <AppText variant="title" tone="onScrim" numberOfLines={1} style={styles.title}>
              {title}
            </AppText>
          ) : null}
        </View>
        {failed ? (
          <View style={styles.failed}>
            <AppText variant="body" tone="onScrim" align="center">
              {"This document couldn't be shown. Try again later."}
            </AppText>
          </View>
        ) : (
          <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
            <Animated.View style={[styles.stage, animated]}>
              {source ? (
                <Image
                  source={{ uri: source }}
                  style={styles.image}
                  contentFit="contain"
                  accessibilityLabel={paged ? `${title ?? 'Document'}, page ${page}` : (title ?? 'Document')}
                  onError={paged && page === 1 ? () => setFailedFor(source) : undefined}
                />
              ) : null}
            </Animated.View>
          </GestureDetector>
        )}
        {paged && !failed ? (
          <View style={[styles.pager, { paddingBottom: Math.max(insets.bottom, space.s16) }]}>
            <Button
              label="Previous"
              variant="secondary"
              size="sm"
              leftIcon="chevron-back"
              disabled={page === 1}
              onPress={() => turnTo(page - 1)}
            />
            <AppText variant="small" tone="onScrim" accessibilityLiveRegion="polite">
              Page {page}
            </AppText>
            <Button
              label="Next"
              variant="secondary"
              size="sm"
              rightIon="chevron-forward"
              disabled={hasNext !== true}
              onPress={() => turnTo(page + 1)}
            />
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
};

export default ImageViewer;
