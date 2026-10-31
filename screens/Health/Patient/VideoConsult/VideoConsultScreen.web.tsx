// ═══════════════════════════════════════════════════════
// MetroMatrix — The video consultation (web)
// ═══════════════════════════════════════════════════════
// The browser build can't host the call inside the page reliably, so it
// says so plainly and offers the room in a new tab (it works in desktop
// Chrome and Edge); the app is the place for video.

import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { Button, EmptyState, ScreenShell } from '../../../../Custom-Components/index';
import type { HealthBrowseParamList } from '../../../../types';
import { leaveRoom, selectVideo } from '../VideoPrecheck/videoSlice';
import { afterCall } from './videoConsultShared';

type Props = NativeStackScreenProps<HealthBrowseParamList, 'VideoConsult'>;

const makeStyles = ({ space }: Theme) => StyleSheet.create({ actions: { gap: space.s12 } });

const VideoConsultScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <VideoConsultContent {...props} />
  </ServiceScope>
);

const VideoConsultContent: React.FC<Props> = ({ route, navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const room = useAppSelector(selectVideo).room;
  const end = () => {
    dispatch(leaveRoom());
    afterCall(navigation, route.params);
  };
  return (
    <ScreenShell title="Video consultation" onBack={end}>
      <EmptyState icon="smartphone" title="Use the mobile app for video" body="Video consultations run in the MetroMatrix app on your phone, where the camera and microphone work inside the call." />
      <View style={styles.actions}>
        {room ? <Button label="Open the call in a new tab" variant="secondary" leftIcon="open-outline" onPress={() => void Linking.openURL(room.roomUrl)} fullWidth /> : null}
        <Button label="I've finished" onPress={end} fullWidth />
      </View>
    </ScreenShell>
  );
};

export default VideoConsultScreen;
