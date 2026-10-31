// QuoteCard — a catering quote: its lines, the delivery fee, the total, the
// advance asked and until when it holds. Older versions show as replaced.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { Card } from '../Card';
import { Divider } from '../Divider';
import { StatusPill } from '../StatusPill';
import { formatPKR } from '../../utils/money';

export interface QuoteCardData {
  version: number;
  lines: { name: string; quantity: number; unitPrice: number; total: number }[];
  deliveryFee: number;
  total: number;
  advancePct: number;
  advance: number;
  validUntilLabel: string;
  notes: string | null;
  /** "Current", "Replaced by version 3", "Accepted", "Expired". */
  stateLabel: string;
  current: boolean;
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s8 },
    body: { gap: space.s8 },
    line: { flexDirection: 'row', gap: space.s8 },
    grow: { flex: 1 },
  });

export const QuoteCard: React.FC<{ quote: QuoteCardData; children?: React.ReactNode }> = ({ quote, children }) => {
  const styles = useStyles(makeStyles);
  const row = (label: string, value: string, strong?: boolean) => (
    <View style={styles.line}>
      <AppText variant={strong ? 'bodyStrong' : 'body'} tone={strong ? 'ink' : 'muted'} style={styles.grow}>
        {label}
      </AppText>
      <AppText variant={strong ? 'title' : 'body'}>{value}</AppText>
    </View>
  );
  return (
    <Card>
      <View style={styles.body}>
        <View style={styles.head}>
          <AppText variant="title" accessibilityRole="header">
            Quote, version {quote.version}
          </AppText>
          <StatusPill label={quote.stateLabel} tone={quote.current ? 'accent' : 'neutral'} />
        </View>
        {quote.lines.map(l => (
          <View key={`${l.name}-${l.quantity}`} style={styles.line}>
            <AppText variant="body" style={styles.grow}>
              {l.quantity} × {l.name}
            </AppText>
            <AppText variant="body">{formatPKR(l.total)}</AppText>
          </View>
        ))}
        <Divider />
        {quote.deliveryFee ? row('Delivery', formatPKR(quote.deliveryFee)) : null}
        {row('Total', formatPKR(quote.total), true)}
        {row(`Advance (${quote.advancePct}%)`, formatPKR(quote.advance))}
        <AppText variant="caption" tone="muted">
          {quote.validUntilLabel}
        </AppText>
        {quote.notes ? (
          <AppText variant="small" tone="muted">
            {quote.notes}
          </AppText>
        ) : null}
        {children}
      </View>
    </Card>
  );
};

export default QuoteCard;
