// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: the dish sheet (over the vendor's page)
// ═══════════════════════════════════════════════════════
// The dish's photo and description, its sizes, each add-on group with its
// rule (required ones say so until met), a note for the kitchen and the
// quantity, with the live price on the button. The first unmet group is
// named when the customer taps Add too early.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { MAX_NOTE, MAX_QUANTITY, firstProblem, groupHint, groupsFor, linePrice, unavailableLabel, type Selection } from '@models/food/itemSelectionModel';
import { ITEM_TAG_LABEL } from '@models/food/menuModel';
import { useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, InlineNotice, QuantityStepper, Sheet, SkeletonLines, TextField } from '@custom/index';
import { ChoiceLine } from '@custom/food/ChoiceLine';
import type { ItemSheet } from '@/types';
import { cdn } from '@utils/cdn';
import { formatPKR } from '@utils/money';
import { haptics } from '@utils/haptics';
import { closeItemSheet, markTried, pickOption, pickVariant, selectItemSheet, setLineNote, setLineQuantity } from './itemSheetSlice';

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    photo: { width: '100%', aspectRatio: size.vendorPhotoAspect, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceSunk },
    fill: { ...StyleSheet.absoluteFillObject },
    head: { gap: space.s4 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    group: { gap: space.s4 },
    groupHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.s8 },
    footer: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1 },
  });

export interface ItemSheetViewProps {
  /** Adds the line to the bag; resolves true when the sheet can close. */
  onAdd: (sheet: ItemSheet, selection: Selection) => Promise<boolean> | boolean;
  adding?: boolean;
  /** Why the last add didn't go in. */
  addError?: string | null;
  /** Ordering is closed for this vendor right now (paused, out of zone…): say why instead. */
  blockedReason?: string | null;
}

export const ItemSheetView: React.FC<ItemSheetViewProps> = ({ onAdd, adding, addError, blockedReason }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const s = useAppSelector(selectItemSheet);
  const sheet = s.sheet;
  const sel = s.selection;
  const open = s.itemId !== null;

  const problem = sheet && sel ? firstProblem(sheet, sel) : null;
  const why = sheet && !sheet.available ? unavailableLabel(sheet.unavailableReason) : null;
  const total = sheet && sel ? linePrice(sheet, sel) : 0;

  const add = async () => {
    if (!sheet || !sel) return;
    if (problem) {
      dispatch(markTried());
      haptics.warning();
      return;
    }
    if (await onAdd(sheet, sel)) {
      haptics.success();
      dispatch(closeItemSheet());
    }
  };

  return (
    <Sheet
      visible={open}
      onClose={() => dispatch(closeItemSheet())}
      title={sheet?.name ?? 'Dish'}
      subtitle={sheet ? (sheet.variants.length ? `from ${formatPKR(sheet.fromPrice)}` : formatPKR(sheet.basePrice)) : undefined}
      footer={
        sheet && sel ? (
          <View style={styles.footer}>
            <QuantityStepper value={sel.quantity} onChange={n => dispatch(setLineQuantity(n))} min={1} max={Math.min(MAX_QUANTITY, sheet.remainingToday ?? MAX_QUANTITY)} label={`How many ${sheet.name}`} />
            <View style={styles.grow}>
              <Button
                label={why ?? blockedReason ? 'Can’t add right now' : `Add · ${formatPKR(total)}`}
                onPress={() => void add()}
                disabled={!!why || !!blockedReason}
                loading={adding}
                fullWidth
              />
            </View>
          </View>
        ) : undefined
      }
    >
      {s.status === 'failed' ? <InlineNotice message={s.error.message} /> : null}
      {!sheet || !sel ? (
        s.status === 'failed' ? null : <SkeletonLines lines={6} />
      ) : (
        <>
          {sheet.photoUrl ? (
            <View style={styles.photo}>
              <Image source={{ uri: cdn(sheet.photoUrl, { w: size.storeCard * 1.6 }) ?? undefined }} style={styles.fill} contentFit="cover" transition={150} />
            </View>
          ) : null}
          <View style={styles.head}>
            {sheet.description ? (
              <AppText variant="body" tone="muted">
                {sheet.description}
              </AppText>
            ) : null}
            {sheet.tags.length || sheet.serves ? (
              <View style={styles.tags}>
                {sheet.serves ? (
                  <AppText variant="tag" tone="muted">
                    {`Serves ${sheet.serves}`}
                  </AppText>
                ) : null}
                {sheet.tags.map(t => (
                  <AppText key={t} variant="tag" tone="muted">
                    {ITEM_TAG_LABEL[t]}
                  </AppText>
                ))}
              </View>
            ) : null}
          </View>
          {why || blockedReason ? <InlineNotice tone="warning" message={why ?? blockedReason!} /> : null}
          {addError ? <InlineNotice message={addError} /> : null}
          {sheet.remainingToday !== null && sheet.remainingToday > 0 && sheet.remainingToday <= 10 ? (
            <AppText variant="small" tone="warning">{`${sheet.remainingToday} left today`}</AppText>
          ) : null}

          {sheet.variants.length ? (
            <View style={styles.group}>
              <View style={styles.groupHead}>
                <AppText variant="title">Size</AppText>
                <AppText variant="small" tone="muted">
                  Required · pick 1
                </AppText>
              </View>
              {sheet.variants.map(v => (
                <ChoiceLine key={v.id} label={v.name} price={formatPKR(v.price)} selected={sel.variantId === v.id} multiple={false} onPress={() => dispatch(pickVariant(v.id))} />
              ))}
            </View>
          ) : null}

          {groupsFor(sheet, sel.variantId).map(g => {
            const chosen = sel.options[g.id] ?? [];
            const missing = s.tried && problem?.groupId === g.id;
            return (
              <View key={`${g.id}:${g.variantId ?? ''}`} style={styles.group}>
                <View style={styles.groupHead}>
                  <AppText variant="title">{g.name}</AppText>
                  <AppText variant="small" tone={missing ? 'danger' : g.required && chosen.length < g.minSelect ? 'accentDeep' : 'muted'}>
                    {groupHint(g)}
                  </AppText>
                </View>
                {missing ? (
                  <AppText variant="small" tone="danger">
                    {problem!.message}
                  </AppText>
                ) : null}
                {g.options.map(o => (
                  <ChoiceLine
                    key={o.id}
                    label={o.name}
                    price={o.priceDelta ? `+ ${formatPKR(o.priceDelta)}` : null}
                    selected={chosen.includes(o.id)}
                    multiple={g.maxSelect > 1}
                    disabled={!o.available || (g.maxSelect > 1 && !chosen.includes(o.id) && chosen.length >= g.maxSelect)}
                    note={o.available ? null : 'Out of stock'}
                    onPress={() => dispatch(pickOption({ groupId: g.id, optionId: o.id }))}
                  />
                ))}
              </View>
            );
          })}

          <TextField
            label="Note for the kitchen (optional)"
            value={sel.note}
            onChangeText={v => dispatch(setLineNote(v))}
            maxLength={MAX_NOTE}
            placeholder="Less spicy, no onions…"
          />
          {s.tried && problem && !problem.groupId ? (
            <AppText variant="small" tone="danger">
              {problem.message}
            </AppText>
          ) : null}
        </>
      )}
    </Sheet>
  );
};

export default ItemSheetView;
