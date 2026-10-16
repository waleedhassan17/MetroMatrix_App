// ═══════════════════════════════════════════════════════
// MetroMatrix — Add or edit a family member
// ═══════════════════════════════════════════════════════
// Name, relation, gender, date of birth (the doctor sees their age) and an
// optional mobile number.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, Button, ChoiceChip, DateField, InlineNotice, ScreenShell, TextField, dateKeyOf } from '@custom/index';
import { RELATIONS, validateFamilyMember } from '@models/health/familyMemberModel';
import type { AccountStackParamList, Gender } from '@/types';
import { haptics } from '@utils/haptics';
import { selectFamily } from '../FamilyMembers/familySlice';
import { saveFamilyMemberAsync, selectFamilyForm, setFamilyField, startFamilyForm, touchFamilyForm } from './familyMemberFormSlice';

type Props = NativeStackScreenProps<AccountStackParamList, 'FamilyMemberForm'>;

const GENDERS: { key: Gender; label: string }[] = [
  { key: 'female', label: 'Female' },
  { key: 'male', label: 'Male' },
  { key: 'other', label: 'Other' },
];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    group: { gap: space.s8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const FamilyMemberFormScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <FamilyMemberFormContent {...props} />
  </ServiceScope>
);

const FamilyMemberFormContent: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'FamilyMembers' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const id = route.params?.id ?? null;
  const member = useAppSelector(selectFamily).members.find(m => m.id === id) ?? null;
  const s = useAppSelector(selectFamilyForm);
  const today = dateKeyOf(new Date());
  const errors = validateFamilyMember(s.form, today);

  useEffect(() => {
    dispatch(startFamilyForm(member));
    // Start once per member.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, id]);

  const save = async () => {
    if (Object.keys(errors).length) {
      haptics.warning();
      dispatch(touchFamilyForm());
      return;
    }
    const r = await dispatch(saveFamilyMemberAsync({ id, form: s.form }));
    if (saveFamilyMemberAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: id ? 'Saved' : `${r.payload.name} added`, text2: id ? undefined : 'You can book for them now.' });
      back();
    } else haptics.warning();
  };

  const show = (field: string) => (s.touched || s.status === 'failed' ? errors[field] : undefined);

  return (
    <ScreenShell
      title={id ? 'Edit family member' : 'Add family member'}
      onBack={back}
      footer={<Button label={id ? 'Save' : 'Add'} onPress={() => void save()} loading={s.status === 'loading'} fullWidth />}>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      <TextField label="Full name" value={s.form.name} onChangeText={t => dispatch(setFamilyField({ name: t }))} autoCapitalize="words" error={show('name')} placeholder="Zara Khan" />
      <View style={styles.group}>
        <AppText variant="label">Relation</AppText>
        <View style={styles.chips}>
          {RELATIONS.map(r => (
            <ChoiceChip key={r.key} label={r.label} selected={s.form.relation === r.key} onPress={() => dispatch(setFamilyField({ relation: r.key }))} />
          ))}
        </View>
      </View>
      <View style={styles.group}>
        <AppText variant="label">Gender</AppText>
        <View style={styles.chips}>
          {GENDERS.map(g => (
            <ChoiceChip key={g.key} label={g.label} selected={s.form.gender === g.key} onPress={() => dispatch(setFamilyField({ gender: g.key }))} />
          ))}
        </View>
      </View>
      <DateField label="Date of birth" value={s.form.dateOfBirth} onChange={v => dispatch(setFamilyField({ dateOfBirth: v }))} max={today} min="1906-01-01" error={show('dateOfBirth')} />
      <TextField
        label="Mobile number (optional)"
        mode="phone"
        value={(s.form.phone ?? '').replace(/^\+92/, '')}
        onChangeText={v => dispatch(setFamilyField({ phone: v ? `+92${v}` : null }))}
        error={show('phone')}
        placeholder="300 1112233"
      />
    </ScreenShell>
  );
};

export default FamilyMemberFormScreen;
