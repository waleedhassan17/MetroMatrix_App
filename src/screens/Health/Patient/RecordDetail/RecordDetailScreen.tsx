// ═══════════════════════════════════════════════════════
// MetroMatrix — A health record
// ═══════════════════════════════════════════════════════
// Every page full width (tap to zoom), a PDF opened in the phone's viewer,
// share, and delete.

import React, { useEffect } from 'react';
import { Linking, Pressable, Share, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, Card, IconButton, ImageViewer, InlineNotice, IonIcon, ScreenShell, SkeletonLines } from '@custom/index';
import { isPdf, recordTypeLabel } from '@models/health/recordModel';
import type { AccountStackParamList } from '@/types';
import { Alert } from '@utils/alert';
import { cdn } from '@utils/cdn';
import { formatDayFull } from '@utils/healthTime';
import { deleteRecordAsync, loadRecordAsync, selectRecordEntry, selectRecordUi, viewPage } from './recordDetailSlice';

type Props = NativeStackScreenProps<AccountStackParamList, 'RecordDetail'>;

const makeStyles = ({ colors, space, radius, size }: Theme) =>
  StyleSheet.create({
    page: { width: '100%', aspectRatio: size.previewAspect, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceSunk },
    pdf: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
  });

const RecordDetailScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <RecordDetailContent {...props} />
  </ServiceScope>
);

const RecordDetailContent: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const { back } = useBack({ name: 'HealthRecords' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, size } = useTheme();
  const entry = useAppSelector(st => selectRecordEntry(st, id));
  const ui = useAppSelector(selectRecordUi);
  const r = entry.record;

  useEffect(() => {
    void dispatch(loadRecordAsync(id));
  }, [dispatch, id]);

  const share = async () => {
    if (!r) return;
    try {
      await Share.share({ message: `${r.title} (${formatDayFull(r.recordedOn)}): ${r.files.map(f => f.url).join(' ')}` });
    } catch {
      Toast.show({ type: 'error', text1: 'Sharing isn’t available here' });
    }
  };

  const remove = () =>
    Alert.alert('Delete this record?', 'It is removed from your records and from any appointment it was shared with.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const res = await dispatch(deleteRecordAsync(id));
          if (deleteRecordAsync.fulfilled.match(res)) {
            Toast.show({ type: 'success', text1: 'Record deleted' });
            back();
          }
        },
      },
    ]);

  return (
    <ScreenShell
      title={r?.title ?? 'Record'}
      subtitle={r ? `${recordTypeLabel(r.type)} · ${r.memberName} · ${formatDayFull(r.recordedOn)}` : undefined}
      onBack={back}
      headerRight={r ? <IconButton icon="share-outline" onPress={() => void share()} accessibilityLabel="Share this record" /> : undefined}>
      {entry.status === 'failed' ? <InlineNotice message={entry.error.message} /> : null}
      {ui.deleteError.message ? <InlineNotice message={ui.deleteError.message} /> : null}
      {!r ? (
        entry.status === 'failed' ? null : <SkeletonLines lines={8} />
      ) : (
        <>
          {r.files.map((file, i) =>
            isPdf(file.mime) ? (
              <Card key={file.url} onPress={() => void Linking.openURL(file.url)} accessibilityLabel={`Open page ${i + 1}, a PDF`}>
                <View style={styles.pdf}>
                  <IonIcon name="document-attach-outline" size="xl" color={service.accentDeep} />
                  <View style={styles.grow}>
                    <AppText variant="title">{r.files.length > 1 ? `Page ${i + 1} (PDF)` : 'PDF document'}</AppText>
                    <AppText variant="small" tone="muted">
                      Opens in your phone’s viewer
                    </AppText>
                  </View>
                  <IonIcon name="open-outline" size="md" color={service.accentDeep} />
                </View>
              </Card>
            ) : (
              <Pressable key={file.url} onPress={() => dispatch(viewPage(file.url))} accessibilityRole="imagebutton" accessibilityLabel={`Page ${i + 1}. Open full screen`}>
                <View style={styles.page}>
                  <Image source={{ uri: cdn(file.url, { w: size.storeCard * 3 }) ?? file.url }} style={StyleSheet.absoluteFill} contentFit="contain" />
                </View>
              </Pressable>
            ),
          )}
          <Button label="Delete record" variant="ghost" leftIcon="trash-outline" onPress={remove} loading={ui.deleting} fullWidth />
          <ImageViewer visible={!!ui.viewing} uri={ui.viewing} title={r.title} onClose={() => dispatch(viewPage(null))} />
        </>
      )}
    </ScreenShell>
  );
};

export default RecordDetailScreen;
