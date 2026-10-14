import 'react-native-gesture-handler';
import React from 'react';
import { StyleSheet } from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { store, persistor } from './src/store/store';
import AppContainer from './src/components/app-container/AppContainer';

// Keep the native splash up until AppContainer knows which navigator to
// mount (bootstrapSession settled). PersistGate renders nothing meanwhile —
// no JS spinner ever sits between the splash and the first real screen.
void SplashScreen.preventAutoHideAsync().catch(() => {
  /* already prevented (fast refresh) */
});

// Session persistence: the access/refresh tokens live in secure-store; on
// cold start AppContainer.bootstrapSession() re-validates them against
// GET /auth/me — the user signs in again only when the stored token is
// missing or no longer refreshable.
const App = () => (
  <GestureHandlerRootView style={styles.root}>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AppContainer />
      </PersistGate>
    </Provider>
  </GestureHandlerRootView>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default App;
