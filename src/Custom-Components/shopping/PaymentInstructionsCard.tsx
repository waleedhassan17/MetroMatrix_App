// ═══════════════════════════════════════════════════════
// PaymentInstructionsCard — where to send a transfer, and by when
// ═══════════════════════════════════════════════════════
// MetroMatrix never touches the money: the customer pays the store's own
// account. The card gives the exact amount and account (each copyable), the
// time left, and the "I've paid" step. A rejected proof says why.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { useStyles, useTheme, type Theme } from '../../theme';
import { accountKindLabel } from '../../models/shopping/storeModel';
import type { PaymentInstructions, PaymentProof, PaymentStatus } from '../../types/shopping';
import { timeLeft } from '../../utils/dates';
import { haptics } from '../../utils/haptics';
import { formatPKR } from '../../utils/money';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { Card } from '../Card';
import { Divider } from '../Divider';
import { IonIcon } from '../Icon';
import { InlineNotice } from '../InlineNotice';

export interface PaymentInstructionsCardProps {
  instructions: PaymentInstructions;
  status: PaymentStatus;
  proof: PaymentProof | null;
  onPaid?: () => void;
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    rowText: { flex: 1, gap: space.s4 },
  });

const CopyRow: React.FC<{ label: string; value: string; display?: string }> = ({ label, value, display }) => {
  const styles = useStyles(makeStyles);
  const { service, opacity } = useTheme();
  const copy = async () => {
    await Clipboard.setStringAsync(value);
    haptics.press();
    Toast.show({ type: 'success', text1: `${label} copied` });
  };
  return (
    <Pressable
      onPress={copy}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${display ?? value}. Copy`}
      style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}>
      <View style={styles.rowText}>
        <AppText variant="caption" tone="muted">
          {label}
        </AppText>
        <AppText variant="bodyStrong" selectable>
          {display ?? value}
        </AppText>
      </View>
      <IonIcon name="copy-outline" size="md" color={service.accentDeep} />
    </Pressable>
  );
};

export const PaymentInstructionsCard: React.FC<PaymentInstructionsCardProps> = ({ instructions, status, proof, onPaid }) => {
  const left = timeLeft(instructions.payBy);
  const owed = status === 'awaiting_transfer' || status === 'proof_rejected';
  return (
    <Card>
      <View>
        <AppText variant="title">
          {owed ? `Send ${formatPKR(instructions.amount)}` : status === 'proof_submitted' ? 'Payment in review' : 'Payment'}
        </AppText>
        <AppText variant="small" tone="muted">
          {owed
            ? `${left ? `${left}. ` : ''}Pay the store directly, then share the transaction ID.`
            : status === 'proof_submitted'
              ? `The store is checking transaction ${proof?.transactionId ?? ''}.`
              : 'The store has confirmed your payment.'}
        </AppText>
      </View>
      {status === 'proof_rejected' && proof?.rejectionReason ? (
        <InlineNotice tone="error" title="The store couldn't find your payment" message={proof.rejectionReason} />
      ) : null}
      {owed ? (
        <>
          <Divider />
          <CopyRow label="Amount" value={String(instructions.amount)} display={formatPKR(instructions.amount)} />
          <CopyRow label={accountKindLabel(instructions.kind)} value={instructions.accountNumber} />
          <CopyRow label="Account title" value={instructions.accountTitle} />
          {instructions.bankName ? <CopyRow label="Bank" value={instructions.bankName} /> : null}
          {onPaid ? <Button label="I've paid" onPress={onPaid} leftIcon="checkmark-circle-outline" fullWidth /> : null}
        </>
      ) : null}
    </Card>
  );
};

export default PaymentInstructionsCard;
