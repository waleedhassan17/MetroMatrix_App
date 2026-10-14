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

  useEffect(() => {
    if (!visible) {
      scale.value = 1;
      savedScale.value = 1;
      tx.value = 0;
      ty.value = 0;
      savedTx.value = 0;
      savedTy.value = 0;
    }
  }, [visible, scale, savedScale, tx, ty, savedTx, savedTy]);

  const pinch = Gesture.Pinch()
    .onUpdate(e => {
      scale.value = Math.min(MAX_ZOOM, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .onUpdate(e => {
      if (scale.value <= 1) return;
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const zoomIn = scale.value <= 1;
      const target = zoomIn ? 2 : 1;
      scale.value = withTiming(target, { duration: motion.sheet.duration });
      savedScale.value = target;
      if (!zoomIn) {
        tx.value = withTiming(0, { duration: motion.sheet.duration });
        ty.value = withTiming(0, { duration: motion.sheet.duration });
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="fade" statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <View style={[styles.bar, { paddingTop: insets.top }]}>
          <IconButton icon="x" onPress={onClose} accessibilityLabel="Close document" tone="onScrim" />
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
