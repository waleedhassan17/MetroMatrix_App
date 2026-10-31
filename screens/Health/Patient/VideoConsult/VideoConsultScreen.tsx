// ═══════════════════════════════════════════════════════
// MetroMatrix — The video consultation (native)
// ═══════════════════════════════════════════════════════
// The room from the API (a Jitsi URL, or JaaS with a token) in a WebView that
// may use the camera and microphone inline, with the screen kept awake.
// Jitsi's own chat covers messages. End leaves the room: the patient goes on
// to rate the visit, the doctor back to the appointment.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBarStyle } from '../../../../hooks/useBarStyle';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import { AppText, Button, EmptyState } from '../../../../Custom-Components/index';
import type { HealthBrowseParamList } from '../../../../types';
import { Alert } from '../../../../utils/alert';
import { formatSlot } from '../../../../utils/healthTime';
import { leaveRoom, selectVideo } from '../VideoPrecheck/videoSlice';
import { afterCall } from './videoConsultShared';

type Props = NativeStackScreenProps<HealthBrowseParamList, 'VideoConsult'>;

const makeStyles = ({ colors, space, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.viewer },
    bar: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingHorizontal: gutter, paddingBottom: space.s8 },
    grow: { flex: 1 },
    web: { flex: 1, backgroundColor: colors.viewer },
    empty: { flex: 1, justifyContent: 'center', padding: gutter, backgroundColor: colors.canvas },
  });

const VideoConsultScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <VideoConsultContent {...props} />
  </ServiceScope>
);

const VideoConsultContent: React.FC<Props> = ({ route, navigation }) => {
  useKeepAwake();
  useBarStyle(true);
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { space } = useTheme();
  const insets = useSafeAreaInsets();
  const v = useAppSelector(selectVideo);
  const room = v.room;

  const end = () =>
    Alert.alert('Leave the consultation?', 'You can join again until the room closes.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Leave',
        onPress: () => {
          dispatch(leaveRoom());
          afterCall(navigation, route.params);
        },
      },
    ]);

  if (!room) {
    return (
      <View style={styles.empty}>
        <EmptyState icon="video-off" title="Not in a consultation" body="Join from the appointment when the room is open." action={{ label: 'Back', onPress: () => navigation.goBack() }} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.s8 }]}>
      <View style={styles.bar}>
        <View style={styles.grow}>
          <AppText variant="title" tone="onScrim">
            {v.visit ? `With ${v.visit.other}` : 'Video consultation'}
          </AppText>
          {v.visit ? (
            <AppText variant="caption" tone="onScrim">{`Room open until ${formatSlot(room.closesAt, v.visit.timezone)}`}</AppText>
          ) : null}
        </View>
        <Button label="End" size="sm" leftIcon="call" onPress={end} accessibilityLabel="Leave the consultation" />
      </View>
      <WebView
        style={styles.web}
        source={{ uri: room.roomUrl, headers: room.jwt ? { Authorization: `Bearer ${room.jwt}` } : undefined }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        allowsProtectedMedia
        originWhitelist={['https://*']}
      />
    </View>
  );
};

export default VideoConsultScreen;
