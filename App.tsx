import 'react-native-gesture-handler';
import React from 'react';
import { StyleSheet } from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as SplashScreen from 'expo-splash-screen';
import { store, persistor } from './src/store/store';
import { ThemeProvider } from './src/theme';
import AppContainer from './src/components/app-container/AppContainer';
import ErrorBoundary from './src/components/shared/ErrorBoundary';

// Keep the native splash up until AppContainer knows which navigator to
// mount (bootstrapSession settled); the JS splash then plays over it. The app
// renders in the platform system font (like the FYP), so there is no font to
// wait for.
void SplashScreen.preventAutoHideAsync().catch(() => {
  /* already prevented (fast refresh) */
});

// Session persistence: the access/refresh tokens live in secure-store; on
// cold start AppContainer.bootstrapSession() re-validates them against
// GET /auth/me — the user signs in again only when the stored token is
// missing or no longer refreshable.
const App = () => {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <Provider store={store}>
            <PersistGate loading={null} persistor={persistor}>
              <ThemeProvider>
                <BottomSheetModalProvider>
                  <AppContainer />
                </BottomSheetModalProvider>
              </ThemeProvider>
            </PersistGate>
          </Provider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default App;
