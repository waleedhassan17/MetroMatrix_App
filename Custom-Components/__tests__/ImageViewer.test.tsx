// ImageViewer pages through a PDF (each page an image Cloudinary renders):
// it opens on page 1, fetches the next page ahead, and Next stays off once
// that page doesn't exist.

import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme';
import { ImageViewer } from '../ImageViewer';

jest.mock('@expo/vector-icons', () => {
  const { createElement } = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  const Glyph = ({ name }: { name: string }) => createElement(Text, null, name);
  return { Feather: Glyph, Ionicons: Glyph, MaterialCommunityIcons: Glyph };
});
// Gestures and animation don't matter here (and aren't transformed for jest): plain stand-ins.
jest.mock('react-native-gesture-handler', () => {
  const { createElement, Fragment } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const chain: Record<string, unknown> = {};
  for (const k of ['onUpdate', 'onEnd', 'numberOfTaps']) chain[k] = () => chain;
  return {
    Gesture: { Pinch: () => chain, Pan: () => chain, Tap: () => chain, Simultaneous: () => chain },
    GestureDetector: ({ children }: { children: React.ReactNode }) => createElement(Fragment, null, children),
    GestureHandlerRootView: (props: Record<string, unknown>) => createElement(View, props),
  };
});
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const shared = (v: number) => {
    let value = v;
    return { get: () => value, set: (n: number) => (value = n) };
  };
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useAnimatedStyle: () => ({}),
    useSharedValue: shared,
    withTiming: (v: number) => v,
    Easing: { out: () => undefined, quad: undefined },
  };
});
jest.mock('expo-image', () => {
  const { createElement } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const Image = (props: Record<string, unknown>) => createElement(View, { ...props, testID: 'viewer-image' });
  Image.prefetch = jest.fn();
  return { Image };
});
const { Image } = jest.requireMock('expo-image') as { Image: { prefetch: jest.Mock } };

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const page = (n: number) => (n <= 2 ? `https://res.cloudinary.com/x/image/upload/pg_${n}/a.jpg` : null);

const flush = () => act(async () => {
  await Promise.resolve();
});

const setup = () => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider>
          <ImageViewer visible uri="https://res.cloudinary.com/x/image/upload/a.pdf" title="PMDC certificate" pageUrl={page} onClose={() => undefined} />
        </ThemeProvider>
      </SafeAreaProvider>,
    );
  });
  const source = () => (tree.root.findByProps({ testID: 'viewer-image' }).props.source as { uri: string }).uri;
  const button = (label: string) =>
    tree.root.findAll((n: ReactTestInstance) => n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === label)[0]!;
  const press = (label: string) => act(() => button(label).props.onPress());
  const disabled = (label: string) => !!button(label).props['aria-disabled'];
  return { tree, source, press, disabled };
};

beforeEach(() => jest.clearAllMocks());

describe('ImageViewer with PDF pages', () => {
  it('opens on page 1, fetches page 2 ahead, and turns pages until the last', async () => {
    Image.prefetch.mockResolvedValue(true);
    const v = setup();
    expect(v.source()).toBe(page(1));
    await flush();
    expect(Image.prefetch).toHaveBeenCalledWith(page(2));
    expect(v.disabled('Previous')).toBe(true);
    expect(v.disabled('Next')).toBe(false);

    v.press('Next');
    expect(v.source()).toBe(page(2));
    // Page 3 can't be shown (pageUrl answers null): page 2 is the last.
    expect(v.disabled('Next')).toBe(true);
    v.press('Previous');
    expect(v.source()).toBe(page(1));
  });

  it('a next page that does not exist keeps Next off', async () => {
    Image.prefetch.mockResolvedValue(false);
    const v = setup();
    await flush();
    expect(v.disabled('Next')).toBe(true);
  });
});
