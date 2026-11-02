// ═══════════════════════════════════════════════════════
// VariantSheet — choose size / colour / quantity, then add to the Bag
// ═══════════════════════════════════════════════════════
// Opens on the first in-stock variant. Values that can't be bought with the
// current choice are struck through; picking one that empties the pair moves
// the other option (variantPickerModel). Quantity stops at the stock.

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { ProductDetail } from '../../models/shopping';
import { cdn } from '../../utils/cdn/cdn';
import {
  choose,
  initialChoice as firstChoice,
  stockNote,
  variantFor,
  type VariantChoice,
} from '../../models/shopping/variantPickerModel';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { Sheet } from '../Sheet';
import { PriceTag } from './PriceTag';
import { QuantityStepper } from './QuantityStepper';
import { VariantOptions } from './VariantOptions';

export interface VariantSheetProps {
  product: ProductDetail;
  visible: boolean;
  onClose: () => void;
  onConfirm: (variantId: string, quantity: number) => void;
  busy?: boolean;
  confirmLabel?: string;
  /** Open on this variant if it is in stock. */
  initialVariantId?: string | null;
  /** Or on this choice (the product page's own), kept as it is. */
  initialChoice?: VariantChoice;
}

const makeStyles = ({ colors, radius, space, size }: Theme) =>
  StyleSheet.create({
    head: { flexDirection: 'row', gap: space.s12, alignItems: 'center' },
    thumb: {
      width: size.lineThumb,
      aspectRatio: size.productAspect,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceSunk,
    },
    headText: { flex: 1, gap: space.s4 },
    qty: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  });

export const VariantSheet: React.FC<VariantSheetProps> = props => {
  // A fresh body on each opening, so the choice starts from the product
  // again; closing keeps the body, so the sheet animates away.
  const [wasVisible, setWasVisible] = useState(props.visible);
  const [opening, setOpening] = useState(0);
  if (props.visible !== wasVisible) {
    setWasVisible(props.visible);
    if (props.visible) setOpening(n => n + 1);
  }
  return <VariantSheetBody key={opening} {...props} />;
};

const VariantSheetBody: React.FC<VariantSheetProps> = ({
  product,
  visible,
  onClose,
  onConfirm,
  busy,
  confirmLabel = 'Add to bag',
  initialVariantId,
  initialChoice,
}) => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const [choice, setChoice] = useState<VariantChoice>(() => initialChoice ?? firstChoice(product, initialVariantId));
  const [quantity, setQuantity] = useState(1);
  const variant = variantFor(product, choice);
  const stock = variant?.stock ?? 0;
  const note = stockNote(variant);
  const qty = Math.min(quantity, Math.max(1, stock));
  const thumb = cdn(variant ? product.images[0] : product.imageUrl, { w: size.lineThumb, h: size.lineThumb / size.productAspect });

  const pick = (which: 1 | 2, value: string) => setChoice(c => choose(product, c, which, value));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Choose your options"
      footer={
        <Button
          label={stock > 0 ? confirmLabel : 'Sold out'}
          onPress={() => variant && onConfirm(variant.id, qty)}
          disabled={!variant || stock <= 0}
          loading={busy}
          leftIcon="bag-add-outline"
          fullWidth
        />
      }>
      <View style={styles.head}>
        {thumb ? <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" /> : <View style={styles.thumb} />}
        <View style={styles.headText}>
          <AppText variant="title" numberOfLines={2}>
            {product.name}
          </AppText>
          <PriceTag price={variant?.price ?? product.price} compareAtPrice={variant?.compareAtPrice ?? product.compareAtPrice} size="md" />
          <AppText variant="small" tone={note.tone}>
            {note.text}
          </AppText>
        </View>
      </View>

      <VariantOptions product={product} choice={choice} onChoose={pick} />

      <View style={styles.qty}>
        <AppText variant="label">Quantity</AppText>
        <QuantityStepper
          value={qty}
          onChange={setQuantity}
          max={Math.max(1, stock)}
          disabled={stock <= 0}
          label={`Quantity of ${product.name}`}
        />
      </View>
    </Sheet>
  );
};

export default VariantSheet;
