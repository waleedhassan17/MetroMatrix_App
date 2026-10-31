// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: words voice understands
// ═══════════════════════════════════════════════════════
// Each ingredient's other names, so "do kilo tamatar", "ٹماٹر" and "2 kg
// tomatoes" all mean the same thing to voice and receipt scans. Add a word
// people use, in Roman Urdu, Urdu or English, or delete a wrong one.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useDebouncedValue } from '../../hooks/usePagedList';
import { ALIAS_LANGUAGES, ALIAS_LANGUAGE_LABEL, validateAlias } from '../../models/kitchen/adminKitchenModel';
import { isUrduScript } from '../../utils/script/script';
import { useStyles, type Theme } from '../../theme/index';
import {
  AppText,
  Button,
  Card,
  ChoiceChip,
  Divider,
  InlineNotice,
  ScreenShell,
  Sheet,
  SkeletonLines,
  TextAction,
  TextField,
} from '../../Custom-Components/index';
import { SearchField } from '../../Components/shopping/ShopParts';
import type { AdminFoodStackParamList, IngredientAlias } from '../../models';
import { Alert } from '../../utils/alert/alert';
import { haptics } from '../../utils/haptics/haptics';
import {
  deleteAliasAsync,
  loadAliasesAsync,
  markAliasSubmitted,
  openAliasSheet,
  saveAliasAsync,
  searchKeysAsync,
  selectAdminKitchenAliases,
  setAliasForm,
  setAliasesQuery,
  setKeyQuery,
} from './adminKitchenAliasesSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminKitchenAliases'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s8 },
    grow: { flex: 1, gap: space.s4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    rtl: { writingDirection: 'rtl' },
  });

const AdminKitchenAliases: React.FC<Props> = () => {
  const { back } = useBack({ name: 'FoodOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAdminKitchenAliases);
  const sheet = s.sheet;
  const q = useDebouncedValue(s.q.trim());
  const keyQ = useDebouncedValue(s.keyQuery.trim());
  const errors = sheet && s.submitted ? validateAlias(sheet) : {};

  useEffect(() => {
    void dispatch(loadAliasesAsync(q));
  }, [dispatch, q]);

  const sheetOpen = !!sheet;
  useEffect(() => {
    if (sheetOpen) void dispatch(searchKeysAsync(keyQ));
  }, [dispatch, keyQ, sheetOpen]);

  const save = () => {
    if (!sheet) return;
    dispatch(markAliasSubmitted());
    if (Object.keys(validateAlias(sheet)).length) return haptics.warning();
    void dispatch(saveAliasAsync({ form: sheet, q }));
  };

  const remove = (a: IngredientAlias) =>
    Alert.alert(`Delete “${a.word}”?`, `Voice and receipts will stop reading it as ${a.keyName}.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void dispatch(deleteAliasAsync({ id: a.id, q })) },
    ]);

  return (
    <ScreenShell
      title="Words voice understands"
      subtitle={s.status === 'succeeded' ? `${s.total} ${s.total === 1 ? 'word' : 'words'} for ingredients` : 'Roman Urdu, Urdu and English'}
      onBack={back}
      refreshing={s.status === 'loading' && !!s.items.length}
      onRefresh={() => void dispatch(loadAliasesAsync(q))}
      headerContent={<SearchField value={s.q} onChange={t => dispatch(setAliasesQuery(t))} placeholder="A word or an ingredient" />}
      footer={<Button label="New word" leftIcon="add" onPress={() => dispatch(openAliasSheet(true))} fullWidth />}>
      {s.error.message ? (
        <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadAliasesAsync(q)) }} />
      ) : null}
      {s.status === 'loading' && !s.items.length ? <SkeletonLines lines={8} /> : null}
      {s.status === 'succeeded' || s.items.length ? (
        <Card>
          {s.items.length ? (
            s.items.map((a, i) => (
              <View key={a.id}>
                {i ? <Divider /> : null}
                <View style={styles.row}>
                  <View style={styles.grow}>
                    <AppText variant="bodyStrong" style={isUrduScript(a.word) ? styles.rtl : undefined} accessibilityLanguage={a.language === 'ur' ? 'ur' : 'en'}>
                      {`“${a.word}”`}
                    </AppText>
                    <AppText variant="small" tone="muted">
                      {`${ALIAS_LANGUAGE_LABEL[a.language]} · means ${a.keyName}`}
                    </AppText>
                  </View>
                  <TextAction label="Delete" tone="danger" onPress={() => remove(a)} />
                </View>
              </View>
            ))
          ) : (
            <AppText variant="body">{s.q.trim() ? `No word matches “${s.q.trim()}”.` : 'No words yet.'}</AppText>
          )}
        </Card>
      ) : null}
      <AppText variant="caption" tone="muted">
        Kitchens speak and write ingredients many ways. Every word here is read as its ingredient by voice and receipt scans.
      </AppText>

      <Sheet
        visible={!!sheet}
        onClose={() => dispatch(openAliasSheet(false))}
        title="New word"
        subtitle="What people say or write, and the ingredient it means."
        footer={<Button label="Save" loading={s.busy} onPress={save} fullWidth />}>
        {s.saveError.message ? <InlineNotice message={s.saveError.message} /> : null}
        <View style={styles.chips}>
          {ALIAS_LANGUAGES.map(l => (
            <ChoiceChip key={l} label={ALIAS_LANGUAGE_LABEL[l]} selected={sheet?.language === l} onPress={() => dispatch(setAliasForm({ language: l }))} />
          ))}
        </View>
        <TextField
          label="The word"
          value={sheet?.word ?? ''}
          onChangeText={t => dispatch(setAliasForm({ word: t.slice(0, 40) }))}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={sheet?.language === 'ur' ? 'ٹماٹر' : sheet?.language === 'en' ? 'tomatoes' : 'tamatar'}
          error={errors.word}
        />
        <TextField
          label="It means"
          value={s.keyQuery}
          onChangeText={t => dispatch(setKeyQuery(t))}
          placeholder="Search the ingredients"
          helper={sheet?.key ? `Picked: ${sheet.keyName}` : undefined}
          error={errors.key}
        />
        <View style={styles.chips}>
          {s.keys.slice(0, 12).map(k => (
            <ChoiceChip key={k.key} label={k.name} selected={sheet?.key === k.key} onPress={() => dispatch(setAliasForm({ key: k.key, keyName: k.name }))} />
          ))}
        </View>
      </Sheet>
    </ScreenShell>
  );
};

export default AdminKitchenAliases;
