// InlineNotice — a server message in the flow of a form, with one optional
// action ("Go to partner sign-in"). Announced to screen readers.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText, type TextTone } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

export type NoticeTone = 'error' | 'info' | 'success' | 'warning';

export interface InlineNoticeProps {
  tone?: NoticeTone;
  title?: string;
  message: string;
  action?: { label: string; onPress: () => void };
}

const makeStyles = ({ space, radius }: Theme) =>
  StyleSheet.create({
    root: { flexDirection: 'row', gap: space.s12, padding: space.s16, borderRadius: radius.md },
    body: { flex: 1, gap: space.s4, alignItems: 'flex-start' },
  });

export const InlineNotice: React.FC<InlineNoticeProps> = ({ tone = 'error', title, message, action }) => {
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const look: Record<NoticeTone, { bg: string; fg: string; icon: IconName; text: TextTone }> = {
    error: { bg: colors.dangerSoft, fg: colors.danger, icon: 'alert-circle', text: 'danger' },
    warning: { bg: colors.warningSoft, fg: colors.warning, icon: 'alert-triangle', text: 'warning' },
    success: { bg: colors.successSoft, fg: colors.success, icon: 'check-circle', text: 'success' },
    info: { bg: service.accentSoft, fg: service.accentDeep, icon: 'info', text: 'accentDeep' },
  };
  const l = look[tone];
  return (
    <View
      style={[styles.root, { backgroundColor: l.bg }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite">
      <Icon name={l.icon} size="md" color={l.fg} />
      <View style={styles.body}>
        {title ? (
          <AppText variant="bodyStrong" tone={l.text}>
            {title}
          </AppText>
        ) : null}
        <AppText variant="small" tone={l.text}>
          {message}
        </AppText>
        {action ? <Button label={action.label} variant="ghost" size="sm" onPress={action.onPress} /> : null}
      </View>
    </View>
  );
};

export default InlineNotice;
