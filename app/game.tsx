import { useState, useEffect, useRef, memo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ActivityIndicator,
  LayoutChangeEvent,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useI18n } from '../lib/i18n';
import { generateGame } from '../lib/api';
import { popPendingImageUri } from '../lib/store';
import type { GameState, Difference } from '../lib/types';

const THEME = '#FF6B8A';
const HIT_MARGIN = 0.06;

export default function GameScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLayout, setImageLayout] = useState<{ w: number; h: number } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const initiated = useRef(false);

  useEffect(() => {
    if (initiated.current) return;
    initiated.current = true;

    const uri = popPendingImageUri();
    if (!uri) {
      router.replace('/');
      return;
    }

    generateGame(uri)
      .then((res) => {
        setGame({
          originalImage: `data:image/jpeg;base64,${res.originalImage}`,
          modifiedImage: `data:image/jpeg;base64,${res.modifiedImage}`,
          differences: res.differences,
          foundIndices: [],
          totalChanges: res.totalChanges,
          status: 'playing',
        });
        setLoading(false);
      })
      .catch((e) => {
        console.log('generateGame error:', e.message);
        setError(e.message || 'Failed to generate puzzle');
        setLoading(false);
      });
  }, []);

  const hitTest = useCallback((px: number, py: number) => {
    if (!game || !imageLayout) return;
    const xPct = px / imageLayout.w;
    const yPct = py / imageLayout.h;

    for (let i = 0; i < game.differences.length; i++) {
      if (game.foundIndices.includes(i)) continue;
      const d = game.differences[i];
      if (
        xPct >= d.x - HIT_MARGIN &&
        xPct <= d.x + d.w + HIT_MARGIN &&
        yPct >= d.y - HIT_MARGIN &&
        yPct <= d.y + d.h + HIT_MARGIN
      ) {
        const newFound = [...game.foundIndices, i];
        const completed = newFound.length >= game.totalChanges;
        setGame((prev) => prev ? {
          ...prev,
          foundIndices: newFound,
          status: completed ? 'completed' : 'playing',
        } : prev);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }
    }

    // Miss — feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [game, imageLayout]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    initiated.current = false;
    const uri = popPendingImageUri();
    if (!uri) {
      router.replace('/');
      return;
    }
    initiated.current = true;
    generateGame(uri)
      .then((res) => {
        setGame({
          originalImage: `data:image/jpeg;base64,${res.originalImage}`,
          modifiedImage: `data:image/jpeg;base64,${res.modifiedImage}`,
          differences: res.differences,
          foundIndices: [],
          totalChanges: res.totalChanges,
          status: 'playing',
        });
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || 'Failed');
        setLoading(false);
      });
  };

  const handleImageLayout = useCallback((w: number, h: number) => {
    if (!imageLayout) setImageLayout({ w, h });
  }, [imageLayout]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={THEME} />
        <Text style={styles.loadingLabel}>{t('generating')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#FF6B6B" />
        <Text style={styles.errorText}>{error}</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
            <Text style={styles.retryBtnText}>{t('playAgain')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
            <Text style={styles.backBtnText}>{t('newPhoto')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!game) return null;

  const progress = game.foundIndices.length / game.totalChanges;
  const screenW = Dimensions.get('window').width;
  const imgW = screenW - 32;
  const availableH = Dimensions.get('window').height - insets.top - 60 - 20 - 16;
  const imgH = Math.floor((availableH - 8) / 2);
  const diffMarkers = revealed
    ? game.differences
    : game.foundIndices.map((fi) => game.differences[fi]);
  const diffOffsets = revealed
    ? game.differences.map((_, i) => i)
    : game.foundIndices;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.hud}>
        <TouchableOpacity onPress={() => router.replace('/')} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#333" />
        </TouchableOpacity>
        <View style={styles.hudCenter}>
          <Text style={styles.hudText}>
            {t('found')} {game.foundIndices.length} {t('of')} {game.totalChanges}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setRevealed(true)}
          style={styles.revealBtn}
          hitSlop={8}
        >
          <Text style={styles.revealBtnText}>答案</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.imageColumn}>
        <ImagePanelMemo
          key="original"
          source={game.originalImage}
          label={t('original')}
          onTap={hitTest}
          onLayout={handleImageLayout}
          width={imgW}
          height={imgH}
          markers={diffMarkers}
          markerOffsets={diffOffsets}
        />
        <ImagePanelMemo
          key="modified"
          source={game.modifiedImage}
          label={t('modified')}
          onTap={hitTest}
          onLayout={() => {}}
          width={imgW}
          height={imgH}
          markers={diffMarkers}
          markerOffsets={diffOffsets}
        />
      </View>

      {game.status === 'completed' && (
        <View style={styles.completedOverlay}>
          <Ionicons name="checkmark-circle" size={48} color={THEME} />
          <Text style={styles.completedText}>{t('completed')}</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Text style={styles.retryBtnText}>{t('playAgain')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
              <Text style={styles.backBtnText}>{t('newPhoto')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

interface PanelProps {
  source: string;
  label: string;
  onTap: (px: number, py: number) => void;
  onLayout: (w: number, h: number) => void;
  width: number;
  height: number;
  markers: Difference[];
  markerOffsets: number[];
}

function ImagePanel({
  source,
  label,
  onTap,
  onLayout,
  width,
  height,
  markers,
  markerOffsets,
}: PanelProps) {
  return (
    <TouchableWithoutFeedback
      onPress={(e) => onTap(e.nativeEvent.locationX, e.nativeEvent.locationY)}
    >
      <View style={[styles.imgWrapper, { width, height }]}>
        <Image
          source={{ uri: source }}
          style={{ width, height }}
          onLayout={() => onLayout(width, height)}
          resizeMode="contain"
        />
        <View style={styles.imgLabel}>
          <Text style={styles.imgLabelText}>{label}</Text>
        </View>
        {markers.map((d, i) => (
          <View
            key={i}
            style={[
              styles.marker,
              {
                left: d.x * width - 75,
                top: d.y * height - 75,
              },
            ]}
          >
            <Text style={styles.markerText}>{markerOffsets[i] + 1}</Text>
          </View>
        ))}
      </View>
    </TouchableWithoutFeedback>
  );
}

const ImagePanelMemo = memo(ImagePanel);

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', gap: 16 },
  container: { flex: 1, backgroundColor: '#FFF' },
  loadingLabel: { fontSize: 15, color: '#888', marginTop: 8 },
  errorText: { fontSize: 17, fontWeight: '600', color: '#FF6B6B' },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  hudCenter: { flex: 1, alignItems: 'center' },
  hudText: { fontSize: 17, fontWeight: '600', color: '#333' },
  progressBg: { height: 4, backgroundColor: '#F0F0F0', marginHorizontal: 16, borderRadius: 2 },
  progressFill: { height: '100%', backgroundColor: THEME, borderRadius: 2 },
  imageColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
    flex: 1,
    gap: 8,
  },
  imgWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F8F8F8',
    position: 'relative',
  },
  imgLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  imgLabelText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  marker: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderWidth: 5,
    borderColor: THEME,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 107, 138, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    color: THEME,
    fontSize: 40,
    fontWeight: '800',
  },
  completedOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  completedText: { fontSize: 20, fontWeight: '700', color: '#333' },
  revealBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealBtnText: {
    color: THEME,
    fontSize: 14,
    fontWeight: '600',
  },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  retryBtn: {
    backgroundColor: THEME,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  backBtn: {
    borderWidth: 1.5,
    borderColor: THEME,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backBtnText: { color: THEME, fontSize: 15, fontWeight: '600' },
});
