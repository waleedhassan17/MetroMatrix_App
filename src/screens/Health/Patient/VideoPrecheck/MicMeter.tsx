// MetroMatrix — A live microphone level (expo-audio metering), so a patient
// sees their mic works before joining. Native only.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useStyles, useTheme, type Theme } from '@theme/index';

const BARS = 12;

const makeStyles = ({ space, size, radius }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s4, height: size.meterHeight },
    bar: { width: size.meterBar, borderRadius: radius.pill },
  });

export const MicMeter: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { service, colors, size } = useTheme();
  const recorder = useAudioRecorder({ ...RecordingPresets.LOW_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 120);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        if (live) recorder.record();
      } catch {
        /* the meter is a nicety; the call works without it */
      }
    })();
    return () => {
      live = false;
      void recorder.stop().catch(() => undefined);
    };
  }, [recorder]);

  // dBFS (−160…0) → 0…1, with a floor for room noise.
  const level = Math.min(1, Math.max(0, ((state.metering ?? -160) + 60) / 60));
  const lit = Math.round(level * BARS);
  return (
    <View style={styles.row} accessibilityLabel={lit > 1 ? 'Your microphone is picking up sound' : 'Say something to test your microphone'}>
      {Array.from({ length: BARS }, (_, i) => (
        <View key={i} style={[styles.bar, { height: size.meterHeight * (0.3 + (0.7 * (i + 1)) / BARS), backgroundColor: i < lit ? service.accent : colors.surfaceSunk }]} />
      ))}
    </View>
  );
};

export default MicMeter;
