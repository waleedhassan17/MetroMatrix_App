// MetroMatrix — shown instead of the whole app when the build has no backend
// URL (config/env.ts CONFIG_ERROR). Nothing is sent anywhere: the client
// rejects every request, and there is nothing a person can do here but
// reinstall or reach support. It also releases the native splash, which the
// JS splash would otherwise have done.

import React, { useCallback } from 'react';
import { Linking, View, StyleSheet } from 'react-native';
import * as NativeSplash from 'expo-splash-screen';
import { EmptyState, ScreenShell } from '../Custom-Components';
import { SUPPORT_EMAIL } from '../config/env';

export const ConfigErrorScreen: React.FC = () => {
  const releaseNativeSplash = useCallback(() => {
    void NativeSplash.hideAsync().catch(() => {
      /* already hidden */
    });
  }, []);

  return (
    <View style={styles.fill} onLayout={releaseNativeSplash}>
      <ScreenShell scroll={false}>
        <EmptyState
          icon="alert-triangle"
          title="This version can't connect"
          body="It was built without a server address. Install the latest version of MetroMatrix, or contact support if this keeps happening."
          action={{
            label: 'Contact support',
            onPress: () => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=App%20cannot%20connect`),
          }}
        />
      </ScreenShell>
    </View>
  );
};

const styles = StyleSheet.create({ fill: { flex: 1 } });

export default ConfigErrorScreen;
