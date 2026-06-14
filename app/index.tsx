import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { setPendingImageUri } from '../lib/store';

const THEME = '#FF6B8A';

export default function HomeScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'We need access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingImageUri(result.assets[0].uri);
      router.push('/game');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'We need access to your camera.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingImageUri(result.assets[0].uri);
      router.push('/game');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          style={styles.settingsBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="settings-outline" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View style={styles.titleArea}>
          <Text style={styles.title}>{t('appName')}</Text>
          <Text style={styles.subtitle}>{t('selectPhoto')}</Text>
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={pickImage}
            activeOpacity={0.8}
          >
            <Ionicons name="images-outline" size={22} color="#fff" />
            <Text style={styles.btnText}>{t('selectPhoto')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={takePhoto}
            activeOpacity={0.8}
          >
            <Ionicons name="camera-outline" size={22} color={THEME} />
            <Text style={[styles.btnText, styles.secondaryBtnText]}>
              {t('takePhoto')}
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  settingsBtn: { padding: 4 },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  titleArea: { alignItems: 'center', marginBottom: 48 },
  title: { fontSize: 32, fontWeight: '700', color: THEME, marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#888' },
  buttonGroup: { width: '100%', gap: 16 },
  primaryBtn: {
    backgroundColor: THEME,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  secondaryBtn: {
    backgroundColor: '#FFF0F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: THEME,
  },
  btnText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  secondaryBtnText: { color: THEME },
});
