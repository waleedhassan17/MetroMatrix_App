// PrepList — the prep sheet as a checklist: groups (Meat and poultry,
// Vegetables …), each line with its quantity and what it is for, a tick to
// mark it done, and Share (as plain text: WhatsApp reads it well).

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { Checkbox } from '../Checkbox';
import { Divider } from '../Divider';

export interface PrepListGroup {
  key: string;
  title: string;
  lines: { id: string; name: string; qtyLabel: string; sub?: string | null }[];
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s16 },
    group: { gap: space.s4 },
    line: { paddingVertical: space.s4 },
    label: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    text: { flex: 1, gap: space.s4 },
  });

export const PrepList: React.FC<{ groups: PrepListGroup[]; done: Record<string, boolean>; onToggle: (id: string) => void; onShare?: () => void; shareLabel?: string }> = ({
  groups,
  done,
  onToggle,
  onShare,
  shareLabel = 'Share the list',
}) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.root}>
      {groups.map(g => (
        <View key={g.key} style={styles.group}>
          <AppText variant="overline" tone="muted" accessibilityRole="header">
            {g.title}
          </AppText>
          {g.lines.map((l, n) => (
            <React.Fragment key={l.id}>
              {n > 0 ? <Divider /> : null}
              <View style={styles.line}>
                <Checkbox
                  checked={!!done[l.id]}
                  onToggle={() => onToggle(l.id)}
                  accessibilityLabel={`${l.name}, ${l.qtyLabel}${l.sub ? `, ${l.sub}` : ''}`}
                  label={
                    <View style={styles.label}>
                      <View style={styles.text}>
                        <AppText variant="bodyStrong" tone={done[l.id] ? 'muted' : 'ink'}>
                          {l.name}
                        </AppText>
                        {l.sub ? (
                          <AppText variant="caption" tone="muted" numberOfLines={2}>
                            {l.sub}
                          </AppText>
                        ) : null}
                      </View>
                      <AppText variant="title" tone={done[l.id] ? 'muted' : 'ink'}>
                        {l.qtyLabel}
                      </AppText>
                    </View>
                  }
                />
              </View>
            </React.Fragment>
          ))}
        </View>
      ))}
      {onShare ? <Button label={shareLabel} variant="secondary" leftIcon="share-outline" onPress={onShare} fullWidth /> : null}
    </View>
  );
};

export default PrepList;
