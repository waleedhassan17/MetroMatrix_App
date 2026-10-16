// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: doctor verification
// ═══════════════════════════════════════════════════════
// A doctor can't be approved until staff check the PMDC number against the
// register. Each doctor waiting shows the number, the uploaded documents
// (images in the zoom viewer, PDFs in the system viewer) and "Mark PMDC
// verified" with a note saying how it was checked. Approval itself stays in
// Approvals; the link opens the application there.

import React, { useEffect, useMemo } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useStyles, useTheme, type Theme } from '@theme/index';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Icon,
  ImageViewer,
  InlineNotice,
  ScreenShell,
  SegmentTabs,
  Sheet,
  SkeletonLines,
  StatusPill,
  TextAction,
  TextField,
} from '@custom/index';
import { DOCUMENT_LABELS } from '@models/businessModel';
import { validatePmdcNote } from '@models/health/adminHealthModel';
import type { AdminDoctor, AdminHealthStackParamList, DocumentKind } from '@/types';
import { formatDateTime } from '@utils/dates';
import { haptics } from '@utils/haptics';
import {
  loadDoctorsForVerificationAsync,
  openDocument,
  openVerify,
  selectDoctorVerification,
  setVerificationFilter,
  setVerifyNote,
  touchVerifyNote,
  verifyPmdcAsync,
  type VerificationFilter,
} from './doctorVerificationSlice';

type Props = NativeStackScreenProps<AdminHealthStackParamList, 'DoctorVerification'>;

const FILTERS: { key: VerificationFilter; label: string }[] = [
  { key: 'pending', label: 'Waiting' },
  { key: 'all', label: 'All doctors' },
];

const STATUS_LABEL: Record<AdminDoctor['status'], { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending_approval: { label: 'Waiting for approval', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  suspended: { label: 'Suspended', tone: 'danger' },
};

const isPdf = (d: AdminDoctor['documents'][number]) => d.mimeType === 'application/pdf' || d.url.toLowerCase().endsWith('.pdf');
const docLabel = (kind: string) => DOCUMENT_LABELS[kind as DocumentKind]?.label ?? kind.replace(/_/g, ' ');

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s12, paddingBottom: space.s40 },
    head: { gap: space.s4 },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    docs: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    doc: { width: size.thumb, gap: space.s4 },
    thumb: {
      width: size.thumb,
      height: size.thumb,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceSunk,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    number: { letterSpacing: size.hairline },
  });

const DoctorVerificationScreen: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'HealthOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { opacity } = useTheme();
  const s = useAppSelector(selectDoctorVerification);
  const focusId = route.params?.businessId;
  const noteError = s.noteTouched ? validatePmdcNote(s.note).note : undefined;
  const verifying = s.doctors.find(d => d.businessId === s.verifying) ?? null;

  useEffect(() => {
    void dispatch(loadDoctorsForVerificationAsync(s.filter));
  }, [s.filter, dispatch]);

  // A doctor opened from their application comes first.
  const rows = useMemo(
    () => (focusId ? [...s.doctors].sort((a, b) => Number(b.businessId === focusId) - Number(a.businessId === focusId)) : s.doctors),
    [s.doctors, focusId],
  );

  const view = (d: AdminDoctor['documents'][number]) => {
    if (isPdf(d)) void Linking.openURL(d.url);
    else dispatch(openDocument({ uri: d.url, title: docLabel(d.kind) }));
  };

  const openApplication = (d: AdminDoctor) =>
    navigation.getParent()?.navigate('ApprovalsTab', { screen: 'BusinessReview', params: { id: d.businessId, name: d.name }, initial: false });

  const verify = async () => {
    if (!s.verifying) return;
    if (Object.keys(validatePmdcNote(s.note)).length) {
      dispatch(touchVerifyNote());
      haptics.warning();
      return;
    }
    const name = verifying?.name ?? 'The doctor';
    const r = await dispatch(verifyPmdcAsync({ businessId: s.verifying, note: s.note }));
    if (verifyPmdcAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'PMDC verified', text2: `${name} can be approved now.` });
    } else haptics.warning();
  };

  const renderDoctor = (d: AdminDoctor) => {
    const st = STATUS_LABEL[d.status];
    return (
      <Card>
        <View style={styles.head}>
          <AppText variant="title">{d.name}</AppText>
          <AppText variant="small" tone="muted">
            {[d.specialty, d.city].filter(Boolean).join(' · ')}
            {d.submittedAt ? ` · submitted ${formatDateTime(d.submittedAt)}` : ''}
          </AppText>
        </View>
        <View style={styles.pills}>
          <StatusPill label={st.label} tone={st.tone} />
          <StatusPill label={d.pmdcVerified ? 'PMDC verified' : 'PMDC not checked'} tone={d.pmdcVerified ? 'success' : 'warning'} />
        </View>
        <AppText variant="label">PMDC number</AppText>
        <AppText variant="h2" selectable style={styles.number} accessibilityLabel={`PMDC number ${d.pmdcNumber.split('').join(' ')}`}>
          {d.pmdcNumber || 'Not given'}
        </AppText>
        {d.pmdcVerified && d.pmdcNote ? (
          <InlineNotice tone="success" title={d.pmdcVerifiedAt ? `Checked ${formatDateTime(d.pmdcVerifiedAt)}` : 'Checked'} message={d.pmdcNote} />
        ) : null}
        <AppText variant="label">Documents ({d.documents.length})</AppText>
        {d.documents.length ? (
          <View style={styles.docs}>
            {d.documents.map(doc => (
              <Pressable
                key={doc.id}
                onPress={() => view(doc)}
                style={({ pressed }) => [styles.doc, pressed && { opacity: opacity.pressed }]}
                accessibilityRole="button"
                accessibilityLabel={`${docLabel(doc.kind)}, ${isPdf(doc) ? 'PDF' : 'image'}`}
                accessibilityHint="Opens the document">
                <View style={styles.thumb}>
                  {isPdf(doc) ? <Icon name="file-text" size="lg" /> : <Image source={{ uri: doc.url }} style={StyleSheet.absoluteFill} contentFit="cover" />}
                </View>
                <AppText variant="caption" tone="muted" numberOfLines={2}>
                  {docLabel(doc.kind)}
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : (
          <AppText variant="small" tone="muted">
            Nothing uploaded.
          </AppText>
        )}
        {!d.pmdcVerified ? <Button label="Mark PMDC verified" leftIcon="shield-checkmark-outline" onPress={() => dispatch(openVerify(d.businessId))} fullWidth /> : null}
        {d.status === 'pending_approval' ? <TextAction label="Open the application in Approvals" onPress={() => openApplication(d)} /> : null}
      </Card>
    );
  };

  return (
    <ScreenShell title="Doctor verification" subtitle="Check the PMDC number before approving" onBack={back} scroll={false}>
      <SegmentTabs options={FILTERS} value={s.filter} onChange={k => dispatch(setVerificationFilter(k))} accessibilityLabel="Doctors" />
      {s.error.message && !s.verifying ? (
        <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadDoctorsForVerificationAsync(s.filter)) }} />
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={d => d.businessId}
        contentContainerStyle={styles.list}
        onRefresh={() => void dispatch(loadDoctorsForVerificationAsync(s.filter))}
        refreshing={false}
        renderItem={({ item }) => renderDoctor(item)}
        ListEmptyComponent={
          s.status === 'loading' || s.status === 'idle' ? (
            <SkeletonLines lines={6} />
          ) : (
            <EmptyState
              icon="shield"
              title={s.filter === 'pending' ? 'No doctor waiting' : 'No doctors yet'}
              body="Doctors who apply show here with their PMDC number and documents."
            />
          )
        }
      />
      <Sheet
        visible={!!s.verifying}
        onClose={() => dispatch(openVerify(null))}
        title="Mark PMDC verified?"
        subtitle={verifying ? `${verifying.name} · PMDC ${verifying.pmdcNumber || 'not given'}` : undefined}
        footer={<Button label="Mark verified" loading={s.busy} onPress={() => void verify()} fullWidth />}>
        <TextField
          label="How you checked it"
          value={s.note}
          onChangeText={t => dispatch(setVerifyNote(t))}
          onBlur={() => dispatch(touchVerifyNote())}
          multiline
          placeholder="Matched name and number on the PMDC register"
          error={noteError}
          helper="Kept with the doctor's record for other staff."
        />
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      </Sheet>
      <ImageViewer visible={!!s.viewer} uri={s.viewer?.uri ?? null} title={s.viewer?.title} onClose={() => dispatch(openDocument(null))} />
    </ScreenShell>
  );
};

export default DoctorVerificationScreen;
