// ═══════════════════════════════════════════════════════
// MetroMatrix — Provider Selection (ported from the FYP app)
// ═══════════════════════════════════════════════════════
// "Choose Your Service": Doctor, Food (expands to Restaurant / Home Kitchen /
// Cloud Kitchen, where the FYP had its home-service trades) and Vendor. Each
// card wears its service's colour. "Continue to Registration" → Provider
// Sign In, which shows the choice as a badge.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { SERVICE_LABELS, SUBTYPE_LABELS } from '../../models/businessModel';
import { SERVICE_PALETTES, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, IonIcon, MciIcon, StickyCTA, type MciName } from '../../Custom-Components/index';
import { ChoiceCard } from '../../Components/auth/ChoiceCard';
import type { RootStackParamList, ServiceType, SubType } from '../../models';
import { useSignOut } from '../../hooks/useSignOut';
import { chooseKitchen, chooseService, rememberPendingPick, selectProviderSelection } from './providerSelectionSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderSelection'>;

const CARDS: { service: ServiceType; icon: MciName; expands: boolean }[] = [
  { service: 'healthcare', icon: 'stethoscope', expands: false },
  { service: 'food', icon: 'silverware-fork-knife', expands: true },
  { service: 'shopping', icon: 'store', expands: false },
];

const KITCHENS: { subType: SubType; icon: MciName }[] = [
  { subType: 'restaurant', icon: 'silverware' },
  { subType: 'home_kitchen', icon: 'stove' },
  { subType: 'cloud_kitchen', icon: 'cloud-outline' },
];

const makeStyles = ({ colors, space, gutter, size, radius }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    header: { paddingHorizontal: gutter, paddingTop: space.s8, paddingBottom: space.s16 },
    back: { width: size.touch, height: size.touch, marginLeft: -space.s8, justifyContent: 'center' },
    titles: { alignItems: 'center', gap: space.s4, paddingTop: space.s8 },
    scroll: { flexGrow: 1, paddingHorizontal: gutter, paddingBottom: space.s32, gap: space.s16 },
    subTypes: { paddingHorizontal: space.s20, paddingBottom: space.s16, paddingTop: space.s8, gap: space.s8 },
    subType: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s12,
      padding: space.s12,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderColor: colors.line,
    },
    subTile: {
      width: size.subTypeTile,
      height: size.subTypeTile,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceSunk,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

const ProviderSelection: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { serviceType, subType, expanded } = useAppSelector(selectProviderSelection);
  const canContinue = !!serviceType && !!subType;
  // Signed in with no service known yet (provider setup gate): the choice is
  // saved as the pending pick and Personal Info follows. There is no screen
  // behind this one, so Back becomes Sign out.
  const inSetup = useAppSelector(state => state.auth.isAuthenticated);
  const { signOutNow, signingOut } = useSignOut();

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('RoleSelection'));

  const next = () => {
    if (!serviceType || !subType) return;
    if (inSetup) {
      dispatch(rememberPendingPick({ serviceType, subType }));
      navigation.replace('PersonalInfo');
    } else {
      navigation.navigate('ProviderSignIn');
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {inSetup ? null : (
          <Pressable onPress={back} style={styles.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
            <IonIcon name="arrow-back" size="lg" color={colors.ink} />
          </Pressable>
        )}
        <View style={styles.titles}>
          <AppText variant="logo" tone="brand">
            MetroMatrix
          </AppText>
          <AppText variant="screenTitle" align="center" accessibilityRole="header">
            Choose Your Service
          </AppText>
          <AppText variant="body" tone="muted" align="center">
            {inSetup ? 'Choose the service your business provides to continue' : 'Select the service you want to provide'}
          </AppText>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {CARDS.map(card => {
          const palette = SERVICE_PALETTES.light[card.service];
          const isThis = serviceType === card.service;
          const selected = isThis && !!subType && !(card.expands && expanded);
          return (
            <ChoiceCard
              key={card.service}
              icon={<MciIcon name={card.icon} size="xl" color={palette.accent} />}
              iconBg={palette.accentSoft}
              title={SERVICE_LABELS[card.service].partnerTitle}
              description={
                card.expands && isThis && subType && !expanded
                  ? `${SUBTYPE_LABELS[subType].title} · ${SERVICE_LABELS[card.service].description}`
                  : SERVICE_LABELS[card.service].description
              }
              onPress={() => dispatch(chooseService(card.service))}
              trailing={card.expands ? 'expand' : 'chevron'}
              selected={selected}
              expanded={card.expands && isThis && expanded}
              accent={palette.accent}>
              {card.expands && isThis && expanded ? (
                <View style={styles.subTypes} accessibilityRole="radiogroup">
                  {KITCHENS.map(k => {
                    const on = subType === k.subType;
                    return (
                      <Pressable
                        key={k.subType}
                        onPress={() => dispatch(chooseKitchen(k.subType))}
                        accessibilityRole="radio"
                        aria-checked={on}
                        accessibilityLabel={SUBTYPE_LABELS[k.subType].title}
                        style={[styles.subType, on && { borderColor: palette.accent, backgroundColor: palette.accentSoft }]}>
                        <View style={[styles.subTile, on && { backgroundColor: palette.accentLine }]}>
                          <MciIcon name={k.icon} size="md" color={on ? palette.accentDeep : colors.inkMuted} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText variant="input" tone={on ? 'ink' : 'muted'}>
                            {SUBTYPE_LABELS[k.subType].title}
                          </AppText>
                          <AppText variant="caption" tone="muted">
                            {SUBTYPE_LABELS[k.subType].description}
                          </AppText>
                        </View>
                        {on ? <IonIcon name="checkmark-circle" size="md" color={palette.accent} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </ChoiceCard>
          );
        })}
      </ScrollView>

      <StickyCTA>
        <Button
          label={inSetup ? 'Continue' : 'Continue to Registration'}
          rightIon="arrow-forward"
          onPress={next}
          disabled={!canContinue}
          fullWidth
        />
        {inSetup ? (
          <Button label={signingOut ? 'Signing out...' : 'Sign out'} variant="ghost" size="sm" onPress={() => void signOutNow()} fullWidth />
        ) : null}
      </StickyCTA>
    </View>
  );
};

export default ProviderSelection;
