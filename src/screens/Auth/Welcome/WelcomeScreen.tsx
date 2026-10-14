// ═══════════════════════════════════════════════════════
// MetroMatrix — Welcome
// ═══════════════════════════════════════════════════════
// The fork in the road: customers, business owners, and (quietly) staff.
// Stateless — every choice is a navigation, so there is no slice.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useStyles, type Theme } from '@theme/index';
import { AppText, Button, ScreenShell, TextLink } from '@custom/index';
import type { RootStackParamList } from '@/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const makeStyles = ({ space, colors, size, radius }: Theme) =>
  StyleSheet.create({
    body: { flex: 1, justifyContent: 'space-between', paddingVertical: space.s24 },
    brand: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    mark: {
      width: size.logoMark,
      height: size.logoMark,
      borderRadius: radius.md,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hero: { gap: space.s16 },
    actions: { gap: space.s12 },
  });

const WelcomeScreen: React.FC<Props> = ({ navigation }) => {
  const styles = useStyles(makeStyles);
  return (
    <ScreenShell scroll={false}>
      <View style={styles.body}>
        <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel="MetroMatrix">
          <View style={styles.mark}>
            <AppText variant="title" tone="onBrand">
              M
            </AppText>
          </View>
          <AppText variant="h2">MetroMatrix</AppText>
        </View>

        <View style={styles.hero}>
          <AppText variant="display">Your city, without the middleman.</AppText>
          <AppText variant="body" tone="muted">
            Shops, doctors and kitchens near you. Zero commission, always.
          </AppText>
        </View>

        <View style={styles.actions}>
          <Button
            label="Continue as customer"
            onPress={() => navigation.navigate('CustomerSignIn')}
            size="lg"
            fullWidth
          />
          <Button
            label="I run a business"
            variant="secondary"
            onPress={() => navigation.navigate('PartnerSignIn')}
            size="lg"
            fullWidth
          />
          <TextLink lead="MetroMatrix team?" label="Staff sign-in" onPress={() => navigation.navigate('AdminSignIn')} />
          {__DEV__ ? (
            <Button label="Design gallery" variant="ghost" size="sm" onPress={() => navigation.navigate('DesignGallery')} />
          ) : null}
        </View>
      </View>
    </ScreenShell>
  );
};

export default WelcomeScreen;
