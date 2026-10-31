// ═══════════════════════════════════════════════════════
// MetroMatrix — All specialties
// ═══════════════════════════════════════════════════════
// Every specialty as a tile, with how many doctors there are in your city;
// type to narrow.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useHealthNav } from '../../hooks/useHealth';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { EmptyState, InlineNotice, ScreenShell, SkeletonLines, SpecialtyTile } from '../../Custom-Components/index';
import { SearchField } from '../../Components/shopping/ShopParts';
import type { HomeStackParamList, Specialty } from '../../models';
import { selectHealthHome } from '../health-home-screen/healthHomeSlice';
import { loadSpecialtiesAsync, selectSpecialtyList, setSpecialtyQuery } from './specialtyListSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'SpecialtyList'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    grid: { gap: space.s8 },
    row: { flexDirection: 'row', gap: space.s8 },
    spacer: { flex: 1 },
  });

const COLS = 3;

const SpecialtyList: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <SpecialtyListContent {...props} />
  </ServiceScope>
);

const SpecialtyListContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'HealthHome' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectSpecialtyList);
  const city = useAppSelector(selectHealthHome).home?.city ?? null;
  const nav = useHealthNav();

  useEffect(() => {
    void dispatch(loadSpecialtiesAsync(city));
  }, [dispatch, city]);

  const q = s.query.trim().toLowerCase();
  const shown = s.items.filter(sp => !q || sp.name.toLowerCase().includes(q));
  const rows: Specialty[][] = [];
  for (let i = 0; i < shown.length; i += COLS) rows.push(shown.slice(i, i + COLS));

  return (
    <ScreenShell
      title="Specialties"
      subtitle={city ? `Doctors in ${city} and by video` : undefined}
      onBack={back}
      headerContent={<SearchField value={s.query} onChange={t => dispatch(setSpecialtyQuery(t))} placeholder="Find a specialty" />}
      refreshing={s.status === 'loading' && s.items.length > 0}
      onRefresh={() => void dispatch(loadSpecialtiesAsync(city))}>
      {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadSpecialtiesAsync(city)) }} /> : null}
      {!s.items.length && s.status !== 'failed' ? <SkeletonLines lines={8} /> : null}
      {s.items.length && !shown.length ? <EmptyState icon="search" title={`No specialty matches "${s.query.trim()}"`} body="Try a symptom from Search instead." /> : null}
      <View style={styles.grid}>
        {rows.map((row, i) => (
          <View key={i} style={styles.row}>
            {row.map(sp => (
              <SpecialtyTile key={sp.slug} specialty={sp} onPress={() => nav.openDoctors({ specialty: sp.slug, title: sp.name })} />
            ))}
            {Array.from({ length: COLS - row.length }, (_, k) => (
              <View key={`pad-${k}`} style={styles.spacer} />
            ))}
          </View>
        ))}
      </View>
    </ScreenShell>
  );
};

export default SpecialtyList;
