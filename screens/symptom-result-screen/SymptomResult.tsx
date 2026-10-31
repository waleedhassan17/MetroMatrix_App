// ═══════════════════════════════════════════════════════
// MetroMatrix — Who to see
// ═══════════════════════════════════════════════════════
// Up to three areas to discuss with a doctor, the specialty to book, and the
// disclaimer — always visible. (A red flag never gets here: it goes to
// Emergency.)

import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useHealthNav } from '../../hooks/useHealth';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, Card, IonIcon, InlineNotice, ScreenShell } from '../../Custom-Components/index';
import type { HomeStackParamList } from '../../models';
import { selectSymptomChecker } from '../symptom-checker-screen/symptomCheckerSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'SymptomResult'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    area: { flexDirection: 'row', gap: space.s12, alignItems: 'flex-start' },
    grow: { flex: 1, gap: space.s4 },
  });

const plural = (name: string) => (/ist$|ian$|eon$/.test(name) ? `${name}s` : `${name} doctors`);

const SymptomResult: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <SymptomResultContent {...props} />
  </ServiceScope>
);

const SymptomResultContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'SymptomChecker' });
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const nav = useHealthNav();
  const r = useAppSelector(selectSymptomChecker).result;

  if (!r || r.emergency) {
    return (
      <ScreenShell title="Who to see" onBack={back}>
        <InlineNotice tone="info" message="Describe how you feel first." action={{ label: 'Open the checker', onPress: () => navigation.navigate('SymptomChecker') }} />
      </ScreenShell>
    );
  }

  const sp = r.specialty;
  return (
    <ScreenShell
      title="Who to see"
      subtitle={sp ? `A ${sp.name.toLowerCase()} is the right place to start` : undefined}
      onBack={back}
      footer={
        sp ? (
          <Button label={`See ${plural(sp.name).toLowerCase()}`} leftIcon="people-outline" onPress={() => nav.openDoctors({ specialty: sp.slug, title: sp.name })} fullWidth />
        ) : undefined
      }>
      <AppText variant="h2">Areas to discuss with a doctor</AppText>
      {r.areas.map(a => (
        <Card key={a.title}>
          <View style={styles.area}>
            <IonIcon name="chatbubble-ellipses-outline" size="lg" color={service.accentDeep} />
            <View style={styles.grow}>
              <AppText variant="title">{a.title}</AppText>
              <AppText variant="body">{a.body}</AppText>
            </View>
          </View>
        </Card>
      ))}
      <InlineNotice tone="info" title="This is not a diagnosis" message={r.disclaimer} />
      <Button label="Emergency numbers" variant="ghost" leftIcon="call-outline" onPress={() => navigation.navigate('Emergency')} fullWidth />
    </ScreenShell>
  );
};

export default SymptomResult;
