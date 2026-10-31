// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth chrome (the FYP's sign-in / sign-up frame)
// ═══════════════════════════════════════════════════════
// Every FYP auth screen shares one frame: white, 24 pt gutters, content
// starting ~50 pt down, a centred header ("MetroMatrix" in the brand green,
// a 24 pt title, a muted one-line subtitle), then the Sign In / Sign Up tab
// switcher. These pieces are that frame; screens compose them.

import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ServiceScope, useStyles, useTheme, type ServiceName, type Theme } from '../../theme';
import { AppText } from '../../Custom-Components/AppText';
import { IonIcon } from '../../Custom-Components/Icon';
import { SegmentTabs } from '../../Custom-Components/SegmentTabs';

const makeStyles = ({ colors, space, gutter, size, radius }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    flex: { flex: 1 },
    content: { flexGrow: 1, paddingHorizontal: gutter, paddingBottom: space.s40, gap: space.s24 },
    back: {
      width: size.touch,
      height: size.touch,
      marginLeft: -space.s8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: { alignItems: 'center', gap: space.s8, marginTop: space.s8 },
    logo: { marginBottom: space.s8 },
    badge: {
      paddingHorizontal: space.s16,
      paddingVertical: space.s4,
      borderRadius: radius.xl,
      borderWidth: size.border,
    },
  });

// ─── Frame ────────────────────────────────────────────
export const AuthScreen: React.FC<{
  children: React.ReactNode;
  onBack?: () => void;
  footer?: React.ReactNode;
}> = ({ children, onBack, footer }) => {
  const styles = useStyles(makeStyles);
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: onBack ? space.s8 : space.s40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {onBack ? (
            <Pressable onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
              <IonIcon name="arrow-back" size="lg" color={colors.ink} />
            </Pressable>
          ) : null}
          {children}
        </ScrollView>
        {footer}
      </KeyboardAvoidingView>
    </View>
  );
};

// ─── Header ───────────────────────────────────────────
export const AuthHeader: React.FC<{
  title: string;
  subtitle?: string;
  /** Shown between title and subtitle (the provider type). */
  badge?: React.ReactNode;
  /** Hide the "MetroMatrix" logo line (reset-password steps). */
  hideLogo?: boolean;
}> = ({ title, subtitle, badge, hideLogo }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.header}>
      {hideLogo ? null : (
        <AppText variant="logo" tone="brand" style={styles.logo} accessibilityRole="header">
          MetroMatrix
        </AppText>
      )}
      <AppText variant="screenTitle" align="center" accessibilityRole={hideLogo ? 'header' : undefined}>
        {title}
      </AppText>
      {badge}
      {subtitle ? (
        <AppText variant="body" tone="muted" align="center">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
};

/** The provider type the user picked on Provider Selection, as a soft pill. */
export const ProviderBadge: React.FC<{ label: string; service: ServiceName }> = ({ label, service }) => (
  <ServiceScope service={service}>
    <ProviderBadgeInner label={label} />
  </ServiceScope>
);

const ProviderBadgeInner: React.FC<{ label: string }> = ({ label }) => {
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  return (
    <View
      style={[styles.badge, { backgroundColor: service.accentSoft, borderColor: service.accentLine }]}
      accessibilityLabel={`Registering as ${label}`}>
      <AppText variant="small" tone="accentDeep">
        {label}
      </AppText>
    </View>
  );
};

// ─── Sign In / Sign Up switcher ───────────────────────
export type AuthTab = 'signin' | 'signup';

export const AuthTabs: React.FC<{ value: AuthTab; onChange: (tab: AuthTab) => void; disabled?: boolean }> = ({
  value,
  onChange,
  disabled,
}) => (
  <SegmentTabs
    options={[
      { key: 'signin', label: 'Sign In' },
      { key: 'signup', label: 'Sign Up' },
    ]}
    value={value}
    onChange={tab => {
      if (!disabled && tab !== value) onChange(tab);
    }}
    accessibilityLabel="Sign in or sign up"
  />
);
