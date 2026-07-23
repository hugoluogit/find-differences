import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Linking, Platform } from 'react-native';
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

function AppContent() {
  const { t } = useI18n();
  const [versionState, setVersionState] = useState<'checking' | 'block' | 'ok'>('checking');

  useEffect(() => {
    (async () => {
      try {
        const currentVersion = Constants.expoConfig?.version || '0.0.0';
        const result = await checkAppVersion();
        if (compareVersions(currentVersion, result.minimumVersion) < 0) {
          setVersionState('block');
        } else {
          setVersionState('ok');
        }
      } catch {
        setVersionState('ok');
      }
    })();
  }, []);

  if (versionState === 'checking') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={THEME} />
      </View>
    );
  }

  if (versionState === 'block') {
    return (
      <View style={styles.center}>
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

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="game" />
        <Stack.Screen
          name="settings"
          options={{ presentation: 'modal', headerShown: true, headerTitle: '' }}
        />
      </Stack>
      {Platform.OS === 'web' && (
        <View style={styles.globalVersionBadge}>
          <Text style={styles.globalVersionText}>v1.0.2</Text>
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <I18nProvider>
      <StatusBar style="dark" />
      <AppContent />
    </I18nProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
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
  globalVersionBadge: {
    position: 'absolute',
    top: 8,
    right: 12,
    zIndex: 9999,
    pointerEvents: 'none' as any,
  },
  globalVersionText: { fontSize: 11, color: '#AAA', fontWeight: '500' },
});
