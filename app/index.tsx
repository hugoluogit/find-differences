import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { setPendingImageUri } from '../lib/store';

const THEME = '#FF6B8A';

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

async function getFileSize(uri: string): Promise<number> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const blob = await res.blob();
    return blob.size;
  }
  try {
    const { FileSystem } = require('expo-file-system');
    const info = await FileSystem.getInfoAsync(uri);
    return (info as any).size ?? 0;
  } catch {
    return 0;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HomeScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [converting, setConverting] = useState(false);

  const pickImage = async () => {
    // Web: use native file input to avoid expo-image-picker rejecting HEIC
    if (Platform.OS === 'web') {
      const file = await new Promise<File | null>((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', () => {
          document.body.removeChild(input);
          resolve(input.files?.[0] ?? null);
        });
        input.addEventListener('cancel', () => {
          document.body.removeChild(input);
          resolve(null);
        });
        input.click();
      });

      if (!file) return;

      if (file.size > MAX_FILE_SIZE) {
        showAlert(t('fileTooLarge'), `${t('maxFileSize')} 3MB，${t('currentSize')} ${formatFileSize(file.size)}`);
        return;
      }

      let uri = URL.createObjectURL(file);

      const isHeic = file.type === 'image/heic' || file.type === 'image/heif'
        || /\.hei[cf]$/i.test(file.name);

      if (isHeic) {
        setConverting(true);
        try {
          const heic2any = (await import('heic2any')).default;
          const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
          const jpegBlob = Array.isArray(result) ? result[0] : result;
          uri = URL.createObjectURL(jpegBlob);
        } catch (e) {
          console.error('HEIC conversion failed:', e);
          setConverting(false);
          // setTimeout so React can re-render (hide spinner) before blocking alert
          const errMsg = e instanceof Error ? e.message : String(e);
          setTimeout(() => {
            showAlert(t('unsupportedFormat'), `${t('heicNotSupported')}\n\nError: ${errMsg}`);
          }, 100);
          return;
        }
        setConverting(false);
      }

      setPendingImageUri(uri);
      router.push('/game');
      return;
    }

    // Native path
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert(t('permissionRequired'), t('permissionPhotoLibrary'));
      return;
    }
    const pickerOptions: any = { mediaTypes: ['images'], quality: 0.8 };
    const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (!(await checkFileSize(asset))) return;
      setConverting(true);
      try {
        const { manipulateAsync, SaveFormat } = require('expo-image-manipulator');
        const resized = await manipulateAsync(
          asset.uri,
          [{ resize: { width: 2048 } }],
          { compress: 0.85, format: SaveFormat.JPEG }
        );
        setConverting(false);
        setPendingImageUri(resized.uri);
        router.push('/game');
      } catch {
        setConverting(false);
        setPendingImageUri(asset.uri);
        router.push('/game');
      }
    }
  };

  const checkFileSize = async (asset: ImagePicker.ImagePickerAsset): Promise<boolean> => {
    try {
      const size = asset.fileSize ?? await getFileSize(asset.uri);
      if (size > MAX_FILE_SIZE) {
        showAlert(t('fileTooLarge'), `${t('maxFileSize')} 3MB，${t('currentSize')} ${formatFileSize(size)}`);
        return false;
      }
    } catch {
      // If we can't determine size, let it through (backend will resize anyway)
    }
    return true;
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert(t('permissionRequired'), t('permissionCamera'));
      return;
    }
    const cameraOptions: any = {};
    if (Platform.OS !== 'web') cameraOptions.quality = 0.8;
    const result = await ImagePicker.launchCameraAsync(cameraOptions);
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (!(await checkFileSize(asset))) return;
      setConverting(true);
      try {
        const { manipulateAsync, SaveFormat } = require('expo-image-manipulator');
        const resized = await manipulateAsync(
          asset.uri,
          [{ resize: { width: 2048 } }],
          { compress: 0.85, format: SaveFormat.JPEG }
        );
        setConverting(false);
        setPendingImageUri(resized.uri);
        router.push('/game');
      } catch {
        setConverting(false);
        setPendingImageUri(asset.uri);
        router.push('/game');
      }
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {Platform.OS === 'web' && <Text style={styles.version}>v1.0.19</Text>}
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={styles.settingsBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="settings-outline" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.titleArea}>
          <Text style={styles.title}>{t('appName')}</Text>
          <Text style={styles.subtitle}>{t('homeSubtitle')}</Text>
        </View>

        <View style={styles.buttonGroup}>
          {converting ? (
            <View style={styles.convertingBox}>
              <ActivityIndicator size="large" color={THEME} />
              <Text style={styles.convertingText}>Converting HEIC...</Text>
            </View>
          ) : (
            <>
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
            </>
          )}
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  version: { fontSize: 11, color: '#AAA' },
  settingsBtn: { padding: 4 },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  titleArea: { alignItems: 'center', marginBottom: 48 },
  title: { fontSize: 32, fontWeight: '700', color: THEME, marginBottom: 8 },
  subtitle: { fontSize: 20, fontWeight: '700', color: THEME },
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
  convertingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  convertingText: {
    fontSize: 15,
    color: '#999',
  },
});
