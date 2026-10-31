// ═══════════════════════════════════════════════════════
// MetroMatrix — Health search
// ═══════════════════════════════════════════════════════
// The keyboard comes up at once. Before you type: your recent searches, then
// the specialties in your city (each in its own colour). As you type (after
// a short pause): doctors, specialties and conditions, in three groups —
// "pimples" finds Acne and the dermatologists.

import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { useDebouncedValue } from '../../../../hooks/usePagedList';
import { useHealthNav } from '../../../../hooks/useHealth';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import { AppText, Divider, IconButton, IonIcon, PageHeader, type IonName } from '../../../../Custom-Components/index';
import { SearchField } from '../../../../Components/shopping/ShopParts';
import {
  addRecentHealthSearch,
  clearRecentHealthSearches,
  removeRecentHealthSearch,
  selectRecentHealthSearches,
} from '../../../../store/preferencesSlice';
import type { HomeStackParamList } from '../../../../types';
import { homeSpecialties } from '../../../../models/health/homeModel';
import { selectHealthHome } from '../HealthHome/healthHomeSlice';
import { healthSuggestAsync, selectHealthSearch, setHealthQuery } from './healthSearchSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'HealthSearch'>;

const makeStyles = ({ colors, space, size, radius, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: {
      paddingHorizontal: gutter,
      paddingTop: space.s16,
      paddingBottom: space.s40,
      gap: space.s24,
    },
    group: { gap: space.s4 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s12,
      minHeight: size.touch,
      paddingVertical: space.s8,
    },
    rowText: { flex: 1, gap: space.s0 },
    well: {
      width: size.icon.xl,
      height: size.icon.xl,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

const HealthSearchScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <HealthSearchContent {...props} />
  </ServiceScope>
);

const Row: React.FC<{
  icon: IonName;
  title: string;
  caption?: string | null;
  onPress: () => void;
  label: string;
  tint?: { fg: string; bg: string };
}> = ({ icon, title, caption, onPress, label, tint }) => {
  const styles = useStyles(makeStyles);
  const { colors, opacity } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}
      accessibilityRole="button"
      accessibilityLabel={label}>
      {tint ? (
        <View style={[styles.well, { backgroundColor: tint.bg }]}>
          <IonIcon name={icon} size="md" color={tint.fg} />
        </View>
      ) : (
        <IonIcon name={icon} size="md" color={colors.inkMuted} />
      )}
      <View style={styles.rowText}>
        <AppText variant="body" numberOfLines={2}>
          {title}
        </AppText>
        {caption ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {caption}
          </AppText>
        ) : null}
      </View>
      <IonIcon name="arrow-forward" size="sm" color={colors.inkFaint} />
    </Pressable>
  );
};

const HealthSearchContent: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'HealthHome' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, motion, opacity, specialtyTint } = useTheme();
  const s = useAppSelector(selectHealthSearch);
  const recent = useAppSelector(selectRecentHealthSearches);
  // The specialties the Health home already loaded, for the city it chose.
  const home = useAppSelector(selectHealthHome).home;
  const popular = home ? homeSpecialties(home.specialties, home.specialties.length) : [];
  const nav = useHealthNav();
  const typed = s.query.trim();
  const settled = useDebouncedValue(typed, motion.suggestDebounce);

  useEffect(() => {
    if (route.params?.q) dispatch(setHealthQuery(route.params.q));
  }, [route.params?.q, dispatch]);

  useEffect(() => {
    if (settled) void dispatch(healthSuggestAsync(settled));
  }, [settled, dispatch]);

  const remember = () => typed && dispatch(addRecentHealthSearch(typed));
  const searchAll = (q: string) => {
    const text = q.trim();
    if (!text) return;
    dispatch(addRecentHealthSearch(text));
    nav.openDoctors({ q: text, title: `"${text}"` });
  };

  const sug = s.suggestions;
  const showSuggestions = !!typed && s.suggestedFor === settled && settled === typed;
  const empty =
    showSuggestions && !sug.doctors.length && !sug.specialties.length && !sug.conditions.length;

  return (
    <View style={styles.root}>
      <PageHeader title="Search" onBack={back}>
        <SearchField
          value={s.query}
          onChange={t => dispatch(setHealthQuery(t))}
          placeholder="Doctors, specialties, conditions"
          autoFocus
          onSubmit={() => searchAll(s.query)}
        />
      </PageHeader>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {showSuggestions ? (
          <>
            {sug.conditions.length ? (
              <View style={styles.group}>
                <AppText variant="micro" tone="muted">
                  CONDITIONS
                </AppText>
                {sug.conditions.map(c => (
                  <Row
                    key={c.slug}
                    icon="pulse-outline"
                    title={c.name}
                    label={`${c.name}, condition`}
                    onPress={() => {
                      remember();
                      nav.openDoctors({ condition: c.slug, title: `Doctors who treat ${c.name}` });
                    }}
                  />
                ))}
              </View>
            ) : null}
            {sug.specialties.length ? (
              <View style={styles.group}>
                <AppText variant="micro" tone="muted">
                  SPECIALTIES
                </AppText>
                {sug.specialties.map(sp => (
                  <Row
                    key={sp.slug}
                    icon={sp.icon as IonName}
                    title={sp.name}
                    caption={`${sp.doctorCount} ${sp.doctorCount === 1 ? 'doctor' : 'doctors'}`}
                    label={`${sp.name}, specialty`}
                    onPress={() => {
                      remember();
                      nav.openDoctors({ specialty: sp.slug, title: sp.name });
                    }}
                  />
                ))}
              </View>
            ) : null}
            {sug.doctors.length ? (
              <View style={styles.group}>
                <AppText variant="micro" tone="muted">
                  DOCTORS
                </AppText>
                {sug.doctors.map(d => (
                  <Row
                    key={d.id}
                    icon="person-outline"
                    title={d.name}
                    caption={d.specialtyName}
                    label={`${d.name}, ${d.specialtyName}`}
                    onPress={() => {
                      remember();
                      nav.openDoctor(d.id, { name: d.name });
                    }}
                  />
                ))}
              </View>
            ) : null}
            {empty ? (
              <AppText variant="body" tone="muted">
                {`Nothing matches "${typed}". Try a symptom, like "fever", or a specialty.`}
              </AppText>
            ) : (
              <Row
                icon="search"
                title={`All doctors for "${typed}"`}
                label={`Search all doctors for ${typed}`}
                onPress={() => searchAll(typed)}
              />
            )}
          </>
        ) : (
          <>
            {recent.length ? (
              <View style={styles.group}>
                <View style={styles.head}>
                  <AppText variant="title">Recent searches</AppText>
                  <Pressable
                    onPress={() => dispatch(clearRecentHealthSearches())}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Clear recent searches">
                    <AppText variant="small" tone="accentDeep">
                      Clear all
                    </AppText>
                  </Pressable>
                </View>
                {recent.map((r, i) => (
                  <View key={r}>
                    {i > 0 ? <Divider /> : null}
                    <View style={styles.row}>
                      <Pressable
                        onPress={() => dispatch(setHealthQuery(r))}
                        onLongPress={() => dispatch(removeRecentHealthSearch(r))}
                        style={({ pressed }) => [
                          styles.row,
                          styles.rowText,
                          pressed && { opacity: opacity.pressed },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Search again: ${r}`}
                        accessibilityHint="Hold to remove it">
                        <IonIcon name="time-outline" size="md" color={colors.inkMuted} />
                        <AppText variant="body" numberOfLines={1} style={styles.rowText}>
                          {r}
                        </AppText>
                      </Pressable>
                      <IconButton
                        icon="close"
                        tone="muted"
                        onPress={() => dispatch(removeRecentHealthSearch(r))}
                        accessibilityLabel={`Remove ${r}`}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <AppText variant="body" tone="muted">
                Search by what you feel (“fever”, “pimples”), a specialty, or a doctor’s name.
              </AppText>
            )}
            {popular.length && home ? (
              <View style={styles.group}>
                <AppText
                  variant="title"
                  accessibilityRole="header">{`Specialties in ${home.city}`}</AppText>
                {popular.map((sp, i) => (
                  <View key={sp.slug}>
                    {i > 0 ? <Divider /> : null}
                    <Row
                      icon={sp.icon as IonName}
                      tint={specialtyTint[i % specialtyTint.length]}
                      title={sp.name}
                      caption={
                        sp.doctorCount > 0
                          ? `in ${home.city} · ${sp.doctorCount} ${
                              sp.doctorCount === 1 ? 'doctor' : 'doctors'
                            }`
                          : `in ${home.city}`
                      }
                      label={`${sp.name} in ${home.city}`}
                      onPress={() => nav.openDoctors({ specialty: sp.slug, title: sp.name })}
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default HealthSearchScreen;
