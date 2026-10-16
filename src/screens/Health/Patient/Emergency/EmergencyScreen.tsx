// ═══════════════════════════════════════════════════════
// MetroMatrix — Emergency
// ═══════════════════════════════════════════════════════
// The one red screen. A large call button for each number (from the API, or
// a built-in list if it hasn't loaded), "Share my location" by text message,
// and three plain instructions — nothing medical beyond them.

import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useBarStyle } from '@hooks/useBarStyle';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, IconButton, IonIcon } from '@custom/index';
import { FALLBACK_EMERGENCY_NUMBERS, helpMessage, smsUrl } from '@models/health/emergencyModel';
import type { HomeStackParamList } from '@/types';
import { callNumber } from '@utils/maps';
import { locationForSms } from '../../../../services/location';
import { selectHealthHome } from '../HealthHome/healthHomeSlice';
import { selectSymptomChecker } from '../SymptomChecker/symptomCheckerSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'Emergency'>;

const makeStyles = ({ colors, space, radius, size, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    head: { backgroundColor: colors.danger, paddingHorizontal: gutter - space.s8, paddingBottom: space.s24, gap: space.s8 },
    headText: { paddingHorizontal: space.s8, gap: space.s4 },
    content: { padding: gutter, gap: space.s16, paddingBottom: space.s40 },
    call: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s16,
      minHeight: size.control.lg + space.s16,
      paddingHorizontal: space.s20,
      borderRadius: radius.lg,
      backgroundColor: colors.dangerSoft,
      borderWidth: size.border,
      borderColor: colors.dangerLine,
    },
    grow: { flex: 1, gap: space.s0 },
    steps: { gap: space.s8 },
    step: { flexDirection: 'row', gap: space.s12, alignItems: 'flex-start' },
  });

const EmergencyScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <EmergencyContent {...props} />
  </ServiceScope>
);

const EmergencyContent: React.FC<Props> = () => {
  const { back, canGoBack } = useBack({ name: 'HealthHome' });
  const styles = useStyles(makeStyles);
  const { colors, opacity, space } = useTheme();
  const insets = useSafeAreaInsets();
  useBarStyle(true);
  const fromHome = useAppSelector(selectHealthHome).home?.emergencyNumbers;
  const fromCheck = useAppSelector(selectSymptomChecker).result?.emergencyNumbers;
  const numbers = fromCheck?.length ? fromCheck : fromHome?.length ? fromHome : FALLBACK_EMERGENCY_NUMBERS;
  const [locating, setLocating] = useState(false);

  const shareLocation = async () => {
    setLocating(true);
    const link = await locationForSms();
    setLocating(false);
    await Linking.openURL(smsUrl(helpMessage(link))).catch(() => undefined);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.head, { paddingTop: insets.top + space.s12 }]}>
        {canGoBack ? <IconButton icon="chevron-back" tone="onScrim" onPress={back} accessibilityLabel="Back" /> : null}
        <View style={styles.headText}>
          <AppText variant="heading" tone="onDanger" accessibilityRole="header">
            Emergency
          </AppText>
          <AppText variant="body" tone="onDanger">
            Call now. Don’t wait for an appointment.
          </AppText>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {numbers.map(n => (
          <Pressable
            key={n.number}
            onPress={() => void callNumber(n.number)}
            style={({ pressed }) => [styles.call, pressed && { opacity: opacity.pressed }]}
            accessibilityRole="button"
            accessibilityLabel={`Call ${n.label}, ${n.number}`}>
            <IonIcon name="call" size="xl" color={colors.danger} />
            <View style={styles.grow}>
              <AppText variant="h2" tone="danger">{`Call ${n.number}`}</AppText>
              <AppText variant="body">{n.label}</AppText>
            </View>
          </Pressable>
        ))}
        <Button label="Share my location by text" variant="secondary" leftIcon="location-outline" onPress={() => void shareLocation()} loading={locating} fullWidth />
        <View style={styles.steps}>
          {['Stay with the person.', 'Keep them still and comfortable.', 'Call now, and follow what the operator tells you.'].map(t => (
            <View key={t} style={styles.step}>
              <IonIcon name="checkmark-circle-outline" size="md" color={colors.inkMuted} />
              <AppText variant="body">{t}</AppText>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default EmergencyScreen;
