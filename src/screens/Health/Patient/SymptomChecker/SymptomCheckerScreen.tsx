// ═══════════════════════════════════════════════════════
// MetroMatrix — Not sure who to see?
// ═══════════════════════════════════════════════════════
// Describe what you feel in your own words (examples help), for you or a
// family member. Signs of an emergency go straight to the Emergency screen.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, Button, ChoiceChip, InlineNotice, PatientPicker, ScreenShell, TextField } from '@custom/index';
import type { HomeStackParamList } from '@/types';
import { ageFrom } from '@utils/healthTime';
import { haptics } from '@utils/haptics';
import { selectUser } from '../../../Auth/authSlice';
import { loadFamilyAsync, selectFamily } from '../FamilyMembers/familySlice';
import { SYMPTOM_EXAMPLES, checkSymptomsAsync, selectSymptomChecker, setSymptomFor, setSymptomText } from './symptomCheckerSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'SymptomChecker'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    group: { gap: space.s8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const SymptomCheckerScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <SymptomCheckerContent {...props} />
  </ServiceScope>
);

const SymptomCheckerContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'HealthHome' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectSymptomChecker);
  const user = useAppSelector(selectUser);
  const family = useAppSelector(selectFamily);
  const member = family.members.find(m => m.id === s.memberId) ?? null;

  useEffect(() => {
    if (family.status === 'idle') void dispatch(loadFamilyAsync());
  }, [family.status, dispatch]);

  const check = async () => {
    const text = s.text.trim();
    if (text.length < 3) {
      haptics.warning();
      return;
    }
    const r = await dispatch(
      checkSymptomsAsync({
        text,
        age: ageFrom(member ? member.dateOfBirth : (user?.dateOfBirth ?? null)),
        gender: member ? member.gender : (user?.gender ?? null),
      }),
    );
    if (checkSymptomsAsync.fulfilled.match(r)) {
      if (r.payload.emergency) navigation.navigate('Emergency');
      else navigation.navigate('SymptomResult');
    }
  };

  return (
    <ScreenShell
      title="Not sure who to see?"
      subtitle="Describe how you feel. We’ll suggest the right specialty."
      onBack={back}
      footer={<Button label="Check" onPress={() => void check()} loading={s.status === 'loading'} disabled={s.text.trim().length < 3} fullWidth />}>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      <View style={styles.group}>
        <AppText variant="label">Who is it for</AppText>
        <PatientPicker family={family.members} selected={s.memberId} onSelect={id => dispatch(setSymptomFor(id))} />
      </View>
      <TextField
        label="What do you feel, and since when?"
        value={s.text}
        onChangeText={t => dispatch(setSymptomText(t))}
        multiline
        maxLength={500}
        placeholder="Fever and sore throat for 3 days"
      />
      <View style={styles.group}>
        <AppText variant="small" tone="muted">
          For example
        </AppText>
        <View style={styles.chips}>
          {SYMPTOM_EXAMPLES.map(e => (
            <ChoiceChip key={e} label={e} onPress={() => dispatch(setSymptomText(e))} />
          ))}
        </View>
      </View>
      <InlineNotice
        tone="info"
        message="This suggests who to see; it is not a diagnosis. If someone has chest pain, trouble breathing, has fainted or is bleeding heavily, call 1122 now."
      />
    </ScreenShell>
  );
};

export default SymptomCheckerScreen;
