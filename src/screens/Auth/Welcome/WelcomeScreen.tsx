// ═══════════════════════════════════════════════════════
// MetroMatrix — Welcome
// ═══════════════════════════════════════════════════════
// P1 placeholder on the design system. The real screen (wordmark, serif
// headline, customer / business / staff entry points) lands in P3.

import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types';
import { AppText, Button, ScreenShell } from '@custom/index';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const WelcomeScreen: React.FC<Props> = ({ navigation }) => (
  <ScreenShell bare>
    <AppText variant="display">MetroMatrix</AppText>
    {__DEV__ ? (
      <Button label="Design gallery" variant="ghost" onPress={() => navigation.navigate('DesignGallery')} />
    ) : null}
  </ScreenShell>
);

export default WelcomeScreen;
