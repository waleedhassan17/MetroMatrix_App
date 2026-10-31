// ═══════════════════════════════════════════════════════
// MetroMatrix — A doctor's reviews
// ═══════════════════════════════════════════════════════
// The summary (tap a star bar to read only those), then every review a page
// at a time: video or clinic, newest or highest first. Only patients who
// had a visit can review.

import React, { useEffect } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { usePagedList } from '../../../../hooks/usePagedList';
import { getDoctorReviewsAPI } from '../../../../networks/health/reviewsNetwork';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import { ChoiceChip, Divider, DoctorReviewItem, EmptyState, InlineNotice, PageHeader, ReviewSummary, SkeletonLines } from '../../../../Custom-Components/index';
import type { HomeStackParamList } from '../../../../types';
import { loadDoctorAsync, selectDoctorEntry } from '../DoctorProfile/doctorProfileSlice';
import { resetReviewFilters, selectDoctorReviewFilters, setReviewKind, setReviewRating, setReviewSort } from './doctorReviewsSlice';
import { doctorReviewPageSerializer } from '../../../../serializers/health/discoverySerializer';

type Props = NativeStackScreenProps<HomeStackParamList, 'DoctorReviews'>;

const makeStyles = ({ colors, space, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    list: { paddingHorizontal: gutter, paddingBottom: space.s40 },
    head: { gap: space.s16, paddingTop: space.s20, paddingBottom: space.s8 },
    chips: { gap: space.s8 },
    state: { paddingTop: space.s16 },
  });

const DoctorReviewsScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <DoctorReviewsContent {...props} />
  </ServiceScope>
);

const DoctorReviewsContent: React.FC<Props> = ({ route }) => {
  const { doctorId, name } = route.params;
  const { back } = useBack({ name: 'DoctorProfile', params: { id: doctorId } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const f = useAppSelector(selectDoctorReviewFilters);
  const entry = useAppSelector(st => selectDoctorEntry(st, doctorId));
  const profile = entry.profile;
  const list = usePagedList((page, size) => getDoctorReviewsAPI(doctorId, f, page, size), doctorReviewPageSerializer, `reviews|${doctorId}|${f.kind}|${f.rating}|${f.sort}`);

  useEffect(() => {
    dispatch(resetReviewFilters());
  }, [dispatch, doctorId]);
  // Opened from a link: the summary comes with the profile.
  useEffect(() => {
    if (entry.status === 'idle') void dispatch(loadDoctorAsync(doctorId));
  }, [entry.status, dispatch, doctorId]);

  const header = (
    <View style={styles.head}>
      {profile ? <ReviewSummary summary={profile.reviewSummary} selected={f.rating} onSelect={r => dispatch(setReviewRating(r))} /> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <ChoiceChip label="All visits" selected={!f.kind} onPress={() => dispatch(setReviewKind(null))} />
        <ChoiceChip label="Video" icon="videocam-outline" selected={f.kind === 'video'} onPress={() => dispatch(setReviewKind('video'))} />
        <ChoiceChip label="Clinic" icon="business-outline" selected={f.kind === 'clinic'} onPress={() => dispatch(setReviewKind('clinic'))} />
        <ChoiceChip label="Newest" selected={f.sort === 'recent'} onPress={() => dispatch(setReviewSort('recent'))} />
        <ChoiceChip label="Highest" selected={f.sort === 'highest'} onPress={() => dispatch(setReviewSort('highest'))} />
        <ChoiceChip label="Lowest" selected={f.sort === 'lowest'} onPress={() => dispatch(setReviewSort('lowest'))} />
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.root}>
      <PageHeader title="Reviews" subtitle={name ?? profile?.name} onBack={back} />
      <FlatList
        data={list.rows}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        ItemSeparatorComponent={Divider}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={list.isRefreshing} onRefresh={list.refresh} tintColor={service.accent} />}
        renderItem={({ item }) => <DoctorReviewItem review={item} doctorName={name ?? profile?.name} />}
        ListEmptyComponent={
          <View style={styles.state}>
            {list.isLoading ? (
              <SkeletonLines lines={6} />
            ) : list.error ? (
              <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
            ) : (
              <EmptyState icon="message-square" title="No reviews match" body="Try all visits, or another star count." />
            )}
          </View>
        }
        ListFooterComponent={list.isLoadingMore ? <SkeletonLines lines={3} /> : null}
      />
    </View>
  );
};

export default DoctorReviewsScreen;
