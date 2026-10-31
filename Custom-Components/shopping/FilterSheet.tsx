// ═══════════════════════════════════════════════════════
// FilterSheet — sort and narrow a product list
// ═══════════════════════════════════════════════════════
// Controlled: the screen owns the draft and asks the server how many
// products it matches, so the button can say "Show 24 results" before it is
// pressed. Nothing applies until then; Reset clears everything but the sort.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../../theme';
import {
  PRICE_PRESETS,
  RATING_PRESETS,
  SORT_OPTIONS,
  validatePriceRange,
  type ProductFilters,
} from '../../models/shopping/filterModel';
import { formatPKR, parseRupees } from '../../utils/money';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { Divider } from '../Divider';
import { Sheet } from '../Sheet';
import { TextField } from '../TextField';
import { ToggleRow } from '../ToggleRow';
import { ChoiceChip } from './ChoiceChip';

export interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  draft: ProductFilters;
  onChange: (next: ProductFilters) => void;
  /** Products the draft matches; null while counting. */
  resultCount: number | null;
  onApply: () => void;
  onReset: () => void;
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    group: { gap: space.s12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    range: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1 },
    footer: { flexDirection: 'row', gap: space.s12 },
    grow: { flex: 1 },
  });

const rupeeText = (n: number | null) => (n === null ? '' : String(n));

export const FilterSheet: React.FC<FilterSheetProps> = ({ visible, onClose, draft, onChange, resultCount, onApply, onReset }) => {
  const styles = useStyles(makeStyles);
  const set = (patch: Partial<ProductFilters>) => onChange({ ...draft, ...patch });
  const rangeError = validatePriceRange(draft.minPrice, draft.maxPrice).price;
  const show =
    resultCount === null ? 'Counting…' : resultCount === 0 ? 'No matches' : `Show ${resultCount} ${resultCount === 1 ? 'result' : 'results'}`;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Sort and filter"
      footer={
        <View style={styles.footer}>
          <Button label="Reset" variant="secondary" onPress={onReset} />
          <View style={styles.grow}>
            <Button label={show} onPress={onApply} disabled={!!rangeError || resultCount === 0} fullWidth />
          </View>
        </View>
      }>
      <View style={styles.group}>
        <AppText variant="label">Sort by</AppText>
        <View style={styles.chips}>
          {SORT_OPTIONS.map(o => (
            <ChoiceChip key={o.key} label={o.label} selected={draft.sort === o.key} onPress={() => set({ sort: o.key })} />
          ))}
        </View>
      </View>
      <Divider />
      <View style={styles.group}>
        <AppText variant="label">Price</AppText>
        <View style={styles.chips}>
          {PRICE_PRESETS.map(max => (
            <ChoiceChip
              key={max}
              label={`Under ${formatPKR(max)}`}
              selected={draft.minPrice === null && draft.maxPrice === max}
              onPress={() =>
                set(draft.minPrice === null && draft.maxPrice === max ? { maxPrice: null } : { minPrice: null, maxPrice: max })
              }
            />
          ))}
        </View>
        <View style={styles.range}>
          <View style={styles.half}>
            <TextField
              label="Min (Rs)"
              mode="numeric"
              value={rupeeText(draft.minPrice)}
              onChangeText={t => set({ minPrice: parseRupees(t) })}
              placeholder="0"
            />
          </View>
          <View style={styles.half}>
            <TextField
              label="Max (Rs)"
              mode="numeric"
              value={rupeeText(draft.maxPrice)}
              onChangeText={t => set({ maxPrice: parseRupees(t) })}
              placeholder="Any"
              error={rangeError}
            />
          </View>
        </View>
      </View>
      <Divider />
      <View style={styles.group}>
        <AppText variant="label">Rating</AppText>
        <View style={styles.chips}>
          {RATING_PRESETS.map(r => (
            <ChoiceChip
              key={r}
              label={`${r} stars & up`}
              icon="star"
              selected={draft.minRating === r}
              onPress={() => set({ minRating: draft.minRating === r ? null : r })}
            />
          ))}
        </View>
      </View>
      <Divider />
      <ToggleRow label="In stock only" value={draft.inStock} onChange={v => set({ inStock: v })} />
      <ToggleRow label="On sale" value={draft.onSale} onChange={v => set({ onSale: v })} />
    </Sheet>
  );
};

export default FilterSheet;
