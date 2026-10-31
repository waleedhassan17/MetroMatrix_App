// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen assistant: write descriptions
// ═══════════════════════════════════════════════════════
// Pick up to ten dishes; the assistant drafts a description for each in
// English and in Urdu (Urdu script, right to left), side by side on a
// tablet. The cook edits either one and saves each dish; nothing changes on
// the menu until they do. With the assistant off or used up, the menu's own
// editor is one tap away.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useLayoutClass } from '../../hooks/useLayoutClass';
import { aiDownNote, isAiDown } from '../../models/kitchen/aiModel';
import { MAX_DESCRIPTION_DISHES, validateDescription } from '../../models/kitchen/assistantModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, Checkbox, Divider, InlineNotice, ScreenShell, SkeletonLines, StatusPill, TextAction, TextField } from '../../Custom-Components/index';
import type { FoodVendorStackParamList } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import { draftDescriptionsAsync, loadDescribeItemsAsync, saveDescriptionAsync, selectAiDescriptions, setDraftText, startOver, toggleDescribe } from './aiDescriptionsSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenAiDescriptions'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    tight: { gap: space.s4 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.s12 },
    pair: { gap: space.s12 },
    pairWide: { flexDirection: 'row', gap: space.s16 },
    half: { flex: 1, flexBasis: 0, minWidth: 0 },
    row: { paddingVertical: space.s8 },
  });

const AiDescriptions: React.FC<Props> = props => (
  <ServiceScope service="food">
    <AiDescriptionsContent {...props} />
  </ServiceScope>
);

const AiDescriptionsContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'KitchenAssistant' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAiDescriptions);
  const wide = useLayoutClass() === 'tablet';

  const load = useCallback(() => void dispatch(loadDescribeItemsAsync()), [dispatch]);
  useFocusEffect(load);

  const down = isAiDown(s.draftError.code) ? aiDownNote(s.draftError.code, s.draftError.details) : null;

  const draft = async () => {
    haptics.press();
    const r = await dispatch(draftDescriptionsAsync(s.selected));
    if (draftDescriptionsAsync.fulfilled.match(r)) haptics.success();
    else haptics.warning();
  };

  const save = async (itemId: string, name: string) => {
    const e = s.edits[itemId];
    if (!e || Object.keys(validateDescription(e)).length) return;
    haptics.press();
    const r = await dispatch(saveDescriptionAsync({ itemId, ...e }));
    if (saveDescriptionAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: `${name} saved`, text2: 'Customers see it on your menu now.' });
    } else haptics.warning();
  };

  // ── Drafts ──
  if (s.drafts.length) {
    return (
      <ScreenShell title="Descriptions" subtitle="Drafts: edit them, then save each dish" onBack={() => dispatch(startOver())}>
        {s.saveError.message ? <InlineNotice message={s.saveError.message} /> : null}
        {s.drafts.map(d => {
          const e = s.edits[d.itemId] ?? { en: d.en, ur: d.ur };
          const errors = validateDescription(e);
          const saved = s.saved.includes(d.itemId);
          return (
            <Card key={d.itemId}>
              <View style={styles.gap}>
                <View style={styles.head}>
                  <AppText variant="title">{d.name}</AppText>
                  {saved ? <StatusPill label="Saved" tone="success" /> : <StatusPill label="Draft" tone="neutral" />}
                </View>
                {d.current.en ? (
                  <AppText variant="small" tone="muted">
                    {`On your menu now: ${d.current.en}`}
                  </AppText>
                ) : null}
                <View style={wide ? styles.pairWide : styles.pair}>
                  <View style={wide ? styles.half : undefined}>
                    <TextField label="English" value={e.en} onChangeText={v => dispatch(setDraftText({ itemId: d.itemId, field: 'en', value: v }))} multiline numberOfLines={5} error={errors.en} />
                  </View>
                  <View style={wide ? styles.half : undefined}>
                    <TextField
                      label="Urdu"
                      value={e.ur}
                      onChangeText={v => dispatch(setDraftText({ itemId: d.itemId, field: 'ur', value: v }))}
                      multiline
                      numberOfLines={5}
                      textAlign="right"
                      accessibilityLanguage="ur"
                      error={errors.ur}
                    />
                  </View>
                </View>
                <Button label={saved ? 'Saved' : `Save ${d.name}`} variant={saved ? 'secondary' : 'primary'} disabled={saved || Object.keys(errors).length > 0} loading={s.saving === d.itemId} onPress={() => void save(d.itemId, d.name)} fullWidth />
              </View>
            </Card>
          );
        })}
        <Button label="Pick other dishes" variant="ghost" onPress={() => dispatch(startOver())} fullWidth />
        <AppText variant="caption" tone="muted">
          Drafts from the assistant: read them before saving. Nothing changes on your menu until you save.
        </AppText>
      </ScreenShell>
    );
  }

  // ── Pick dishes ──
  const items = s.items.filter(i => i.isActive);
  return (
    <ScreenShell title="Descriptions" subtitle={`Pick up to ${MAX_DESCRIPTION_DISHES} dishes`} onBack={back} refreshing={s.status === 'loading' && !!items.length} onRefresh={load}>
      {down ? <InlineNotice tone="info" title={down.title} message={down.message} action={{ label: 'Write one in the menu', onPress: () => navigation.navigate('VendorMenuItem', s.selected[0] ? { id: s.selected[0] } : undefined) }} /> : null}
      {s.draftError.message && !down ? <InlineNotice message={s.draftError.message} /> : null}
      {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : null}
      {!items.length && s.status !== 'failed' ? <SkeletonLines lines={8} /> : null}
      {items.length ? (
        <Card padded="horizontal">
          {items.map((i, n) => (
            <View key={i.id}>
              {n ? <Divider /> : null}
              <View style={styles.row}>
                <Checkbox
                  checked={s.selected.includes(i.id)}
                  onToggle={() => dispatch(toggleDescribe(i.id))}
                  label={
                    <View style={styles.tight}>
                      <AppText variant="bodyStrong">{i.name}</AppText>
                      <AppText variant="small" tone="muted" numberOfLines={1}>
                        {i.description ?? 'No description yet'}
                      </AppText>
                    </View>
                  }
                  accessibilityLabel={`${i.name}${i.description ? '' : ', no description yet'}`}
                />
              </View>
            </View>
          ))}
        </Card>
      ) : null}
      <Button
        label={s.selected.length ? `Write drafts for ${s.selected.length} ${s.selected.length === 1 ? 'dish' : 'dishes'}` : 'Pick a dish first'}
        disabled={!s.selected.length}
        loading={s.drafting}
        onPress={() => void draft()}
        fullWidth
      />
      <TextAction label="Or write one yourself in the menu" icon="create-outline" onPress={() => navigation.navigate('VendorMenuItem', s.selected[0] ? { id: s.selected[0] } : undefined)} />
      <AppText variant="caption" tone="muted">
        One assistant action, however many dishes you pick.
      </AppText>
    </ScreenShell>
  );
};

export default AiDescriptions;
