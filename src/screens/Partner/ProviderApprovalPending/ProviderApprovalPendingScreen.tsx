// ═══════════════════════════════════════════════════════
// MetroMatrix — Application Under Review (the FYP's approval-pending screen)
// ═══════════════════════════════════════════════════════
// A breathing status mark, three stats (Status · Checks Made · Next Check),
// what happens next, Check Now / Contact Support, and the review timeline.

import React, { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Linking, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useCountdown } from '@hooks/useCountdown';
import { useSignOut } from '@hooks/useSignOut';
import { providerTypeLabel } from '@models/businessModel';
import { SUPPORT_EMAIL, USE_MOCK_API } from '@/config/env';
import { haptics } from '@utils/haptics';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, IonIcon, InlineNotice, MciIcon, StatusTimeline, type IonName } from '@custom/index';
import { AuthHeader, AuthScreen, ProviderBadge } from '@components/auth/AuthChrome';
import type { Business } from '@/types';
import { selectBusiness } from '../../Auth/authSlice';
import { POLL_INTERVAL_MS, checkStatusAsync, selectProviderApprovalPending } from './providerApprovalPendingSlice';

const makeStyles = ({ colors, space, size, radius, elevation }: Theme) =>
  StyleSheet.create({
    mark: {
      alignSelf: 'center',
      width: size.avatar.xl + space.s24,
      height: size.avatar.xl + space.s24,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    status: { alignItems: 'center', gap: space.s4 },
    stats: { flexDirection: 'row', gap: space.s12 },
    stat: {
      flex: 1,
      alignItems: 'center',
      gap: space.s4,
      paddingVertical: space.s16,
      paddingHorizontal: space.s8,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceSunk,
    },
    info: {
      flexDirection: 'row',
      gap: space.s12,
      padding: space.s16,
      borderRadius: radius.md,
      borderWidth: size.hairline,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      ...elevation.input,
    },
    infoText: { flex: 1, gap: space.s4 },
    card: {
      gap: space.s16,
      padding: space.s16,
      borderRadius: radius.lg,
      borderWidth: size.hairline,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      ...elevation.raised,
    },
    actions: { gap: space.s12 },
  });

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="title" numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
};

const Info: React.FC<{ icon: IonName; tint: string; title: string; text: string }> = ({ icon, tint, title, text }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.info}>
      <IonIcon name={icon} size="lg" color={tint} />
      <View style={styles.infoText}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="body" tone="muted">
          {text}
        </AppText>
      </View>
    </View>
  );
};

/** A slow breath on the mark; still under reduced motion. */
const useBreath = () => {
  const { motion } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(reduced => {
        if (cancelled || reduced) return;
        const ease = Easing.inOut(Easing.sin);
        const { duration, scale: peak } = motion.breath;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(scale, { toValue: peak, duration, easing: ease, useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1, duration, easing: ease, useNativeDriver: true }),
          ]),
        );
        loop.start();
      });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [scale, motion.breath]);
  return scale;
};

const ProviderApprovalPendingScreen: React.FC = () => {
  const business = useAppSelector(selectBusiness);
  if (!business) return null;
  // The accent is the provider's service, so everything renders inside its scope.
  return (
    <ServiceScope service={business.serviceType}>
      <PendingContent business={business} />
    </ServiceScope>
  );
};

const PendingContent: React.FC<{ business: Business }> = ({ business }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  const s = useAppSelector(selectProviderApprovalPending);
  const nextIn = useCountdown(s.nextCheckAt);
  const { confirmSignOut } = useSignOut();
  const scale = useBreath();

  useFocusEffect(
    useCallback(() => {
      dispatch(checkStatusAsync({ manual: false }));
      const id = setInterval(() => dispatch(checkStatusAsync({ manual: false })), POLL_INTERVAL_MS);
      return () => clearInterval(id);
    }, [dispatch]),
  );

  const submitted = business.submittedAt ? dayjs(business.submittedAt).format('D MMM, h:mm a') : 'Just now';

  const checkNow = async () => {
    const r = await dispatch(checkStatusAsync({ manual: true }));
    if (checkStatusAsync.rejected.match(r)) haptics.warning();
  };

  return (
    <AuthScreen>
      <AuthHeader
        title="Application Under Review"
        badge={<ProviderBadge label={providerTypeLabel(business.subType)} service={business.serviceType} />}
        subtitle="Your profile is being reviewed by our admin team"
      />
      <Animated.View style={[styles.mark, { backgroundColor: service.accentSoft, transform: [{ scale }] }]}>
        <MciIcon name="clipboard-check-outline" size="hero" color={service.accent} />
      </Animated.View>
      <View style={styles.status} accessibilityLiveRegion="polite">
        <AppText variant="h2">{s.checking ? 'Checking status...' : 'Waiting for approval'}</AppText>
        <AppText variant="body" tone="muted" align="center">
          {business.name}
        </AppText>
      </View>

      <View style={styles.stats}>
        <Stat label="Status" value="Pending" />
        <Stat label="Checks Made" value={String(s.checks)} />
        <Stat label="Next Check" value={s.checking ? '...' : `${nextIn}s`} />
      </View>

      {s.error.message ? <InlineNotice tone="warning" message={s.error.message} /> : null}

      <Info
        icon="information-circle-outline"
        tint={service.accent}
        title="What happens next?"
        text="Our admin team will review your profile and documents. You'll receive an email once your status is updated."
      />
      <Info
        icon="time-outline"
        tint={colors.warning}
        title="Expected Timeline"
        text={
          USE_MOCK_API
            ? 'Demo mode: applications are approved automatically about 30 seconds after you submit.'
            : 'Approval typically takes 24-48 hours. We will keep you updated throughout the process.'
        }
      />

      <View style={styles.actions}>
        <Button label={s.manual ? 'Checking...' : 'Check Now'} onPress={checkNow} loading={s.manual} disabled={s.checking} fullWidth />
        <Button
          label="Contact Support"
          variant="secondary"
          leftIcon="mail"
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Application%20review`)}
          fullWidth
        />
      </View>

      <View style={styles.card}>
        <AppText variant="title">Review Timeline</AppText>
        <StatusTimeline
          steps={[
            { label: 'Application Submitted', description: submitted, state: 'done' },
            { label: 'Under Review', description: 'In progress...', state: 'current' },
            { label: 'Approval Decision', description: 'Pending', state: 'upcoming' },
          ]}
        />
      </View>
      <Button label="Sign out" variant="ghost" onPress={confirmSignOut} />
    </AuthScreen>
  );
};

export default ProviderApprovalPendingScreen;
