// PatientPicker — who the appointment is for: Me or a family member, each an
// avatar with their first name and relation under it (the chosen one ringed
// in the accent), and "Add" to add someone without leaving.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { FamilyMember } from '../../models/health';
import { relationLabel } from '../../models/health/familyMemberModel';
import { AppText } from '../AppText';
import { Avatar } from '../Avatar';
import { IconWell } from '../IconWell';

const makeStyles = ({ space, size, radius, gutter }: Theme) =>
  StyleSheet.create({
    bleed: { marginHorizontal: -gutter },
    row: { paddingHorizontal: gutter, gap: space.s16 },
    person: { width: size.well.lg + space.s16, alignItems: 'center', gap: space.s4 },
    ring: { padding: size.focusBorder, borderRadius: radius.pill, borderWidth: size.focusBorder, borderColor: 'transparent' },
  });

export const PatientPicker: React.FC<{
  family: FamilyMember[];
  /** null = me. */
  selected: string | null;
  onSelect: (memberId: string | null) => void;
  onAdd?: () => void;
  /** The account holder's name, for their own avatar's initials. */
  meName?: string | null;
}> = ({ family, selected, onSelect, onAdd, meName }) => {
  const styles = useStyles(makeStyles);
  const { service, opacity } = useTheme();
  const people: { id: string | null; name: string; caption: string }[] = [
    { id: null, name: meName || 'Me', caption: 'Me' },
    ...family.map(m => ({ id: m.id, name: m.name, caption: `${m.name.split(' ')[0]}` + (m.relation ? ` · ${relationLabel(m.relation)}` : '') })),
  ];
  return (
    <View style={styles.bleed}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Who is the appointment for">
        {people.map(p => {
          const on = selected === p.id;
          return (
            <Pressable
              key={p.id ?? 'me'}
              onPress={() => onSelect(p.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={p.id ? `Book for ${p.name}` : 'Book for me'}
              style={({ pressed }) => [styles.person, pressed && { opacity: opacity.pressed }]}>
              <View style={[styles.ring, on && { borderColor: service.accent }]}>
                <Avatar name={p.name} size="md" />
              </View>
              <AppText variant={on ? 'chip' : 'caption'} tone={on ? 'accentDeep' : 'muted'} align="center" numberOfLines={2}>
                {p.caption}
              </AppText>
            </Pressable>
          );
        })}
        {onAdd ? (
          <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel="Add a family member" style={({ pressed }) => [styles.person, pressed && { opacity: opacity.pressed }]}>
            <View style={styles.ring}>
              <IconWell icon="add" size="md" />
            </View>
            <AppText variant="caption" tone="muted" align="center">
              Add
            </AppText>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
};

export default PatientPicker;
