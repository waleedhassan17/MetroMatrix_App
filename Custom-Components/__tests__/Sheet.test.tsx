// Sheet is the plain React Native Modal sheet on every platform. The
// @gorhom/bottom-sheet version never presented in Expo Go on Android, so a
// provider's "Add document" did nothing (the owner's report of 2026-11-25).
// This pins the Modal: it opens from `visible`, shows its title and content,
// rises above the keyboard, and every way out (scrim, Close, Android back)
// calls onClose.

import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { KeyboardAvoidingView, Modal, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme';
import { Sheet } from '../Sheet';
import { ModalSheet } from '../ModalSheet';

jest.mock('@expo/vector-icons', () => {
  const { createElement } = jest.requireActual('react');
  const { Text: RNText } = jest.requireActual('react-native');
  const Glyph = ({ name }: { name: string }) => createElement(RNText, null, name);
  return { Feather: Glyph, Ionicons: Glyph, MaterialCommunityIcons: Glyph };
});

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const setup = (visible = true) => {
  const onClose = jest.fn();
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider>
          <Sheet visible={visible} onClose={onClose} title="PMDC certificate" subtitle="Use good light.">
            <Text>Choose a file</Text>
          </Sheet>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
  });
  const closers = () =>
    tree.root.findAll((n: ReactTestInstance) => n.props.accessibilityLabel === 'Close' && typeof n.props.onPress === 'function');
  return { tree, onClose, closers };
};

describe('Sheet', () => {
  it('is the Modal sheet on phones too', () => {
    expect(Sheet).toBe(ModalSheet);
  });

  it('opens from `visible` with its title and content', () => {
    const { tree } = setup();
    expect(tree.root.findByType(Modal).props.visible).toBe(true);
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('PMDC certificate');
    expect(text).toContain('Choose a file');
  });

  it('stays shut while `visible` is false', () => {
    const { tree } = setup(false);
    expect(tree.root.findByType(Modal).props.visible).toBe(false);
  });

  it('rises above the keyboard', () => {
    const { tree } = setup();
    expect(tree.root.findByType(KeyboardAvoidingView).props.behavior).toBe('padding');
  });

  it('closes from the scrim, the Close button and Android back', () => {
    const { tree, onClose, closers } = setup();
    const [scrim, closeButton] = closers();
    act(() => scrim!.props.onPress());
    act(() => closeButton!.props.onPress());
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
