// ═══════════════════════════════════════════════════════
// MetroMatrix — Welcome
// ═══════════════════════════════════════════════════════
// P0 placeholder: proves the shell boots to the unauthenticated stack.
// The real screen (wordmark, serif headline, customer / business / staff
// entry points) lands in P3.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const WelcomeScreen: React.FC = () => (
  <View style={styles.root} accessibilityLabel="Welcome">
    <Text>MetroMatrix</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default WelcomeScreen;
