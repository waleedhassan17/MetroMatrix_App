// SearchPicker — a BottomSheetPicker with a search field, for long lists or
// lists that can't hold every answer (a city). Typing filters the options;
// with `custom`, what was typed can be chosen too ("Use “Okara”"), and a
// value chosen that way shows at the top, ticked, next time. The keyboard's
// Done picks the typed value (or the only match). A tall ModalSheet, so the
// field stays put while the list shrinks under it.

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { PickerOptionRow, type PickerOption } from './BottomSheetPicker';
import { Icon } from './Icon';
import { ModalSheet } from './ModalSheet';
import { TextField } from './TextField';

export interface SearchPickerProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: PickerOption<string>[];
  value: string | null;
  onSelect: (value: string) => void;
  /** The field's label, e.g. "Search or type your city". */
  searchLabel: string;
  placeholder?: string;
  /**
   * Turns what was typed into a value of its own, or null when it can't be
   * one. Without it only the listed options can be chosen.
   */
  custom?: (text: string) => string | null;
  /** Shown when what was typed matches nothing and `custom` refuses it. */
  customHint?: string;
}

const makeStyles = ({ space, size, radius }: Theme) =>
  StyleSheet.create({
    use: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: size.control.lg,
      gap: space.s12,
      paddingHorizontal: space.s12,
      borderRadius: radius.md,
    },
    useText: { flex: 1 },
  });

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const SearchPicker: React.FC<SearchPickerProps> = ({
  visible,
  onClose,
  title,
  options,
  value,
  onSelect,
  searchLabel,
  placeholder,
  custom,
  customHint,
}) => {
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const [query, setQuery] = useState('');

  // A value chosen by typing isn't in the list: show it first, ticked.
  const all = useMemo(
    () => (value && !options.some(o => o.value === value) ? [{ value, label: value }, ...options] : options),
    [options, value],
  );
  const text = query.trim();
  const matches = text ? all.filter(o => o.label.toLowerCase().includes(text.toLowerCase())) : all;
  const exact = matches.find(o => same(o.label, text));
  const typed = text && custom && !exact ? custom(text) : null;
  const typedIsListed = typed ? all.some(o => same(o.value, typed)) : false;

  // Every opening starts from the whole list.
  const close = () => {
    setQuery('');
    onClose();
  };

  const choose = (v: string) => {
    onSelect(v);
    close();
  };

  const submit = () => {
    if (exact) choose(exact.value);
    else if (typed && !typedIsListed) choose(typed);
    else if (matches.length === 1 && matches[0]) choose(matches[0].value);
  };

  return (
    <ModalSheet visible={visible} onClose={close} title={title} tall>
      <TextField
        label={searchLabel}
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        icon="search-outline"
        clearable
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <View accessibilityRole="radiogroup">
        {typed && !typedIsListed ? (
          <Pressable
            onPress={() => choose(typed)}
            accessibilityRole="button"
            accessibilityLabel={`Use ${typed}`}
            style={styles.use}>
            <Icon name="plus-circle" size="md" color={service.accentDeep} />
            <AppText variant="title" tone="accentDeep" style={styles.useText}>
              {`Use “${typed}”`}
            </AppText>
          </Pressable>
        ) : null}
        {matches.map(option => (
          <PickerOptionRow
            key={option.value}
            label={option.label}
            description={option.description}
            selected={option.value === value}
            onPress={() => choose(option.value)}
          />
        ))}
      </View>
      {text && !matches.length && !typed ? (
        <AppText variant="body" tone="muted">
          {customHint ?? `Nothing matches “${text}”.`}
        </AppText>
      ) : null}
    </ModalSheet>
  );
};

export default SearchPicker;
