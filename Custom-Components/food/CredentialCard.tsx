// ═══════════════════════════════════════════════════════
// CredentialCard — a rider's username and password, shown once
// ═══════════════════════════════════════════════════════
// After a vendor adds a rider (or resets their password). The password is
// never shown again: Copy puts both lines on the clipboard, Share opens the
// phone's share sheet (WhatsApp, SMS). The FinMatrix pattern, with Share
// that really shares.

import React, { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { InlineNotice } from '../InlineNotice';
import { useStyles, type Theme } from '../../theme';
import type { RiderCredential } from '../../models/food';

const makeStyles = ({ colors, space, radius, size }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s16 },
    box: { gap: space.s12, padding: space.s16, borderRadius: radius.lg, borderWidth: size.border, borderColor: colors.line, backgroundColor: colors.surfaceSunk },
    line: { gap: space.s4 },
    actions: { flexDirection: 'row', gap: space.s12 },
    grow: { flex: 1 },
  });

/** The words a vendor sends their rider. */
export const credentialMessage = (riderName: string, c: RiderCredential) =>
  `${riderName}, you can deliver for us on MetroMatrix.\n1. Install MetroMatrix and choose Rider.\n2. Username: ${c.username}\n3. Password: ${c.password}`;

export const CredentialCard: React.FC<{ riderName: string; credential: RiderCredential }> = ({ riderName, credential }) => {
  const styles = useStyles(makeStyles);
  const [copied, setCopied] = useState(false);
  const message = credentialMessage(riderName, credential);
  return (
    <View style={styles.root}>
      <InlineNotice tone="warning" message="This password is shown only once. Send it to the rider now; to change it later, reset it." />
      <View style={styles.box} accessible accessibilityLabel={`Username ${credential.username}. Password ${credential.password.split('').join(' ')}`}>
        <View style={styles.line}>
          <AppText variant="small" tone="muted">
            Username
          </AppText>
          <AppText variant="title" selectable>
            {credential.username}
          </AppText>
        </View>
        <View style={styles.line}>
          <AppText variant="small" tone="muted">
            Password
          </AppText>
          <AppText variant="title" selectable>
            {credential.password}
          </AppText>
        </View>
      </View>
      <View style={styles.actions}>
        <View style={styles.grow}>
          <Button
            label={copied ? 'Copied' : 'Copy'}
            leftIcon={copied ? 'checkmark' : 'copy-outline'}
            variant="secondary"
            onPress={async () => {
              await Clipboard.setStringAsync(message).catch(() => undefined);
              setCopied(true);
            }}
            fullWidth
          />
        </View>
        <View style={styles.grow}>
          <Button label="Share" leftIcon="share-social-outline" onPress={() => void Share.share({ message }).catch(() => undefined)} fullWidth />
        </View>
      </View>
    </View>
  );
};

export default CredentialCard;
