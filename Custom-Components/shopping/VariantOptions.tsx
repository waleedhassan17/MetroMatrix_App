// VariantOptions — a product's options on its page (the FYP's): sizes as
// 44 pt chips, colours as round swatches ringed when chosen (a chip when the
// store set no colour), the choice named in the label ("Size: M"). Values
// that can't be bought with the other choice are struck through.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { ProductDetail } from '../../models/shopping';
import { isValueAvailable, type VariantChoice } from '../../models/shopping/variantPickerModel';
import { AppText } from '../AppText';
import { IonIcon } from '../Icon';
import { ChoiceChip } from './ChoiceChip';

export interface VariantOptionsProps {
  product: Pick<ProductDetail, 'option1' | 'option2' | 'variants'>;
  choice: VariantChoice;
  onChoose: (which: 1 | 2, value: string) => void;
}

const makeStyles = ({ colors, radius, space, size }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s16 },
    group: { gap: space.s8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    swatchHit: {
      width: size.touch,
      height: size.touch,
      borderRadius: radius.pill,
      borderWidth: size.focusBorder,
      borderColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatch: {
      width: size.swatch,
      height: size.swatch,
      borderRadius: radius.pill,
      borderWidth: size.hairline,
      borderColor: colors.lineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export const VariantOptions: React.FC<VariantOptionsProps> = ({ product, choice, onChoose }) => {
  const styles = useStyles(makeStyles);
  const { service, colors, opacity } = useTheme();
  const groups = [
    { which: 1 as const, option: product.option1, chosen: choice.option1 },
    { which: 2 as const, option: product.option2, chosen: choice.option2 },
  ];
  return (
    <View style={styles.list}>
      {groups.map(({ which, option, chosen }) => {
        if (!option) return null;
        // Option 1 is offered against nothing; option 2 against the size chosen.
        const against: VariantChoice = which === 1 ? { option1: null, option2: null } : choice;
        return (
          <View key={which} style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={option.name}>
            <AppText variant="label">
              {option.name}
              {chosen ? <AppText variant="label" tone="muted">{`: ${chosen}`}</AppText> : null}
            </AppText>
            <View style={styles.chips}>
              {option.values.map(value => {
                const available = isValueAvailable(product, which, value, against);
                const selected = chosen === value;
                const swatch = option.swatches?.[value];
                if (!swatch) {
                  return (
                    <ChoiceChip
                      key={value}
                      label={value}
                      size="option"
                      selected={selected}
                      disabled={!available}
                      onPress={() => onChoose(which, value)}
                    />
                  );
                }
                return (
                  <Pressable
                    key={value}
                    onPress={() => onChoose(which, value)}
                    disabled={!available}
                    accessibilityRole="radio"
                    aria-checked={selected}
                    aria-disabled={!available}
                    accessibilityLabel={available ? value : `${value}, unavailable`}
                    style={[styles.swatchHit, selected && { borderColor: service.accent }, !available && { opacity: opacity.disabled }]}>
                    <View style={[styles.swatch, { backgroundColor: swatch }]}>
                      {!available ? <IonIcon name="close" size="md" color={colors.inkMuted} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default VariantOptions;
