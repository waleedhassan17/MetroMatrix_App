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
import type { HomeStackParamList, SymptomResult } from '../../models';
import { selectSymptomChecker } from '../symptom-checker-screen/symptomCheckerSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'SymptomResult'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    area: { flexDirection: 'row', gap: space.s12, alignItems: 'flex-start' },
    grow: { flex: 1, gap: space.s4 },
  });

const plural = (name: string) => (/ist$|ian$|eon$/.test(name) ? `${name}s` : `${name} doctors`);

/** "a dermatologist", "an ENT specialist": the article follows the sound, and abbreviations stay in capitals. */
const withArticle = (name: string) => {
  const shown = name.split(' ').map(w => (/^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase())).join(' ');
  return `${/^[aeiouAEIOU]|^(ENT|MRI|X-ray)\b/.test(shown) ? 'An' : 'A'} ${shown}`;
};

/** How soon to be seen, in the checker's calm words (never alarming: red flags go to Emergency first). */
const URGENCY: Record<NonNullable<SymptomResult['urgency']>, { title: string; tone: 'info' | 'warning' }> = {
  routine: { title: 'A routine visit is fine', tone: 'info' },
  soon: { title: 'See a doctor in the next few days', tone: 'info' },
  urgent: { title: 'See a doctor today', tone: 'warning' },
};

const SymptomResult: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <SymptomResultContent {...props} />
  </ServiceScope>
);

const SymptomResultContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'SymptomChecker' });
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
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
      subtitle={sp ? `${withArticle(sp.name)} is the right place to start` : undefined}
      onBack={back}
      footer={
        sp ? (
          <Button label={`See ${plural(sp.name).toLowerCase()}`} leftIcon="people-outline" onPress={() => nav.openDoctors({ specialty: sp.slug, title: sp.name })} fullWidth />
        ) : undefined
      }>
      {r.urgency ? <InlineNotice tone={URGENCY[r.urgency].tone} title={URGENCY[r.urgency].title} message={r.advice ?? 'Book a visit and tell the doctor what you told us.'} /> : null}
      <AppText variant="sectionTitle" accessibilityRole="header">
        Areas to discuss with a doctor
      </AppText>
      {r.areas.map(a => (
        <Card key={a.title}>
          <View style={styles.area}>
            <IonIcon name="chatbubble-ellipses-outline" size="lg" color={colors.inkMuted} />
            <View style={styles.grow}>
              <AppText variant="title">{a.title}</AppText>
              <AppText variant="body">{a.body}</AppText>
            </View>
          </View>
        </Card>
      ))}
      {r.alternatives.length ? (
        <Card>
          <AppText variant="title">Could also help</AppText>
          {r.alternatives.map(x => (
            <Button key={x.slug} label={`See ${plural(x.name).toLowerCase()}`} variant="secondary" size="sm" onPress={() => nav.openDoctors({ specialty: x.slug, title: x.name })} />
          ))}
        </Card>
      ) : null}
      <InlineNotice tone="info" title="This is not a diagnosis" message={r.disclaimer} />
      <Button label="Emergency numbers" variant="ghost" leftIcon="call-outline" onPress={() => navigation.navigate('Emergency')} fullWidth />
    </ScreenShell>
  );
};

export default SymptomResult;
