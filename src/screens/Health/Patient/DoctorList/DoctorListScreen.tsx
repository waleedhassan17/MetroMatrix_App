// ═══════════════════════════════════════════════════════
// MetroMatrix — Doctor list
// ═══════════════════════════════════════════════════════
// The list's context in the header (a specialty, a condition — "Doctors who
// treat Acne" — or a search) and the city. Quick chips (Available today,
// Video consult, Female doctor, Under Rs 1,500, 10+ years) and Sort & filter
// change what the server sends; cards scroll a page at a time.

import React, { useEffect } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useDebouncedValue, usePagedList } from '@hooks/usePagedList';
import { useHealthNav } from '@hooks/useHealth';
import { listDoctors } from '@networks/health/discoveryNetwork';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { ChoiceChip, DoctorCard, EmptyState, InlineNotice, PageHeader, Skeleton } from '@custom/index';
import { QUICK_FILTERS, activeFilterCount, isQuickOn, queryKey } from '@models/health/filterModel';
import type { HomeStackParamList } from '@/types';
import { selectHealthHome } from '../HealthHome/healthHomeSlice';
import { DoctorFilterSheet } from './DoctorFilterSheet';
import {
  applyDraft,
  baseQuery,
  clearDoctorFilters,
  closeDoctorList,
  closeFilterSheet,
  countDraftAsync,
  editDraft,
  openDoctorList,
  openFilterSheet,
  resetDraft,
  selectDoctorListView,
  toggleQuickFilter,
} from './doctorListSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'DoctorList'>;

const makeStyles = ({ colors, space, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    chips: { paddingHorizontal: gutter, paddingVertical: space.s12, gap: space.s8 },
    list: { paddingHorizontal: gutter, paddingBottom: space.s40, gap: space.s12 },
    count: { paddingBottom: space.s4 },
    state: { gap: space.s12 },
  });

const DoctorListScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <DoctorListContent {...props} />
  </ServiceScope>
);

const DoctorListContent: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'HealthHome' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, size } = useTheme();
  const nav = useHealthNav();
  const key = route.key;
  const p = route.params ?? {};
  const city = useAppSelector(selectHealthHome).home?.city ?? 'Lahore';
  const view = useAppSelector(st => selectDoctorListView(st, key));

  useEffect(() => {
    dispatch(
      openDoctorList({
        key,
        query: baseQuery(city, {
          specialty: p.specialty ?? null,
          condition: p.condition ?? null,
          q: p.q ?? null,
          kind: p.kind ?? null,
          availableToday: !!p.availableToday,
        }),
      }),
    );
    return () => {
      dispatch(closeDoctorList(key));
    };
    // The list's context is fixed when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, key]);

  const query = view?.query ?? baseQuery(city);
  const list = usePagedList((page, sz) => listDoctors(query, page, sz), queryKey(query), { enabled: !!view });

  // "Show N doctors" follows the draft.
  const draftKey = useDebouncedValue(view?.sheetOpen ? queryKey(view.draft) : '', 300);
  useEffect(() => {
    if (view?.sheetOpen && draftKey) void dispatch(countDraftAsync({ key, query: view.draft }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, dispatch, key]);

  const filters = activeFilterCount(query);
  const title = p.title ?? (query.kind === 'video' ? 'Video consultation' : 'Doctors');
  const subtitle = list.isLoading ? city : `${list.total} ${list.total === 1 ? 'doctor' : 'doctors'} · ${city}`;

  return (
    <View style={styles.root}>
      <PageHeader title={title} subtitle={subtitle} onBack={back} />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <ChoiceChip label={filters ? `Sort and filter · ${filters}` : 'Sort and filter'} icon="options-outline" selected={filters > 0} onPress={() => dispatch(openFilterSheet(key))} />
          {QUICK_FILTERS.map(f => (
            <ChoiceChip key={f.key} label={f.label} selected={isQuickOn(query, f.key)} onPress={() => dispatch(toggleQuickFilter({ key, filter: f.key }))} />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={list.rows}
        keyExtractor={d => d.id}
        contentContainerStyle={styles.list}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={list.isRefreshing} onRefresh={list.refresh} tintColor={service.accent} />}
        renderItem={({ item }) => (
          <DoctorCard
            doctor={item}
            onPress={() => nav.openDoctor(item.id, { name: item.name, kind: query.kind ?? undefined })}
            onVideo={() => nav.openDoctor(item.id, { name: item.name, kind: 'video' })}
            onVisit={() => nav.openDoctor(item.id, { name: item.name, kind: 'clinic' })}
          />
        )}
        ListEmptyComponent={
          list.isLoading || !view ? (
            <View style={styles.state}>
              <Skeleton height={size.doctorPhoto.lg * 2} shape="lg" />
              <Skeleton height={size.doctorPhoto.lg * 2} shape="lg" />
            </View>
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState
              icon="search"
              title="No doctors match these filters"
              body="Clear the filters, or try another day or city."
              action={filters ? { label: 'Clear filters', onPress: () => dispatch(clearDoctorFilters(key)) } : undefined}
            />
          )
        }
        ListFooterComponent={list.isLoadingMore ? <Skeleton height={size.doctorPhoto.lg * 2} shape="lg" /> : null}
      />
      {view ? (
        <DoctorFilterSheet
          visible={view.sheetOpen}
          draft={view.draft}
          total={view.draftTotal}
          onChange={patch => dispatch(editDraft({ key, patch }))}
          onReset={() => dispatch(resetDraft(key))}
          onApply={() => dispatch(applyDraft(key))}
          onClose={() => dispatch(closeFilterSheet(key))}
        />
      ) : null}
    </View>
  );
};

export default DoctorListScreen;
