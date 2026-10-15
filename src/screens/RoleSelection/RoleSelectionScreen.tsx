// ═══════════════════════════════════════════════════════
// MetroMatrix — Role Selection (ported from the FYP app)
// ═══════════════════════════════════════════════════════
// The first question after onboarding: are you offering services or using
// them? "Service Provider" → Provider Selection; "User" → Sign In (staff sign
// in there too, as in the FYP).

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch } from '@hooks/useReduxHooks';
import { useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, IonIcon } from '@custom/index';
import { ChoiceCard } from '@components/auth/ChoiceCard';
import type { AuthUserType, RootStackParamList } from '@/types';
import { selectRole } from './roleSelectionSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'RoleSelection'>;

const makeStyles = ({ colors, space, gutter, size, radius, elevation }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    header: { alignItems: 'center', gap: space.s8, paddingHorizontal: gutter, paddingTop: space.s40, paddingBottom: space.s32 },
    scroll: { flexGrow: 1, paddingHorizontal: gutter, paddingBottom: space.s32 },
    content: { flex: 1, justifyContent: 'center', maxWidth: size.prose, alignSelf: 'center', width: '100%' },
    welcome: { alignItems: 'center', gap: space.s12, marginBottom: space.s40, paddingHorizontal: space.s16 },
    cards: { gap: space.s16, marginBottom: space.s32 },
    help: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s12,
      padding: space.s16,
      borderRadius: radius.lg,
      borderWidth: size.border,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      ...elevation.input,
    },
  });

const RoleSelectionScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const insets = useSafeAreaInsets();

  const choose = (role: AuthUserType) => {
    dispatch(selectRole(role));
    if (role === 'provider') navigation.navigate('ProviderSelection');
    else navigation.navigate('SignIn');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <AppText variant="logo" tone="brand" accessibilityRole="header">
          MetroMatrix
        </AppText>
        <AppText variant="body" tone="muted" align="center">
          Choose your role to get started
        </AppText>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.welcome}>
            <AppText variant="screenTitle" align="center">
              Welcome!
            </AppText>
            <AppText variant="body" tone="muted" align="center">
              Please select your role to continue with the appropriate registration process.
            </AppText>
          </View>

          <View style={styles.cards}>
            <ChoiceCard
              icon={<IonIcon name="construct" size="xl" color={colors.roleProvider} />}
              iconBg={colors.roleProviderSoft}
              title="Service Provider"
              description="Offer your services to customers in your area"
              onPress={() => choose('provider')}
            />
            <ChoiceCard
              icon={<IonIcon name="person" size="xl" color={service.highlight} />}
              iconBg={service.accentSoft}
              title="User"
              description="Discover local food vendors, book doctors and shop from trusted sellers"
              onPress={() => choose('user')}
            />
          </View>

          <View style={styles.help}>
            <IonIcon name="help-circle-outline" size="md" color={colors.roleProvider} />
            <AppText variant="small" tone="muted" style={{ flex: 1 }}>
              Need help choosing? Contact our support team anytime.
            </AppText>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default RoleSelectionScreen;
