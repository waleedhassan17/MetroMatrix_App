// ═══════════════════════════════════════════════════════
// MetroMatrix — Health records
// ═══════════════════════════════════════════════════════
// Lab reports, scans and old prescriptions for you and your family, filtered
// by person and type; each opens full screen and can be shared with a doctor
// from an appointment.

import React, { useCallback, useEffect } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { usePagedList } from '@hooks/usePagedList';
import { listRecords } from '@networks/health/recordsNetwork';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, ChoiceChip, EmptyState, IonIcon, InlineNotice, PageHeader, Skeleton, type IonName } from '@custom/index';
import { RECORD_TYPES, isPdf, recordTypeIcon, recordTypeLabel } from '@models/health/recordModel';
import type { AccountStackParamList, HealthRecord } from '@/types';
import { cdn } from '@utils/cdn';
import { formatDayFull } from '@utils/healthTime';
import { loadFamilyAsync, selectFamily } from '../FamilyMembers/familySlice';
import { selectRecordsFilter, setRecordsMember, setRecordsType } from './healthRecordsSlice';

type Props = NativeStackScreenProps<AccountStackParamList, 'HealthRecords'>;

const makeStyles = ({ colors, space, radius, gutter, elevation, size }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    chips: { paddingHorizontal: gutter, gap: space.s8 },
    filters: { gap: space.s8, paddingVertical: space.s12 },
    list: { paddingHorizontal: gutter - space.s4, paddingBottom: space.s40 },
    cell: { width: '50%', padding: space.s4 },
    card: { borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden', ...elevation.none },
    thumb: { width: '100%', aspectRatio: size.productAspect, backgroundColor: colors.surfaceSunk, alignItems: 'center', justifyContent: 'center' },
    pages: { position: 'absolute', right: space.s8, top: space.s8, paddingHorizontal: space.s8, borderRadius: radius.pill, backgroundColor: colors.glass },
    body: { padding: space.s12, gap: space.s4 },
    footer: { paddingHorizontal: gutter, paddingBottom: space.s16 },
    state: { paddingHorizontal: space.s4, gap: space.s12 },
  });

const RecordCard: React.FC<{ record: HealthRecord; onPress: () => void }> = ({ record: r, onPress }) => {
  const styles = useStyles(makeStyles);
  const { service, opacity, size } = useTheme();
  const first = r.files[0];
  const image = first && !isPdf(first.mime) ? first.url : null;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: opacity.pressed }]}
      accessibilityRole="button"
      accessibilityLabel={`${r.title}, ${recordTypeLabel(r.type)}, ${r.memberName}, ${formatDayFull(r.recordedOn)}`}>
      <View style={styles.thumb}>
        {image ? (
          <Image source={{ uri: cdn(image, { w: size.storeCard }) ?? image }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <IonIcon name={(first && isPdf(first.mime) ? 'document-attach-outline' : recordTypeIcon(r.type)) as IonName} size="hero" color={service.accentDeep} />
        )}
        {r.files.length > 1 ? (
          <View style={styles.pages}>
            <AppText variant="micro">{`${r.files.length} pages`}</AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {r.title}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {`${recordTypeLabel(r.type)} · ${r.memberName}`}
        </AppText>
        <AppText variant="caption" tone="muted">
          {formatDayFull(r.recordedOn)}
        </AppText>
      </View>
    </Pressable>
  );
};

const HealthRecordsScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <HealthRecordsContent {...props} />
  </ServiceScope>
);

const HealthRecordsContent: React.FC<Props> = ({ navigation, route }) => {
  const { back, canGoBack } = useBack({ name: 'Profile' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const f = useAppSelector(selectRecordsFilter);
  const family = useAppSelector(selectFamily);
  const list = usePagedList((page, sz) => listRecords(f, page, sz), `records|${f.memberId}|${f.type}`);

  useEffect(() => {
    if (route.params?.memberId) dispatch(setRecordsMember(route.params.memberId));
  }, [route.params?.memberId, dispatch]);
  useEffect(() => {
    if (family.status === 'idle') void dispatch(loadFamilyAsync());
  }, [family.status, dispatch]);
  // A new upload shows when you come back.
  useFocusEffect(
    useCallback(() => {
      list.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  return (
    <View style={styles.root}>
      <PageHeader title="Health records" subtitle="Reports, scans and prescriptions" onBack={canGoBack ? back : undefined} />
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <ChoiceChip label="Everyone" selected={f.memberId === null} onPress={() => dispatch(setRecordsMember(null))} />
          <ChoiceChip label="Me" selected={f.memberId === 'self'} onPress={() => dispatch(setRecordsMember('self'))} />
          {family.members.map(m => (
            <ChoiceChip key={m.id} label={m.name.split(' ')[0]} selected={f.memberId === m.id} onPress={() => dispatch(setRecordsMember(m.id))} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <ChoiceChip label="All types" selected={f.type === null} onPress={() => dispatch(setRecordsType(null))} />
          {RECORD_TYPES.map(t => (
            <ChoiceChip key={t.key} label={t.label} icon={t.icon as IonName} selected={f.type === t.key} onPress={() => dispatch(setRecordsType(t.key))} />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={list.rows}
        keyExtractor={r => r.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <RecordCard record={item} onPress={() => navigation.navigate('RecordDetail', { id: item.id })} />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.state}>
            {list.isLoading ? (
              <>
                <Skeleton height={size.storeCard} shape="lg" />
              </>
            ) : list.error ? (
              <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
            ) : (
              <EmptyState icon="folder" title="No records here yet" body="Upload lab reports, scans and old prescriptions, and share them with your doctor before a visit." />
            )}
          </View>
        }
      />
      <View style={styles.footer}>
        <Button
          label="Upload a record"
          leftIcon="cloud-upload-outline"
          onPress={() => navigation.navigate('RecordUpload', { memberId: f.memberId && f.memberId !== 'self' ? f.memberId : undefined })}
          fullWidth
        />
      </View>
    </View>
  );
};

export default HealthRecordsScreen;
