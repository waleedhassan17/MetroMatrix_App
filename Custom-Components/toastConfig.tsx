// Toast config — react-native-toast-message rendered with tokens.
// Types: success · error · info. Pass to <Toast config={toastConfig} />.
// The tone sits in a small tinted icon well, as on InlineNotice. Toasts show
// at the bottom (AppContainer), so they never cover a page header.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ToastConfig, ToastConfigParams } from 'react-native-toast-message';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Tone = 'success' | 'error' | 'info';

const makeStyles = ({ colors, space, radius, elevation, gutter, size }: Theme) =>
  StyleSheet.create({
    well: { width: size.subTypeTile, height: size.subTypeTile, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s12,
      marginHorizontal: gutter,
      padding: space.s16,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      alignSelf: 'stretch',
      ...elevation.float,
    },
    text: { flex: 1, gap: space.s4 },
  });

const ToastCard: React.FC<ToastConfigParams<unknown> & { tone: Tone }> = ({ text1, text2, tone }) => {
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const look: Record<Tone, { icon: IconName; color: string; bg: string }> = {
    success: { icon: 'check-circle', color: colors.success, bg: colors.successSoft },
    error: { icon: 'alert-circle', color: colors.danger, bg: colors.dangerSoft },
    info: { icon: 'info', color: service.accentDeep, bg: service.accentSoft },
  };
  return (
    <View style={styles.root} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={[styles.well, { backgroundColor: look[tone].bg }]}>
        <Icon name={look[tone].icon} size="md" color={look[tone].color} />
      </View>
      <View style={styles.text}>
        {text1 ? <AppText variant="bodyStrong">{text1}</AppText> : null}
        {text2 ? (
          <AppText variant="small" tone="muted">
            {text2}
          </AppText>
        ) : null}
      </View>
    </View>
  );
};

export const toastConfig: ToastConfig = {
  success: props => <ToastCard {...props} tone="success" />,
  error: props => <ToastCard {...props} tone="error" />,
  info: props => <ToastCard {...props} tone="info" />,
};

export default toastConfig;
