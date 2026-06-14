import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nProvider } from '../lib/i18n';

export default function RootLayout() {
  return (
    <I18nProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="game" />
        <Stack.Screen
          name="settings"
          options={{ presentation: 'modal', headerShown: true, headerTitle: '' }}
        />
      </Stack>
    </I18nProvider>
  );
}
