// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: specialties
// ═══════════════════════════════════════════════════════
// The specialties patients browse, in the order they see them: the name, a
// line icon, how many doctors are listed. Add, edit, move up
// and down; one with doctors listed under it can't be deleted.

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useStyles, useTheme, type Theme } from '@theme/index';
import {
  AppText,
  Button,
  Card,
  Divider,
  IconButton,
  InlineNotice,
  IonIcon,
  ScreenShell,
  Sheet,
  SkeletonLines,
  TextAction,
  TextField,
  type IonName,
} from '@custom/index';
import { SPECIALTY_ICONS, specialtyForm, validateSpecialty } from '@models/health/adminHealthModel';
import type { AdminHealthStackParamList, AdminSpecialty } from '@/types';
import { Alert } from '@utils/alert';
import { haptics } from '@utils/haptics';
import {
  changeSpecialtyAsync,
  loadSpecialtiesAsync,
  openSpecialtySheet,
  selectAdminSpecialties,
  setSpecialtyForm,
  touchSpecialtyForm,
} from './specialtiesSlice';

type Props = NativeStackScreenProps<AdminHealthStackParamList, 'Specialties'>;

const makeStyles = ({ space, size, radius }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s8, paddingVertical: space.s12 },
    well: { width: size.touch, height: size.touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    text: { flex: 1, gap: space.s4 },
    actions: { flexDirection: 'row', gap: space.s16 },
    icons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    iconWell: { width: size.touch, height: size.touch, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  });

const SpecialtiesScreen: React.FC<Props> = () => {
  const { back } = useBack({ name: 'HealthOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const s = useAppSelector(selectAdminSpecialties);
  const f = s.sheet;
  const errors = f && s.touched ? validateSpecialty(f) : {};

  useEffect(() => {
    void dispatch(loadSpecialtiesAsync());
  }, [dispatch]);

  // A new specialty goes to the end, so the list must be in first.
  const loaded = s.status === 'succeeded' || s.list.length > 0;
  const nextSort = s.list.reduce((m, x) => Math.max(m, x.sort), 0) + 1;

  const save = () => {
    if (!f) return;
    if (Object.keys(validateSpecialty(f)).length) {
      dispatch(touchSpecialtyForm());
      haptics.warning();
      return;
    }
    void dispatch(changeSpecialtyAsync({ kind: 'save', form: f }));
  };

  const move = (i: number, by: -1 | 1) => {
    const list = [...s.list];
    [list[i], list[i + by]] = [list[i + by], list[i]];
    void dispatch(changeSpecialtyAsync({ kind: 'reorder', list }));
  };

  const remove = (x: AdminSpecialty) =>
    Alert.alert(`Delete ${x.name}?`, 'Only a specialty with no doctors listed under it can go.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void dispatch(changeSpecialtyAsync({ kind: 'delete', id: x.id })) },
    ]);

  return (
    <ScreenShell
      title="Specialties"
      subtitle="Patients see them in this order"
      onBack={back}
      footer={<Button label="New specialty" leftIcon="add" disabled={!loaded} onPress={() => dispatch(openSpecialtySheet(specialtyForm(null, nextSort)))} fullWidth />}>
      {s.error.message && !s.sheet ? (
        <InlineNotice message={s.error.message} action={s.list.length ? undefined : { label: 'Try again', onPress: () => void dispatch(loadSpecialtiesAsync()) }} />
      ) : null}
      {s.status === 'loading' && !s.list.length ? <SkeletonLines lines={8} /> : null}
      {s.list.length ? (
        <Card padded="horizontal">
          {s.list.map((x, i) => (
            <View key={x.id}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.row}>
                <View style={[styles.well, { backgroundColor: service.accentSoft }]}>
                  <IonIcon name={x.icon as IonName} size="md" color={service.accentDeep} />
                </View>
                <View style={styles.text}>
                  <AppText variant="bodyStrong">{x.name}</AppText>
                  <AppText variant="caption" tone="muted">
                    {x.doctorCount} {x.doctorCount === 1 ? 'doctor' : 'doctors'} listed
                  </AppText>
                  <View style={styles.actions}>
                    <TextAction label="Edit" onPress={() => dispatch(openSpecialtySheet(specialtyForm(x, nextSort)))} />
                    {x.doctorCount === 0 ? <TextAction label="Delete" tone="danger" onPress={() => remove(x)} /> : null}
                  </View>
                </View>
                <IconButton
                  icon="arrow-up"
                  tone="muted"
                  disabled={i === 0 || s.busy}
                  onPress={() => move(i, -1)}
                  accessibilityLabel={`Move ${x.name} up`}
                />
                <IconButton
                  icon="arrow-down"
                  tone="muted"
                  disabled={i === s.list.length - 1 || s.busy}
                  onPress={() => move(i, 1)}
                  accessibilityLabel={`Move ${x.name} down`}
                />
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <Sheet
        visible={!!f}
        onClose={() => dispatch(openSpecialtySheet(null))}
        title={f?.id ? 'Edit specialty' : 'New specialty'}
        footer={<Button label="Save" loading={s.busy} onPress={save} fullWidth />}>
        <TextField label="Name" value={f?.name ?? ''} onChangeText={t => dispatch(setSpecialtyForm({ name: t.slice(0, 40) }))} placeholder="Dermatologist" error={errors.name} />
        <TextField
          label="Place in the list"
          value={f?.sort ?? ''}
          onChangeText={t => dispatch(setSpecialtyForm({ sort: t.replace(/\D/g, '').slice(0, 3) }))}
          keyboardType="number-pad"
          helper="Lower numbers come first."
          error={errors.sort}
        />
        <AppText variant="label" tone={errors.icon ? 'danger' : 'ink'}>
          Icon
        </AppText>
        <View style={styles.icons} accessibilityRole="radiogroup">
          {SPECIALTY_ICONS.map(icon => {
            const on = f?.icon === icon;
            return (
              <Pressable
                key={icon}
                onPress={() => dispatch(setSpecialtyForm({ icon }))}
                style={[styles.iconWell, { backgroundColor: on ? service.accent : service.accentSoft }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={icon.replace(/-outline$/, '').replace(/-/g, ' ')}>
                <IonIcon name={icon} size="md" color={on ? service.onAccent : service.accentDeep} />
              </Pressable>
            );
          })}
        </View>
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      </Sheet>
    </ScreenShell>
  );
};

export default SpecialtiesScreen;
