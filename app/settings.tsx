import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useI18n, type Locale } from '../lib/i18n';

const THEME = '#FF6B8A';

const LANGUAGES: { label: string; value: Locale }[] = [
  { label: 'English', value: 'en' },
  { label: '简体中文', value: 'zh' },
  { label: '繁體中文', value: 'zh-TW' },
];

export default function SettingsScreen() {
  const { t, locale, setLocale } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings')}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>{t('language')}</Text>
        <View style={styles.card}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.value}
              style={[
                styles.langRow,
                locale === lang.value && styles.langRowActive,
              ]}
              onPress={() => setLocale(lang.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.langLabel,
                  locale === lang.value && styles.langLabelActive,
                ]}
              >
                {lang.label}
              </Text>
              {locale === lang.value && (
                <Ionicons name="checkmark" size={20} color={THEME} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.aboutSection}>
          <Text style={styles.sectionTitle}>{t('about')}</Text>
          <Text style={styles.aboutText}>{t('madeBy')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#333' },
  content: { paddingTop: 12, paddingHorizontal: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
  },
  card: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    overflow: 'hidden',
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  langRowActive: { backgroundColor: '#FFF0F3' },
  langLabel: { fontSize: 16, color: '#333' },
  langLabelActive: { color: THEME, fontWeight: '600' },
  aboutSection: { marginTop: 8, paddingBottom: 40 },
  aboutText: { fontSize: 15, color: '#888' },
});
