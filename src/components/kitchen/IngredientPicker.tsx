// MetroMatrix — Pick an ingredient from the kitchen's stock (search by
// name), or name a new one. Used by the recipe editor and the purchase form.

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '@theme/index';
import { AppText, Divider, ListRow, Sheet, TextField } from '@custom/index';
import { CATEGORY_LABEL } from '@models/kitchen/kitchenStatusModel';
import { qtyLabel } from '@models/kitchen/stockModel';
import type { Ingredient } from '@/types';

const makeStyles = ({ space, size }: Theme) =>
  StyleSheet.create({
    list: { maxHeight: size.heatmap + size.quadrant / 2 },
    body: { gap: space.s12 },
  });

export interface IngredientPickerProps {
  visible: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  onPick: (ingredient: Ingredient) => void;
  /** Name a new ingredient (the caller decides how it is added). */
  onCreate?: (name: string) => void;
  title?: string;
  /** Packaging lines pick packaging; ingredient lines everything else. */
  only?: 'food' | 'packaging';
}

export const IngredientPicker: React.FC<IngredientPickerProps> = ({ visible, onClose, ingredients, onPick, onCreate, title = 'Pick an ingredient', only }) => {
  const styles = useStyles(makeStyles);
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ingredients
      .filter(i => !only || (only === 'packaging' ? i.category === 'packaging' : i.category !== 'packaging'))
      .filter(i => !needle || i.name.toLowerCase().includes(needle))
      .slice(0, 60);
  }, [ingredients, q, only]);
  const close = () => {
    setQ('');
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={close} title={title}>
      <View style={styles.body}>
        <TextField label="Search your stock" value={q} onChangeText={setQ} autoFocus clearable />
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {shown.map((i, n) => (
            <View key={i.id}>
              {n > 0 ? <Divider /> : null}
              <ListRow
                title={i.name}
                subtitle={`${CATEGORY_LABEL[i.category]} · ${qtyLabel(i, i.onHand)} in stock`}
                onPress={() => {
                  onPick(i);
                  close();
                }}
              />
            </View>
          ))}
          {!shown.length ? (
            <AppText variant="small" tone="muted">
              Nothing in your stock is called that.
            </AppText>
          ) : null}
        </ScrollView>
        {onCreate && q.trim().length >= 2 ? (
          <ListRow
            title={`Add “${q.trim()}” as a new ingredient`}
            leftIcon="add-circle-outline"
            onPress={() => {
              onCreate(q.trim());
              close();
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
};

export default IngredientPicker;
