// ═══════════════════════════════════════════════════════
// MetroMatrix — Conditions A–Z
// ═══════════════════════════════════════════════════════
// Patients often know "acne", not "dermatologist": every condition, grouped
// by letter; type a word you use ("pimples") to find it.

import React, { useEffect } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { useDebouncedValue } from '../../../../hooks/usePagedList';
import { useHealthNav } from '../../../../hooks/useHealth';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import { AppText, Divider, EmptyState, IonIcon, InlineNotice, PageHeader, SkeletonLines } from '../../../../Custom-Components/index';
import { SearchField } from '../../../../Components/shopping/ShopParts';
import type { Condition, HomeStackParamList } from '../../../../types';
import { loadConditionsAsync, selectConditionList, setConditionQuery } from './conditionListSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'ConditionList'>;

const makeStyles = ({ colors, space, size, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    list: { paddingHorizontal: gutter, paddingBottom: space.s40 },
    letter: { paddingTop: space.s16, paddingBottom: space.s4, backgroundColor: colors.canvas },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, minHeight: size.touch, paddingVertical: space.s12 },
    text: { flex: 1, gap: space.s0 },
    state: { paddingTop: space.s16 },
  });

const ConditionListScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <ConditionListContent {...props} />
  </ServiceScope>
);

const ConditionListContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'HealthHome' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, opacity } = useTheme();
  const s = useAppSelector(selectConditionList);
  const nav = useHealthNav();
  const q = useDebouncedValue(s.query.trim(), 250);

  useEffect(() => {
    void dispatch(loadConditionsAsync(q));
  }, [dispatch, q]);

  const sections = Object.entries(
    s.items.reduce<Record<string, Condition[]>>((acc, c) => {
      const k = c.name[0]?.toUpperCase() ?? '#';
      (acc[k] ??= []).push(c);
      return acc;
    }, {}),
  ).map(([title, data]) => ({ title, data }));

  return (
    <View style={styles.root}>
      <PageHeader title="Conditions" subtitle="Find doctors by what you feel" onBack={back}>
        <SearchField value={s.query} onChange={t => dispatch(setConditionQuery(t))} placeholder="Acne, fever, back pain…" />
      </PageHeader>
      <SectionList
        sections={sections}
        keyExtractor={c => c.slug}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={Divider}
        renderSectionHeader={({ section }) => (
          <View style={styles.letter}>
            <AppText variant="micro" tone="muted">
              {section.title}
            </AppText>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => nav.openDoctors({ condition: item.slug, title: `Doctors who treat ${item.name}` })}
            style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}. Doctors who treat it`}>
            <View style={styles.text}>
              <AppText variant="body">{item.name}</AppText>
            </View>
            <IonIcon name="chevron-forward" size="md" color={colors.inkFaint} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.state}>
            {s.status === 'loading' || s.status === 'idle' ? (
              <SkeletonLines lines={8} />
            ) : s.status === 'failed' ? (
              <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadConditionsAsync(q)) }} />
            ) : (
              <EmptyState icon="search" title={`Nothing matches "${q}"`} body="Try another word, or search all doctors." />
            )}
          </View>
        }
      />
    </View>
  );
};

export default ConditionListScreen;
