// ═══════════════════════════════════════════════════════
// MetroMatrix — Upload a health record
// ═══════════════════════════════════════════════════════
// Photograph each page, pick photos, or choose files (a PDF or several
// images); then a title, the type, the date on it and who it belongs to.

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  Button,
  ChoiceChip,
  DateField,
  IconButton,
  InlineNotice,
  IonIcon,
  ProgressBar,
  ScreenShell,
  TextField,
  dateKeyOf,
  type IonName,
} from '../../Custom-Components/index';
import { MAX_RECORD_FILES, RECORD_TYPES, isPdf, validateRecord } from '../../models/health/recordModel';
import type { AccountStackParamList, LocalFile } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import { pickDocumentFiles, pickImagesFromLibrary, takePhoto } from '../../utils/pickers/pickers';
import { appointmentReceived } from '../appointment-detail-screen/appointmentDetailSlice';
import { loadFamilyAsync, selectFamily } from '../family-members-screen/familySlice';
import { addPageAsync, pageKey, removePage, saveRecordAsync, selectRecordUpload, setRecordField, startRecordUpload, touchRecord } from './recordUploadSlice';

type Props = NativeStackScreenProps<AccountStackParamList, 'RecordUpload'>;

const makeStyles = ({ colors, space, radius, size }: Theme) =>
  StyleSheet.create({
    group: { gap: space.s8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    sources: { flexDirection: 'row', gap: space.s8 },
    source: {
      flex: 1,
      alignItems: 'center',
      gap: space.s4,
      paddingVertical: space.s12,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderColor: colors.line,
      minHeight: size.touch,
    },
    page: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s8 },
    thumb: { width: size.thumb, height: size.thumb, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surfaceSunk, alignItems: 'center', justifyContent: 'center' },
    grow: { flex: 1, gap: space.s4 },
  });

const RecordUpload: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <RecordUploadContent {...props} />
  </ServiceScope>
);

const RecordUploadContent: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'HealthTabs', params: { screen: 'RecordsTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, opacity } = useTheme();
  const s = useAppSelector(selectRecordUpload);
  const family = useAppSelector(selectFamily);
  const today = dateKeyOf(new Date());

  useEffect(() => {
    dispatch(startRecordUpload({ memberId: route.params?.memberId ?? null, attachTo: route.params?.attachTo ?? null, today }));
    if (family.status === 'idle') void dispatch(loadFamilyAsync());
    // Start once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const input = {
    title: s.title,
    type: s.type,
    recordedOn: s.recordedOn,
    memberId: s.memberId,
    files: s.pages.filter(p => p.url).map(p => ({ url: p.url!, mime: p.mime })),
  };
  const errors = validateRecord({ ...input, files: s.pages.map(p => ({ url: p.url ?? p.uri, mime: p.mime })) }, today);
  const busy = s.pages.some(p => p.url === null);
  const room = MAX_RECORD_FILES - s.pages.length;

  const add = (files: LocalFile[]) => files.slice(0, room).forEach(file => void dispatch(addPageAsync({ key: pageKey(), file })));

  const save = async () => {
    dispatch(touchRecord());
    if (Object.keys(errors).length || busy) {
      haptics.warning();
      return;
    }
    const r = await dispatch(saveRecordAsync({ input, attachTo: s.attachTo }));
    if (saveRecordAsync.fulfilled.match(r)) {
      if (r.payload.appointment) dispatch(appointmentReceived(r.payload.appointment));
      haptics.success();
      Toast.show({ type: 'success', text1: 'Record saved', text2: s.attachTo ? 'Shared with the doctor too.' : undefined });
      back();
    } else haptics.warning();
  };

  const show = (k: string) => (s.touched ? errors[k] : undefined);

  return (
    <ScreenShell
      title="Upload a record"
      subtitle={s.attachTo ? 'It will be shared with your doctor' : 'Lab report, scan or prescription'}
      onBack={back}
      footer={<Button label={busy ? 'Uploading pages…' : 'Save record'} onPress={() => void save()} loading={s.status === 'loading'} disabled={busy} fullWidth />}>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}

      <View style={styles.group}>
        <AppText variant="label">{`Pages (${s.pages.length} of ${MAX_RECORD_FILES})`}</AppText>
        {room > 0 ? (
          <View style={styles.sources}>
            {(
              [
                [
                  'camera-outline',
                  'Camera',
                  async () => {
                    const photo = await takePhoto();
                    if (photo) add([photo]);
                  },
                ],
                ['images-outline', 'Photos', async () => add(await pickImagesFromLibrary(room))],
                ['document-outline', 'Files', async () => add(await pickDocumentFiles(room))],
              ] as [IonName, string, () => Promise<void>][]
            ).map(([icon, label, run]) => (
              <Pressable key={label} onPress={() => void run()} style={({ pressed }) => [styles.source, pressed && { opacity: opacity.pressed }]} accessibilityRole="button" accessibilityLabel={`Add from ${label}`}>
                <IonIcon name={icon} size="lg" color={service.accentDeep} />
                <AppText variant="small">{label}</AppText>
              </Pressable>
            ))}
          </View>
        ) : null}
        {show('files') ? (
          <AppText variant="small" tone="danger">
            {show('files')}
          </AppText>
        ) : null}
        {s.pages.map((p, i) => (
          <View key={p.key} style={styles.page}>
            <View style={styles.thumb}>
              {isPdf(p.mime) ? <IonIcon name="document-attach-outline" size="lg" color={service.accentDeep} /> : <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />}
            </View>
            <View style={styles.grow}>
              <AppText variant="body" numberOfLines={1}>{`Page ${i + 1}`}</AppText>
              {p.url === null ? <ProgressBar progress={p.progress ?? 0} accessibilityLabel={`Uploading page ${i + 1}`} /> : <AppText variant="caption" tone="success">Uploaded</AppText>}
            </View>
            <IconButton icon="close" tone="muted" onPress={() => dispatch(removePage(p.key))} accessibilityLabel={`Remove page ${i + 1}`} />
          </View>
        ))}
      </View>

      <TextField label="Title" value={s.title} onChangeText={t => dispatch(setRecordField({ title: t }))} error={show('title')} placeholder="Complete blood count" maxLength={80} />

      <View style={styles.group}>
        <AppText variant="label">Type</AppText>
        <View style={styles.chips}>
          {RECORD_TYPES.map(t => (
            <ChoiceChip key={t.key} label={t.label} icon={t.icon as IonName} selected={s.type === t.key} onPress={() => dispatch(setRecordField({ type: t.key }))} />
          ))}
        </View>
      </View>

      <DateField label="Date on the record" value={s.recordedOn} onChange={v => dispatch(setRecordField({ recordedOn: v }))} max={today} min="1950-01-01" error={show('recordedOn')} />

      <View style={styles.group}>
        <AppText variant="label">Whose record is it</AppText>
        <View style={styles.chips}>
          <ChoiceChip label="Me" selected={s.memberId === null} onPress={() => dispatch(setRecordField({ memberId: null }))} />
          {family.members.map(m => (
            <ChoiceChip key={m.id} label={m.name.split(' ')[0]} selected={s.memberId === m.id} onPress={() => dispatch(setRecordField({ memberId: m.id }))} />
          ))}
        </View>
      </View>
    </ScreenShell>
  );
};

export default RecordUpload;
