/**
 * Root layout — wraps the entire app with providers:
 * - React Navigation theme (James dark tokens)
 * - TanStack Query client
 * - SafeAreaProvider
 * - GestureHandlerRootView
 * Per react-native-ui-ux-plan.md §6.
 */
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { hydrateSession } from '@/stores/sessionStore';
import { colors } from '@/theme/tokens';

// Single shared QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Hydrate session from SecureStore
    hydrateSession();
    // Small delay to ensure hydration before first render
    const t = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Prevent rendering until initialized
  if (!isReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'default',
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="connection" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="devices" options={{ title: 'Devices' }} />
            <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
            <Stack.Screen name="voice" options={{ title: 'Voice' }} />
            <Stack.Screen name="command/[requestId]" options={{ title: 'Command' }} />
            <Stack.Screen name="file/[fileId]" options={{ title: 'File' }} />
            <Stack.Screen name="file/[fileId]/preview" options={{ title: 'Preview' }} />
            <Stack.Screen name="file/[fileId]/edit" options={{ title: 'Edit' }} />
            <Stack.Screen name="file/[fileId]/edit-review" options={{ title: 'Review Edit' }} />
            <Stack.Screen name="indexing/[jobId]" options={{ title: 'Indexing' }} />
          </Stack>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
