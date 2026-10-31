// TransferCard — paying a Food order by transfer: the exact amount and the
// kitchen's own accounts (each copyable), the minutes left to send it, and
// the receipt step. MetroMatrix never holds the money.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../../theme';
import { useCountdown } from '../../hooks/useCountdown';
import { accountKindLabel } from '../../models/shopping/storeModel';
import { clock } from '../../models/food/foodStatusModel';
import type { FoodPaymentStatus, FoodTransferAccount } from '../../types/food';
import type { PaymentAccountKind } from '../../types/shopping';
import { formatPKR } from '../../utils/money';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { Card } from '../Card';
import { Divider } from '../Divider';
import { InlineNotice } from '../InlineNotice';
import { CopyRow } from '../shopping/PaymentInstructionsCard';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    head: { gap: space.s4 },
  });

export interface TransferCardProps {
  vendorName: string;
  amount: number;
  accounts: FoodTransferAccount[];
  status: FoodPaymentStatus;
  payBy: string | null;
  reference?: string | null;
  rejectedReason?: string | null;
  onSendReceipt?: () => void;
  /** What lapses without the transfer: an order, or a Bachat Box reservation. */
  holds?: 'order' | 'reservation';
}

export const TransferCard: React.FC<TransferCardProps> = ({ vendorName, amount, accounts, status, payBy, reference, rejectedReason, onSendReceipt, holds = 'order' }) => {
  const styles = useStyles(makeStyles);
  const left = useCountdown(payBy ? Date.parse(payBy) : 0);
  const owed = status === 'awaiting_transfer';
  return (
    <Card selected={owed}>
      <View style={styles.head}>
        <AppText variant="title">{owed ? `Send ${formatPKR(amount)} to ${vendorName}` : status === 'proof_submitted' ? 'Receipt sent' : status === 'paid' ? 'Paid' : 'Payment'}</AppText>
        <AppText variant="small" tone={owed && left > 0 && left < 180 ? 'warning' : 'muted'}>
          {owed
            ? payBy && left > 0
              ? `${clock(left)} left. Pay the kitchen directly, then send the receipt — or the ${holds} is cancelled.`
              : 'Pay the kitchen directly, then send the receipt.'
            : status === 'proof_submitted'
              ? `${vendorName} is checking transfer ${reference ?? ''}.`.replace(' .', '.')
              : status === 'paid'
                ? `${vendorName} has confirmed your transfer.`
                : 'Nothing to pay.'}
        </AppText>
      </View>
      {rejectedReason && owed ? <InlineNotice tone="warning" title={`${vendorName} couldn’t find your transfer`} message={rejectedReason} /> : null}
      {owed ? (
        <>
          <Divider />
          <CopyRow label="Amount" value={String(amount)} display={formatPKR(amount)} />
          {accounts.map(a => (
            <View key={`${a.kind}:${a.number}`}>
              <Divider />
              <CopyRow label={accountKindLabel(a.kind as PaymentAccountKind)} value={a.number} />
              <CopyRow label="Account title" value={a.title} />
              {a.bankName ? <CopyRow label="Bank" value={a.bankName} /> : null}
            </View>
          ))}
          {onSendReceipt ? <Button label="I’ve sent it — add the receipt" onPress={onSendReceipt} leftIcon="receipt-outline" fullWidth /> : null}
        </>
      ) : null}
    </Card>
  );
};

export default TransferCard;
