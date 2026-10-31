// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen assistant: photo check
// ═══════════════════════════════════════════════════════
// Take or pick a dish's photo; the assistant scores it and says what would
// make it sell the dish better (light, framing, background, focus). If a
// dish is picked, the photo can become that dish's photo; nothing changes
// on the menu before that.

import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { aiDownNote, isAiDown } from '../../models/kitchen/aiModel';
import { PHOTO_VERDICT, TIP_KIND } from '../../models/kitchen/assistantModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, BottomSheetPicker, Button, Card, InlineNotice, IonIcon, type IonName, PickerField, ProgressBar, ScreenShell, StatusPill } from '../../Custom-Components/index';
import type { FoodVendorStackParamList } from '../../models';
import { pickImageFromLibrary, takePhoto } from '../../utils/pickers/pickers';
import { cdn } from '../../utils/cdn/cdn';
import { haptics } from '../../utils/haptics/haptics';
import { applyPhotoAsync, checkPhotoAsync, loadPhotoDishesAsync, pickPhotoDish, selectAiPhotoCheck } from './aiPhotoCheckSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenAiPhotoCheck'>;

const NO_DISH = '__none__';

const makeStyles = ({ space, radius, colors, size }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.s12 },
    photo: { width: '100%', aspectRatio: size.vendorPhotoAspect, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    tip: { flexDirection: 'row', gap: space.s12, alignItems: 'flex-start' },
    grow: { flex: 1, minWidth: 0, gap: space.s4 },
  });

const AiPhotoCheck: React.FC<Props> = props => (
  <ServiceScope service="food">
    <AiPhotoCheckContent {...props} />
  </ServiceScope>
);

const AiPhotoCheckContent: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'KitchenAssistant' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const s = useAppSelector(selectAiPhotoCheck);
  const [picking, setPicking] = useState(false);
  const wantItem = route.params?.itemId ?? null;

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadPhotoDishesAsync());
      if (wantItem) dispatch(pickPhotoDish(wantItem));
    }, [dispatch, wantItem]),
  );

  const dish = s.items.find(i => i.id === s.itemId) ?? null;
  const down = isAiDown(s.error.code) ? aiDownNote(s.error.code, s.error.details) : null;

  const check = async (camera: boolean) => {
    const file = camera ? await takePhoto() : await pickImageFromLibrary();
    if (!file) return;
    haptics.press();
    const r = await dispatch(checkPhotoAsync({ file, itemId: s.itemId }));
    if (checkPhotoAsync.fulfilled.match(r)) haptics.success();
    else haptics.warning();
  };

  const apply = async () => {
    if (!dish || !s.result) return;
    const r = await dispatch(applyPhotoAsync({ itemId: dish.id, photoUrl: s.result.imageUrl }));
    if (applyPhotoAsync.fulfilled.match(r)) Toast.show({ type: 'success', text1: 'Photo saved', text2: `${dish.name} shows it on your menu now.` });
  };

  return (
    <ScreenShell title="Photo check" subtitle="Tips before a photo goes on your menu" onBack={back}>
      {down ? <InlineNotice tone="info" title={down.title} message="You can still change a dish’s photo in your menu." /> : null}
      {s.error.message && !down ? <InlineNotice message={s.error.message} /> : null}
      <Card>
        <View style={styles.gap}>
          <PickerField label="For which dish (optional)" valueLabel={dish?.name ?? null} placeholder="Just checking a photo" onPress={() => setPicking(true)} />
          <Button label="Take a photo" leftIcon="camera-outline" loading={s.checking} onPress={() => void check(true)} fullWidth />
          <Button label="From your photos" variant="secondary" leftIcon="images-outline" disabled={s.checking} onPress={() => void check(false)} fullWidth />
          <AppText variant="caption" tone="muted">
            One assistant action per photo.
          </AppText>
        </View>
      </Card>

      {s.result ? (
        <Card>
          <View style={styles.gap}>
            <Image source={cdn(s.result.imageUrl, { w: 640 }) ?? s.result.imageUrl} style={styles.photo} contentFit="cover" accessibilityLabel="The photo you checked" />
            <View style={styles.head}>
              <AppText variant="title">{`${s.result.score} out of 100`}</AppText>
              <StatusPill label={PHOTO_VERDICT[s.result.verdict].label} tone={PHOTO_VERDICT[s.result.verdict].tone} />
            </View>
            <ProgressBar progress={s.result.score / 100} accessibilityLabel={`Photo score ${s.result.score} out of 100`} />
            {s.result.tips.map(t => (
              <View key={t.text} style={styles.tip}>
                <IonIcon name={TIP_KIND[t.kind].icon as IonName} size="md" color={colors.inkMuted} />
                <View style={styles.grow}>
                  <AppText variant="bodyStrong">{TIP_KIND[t.kind].label}</AppText>
                  <AppText variant="body">{t.text}</AppText>
                </View>
              </View>
            ))}
            {dish ? (
              <Button label={s.applied ? 'Saved as the dish’s photo' : `Use it for ${dish.name}`} variant={s.result.verdict === 'good' ? 'primary' : 'secondary'} disabled={s.applied} loading={s.applying} onPress={() => void apply()} fullWidth />
            ) : null}
          </View>
        </Card>
      ) : null}

      <BottomSheetPicker
        visible={picking}
        onClose={() => setPicking(false)}
        title="Which dish"
        options={[{ value: NO_DISH, label: 'Just checking a photo' }, ...s.items.filter(i => i.isActive).map(i => ({ value: i.id, label: i.name }))]}
        value={s.itemId ?? NO_DISH}
        onSelect={v => {
          dispatch(pickPhotoDish(v === NO_DISH ? null : v));
          setPicking(false);
        }}
      />
    </ScreenShell>
  );
};

export default AiPhotoCheck;
