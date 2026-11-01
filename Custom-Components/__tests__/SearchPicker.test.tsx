// SearchPicker: the city pickers (Complete Profile, PersonalInfo, an address).
// A plain Modal on every platform; typing filters, and a city the list doesn't
// have can be used as typed.

import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Modal, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme';
import { SearchPicker } from '../SearchPicker';
import { CITIES, TYPED_CITY_HINT, typedCity } from '../../models/businessModel';

// The icon fonts load asynchronously and set state after the test; glyphs don't matter here.
jest.mock('@expo/vector-icons', () => {
  const { createElement } = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  const Glyph = ({ name }: { name: string }) => createElement(Text, null, name);
  return { Feather: Glyph, Ionicons: Glyph, MaterialCommunityIcons: Glyph };
});

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const setup = (value: string | null = null) => {
  const onSelect = jest.fn();
  const onClose = jest.fn();
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider>
          <SearchPicker
            visible
            onClose={onClose}
            title="Select City"
            options={CITIES}
            value={value}
            onSelect={onSelect}
            searchLabel="Search or type your city"
            custom={typedCity}
            customHint={TYPED_CITY_HINT}
          />
        </ThemeProvider>
      </SafeAreaProvider>,
    );
  });
  /** Host views only: one per rendered row, with the role and label it announces. */
  const hosts = (match: (props: Record<string, unknown>) => boolean) =>
    tree.root.findAll((n: ReactTestInstance) => typeof n.type === 'string' && match(n.props));
  const type = (text: string) => act(() => tree.root.findByType(TextInput).props.onChangeText(text));
  const labels = (role: string) => hosts(p => p.accessibilityRole === role).map(n => n.props.accessibilityLabel as string);
  const press = (label: string) =>
    act(() => tree.root.findAll((n: ReactTestInstance) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0]!.props.onPress());
  const text = () => JSON.stringify(tree.toJSON());
  return { tree, onSelect, onClose, hosts, type, labels, press, text };
};

describe('SearchPicker', () => {
  it('opens as a Modal with every city', () => {
    const { tree, labels } = setup();
    expect(tree.root.findByType(Modal).props.visible).toBe(true);
    expect(labels('radio')).toEqual(CITIES.map(c => c.label));
  });

  it('typing filters the list', () => {
    const { type, labels } = setup();
    type('abad');
    expect(labels('radio')).toEqual(['Islamabad', 'Faisalabad', 'Hyderabad']);
  });

  it('a listed city picks as itself', () => {
    const { press, onSelect, onClose } = setup();
    press('Multan');
    expect(onSelect).toHaveBeenCalledWith('Multan');
    expect(onClose).toHaveBeenCalled();
  });

  it('a city the list lacks can be used as typed, capitalised', () => {
    const { type, labels, press, onSelect } = setup();
    type('okara');
    expect(labels('radio')).toEqual([]);
    expect(labels('button')).toContain('Use Okara');
    press('Use Okara');
    expect(onSelect).toHaveBeenCalledWith('Okara');
  });

  it('typing a listed city exactly offers no duplicate', () => {
    const { type, labels } = setup();
    type('lahore');
    expect(labels('radio')).toEqual(['Lahore']);
    expect(labels('button')).not.toContain('Use Lahore');
  });

  it('Done on the keyboard picks the typed city', () => {
    const { tree, type, onSelect } = setup();
    type('Sahiwal');
    act(() => tree.root.findByType(TextInput).props.onSubmitEditing());
    expect(onSelect).toHaveBeenCalledWith('Sahiwal');
  });

  it('says how to type a city when the text cannot be one', () => {
    const { type, labels, text } = setup();
    type('123');
    expect(labels('button')).not.toContain('Use 123');
    expect(text()).toContain(TYPED_CITY_HINT);
  });

  it('a typed city chosen before shows first, ticked', () => {
    const { hosts, labels } = setup('Okara');
    expect(labels('radio')[0]).toBe('Okara');
    expect(hosts(p => p.accessibilityLabel === 'Okara')[0]!.props.accessibilityState?.checked).toBe(true);
  });
});
