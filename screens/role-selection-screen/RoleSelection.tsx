// ═══════════════════════════════════════════════════════
// MetroMatrix — Role Selection (ported from the FYP app)
// ═══════════════════════════════════════════════════════
// The first question after onboarding: are you offering services or using
// them? "Service Provider" → Provider Selection; "User" → Sign In (staff sign
// in there too, as in the FYP); "Rider" → Rider Sign In (riders a Food Court
// vendor added, with the username the vendor gave them).

import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch } from '../../hooks/useReduxHooks';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, IonIcon } from '../../Custom-Components/index';
import { ChoiceCard } from '../../Components/auth/ChoiceCard';
import type { AuthUserType, RootStackParamList } from '../../models';
import { selectRole } from './roleSelectionSlice';
import { SUPPORT_EMAIL } from '../../config/env';

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

/** Inside Food Court's scope (its selected line and check): riders deliver for its vendors. */
const RiderChoice: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const { colors } = useTheme();
  return (
    <ChoiceCard
      icon={<IonIcon name="bicycle-outline" size="xl" color={colors.inkMuted} />}
      title="Rider"
      description="Deliver orders for a Food Court vendor who added you"
      onPress={onPress}
    />
  );
};

const RoleSelection: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const choose = (role: AuthUserType) => {
    dispatch(selectRole(role));
    if (role === 'provider') navigation.navigate('ProviderSelection');
    else if (role === 'rider') navigation.navigate('RiderSignIn');
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
              icon={<IonIcon name="construct-outline" size="xl" color={colors.inkMuted} />}
              title="Service Provider"
              description="Offer your services to customers in your area"
              onPress={() => choose('provider')}
            />
            <ChoiceCard
              icon={<IonIcon name="person-outline" size="xl" color={colors.inkMuted} />}
              title="User"
              description="Discover local food vendors, book doctors and shop from trusted sellers"
              onPress={() => choose('user')}
            />
            <ServiceScope service="food">
              <RiderChoice onPress={() => choose('rider')} />
            </ServiceScope>
          </View>

          <Pressable
            style={styles.help}
            onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Help%20choosing%20a%20role`)}
            accessibilityRole="link"
            accessibilityLabel="Need help choosing? Email our support team"
            accessibilityHint={SUPPORT_EMAIL}>
            <IonIcon name="help-circle-outline" size="md" color={colors.inkMuted} />
            <AppText variant="small" tone="muted" style={{ flex: 1 }}>
              Need help choosing?{' '}
              <AppText variant="small" tone="accentDeep">
                Contact our support team
              </AppText>{' '}
              anytime.
            </AppText>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
};

export default RoleSelection;
