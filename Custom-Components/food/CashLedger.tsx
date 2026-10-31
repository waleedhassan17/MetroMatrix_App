// CashLedger — a rider's cash for their vendor: what they hold now, and each
// entry (collected at a door, handed over at the kitchen), newest first.
// Shared by the rider's Cash tab and the vendor's rider page.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { RiderCash } from '../../types/food';
import { formatSlot, formatDayShort, dateInZone } from '../../utils/healthTime';
import { formatPKR } from '../../utils/money';
import { AppText } from '../AppText';
import { Card } from '../Card';
import { Divider } from '../Divider';
import { IonIcon } from '../Icon';

const TZ = 'Asia/Karachi';

const makeStyles = ({ space, radius }: Theme) =>
  StyleSheet.create({
    balance: { padding: space.s16, borderRadius: radius.lg, gap: space.s4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s12 },
    grow: { flex: 1, gap: space.s4 },
  });

export const CashLedger: React.FC<{ cash: RiderCash; holder: string; vendor: string }> = ({ cash, holder, vendor }) => {
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  return (
    <>
      <View style={[styles.balance, { backgroundColor: service.accentSoft }]} accessible accessibilityLabel={`${holder} holds ${formatPKR(cash.balance)} for ${vendor}`}>
        <AppText variant="small" tone="accentDeep">{`${holder} hold${holder === 'You' ? '' : 's'} for ${vendor}`}</AppText>
        <AppText variant="h1" tone="accentDeep">
          {formatPKR(cash.balance)}
        </AppText>
      </View>
      {cash.entries.length ? (
        <Card padded="horizontal">
          {cash.entries.map((e, i) => (
            <View key={e.id}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.row}>
                <IonIcon name={e.kind === 'handover' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'} size="lg" color={e.kind === 'handover' ? colors.inkMuted : service.accentDeep} />
                <View style={styles.grow}>
                  <AppText variant="bodyStrong">{e.kind === 'handover' ? `Handed to ${vendor}` : `Collected · ${e.orderCode ?? 'an order'}`}</AppText>
                  <AppText variant="caption" tone="muted">
                    {[e.at ? `${formatDayShort(dateInZone(e.at, TZ))}, ${formatSlot(e.at, TZ)}` : null, e.note].filter(Boolean).join(' · ')}
                  </AppText>
                </View>
                <AppText variant="bodyStrong" tone={e.amount < 0 ? 'muted' : 'ink'}>
                  {e.amount < 0 ? `− ${formatPKR(-e.amount)}` : `+ ${formatPKR(e.amount)}`}
                </AppText>
              </View>
            </View>
          ))}
        </Card>
      ) : null}
    </>
  );
};

export default CashLedger;
