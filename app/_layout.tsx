import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { I18nProvider, useI18n } from '../lib/i18n';
import { checkAppVersion } from '../lib/api';

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

const THEME = '#FF6B8A';

function UpdateBlock() {
  const { t } = useI18n();
  const [state, setState] = useState<'checking' | 'block' | 'ok'>('checking');

  useEffect(() => {
    (async () => {
      try {
        const currentVersion = Constants.expoConfig?.version || '0.0.0';
        const result = await checkAppVersion();
        if (compareVersions(currentVersion, result.minimumVersion) < 0) {
          setState('block');
        } else {
          setState('ok');
        }
      } catch {
        setState('ok');
      }
    })();
  }, []);

  if (state === 'checking') {
    return (
      <View style={styles.overlay}>
        <ActivityIndicator size="large" color={THEME} />
      </View>
    );
  }

  if (state === 'block') {
    return (
      <View style={styles.overlay}>
        <Text style={styles.icon}>📲</Text>
        <Text style={styles.title}>{t('updateRequired')}</Text>
        <Text style={styles.message}>{t('updateMessage')}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => Linking.openURL('https://find-differences-m5tr.vercel.app')}
        >
          <Text style={styles.buttonText}>{t('updateNow')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

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
      <UpdateBlock />
    </I18nProvider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
    zIndex: 999,
  },
  icon: { fontSize: 48 },
  title: { fontSize: 22, fontWeight: '700', color: '#333' },
  message: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24 },
  button: {
    backgroundColor: THEME,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  buttonText: { color: '#FFF', fontSize: 17, fontWeight: '600' },
});
