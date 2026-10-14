// ═══════════════════════════════════════════════════════
// MetroMatrix — ErrorBoundary
// ═══════════════════════════════════════════════════════
// Last line of defence for a render crash: a calm message and a way to try
// again instead of a white screen. Sits outside the ThemeProvider, so its
// fallback renders with the default (light, neutral) theme context.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { getTheme } from '../../theme';
import { EmptyState } from '../../Custom-Components/EmptyState';

interface State {
  error: Error | null;
}

const theme = getTheme('light');

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.root}>
        <EmptyState
          icon="alert-triangle"
          title="Something went wrong"
          body="The app hit an unexpected error. Your data is safe."
          action={{ label: 'Try again', onPress: () => this.setState({ error: null }) }}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.gutter,
    backgroundColor: theme.colors.canvas,
  },
});

export default ErrorBoundary;
