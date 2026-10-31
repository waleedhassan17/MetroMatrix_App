// ═══════════════════════════════════════════════════════
// MetroMatrix — Before the video consultation
// ═══════════════════════════════════════════════════════
// You see yourself (front camera) and your microphone's level; any missing
// permission is asked for, with Open settings if it was refused. "Join
// consultation" opens 10 minutes before the time, with a countdown until then.

import React, { useEffect } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { useCountdown } from '../../../../hooks/useCountdown';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, IonIcon, InlineNotice, ScreenShell, SkeletonLines } from '../../../../Custom-Components/index';
import type { HealthBrowseParamList } from '../../../../types';
import { formatSlot, formatWhen } from '../../../../utils/healthTime';
import { MicMeter } from './MicMeter';
import { joinRoomAsync, loadVideoVisitAsync, selectVideo } from './videoSlice';

type Props = NativeStackScreenProps<HealthBrowseParamList, 'VideoPrecheck'>;

const makeStyles = ({ colors, space, radius, size }: Theme) =>
  StyleSheet.create({
    preview: { width: '100%', aspectRatio: size.previewAspect, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.viewer, alignItems: 'center', justifyContent: 'center', gap: space.s8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    tips: { gap: space.s8 },
  });

const clock = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m}:${String(s).padStart(2, '0')}`;
};

const VideoPrecheckScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <VideoPrecheckContent {...props} />
  </ServiceScope>
);

const VideoPrecheckContent: React.FC<Props> = ({ route, navigation }) => {
  const target = route.params;
  const { back } = useBack(target.code ? { name: 'AppointmentDetail', params: { code: target.code } } : undefined);
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const v = useAppSelector(selectVideo);
  const [camera, askCamera] = useCameraPermissions();
  const [mic, askMic] = useMicrophonePermissions();
  const native = Platform.OS !== 'web';
  const visit = v.visit;
  const opensMs = visit?.joinOpensAt ? Date.parse(visit.joinOpensAt) : 0;
  const wait = useCountdown(opensMs);

  useEffect(() => {
    void dispatch(loadVideoVisitAsync(target));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, target.code, target.appointmentId]);

  useEffect(() => {
    if (!native) return;
    if (camera && !camera.granted && camera.canAskAgain) void askCamera();
    if (mic && !mic.granted && mic.canAskAgain) void askMic();
  }, [native, camera, mic, askCamera, askMic]);

  const blocked = native && ((camera && !camera.granted) || (mic && !mic.granted));
  const open = wait === 0 && !!visit;

  const join = async () => {
    const r = await dispatch(joinRoomAsync(target));
    if (joinRoomAsync.fulfilled.match(r)) navigation.replace('VideoConsult', target);
  };

  return (
    <ScreenShell
      title="Video consultation"
      subtitle={visit ? `With ${visit.other} · ${formatSlot(visit.startAt, visit.timezone)}` : undefined}
      onBack={back}
      footer={
        <Button
          label={open ? 'Join consultation' : visit ? `Opens in ${clock(wait)}` : 'Join consultation'}
          leftIcon="videocam"
          onPress={() => void join()}
          disabled={!open || !!blocked}
          loading={v.status === 'loading'}
          fullWidth
        />
      }>
      {v.visitStatus === 'failed' ? <InlineNotice message={v.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadVideoVisitAsync(target)) }} /> : null}
      {v.status === 'failed' ? <InlineNotice message={v.error.message} /> : null}
      {!visit && v.visitStatus !== 'failed' ? <SkeletonLines lines={3} /> : null}
      {visit && !open ? (
        <InlineNotice tone="info" title={`The room opens at ${formatSlot(visit.joinOpensAt ?? visit.startAt, visit.timezone)}`} message={`10 minutes before your time (${formatWhen(visit.startAt, visit.timezone)}). Check your camera and microphone meanwhile.`} />
      ) : null}

      <View style={styles.preview}>
        {native && camera?.granted ? (
          <CameraView style={StyleSheet.absoluteFill} facing="front" mute />
        ) : (
          <>
            <IonIcon name="videocam-off-outline" size="xl" color={colors.onScrim} />
            <AppText variant="small" tone="onScrim" align="center">
              {native ? 'Camera preview appears once you allow the camera' : 'The camera check runs in the MetroMatrix app'}
            </AppText>
          </>
        )}
      </View>

      <Card>
        <View style={styles.row}>
          <IonIcon name={mic?.granted || !native ? 'mic-outline' : 'mic-off-outline'} size="lg" color={service.accentDeep} />
          <View style={styles.grow}>
            <AppText variant="title">Microphone</AppText>
            {native && mic?.granted ? (
              <MicMeter />
            ) : (
              <AppText variant="small" tone="muted">
                {native ? 'Allow the microphone so the doctor can hear you.' : 'The microphone check runs in the app.'}
              </AppText>
            )}
          </View>
        </View>
      </Card>

      {blocked ? (
        <InlineNotice
          tone="warning"
          title="Camera or microphone is off"
          message="The consultation needs both. Allow them in your phone's settings, then come back."
          action={{ label: 'Open settings', onPress: () => void Linking.openSettings() }}
        />
      ) : null}

      <View style={styles.tips}>
        {['Find a quiet place with good signal.', 'Keep your reports and medicines nearby.', 'Use earphones if others are around.'].map(t => (
          <View key={t} style={styles.row}>
            <IonIcon name="checkmark-circle-outline" size="md" color={colors.inkMuted} />
            <AppText variant="body" style={styles.grow}>
              {t}
            </AppText>
          </View>
        ))}
      </View>
    </ScreenShell>
  );
};

export default VideoPrecheckScreen;
