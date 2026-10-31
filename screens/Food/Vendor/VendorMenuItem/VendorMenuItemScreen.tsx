// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: one dish (new or edit)
// ═══════════════════════════════════════════════════════
// Photo, name and description; its category; a price, or sizes each with
// their own price; the add-on groups it offers; who it serves, tags, the
// days it is on, and whether customers see it at all.

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { DAY_SHORT, ITEM_TAGS, ITEM_TAG_LABEL, MAX_VARIANTS, WEEK_ORDER, groupRuleLabel, validateItem } from '../../../../models/food/menuModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import {
  AppText,
  Button,
  Card,
  Checkbox,
  ChoiceChip,
  Divider,
  IconButton,
  IonIcon,
  InlineNotice,
  ListRow,
  ScreenShell,
  SkeletonLines,
  TextAction,
  TextField,
  ToggleRow,
} from '../../../../Custom-Components/index';
import type { FoodVendorStackParamList } from '../../../../types';
import { Alert } from '../../../../utils/alert';
import { cdn } from '../../../../utils/cdn';
import { haptics } from '../../../../utils/haptics';
import { pickImageFromLibrary } from '../../../../utils/pickers';
import {
  addVariant,
  deleteMenuItemAsync,
  duplicateMenuItemAsync,
  loadMenuItemAsync,
  markItemSubmitted,
  removeVariant,
  saveMenuItemAsync,
  selectVendorMenuItem,
  setItemField,
  setVariant,
  toggleItemDay,
  toggleItemGroup,
  toggleItemTag,
  uploadItemPhotoAsync,
} from './vendorMenuItemSlice';
import { menuPlace } from '../../../../models/food/vendorModel';
import { selectBusiness } from '../../../Auth/authSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'VendorMenuItem'>;

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    photo: {
      width: '100%',
      aspectRatio: size.coverAspect,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceSunk,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    fill: { ...StyleSheet.absoluteFillObject },
    card: { gap: space.s12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    size: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8 },
    sizeName: { flex: 3 },
    sizePrice: { flex: 2 },
  });

const VendorMenuItemScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <VendorMenuItemContent {...props} />
  </ServiceScope>
);

const VendorMenuItemContent: React.FC<Props> = ({ route, navigation }) => {
  const id = route.params?.id;
  const categoryId = route.params?.categoryId;
  const { back } = useBack(menuPlace(useAppSelector(selectBusiness)?.subType === 'home_kitchen'));
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, size } = useTheme();
  const s = useAppSelector(selectVendorMenuItem);
  const f = s.form;

  useEffect(() => {
    void dispatch(loadMenuItemAsync({ id, categoryId }));
  }, [dispatch, id, categoryId]);

  const title = id ? 'Edit dish' : 'New dish';
  if (!f || s.status === 'loading') {
    return (
      <ScreenShell title={title} onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadMenuItemAsync({ id, categoryId })) }} /> : <SkeletonLines lines={10} />}
      </ScreenShell>
    );
  }

  const errors = s.submitted ? validateItem(f) : {};
  const set = <K extends Parameters<typeof setItemField>[0]['field']>(field: K, value: (typeof f)[K]) => dispatch(setItemField({ field, value }));

  const pick = async () => {
    const file = await pickImageFromLibrary({ square: false });
    if (file) void dispatch(uploadItemPhotoAsync(file));
  };

  const save = async () => {
    dispatch(markItemSubmitted());
    if (Object.keys(validateItem(f)).length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(saveMenuItemAsync());
    if (saveMenuItemAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: id ? 'Dish saved' : 'Dish added' });
      back();
    } else haptics.warning();
  };

  const remove = () =>
    Alert.alert(`Delete ${f.name}?`, 'It leaves your menu. Past orders keep their own copy.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const r = await dispatch(deleteMenuItemAsync(id!));
          if (deleteMenuItemAsync.fulfilled.match(r)) {
            Toast.show({ type: 'success', text1: 'Dish deleted' });
            back();
          }
        },
      },
    ]);

  const duplicate = async () => {
    const r = await dispatch(duplicateMenuItemAsync(id!));
    if (duplicateMenuItemAsync.fulfilled.match(r)) {
      Toast.show({ type: 'success', text1: 'Copy added', text2: 'It stays hidden until you show it on the menu.' });
      navigation.setParams({ id: r.payload.id });
    }
  };

  const hasSizes = f.variants.length > 0;
  return (
    <ScreenShell
      title={title}
      subtitle={s.item?.name}
      onBack={back}
      footer={<Button label={id ? 'Save dish' : 'Add dish'} onPress={() => void save()} loading={s.saving} disabled={s.uploading} fullWidth />}
    >
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}

      <Pressable onPress={() => void pick()} style={styles.photo} accessibilityRole="button" accessibilityLabel={f.photoUrl ? 'Change the photo' : 'Add a photo'}>
        {f.photoUrl ? (
          <Image source={{ uri: cdn(f.photoUrl, { w: size.storeCard * 2 }) ?? undefined }} style={styles.fill} contentFit="cover" />
        ) : (
          <IonIcon name="camera-outline" size="xl" color={colors.inkFaint} />
        )}
      </Pressable>
      <TextAction
        label={s.uploading ? 'Uploading the photo…' : f.photoUrl ? 'Change the photo' : 'Add a photo — dishes with one sell better'}
        icon="image-outline"
        onPress={() => void pick()}
        disabled={s.uploading}
      />

      <TextField label="Name" value={f.name} onChangeText={v => set('name', v)} error={errors.name} maxLength={120} placeholder="Chicken Biryani" />
      <TextField
        label="Description (optional)"
        value={f.description}
        onChangeText={v => set('description', v)}
        error={errors.description}
        maxLength={1000}
        multiline
        placeholder="What’s in it, how it’s cooked"
      />

      <Card style={styles.card}>
        <AppText variant="title">Category</AppText>
        <View style={styles.chips}>
          {s.categories.map(c => (
            <ChoiceChip key={c.id} label={c.name} selected={f.categoryId === c.id} onPress={() => set('categoryId', c.id)} />
          ))}
        </View>
        {errors.categoryId ? (
          <AppText variant="small" tone="danger">
            {errors.categoryId}
          </AppText>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <AppText variant="title">{hasSizes ? 'Sizes' : 'Price'}</AppText>
        {hasSizes ? (
          <>
            <AppText variant="small" tone="muted">
              Customers pick a size. Your menu shows the cheapest as “from”.
            </AppText>
            {f.variants.map((v, i) => (
              <View key={i} style={styles.size}>
                <View style={styles.sizeName}>
                  <TextField label="Size" value={v.name} onChangeText={x => dispatch(setVariant({ index: i, field: 'name', value: x }))} error={errors[`variants.${i}.name`]} maxLength={60} placeholder="Half kg" />
                </View>
                <View style={styles.sizePrice}>
                  <TextField
                    label="Price (Rs)"
                    value={v.price}
                    onChangeText={x => dispatch(setVariant({ index: i, field: 'price', value: x.replace(/[^\d]/g, '') }))}
                    error={errors[`variants.${i}.price`]}
                    keyboardType="number-pad"
                  />
                </View>
                <IconButton icon="close" accessibilityLabel={`Remove the ${v.name || 'new'} size`} onPress={() => dispatch(removeVariant(i))} />
              </View>
            ))}
          </>
        ) : (
          <TextField label="Price (Rs)" value={f.basePrice} onChangeText={v => set('basePrice', v.replace(/[^\d]/g, ''))} error={errors.basePrice} keyboardType="number-pad" placeholder="650" />
        )}
        {errors.variants ? (
          <AppText variant="small" tone="danger">
            {errors.variants}
          </AppText>
        ) : null}
        {f.variants.length < MAX_VARIANTS ? (
          <TextAction label={hasSizes ? 'Add another size' : 'Sell it in sizes (half, full…)'} icon="add" onPress={() => dispatch(addVariant())} />
        ) : null}
      </Card>

      <Card style={styles.card}>
        <AppText variant="title">Add-ons</AppText>
        {s.groups.length ? (
          <>
            <AppText variant="small" tone="muted">
              Groups customers choose from, like spice level or extra toppings.
            </AppText>
            {s.groups.map(g => (
              <Checkbox
                key={g.id}
                checked={f.groupIds.includes(g.id)}
                onToggle={() => dispatch(toggleItemGroup(g.id))}
                accessibilityLabel={`Offer ${g.name}`}
                label={
                  <View>
                    <AppText variant="bodyStrong">{g.name}</AppText>
                    <AppText variant="small" tone="muted">{`${groupRuleLabel(g)} · ${g.options.length} choices`}</AppText>
                  </View>
                }
              />
            ))}
          </>
        ) : (
          <AppText variant="small" tone="muted">
            None yet. Make a group once, like “Spice level”, and offer it on any dish.
          </AppText>
        )}
        <TextAction label="New add-on group" icon="add" onPress={() => navigation.navigate('VendorOptionGroup', {})} />
      </Card>

      <Card style={styles.card}>
        <AppText variant="title">Details</AppText>
        <TextField label="Serves (optional)" value={f.serves} onChangeText={v => set('serves', v.replace(/[^\d]/g, ''))} error={errors.serves} keyboardType="number-pad" placeholder="1" />
        <AppText variant="bodyStrong">Tags</AppText>
        <View style={styles.chips}>
          {ITEM_TAGS.map(t => (
            <ChoiceChip key={t} label={ITEM_TAG_LABEL[t]} selected={f.tags.includes(t)} onPress={() => dispatch(toggleItemTag(t))} />
          ))}
        </View>
        <AppText variant="bodyStrong">On the menu on</AppText>
        <View style={styles.chips}>
          {WEEK_ORDER.map(d => (
            <ChoiceChip key={d} label={DAY_SHORT[d]} selected={f.days.includes(d)} onPress={() => dispatch(toggleItemDay(d))} />
          ))}
        </View>
        {errors.days ? (
          <AppText variant="small" tone="danger">
            {errors.days}
          </AppText>
        ) : null}
        <ToggleRow label="It’s a deal" helper="Shown with your deals, with a deal ribbon" value={f.isDeal} onChange={v => set('isDeal', v)} />
        <ToggleRow label="Show on the menu" helper="Off hides it from customers until you switch it back" value={f.isActive} onChange={v => set('isActive', v)} />
      </Card>

      {id ? (
        <Card padded="horizontal">
          <ListRow title="Make a copy" subtitle="With the same sizes and add-ons" leftIcon="copy-outline" onPress={() => void duplicate()} />
          <Divider />
          <ListRow title="Delete dish" leftIcon="trash-outline" destructive onPress={remove} chevron={false} />
        </Card>
      ) : null}
    </ScreenShell>
  );
};

export default VendorMenuItemScreen;
