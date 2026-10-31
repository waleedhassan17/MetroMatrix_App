// ═══════════════════════════════════════════════════════
// MetroMatrix — Add or edit a product
// ═══════════════════════════════════════════════════════
// Photos (the first is the cover; arrows reorder), the basics, the price
// and a sale price, where it lives (category, collection), and — if it
// comes in sizes or colours — every combination with its own stock and SKU.
// Save a draft any time; publishing asks for what a buyer needs. Leaving
// with unsaved changes asks first.

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { MAX_PRODUCT_PHOTOS, isFormDirty, salePreviewPercent, validateProductForm } from '../../models/shopping/productFormModel';
import { totalStock, variantLabel } from '../../models/shopping/variantMatrixModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  BottomSheetPicker,
  Button,
  Card,
  ChoiceChip,
  Divider,
  IconButton,
  InlineNotice,
  IonIcon,
  PickerField,
  ScreenShell,
  SkeletonLines,
  StatusPill,
  TextAction,
  TextField,
  ToggleRow,
} from '../../Custom-Components/index';
import type { StorePartnerStackParamList } from '../../models';
import { Alert } from '../../utils/alert/alert';
import { cdn } from '../../utils/cdn/cdn';
import { haptics } from '../../utils/haptics/haptics';
import { pickImageFromLibrary } from '../../utils/pickers/pickers';
import { photoKey } from '../shared/photoUploads';
import {
  addOptionValues,
  attemptProductSave,
  addProductPhotoAsync,
  loadProductFormAsync,
  makeCoverPhoto,
  moveProductPhoto,
  removeOptionValue,
  removeProductPhoto,
  resetProductForm,
  saveProductAsync,
  selectProductForm,
  setEveryStock,
  setOptionInput,
  setProductField,
  setProductStatusAsync,
  setVariantField,
} from './productFormSlice';

type Props = NativeStackScreenProps<StorePartnerStackParamList, 'ProductForm'>;

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    photos: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s12 },
    photo: { width: size.tile + space.s24, gap: space.s4, alignItems: 'center' },
    image: { width: size.tile + space.s24, aspectRatio: size.productAspect, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    cover: { position: 'absolute', top: space.s4, left: space.s4, paddingHorizontal: space.s4, borderRadius: radius.sm, backgroundColor: colors.glass },
    remove: { position: 'absolute', top: space.s0, right: space.s0 },
    arrows: { flexDirection: 'row', justifyContent: 'center' },
    add: {
      width: size.tile + space.s24,
      aspectRatio: size.productAspect,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderStyle: 'dashed',
      borderColor: colors.lineStrong,
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.s4,
    },
    two: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    addRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8 },
    grow: { flex: 1 },
    variant: { gap: space.s8 },
    variantFields: { flexDirection: 'row', gap: space.s8 },
    footer: { flexDirection: 'row', gap: space.s12 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  });

const ProductForm: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <ProductFormContent {...props} />
  </ServiceScope>
);

const ProductFormContent: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'StoreTabs', params: { screen: 'ProductsTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, size, space, opacity } = useTheme();
  const s = useAppSelector(selectProductForm);
  const [picker, setPicker] = useState<'category' | 'collection' | null>(null);
  const [everyStock, setEveryStockText] = useState('');
  const id = route.params?.id ?? null;
  const f = s.form;

  useEffect(() => {
    dispatch(resetProductForm());
    void dispatch(loadProductFormAsync(id));
  }, [dispatch, id]);

  const dirty = s.loadStatus === 'succeeded' && (isFormDirty(f, s.original) || s.uploads.length > 0);

  // Leaving with unsaved changes asks first.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', e => {
        if (!dirty || s.saveStatus === 'loading') return;
        e.preventDefault();
        Alert.alert('Discard your changes?', 'What you changed here hasn’t been saved.', [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]);
      }),
    [navigation, dirty, s.saveStatus],
  );

  const intent = s.submitted ?? 'draft';
  const local = s.submitted ? validateProductForm(f, intent) : {};
  const errors: Record<string, string | undefined> = { ...s.serverFields, ...local };

  const addPhoto = async () => {
    const file = await pickImageFromLibrary();
    if (file) void dispatch(addProductPhotoAsync({ key: photoKey(), file }));
  };

  const save = async (status: 'draft' | 'active') => {
    const problems = validateProductForm(f, status === 'active' ? 'publish' : 'draft');
    if (Object.keys(problems).length) {
      dispatch(attemptProductSave(status === 'active' ? 'publish' : 'draft'));
      haptics.warning();
      return;
    }
    if (s.uploads.length) {
      Toast.show({ type: 'info', text1: 'A photo is still uploading', text2: 'Save again in a moment.' });
      return;
    }
    const r = await dispatch(saveProductAsync({ id: s.productId, form: f, status }));
    if (saveProductAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: status === 'active' ? (f.status === 'active' ? 'Saved' : 'Published: it’s on sale') : 'Draft saved' });
    } else haptics.warning();
  };

  const setStatus = async (status: 'archived' | 'active' | 'draft') => {
    if (!s.productId) return;
    const r = await dispatch(setProductStatusAsync({ id: s.productId, status }));
    if (setProductStatusAsync.fulfilled.match(r)) {
      Toast.show({ type: 'success', text1: status === 'archived' ? 'Hidden from the shop' : 'Back on sale' });
    }
  };

  const categoryOptions = s.categories.flatMap(c => [
    { value: c.id, label: c.name },
    ...c.children.map(x => ({ value: x.id, label: `${c.name} › ${x.name}` })),
  ]);
  const categoryLabel = categoryOptions.find(o => o.value === f.categoryId)?.label ?? null;
  const collectionOptions = [{ value: '', label: 'No collection' }, ...s.collections.map(c => ({ value: c.id, label: c.name }))];
  const collectionLabel = s.collections.find(c => c.id === f.collectionId)?.name ?? null;
  const salePct = salePreviewPercent(f);
  const live = f.status === 'active';

  if (s.loadStatus !== 'succeeded') {
    return (
      <ScreenShell title={id ? 'Edit product' : 'New product'} onBack={back}>
        {s.loadStatus === 'failed' ? (
          <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadProductFormAsync(id)) }} />
        ) : (
          <SkeletonLines lines={10} />
        )}
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={s.productId ? 'Edit product' : 'New product'}
      onBack={back}
      headerRight={f.status !== 'active' && s.productId ? <StatusPill label={f.status === 'archived' ? 'Hidden' : 'Draft'} /> : undefined}
      footer={
        <View style={styles.footer}>
          {!live ? <Button label="Save draft" variant="secondary" onPress={() => void save('draft')} loading={s.saveStatus === 'loading' && s.submitted === 'draft'} /> : null}
          <View style={styles.grow}>
            <Button label={live ? 'Save changes' : 'Publish'} onPress={() => void save('active')} loading={s.saveStatus === 'loading' && s.submitted === 'publish'} fullWidth />
          </View>
        </View>
      }>
      {s.error.message && s.error.code !== 'PUBLISH_BLOCKED' ? <InlineNotice message={s.error.message} /> : null}
      {s.submitted === 'publish' && Object.keys(errors).some(k => errors[k]) ? (
        <InlineNotice tone="warning" title="Almost ready to publish" message="Finish the highlighted parts, or save it as a draft." />
      ) : null}

      {/* Photos */}
      <Card invalid={!!errors.images}>
        <View style={styles.head}>
          <AppText variant="title">Photos</AppText>
          <AppText variant="caption" tone="muted">
            {f.images.length}/{MAX_PRODUCT_PHOTOS} · first is the cover
          </AppText>
        </View>
        <View style={styles.photos}>
          {f.images.map((img, i) => (
            <View key={`${img.url}-${i}`} style={styles.photo}>
              <View>
                <Image source={{ uri: cdn(img.url, { w: size.tile + space.s24 }) ?? undefined }} style={styles.image} contentFit="cover" />
                {i === 0 ? (
                  <View style={styles.cover}>
                    <AppText variant="tag">COVER</AppText>
                  </View>
                ) : null}
                <View style={styles.remove}>
                  <IconButton icon="close-circle" tone="muted" onPress={() => dispatch(removeProductPhoto(i))} accessibilityLabel={`Remove photo ${i + 1}`} />
                </View>
              </View>
              <View style={styles.arrows}>
                <IconButton icon="chevron-back" tone="muted" disabled={i === 0} onPress={() => dispatch(moveProductPhoto({ index: i, by: -1 }))} accessibilityLabel={`Move photo ${i + 1} left`} />
                <IconButton icon="chevron-forward" tone="muted" disabled={i === f.images.length - 1} onPress={() => dispatch(moveProductPhoto({ index: i, by: 1 }))} accessibilityLabel={`Move photo ${i + 1} right`} />
              </View>
              {i > 0 ? <TextAction label="Make cover" onPress={() => dispatch(makeCoverPhoto(i))} /> : null}
            </View>
          ))}
          {s.uploads.map(u => (
            <View key={u.key} style={styles.photo}>
              <Image source={{ uri: u.uri }} style={[styles.image, { opacity: opacity.soldOut }]} contentFit="cover" />
              <AppText variant="caption" tone="muted">
                Uploading {Math.round((u.progress ?? 0) * 100)}%
              </AppText>
            </View>
          ))}
          {f.images.length + s.uploads.length < MAX_PRODUCT_PHOTOS ? (
            <Pressable onPress={() => void addPhoto()} style={styles.add} accessibilityRole="button" accessibilityLabel="Add a photo">
              <IonIcon name="camera-outline" size="lg" color={service.accentDeep} />
              <AppText variant="caption" tone="accentDeep">
                Add photo
              </AppText>
            </Pressable>
          ) : null}
        </View>
        {errors.images ? (
          <AppText variant="small" tone="danger">
            {errors.images}
          </AppText>
        ) : null}
      </Card>

      {/* Basics */}
      <TextField label="Product name" value={f.name} onChangeText={v => dispatch(setProductField({ field: 'name', value: v }))} error={errors.name} maxLength={80} placeholder="Rouge embroidered kurta set" />
      <TextField
        label="Description"
        value={f.description}
        onChangeText={v => dispatch(setProductField({ field: 'description', value: v }))}
        multiline
        maxLength={4000}
        helper="Fabric, fit, what's included, care."
      />

      {/* Price */}
      <View style={styles.two}>
        <View style={styles.half}>
          <TextField label="Price (Rs)" mode="numeric" value={f.price} onChangeText={v => dispatch(setProductField({ field: 'price', value: v }))} error={errors.price} placeholder="4990" />
        </View>
        <View style={styles.half}>
          <TextField
            label="Sale price (Rs)"
            mode="numeric"
            value={f.salePrice}
            onChangeText={v => dispatch(setProductField({ field: 'salePrice', value: v }))}
            error={errors.salePrice}
            helper={salePct ? `Shows as ${salePct}% off` : 'Optional'}
            placeholder="3990"
          />
        </View>
      </View>

      {/* Where it lives */}
      <PickerField label="Category" valueLabel={categoryLabel} placeholder="Choose a category" onPress={() => setPicker('category')} error={errors.categoryId} />
      <PickerField label="Collection in your store" valueLabel={collectionLabel} placeholder="No collection" onPress={() => setPicker('collection')} />

      {/* Options and stock */}
      <Card invalid={!!errors.variants}>
        <ToggleRow
          label="Comes in sizes or colours"
          helper="Each combination gets its own stock and SKU."
          value={f.hasOptions}
          onChange={v => dispatch(setProductField({ field: 'hasOptions', value: v }))}
        />
        {f.hasOptions ? (
          <>
            {([1, 2] as const).map(which => {
              const values = which === 1 ? f.option1Values : f.option2Values;
              return (
                <View key={which} style={styles.variant}>
                  <TextField
                    label={which === 1 ? 'First option' : 'Second option (optional)'}
                    value={which === 1 ? f.option1Name : f.option2Name}
                    onChangeText={v => dispatch(setProductField({ field: which === 1 ? 'option1Name' : 'option2Name', value: v }))}
                    placeholder={which === 1 ? 'Size' : 'Colour'}
                    error={which === 1 ? errors.option1 : errors.option2}
                  />
                  <View style={styles.chips}>
                    {values.map(v => (
                      <ChoiceChip
                        key={v}
                        label={v}
                        swatch={which === 2 ? f.swatches[v] : undefined}
                        icon="close"
                        accessibilityHint="Removes this value"
                        onPress={() => dispatch(removeOptionValue({ which, value: v }))}
                      />
                    ))}
                  </View>
                  <View style={styles.addRow}>
                    <View style={styles.grow}>
                      <TextField
                        label={`Add ${which === 1 ? f.option1Name || 'values' : f.option2Name || 'values'}`}
                        value={s.optionInput[which]}
                        onChangeText={t => dispatch(setOptionInput({ which, text: t }))}
                        onSubmitEditing={() => dispatch(addOptionValues(which))}
                        placeholder={which === 1 ? 'S, M, L' : 'Black, Rust'}
                        returnKeyType="done"
                      />
                    </View>
                  </View>
                  <TextAction label="Add" icon="add" disabled={!s.optionInput[which].trim()} onPress={() => dispatch(addOptionValues(which))} />
                </View>
              );
            })}
            <TextField label="SKU prefix" value={f.baseSku} onChangeText={v => dispatch(setProductField({ field: 'baseSku', value: v.toUpperCase() }))} placeholder="KUR-01" autoCapitalize="characters" />
            <Divider />
            <View style={styles.head}>
              <AppText variant="title">{f.variants.length} combinations</AppText>
              <AppText variant="small" tone="muted">
                {totalStock(f.variants)} in stock
              </AppText>
            </View>
            <View style={styles.addRow}>
              <View style={styles.grow}>
                <TextField label="Set every stock to" mode="numeric" value={everyStock} onChangeText={setEveryStockText} placeholder="10" />
              </View>
            </View>
            <TextAction
              label="Apply to all"
              disabled={!everyStock}
              onPress={() => {
                dispatch(setEveryStock(Number(everyStock) || 0));
                setEveryStockText('');
              }}
            />
          </>
        ) : null}
        {f.variants.map(v => (
          <View key={v.key} style={styles.variant}>
            {f.hasOptions ? (
              <AppText variant="bodyStrong">{variantLabel(v.option1, v.option2) || 'Default'}</AppText>
            ) : null}
            <View style={styles.variantFields}>
              <View style={styles.grow}>
                <TextField label="Stock" mode="numeric" value={v.stock} onChangeText={t => dispatch(setVariantField({ key: v.key, field: 'stock', value: t }))} />
              </View>
              <View style={styles.grow}>
                <TextField label="SKU" value={v.sku} onChangeText={t => dispatch(setVariantField({ key: v.key, field: 'sku', value: t }))} autoCapitalize="characters" />
              </View>
              {f.hasOptions ? (
                <View style={styles.grow}>
                  <TextField label="+/− Rs" value={v.priceDelta} onChangeText={t => dispatch(setVariantField({ key: v.key, field: 'priceDelta', value: t }))} keyboardType="numbers-and-punctuation" />
                </View>
              ) : null}
            </View>
          </View>
        ))}
        {errors.variants ? (
          <AppText variant="small" tone="danger">
            {errors.variants}
          </AppText>
        ) : null}
      </Card>

      {s.productId && f.status !== 'draft' ? (
        <Button
          label={f.status === 'archived' ? 'Put it back on sale' : 'Hide from the shop'}
          variant="ghost"
          onPress={() => void setStatus(f.status === 'archived' ? 'active' : 'archived')}
          fullWidth
        />
      ) : null}

      <BottomSheetPicker
        visible={picker === 'category'}
        onClose={() => setPicker(null)}
        title="Category"
        options={categoryOptions}
        value={f.categoryId}
        onSelect={v => {
          dispatch(setProductField({ field: 'categoryId', value: v }));
          setPicker(null);
        }}
      />
      <BottomSheetPicker
        visible={picker === 'collection'}
        onClose={() => setPicker(null)}
        title="Collection"
        options={collectionOptions}
        value={f.collectionId ?? ''}
        onSelect={v => {
          dispatch(setProductField({ field: 'collectionId', value: v || null }));
          setPicker(null);
        }}
      />
    </ScreenShell>
  );
};

export default ProductForm;
