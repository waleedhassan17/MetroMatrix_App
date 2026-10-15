// ═══════════════════════════════════════════════════════
// ImageViewer — full-screen document image with pinch, pan, double-tap
// ═══════════════════════════════════════════════════════
// The Modal renders outside the app's GestureHandlerRootView on Android, so
// it carries its own.

import React, { useEffect } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

export interface ImageViewerProps {
  visible: boolean;
  uri: string | null;
  title?: string;
  onClose: () => void;
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
  });

export const ImageViewer: React.FC<ImageViewerProps> = ({ visible, uri, title, onClose }) => {
  const styles = useStyles(makeStyles);
  const { motion } = useTheme();
  const insets = useSafeAreaInsets();

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
        <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
          <Animated.View style={[styles.stage, animated]}>
            {uri ? (
              <Image
                source={{ uri }}
                style={styles.image}
                contentFit="contain"
                accessibilityLabel={title ?? 'Document'}
              />
            ) : null}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default ImageViewer;
