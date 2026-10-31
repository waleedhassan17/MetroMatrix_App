// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: conditions
// ═══════════════════════════════════════════════════════
// What patients type when they don't know the specialty: each condition, the
// other words people use ("pimples" for Acne), the specialty it leads to, and
// whether Health home shows it as common.

import React, { useEffect } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useDebouncedValue } from '../../hooks/usePagedList';
import { useStyles, type Theme } from '../../theme/index';
import {
  AppText,
  Button,
  Card,
  ChoiceChip,
  EmptyState,
  InlineNotice,
  ListRow,
  ScreenShell,
  Sheet,
  SkeletonLines,
  StatusPill,
  TextAction,
  TextField,
  ToggleRow,
} from '../../Custom-Components/index';
import { SearchField } from '../../Components/shopping/ShopParts';
import { MAX_ALIASES, conditionForm, parseAliases, validateCondition } from '../../models/health/adminHealthModel';
import type { AdminCondition, AdminHealthStackParamList } from '../../models';
import { Alert } from '../../utils/alert/alert';
import { haptics } from '../../utils/haptics/haptics';
import {
  changeConditionAsync,
  loadConditionsAsync,
  openConditionSheet,
  selectAdminConditions,
  setConditionForm,
  setConditionQuery,
  touchConditionForm,
} from './conditionsSlice';

type Props = NativeStackScreenProps<AdminHealthStackParamList, 'Conditions'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s12, paddingTop: space.s4, paddingBottom: space.s40 },
    state: { paddingTop: space.s16 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const Conditions: React.FC<Props> = () => {
  const { back } = useBack({ name: 'HealthOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAdminConditions);
  const q = useDebouncedValue(s.query, 300);
  const f = s.sheet;
  const errors = f && s.touched ? validateCondition(f) : {};
  const specialtyName = (slug: string | null) => s.specialties.find(x => x.slug === slug)?.name ?? null;

  useEffect(() => {
    void dispatch(loadConditionsAsync(q));
  }, [q, dispatch]);

  const save = () => {
    if (!f) return;
    if (Object.keys(validateCondition(f)).length) {
      dispatch(touchConditionForm());
      haptics.warning();
      return;
    }
    void dispatch(changeConditionAsync({ kind: 'save', form: f, query: s.query }));
  };

  const remove = (id: string, name: string) =>
    Alert.alert(`Delete ${name}?`, 'Doctors who list it lose it too, and patients can no longer search for it.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void dispatch(changeConditionAsync({ kind: 'delete', id, query: s.query })) },
    ]);

  const subtitle = (c: AdminCondition) =>
    [specialtyName(c.specialtySlug) ?? 'No specialty', c.aliases.length ? `Also: ${c.aliases.slice(0, 4).join(', ')}` : null].filter(Boolean).join(' · ');

  const aliasCount = f ? parseAliases(f.aliases).length : 0;

  return (
    <ScreenShell
      title="Conditions"
      subtitle="What patients type, and the specialty it leads to"
      onBack={back}
      scroll={false}
      headerContent={<SearchField value={s.query} onChange={t => dispatch(setConditionQuery(t))} placeholder="Find a condition or another name for it" />}
      footer={<Button label="New condition" leftIcon="add" onPress={() => dispatch(openConditionSheet(conditionForm(null)))} fullWidth />}>
      {s.error.message && !s.sheet ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadConditionsAsync(s.query)) }} /> : null}
      <FlatList
        data={s.list}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: c }) => (
          <Card padded="horizontal">
            <ListRow
              title={c.name}
              subtitle={subtitle(c)}
              right={c.isCommon ? <StatusPill label="Common" tone="accent" /> : undefined}
              onPress={() => dispatch(openConditionSheet(conditionForm(c)))}
              accessibilityHint="Edit this condition"
            />
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.state}>
            {s.status === 'loading' ? (
              <SkeletonLines lines={8} />
            ) : (
              <EmptyState icon="search" title={s.query ? 'No condition matches' : 'No conditions yet'} body="Add the words patients type when they don't know the specialty." />
            )}
          </View>
        }
      />

      <Sheet
        visible={!!f}
        onClose={() => dispatch(openConditionSheet(null))}
        title={f?.id ? 'Edit condition' : 'New condition'}
        footer={<Button label="Save" loading={s.busy} onPress={save} fullWidth />}>
        <TextField label="Condition" value={f?.name ?? ''} onChangeText={t => dispatch(setConditionForm({ name: t.slice(0, 60) }))} placeholder="Acne" error={errors.name} />
        <TextField
          label="Other names patients use"
          value={f?.aliases ?? ''}
          onChangeText={t => dispatch(setConditionForm({ aliases: t.slice(0, 400) }))}
          placeholder="pimples, breakouts, zits"
          multiline
          helper={`Separate them with commas. ${aliasCount} of ${MAX_ALIASES}.`}
          error={errors.aliases}
        />
        <AppText variant="label">Leads to</AppText>
        <View style={styles.chips}>
          <ChoiceChip label="No specialty" selected={!f?.specialtySlug} onPress={() => dispatch(setConditionForm({ specialtySlug: null }))} />
          {s.specialties.map(x => (
            <ChoiceChip key={x.id} label={x.name} selected={f?.specialtySlug === x.slug} onPress={() => dispatch(setConditionForm({ specialtySlug: x.slug }))} />
          ))}
        </View>
        <ToggleRow
          label="Common condition"
          helper="Shown on Health home and at the top of the conditions list."
          value={!!f?.isCommon}
          onChange={v => dispatch(setConditionForm({ isCommon: v }))}
        />
        {f?.id ? <TextAction label="Delete this condition" tone="danger" onPress={() => remove(f.id, f.name)} /> : null}
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      </Sheet>
    </ScreenShell>
  );
};

export default Conditions;
