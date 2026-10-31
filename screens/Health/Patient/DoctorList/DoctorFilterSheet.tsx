// ═══════════════════════════════════════════════════════
// MetroMatrix — Sort & filter (Doctor list)
// ═══════════════════════════════════════════════════════
// Sort, how you'll be seen, fee, experience, rating, the doctor's gender,
// language and area. "Show N doctors" says what the choice will find before
// you apply it.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../../../../theme/index';
import { AppText, Button, ChoiceChip, Sheet, TextAction, TextField } from '../../../../Custom-Components/index';
import { EXPERIENCE_FLOORS, FEE_CAPS, FILTER_LANGUAGES, RATING_FLOORS, SORTS } from '../../../../models/health/filterModel';
import type { DoctorQuery } from '../../../../types';
import { formatPKR } from '../../../../utils/money';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    group: { gap: space.s8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.group}>
      <AppText variant="label">{title}</AppText>
      <View style={styles.chips}>{children}</View>
    </View>
  );
};

export const DoctorFilterSheet: React.FC<{
  visible: boolean;
  draft: DoctorQuery;
  total: number | null;
  onChange: (patch: Partial<DoctorQuery>) => void;
  onReset: () => void;
  onApply: () => void;
  onClose: () => void;
}> = ({ visible, draft: d, total, onChange, onReset, onApply, onClose }) => (
  <Sheet
    visible={visible}
    onClose={onClose}
    title="Sort and filter"
    footer={
      <Button
        label={total === null ? 'Show doctors' : total === 0 ? 'No doctors match' : `Show ${total} ${total === 1 ? 'doctor' : 'doctors'}`}
        onPress={onApply}
        disabled={total === 0}
        fullWidth
      />
    }>
    <TextAction label="Clear all" icon="refresh" onPress={onReset} />
    <Group title="Sort by">
      {SORTS.map(s => (
        <ChoiceChip key={s.key} label={s.label} selected={d.sort === s.key} onPress={() => onChange({ sort: s.key })} />
      ))}
    </Group>
    <Group title="How you'll be seen">
      <ChoiceChip label="Any" selected={!d.kind} onPress={() => onChange({ kind: null })} />
      <ChoiceChip label="Video consultation" icon="videocam-outline" selected={d.kind === 'video'} onPress={() => onChange({ kind: 'video' })} />
      <ChoiceChip label="Clinic visit" icon="business-outline" selected={d.kind === 'clinic'} onPress={() => onChange({ kind: 'clinic' })} />
    </Group>
    <Group title="Availability">
      <ChoiceChip label="Any day" selected={!d.availableToday} onPress={() => onChange({ availableToday: false })} />
      <ChoiceChip label="Available today" selected={!!d.availableToday} onPress={() => onChange({ availableToday: true })} />
    </Group>
    <Group title="Fee">
      <ChoiceChip label="Any" selected={d.maxFee === null || d.maxFee === undefined} onPress={() => onChange({ maxFee: null })} />
      {FEE_CAPS.map(f => (
        <ChoiceChip key={f} label={`Up to ${formatPKR(f)}`} selected={d.maxFee === f} onPress={() => onChange({ maxFee: f })} />
      ))}
    </Group>
    <Group title="Experience">
      <ChoiceChip label="Any" selected={!d.minYears} onPress={() => onChange({ minYears: null })} />
      {EXPERIENCE_FLOORS.map(y => (
        <ChoiceChip key={y} label={`${y}+ years`} selected={d.minYears === y} onPress={() => onChange({ minYears: y })} />
      ))}
    </Group>
    <Group title="Rating">
      <ChoiceChip label="Any" selected={!d.minRating} onPress={() => onChange({ minRating: null })} />
      {RATING_FLOORS.map(r => (
        <ChoiceChip key={r} label={`${r}+ stars`} icon="star" selected={d.minRating === r} onPress={() => onChange({ minRating: r })} />
      ))}
    </Group>
    <Group title="Doctor">
      <ChoiceChip label="Any" selected={!d.gender} onPress={() => onChange({ gender: null })} />
      <ChoiceChip label="Female doctor" selected={d.gender === 'female'} onPress={() => onChange({ gender: 'female' })} />
      <ChoiceChip label="Male doctor" selected={d.gender === 'male'} onPress={() => onChange({ gender: 'male' })} />
    </Group>
    <Group title="Speaks">
      <ChoiceChip label="Any language" selected={!d.language} onPress={() => onChange({ language: null })} />
      {FILTER_LANGUAGES.map(l => (
        <ChoiceChip key={l} label={l} selected={d.language === l} onPress={() => onChange({ language: l })} />
      ))}
    </Group>
    <TextField
      label="Area (clinic visits)"
      value={d.area ?? ''}
      onChangeText={t => onChange({ area: t.trim() ? t : null })}
      placeholder="Gulberg, DHA, Clifton…"
      icon="location-outline"
      clearable
      autoCorrect={false}
    />
  </Sheet>
);

export default DoctorFilterSheet;
