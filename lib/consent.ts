import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ai_consent_granted';

export async function hasConsent(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function requestConsent(t: (key: string) => string): Promise<boolean> {
  if (await hasConsent()) return true;

  const title = t('consentTitle');
  const message = t('consentMessage');

  if (Platform.OS === 'web') {
    const ok = window.confirm(`${title}\n\n${message}`);
    if (ok) {
      try {
        await AsyncStorage.setItem(KEY, '1');
      } catch {}
    }
    return ok;
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: t('consentDecline'), style: 'cancel', onPress: () => resolve(false) },
        {
          text: t('consentAgree'),
          onPress: () => {
            AsyncStorage.setItem(KEY, '1').catch(() => {});
            resolve(true);
          },
        },
      ],
      { cancelable: false },
    );
  });
}
