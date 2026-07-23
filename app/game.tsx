import { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useI18n } from '../lib/i18n';
import { generateGame, startCheckout, confirmPayment, openPaymentUrl } from '../lib/api';
import { popPendingImageUri } from '../lib/store';
import type { GameState, Difference } from '../lib/types';

const THEME = '#FF6B8A';
const HIT_MARGIN = 0.06;

export default function GameScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [gameKey, setGameKey] = useState(0);
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLayout, setImageLayout] = useState<{ w: number; h: number } | null>(null);
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [paying, setPaying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const savedUri = useRef<string | null>(null);
  const initiated = useRef(false);

  useEffect(() => {
    if (initiated.current) return;
    initiated.current = true;

    // Web: check for returning from Stripe payment
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sid = params.get('session_id');
      const cancelled = params.get('cancelled');
      if (cancelled === '1') {
        // Clean URL and show payment screen again
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        const savedUri = sessionStorage.getItem('pendingImageUri');
        if (savedUri) setImageUri(savedUri);
        setLoading(false);
        return;
      }
      if (sid) {
        // Clean URL
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        // Restore image URI from sessionStorage
        const savedUri = sessionStorage.getItem('pendingImageUri');
        if (savedUri) {
          try { sessionStorage.removeItem('pendingImageUri'); } catch {}
          setImageUri(savedUri);
          setCurrentSessionId(sid);
          // Auto-confirm after a short delay for state to settle
          setTimeout(() => {
            setChecking(true);
            confirmPayment(sid).then(result => {
              if (result.paid) {
                doGenerate(savedUri, sid);
              } else {
                setChecking(false);
                setLoading(false);
                setError('Payment not confirmed');
              }
            }).catch(() => {
              setChecking(false);
              setLoading(false);
              setError('Payment verification failed');
            });
          }, 500);
          return;
        }
      }
    }

    const uri = popPendingImageUri();
    if (!uri) {
      router.replace('/');
      return;
    }
    setImageUri(uri);
    setLoading(false);
  }, []);

  const doGenerate = async (uri: string, sid: string) => {
    savedUri.current = uri;
    setGameKey(k => k + 1);
    setImageUri(null);
    setPaying(false);
    setChecking(false);
    setError(null);
    // Force full View tree remount via gameKey + clear imageUri
    await new Promise(resolve => requestAnimationFrame(resolve));
    setLoading(true);
    await new Promise(resolve => requestAnimationFrame(resolve));

    try {
      const res = await generateGame(uri, sid);
      setGame({
        originalImage: `data:image/jpeg;base64,${res.originalImage}`,
        modifiedImage: `data:image/jpeg;base64,${res.modifiedImage}`,
        differences: res.differences,
        foundIndices: [],
        totalChanges: res.totalChanges,
        status: 'playing',
      });
      setLoading(false);
    } catch (e: any) {
      console.log('generateGame error:', e.message);
      setError(e.message || 'Failed to generate puzzle');
      setLoading(false);
    }
  };

  const handlePay = useCallback(async () => {
    try {
      setPaying(true);
      setError(null);
      const ref = Math.random().toString(36).substring(2, 15);
      const { url, sessionId: sid } = await startCheckout(ref);
      setCurrentSessionId(sid);
      // On web, save imageUri to sessionStorage so it survives the redirect
      if (typeof window !== 'undefined' && imageUri) {
        try { sessionStorage.setItem('pendingImageUri', imageUri); } catch {}
      }
      setPaying(false);
      openPaymentUrl(url);
    } catch (e: any) {
      console.log('Payment error:', e.message);
      setPaying(false);
    }
  }, [imageUri]);

  const handleCheckPayment = useCallback(async () => {
    if (!currentSessionId || !imageUri) return;
    setChecking(true);
    setError(null);
    try {
      const result = await confirmPayment(currentSessionId);
      if (result.paid) {
        savedUri.current = imageUri;
        doGenerate(imageUri, currentSessionId);
      } else {
        setChecking(false);
      }
    } catch {
      setChecking(false);
    }
  }, [currentSessionId, imageUri]);

  const handleRetry = () => {
    setError(null);
    const uri = savedUri.current || imageUri;
    if (uri && currentSessionId) {
      doGenerate(uri, currentSessionId);
    } else if (uri) {
      setLoading(false);
    } else {
      router.replace('/');
    }
  };

  const handlePlayAgain = () => {
    setGame((prev) => prev ? { ...prev, foundIndices: [], status: 'playing' } : prev);
  };

  /** Convert container-relative px to image-relative %, accounting for letterbox */
  const toImagePct = useCallback((px: number, py: number) => {
    if (!imageLayout || !imageSize) return null;
    const cw = imageLayout.w, ch = imageLayout.h;
    const iw = imageSize.w, ih = imageSize.h;
    const renderW = Math.min(cw, ch * (iw / ih));
    const renderH = Math.min(ch, cw / (iw / ih));
    const offsetX = (cw - renderW) / 2;
    const offsetY = (ch - renderH) / 2;
    const xPct = (px - offsetX) / renderW;
    const yPct = (py - offsetY) / renderH;
    if (xPct < 0 || xPct > 1 || yPct < 0 || yPct > 1) return null;
    return { xPct, yPct };
  }, [imageLayout, imageSize]);

  const hitTest = useCallback((px: number, py: number) => {
    if (!game) return;
    const pct = toImagePct(px, py);
    if (!pct) return;
    const { xPct, yPct } = pct;

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
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
        return;
      }
    }

    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  }, [game, toImagePct]);

  const handleImageLoad = useCallback((w: number, h: number) => {
    if (!imageSize) setImageSize({ w, h });
  }, [imageSize]);

  const handleImageLayout = useCallback((w: number, h: number) => {
    if (!imageLayout) setImageLayout({ w, h });
  }, [imageLayout]);

  // Wrap all states in a View with dynamic key so React fully destroys
  // and recreates the native tree — no Image view recycling across generations.
  return (
    <View key={gameKey} style={{ flex: 1 }}>
      {loading ? (
        <LoadingScreen insetsTop={insets.top} t={t} />
      ) : imageUri && !game && !error ? (
        <PaymentScreen
          insetsTop={insets.top}
          t={t}
          imageUri={imageUri}
          currentSessionId={currentSessionId}
          paying={paying}
          checking={checking}
          onPay={handlePay}
          onCheckPayment={handleCheckPayment}
          onCancel={() => { setCurrentSessionId(null); setError(null); }}
          onCancelNav={() => router.replace('/')}
        />
      ) : error ? (
        <ErrorScreen insetsTop={insets.top} t={t} error={error} onRetry={handleRetry} onBack={() => router.replace('/')} />
      ) : !game ? null : (
        <GamePlayScreen
          insetsTop={insets.top}
          t={t}
          game={game}
          revealed={revealed}
          onReveal={() => setRevealed(true)}
          onBack={() => router.replace('/')}
          onPlayAgain={handlePlayAgain}
          hitTest={hitTest}
          imageLayout={imageLayout}
          onImageLayout={handleImageLayout}
          onImageLoad={handleImageLoad}
          imageSize={imageSize}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Separate component per state — each is a distinct React type, so transitions
// always trigger a clean unmount → remount cycle, never View-in-place update.
// ---------------------------------------------------------------------------

function LoadingScreen({ insetsTop, t }: { insetsTop: number; t: (k: string) => string }) {
  return (
    <View style={[styles.center, { paddingTop: insetsTop }]}>
      <ActivityIndicator size="large" color={THEME} />
      <Text style={styles.loadingLabel}>{t('generating')}</Text>
    </View>
  );
}

interface PaymentScreenProps {
  insetsTop: number;
  t: (k: string) => string;
  imageUri: string;
  currentSessionId: string | null;
  paying: boolean;
  checking: boolean;
  onPay: () => void;
  onCheckPayment: () => void;
  onCancel: () => void;
  onCancelNav: () => void;
}

function PaymentScreen({
  insetsTop, t, imageUri, currentSessionId,
  paying, checking,
  onPay, onCheckPayment, onCancel, onCancelNav,
}: PaymentScreenProps) {
  const screenW = Dimensions.get('window').width;
  const previewW = screenW - 64;
  const previewH = Math.floor(previewW * 0.75);
  const awaitingPayment = currentSessionId !== null;

  return (
    <View style={[styles.center, { paddingTop: insetsTop }]}>
      <Ionicons name={awaitingPayment ? "hourglass-outline" : "lock-closed-outline"} size={36} color={THEME} />
      <Text style={styles.payTitle}>{t('payToPlay')}</Text>
      <Text style={styles.payPrice}>HK$4.00</Text>
      <Image
        source={{ uri: imageUri }}
        style={{ width: previewW, height: previewH, borderRadius: 12, marginVertical: 16 }}
        resizeMode="cover"
      />
      {awaitingPayment ? (
        <>
          <TouchableOpacity
            style={[styles.payBtn, checking && { opacity: 0.6 }]}
            onPress={onCheckPayment}
            disabled={checking}
          >
            {checking ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
            )}
            <Text style={styles.payBtnText}>
              {checking ? t('checkingPayment') : t('checkPayment')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.payBtn, paying && { opacity: 0.6 }]}
            onPress={onPay}
            disabled={paying}
          >
            {paying ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Ionicons name="card-outline" size={20} color="#FFF" />
            )}
            <Text style={styles.payBtnText}>
              {paying ? t('processing') : t('payBtn')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancelNav}>
            <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function ErrorScreen({
  insetsTop, t, error, onRetry, onBack,
}: {
  insetsTop: number; t: (k: string) => string; error: string;
  onRetry: () => void; onBack: () => void;
}) {
  return (
    <View style={[styles.center, { paddingTop: insetsTop }]}>
      <Ionicons name="alert-circle-outline" size={48} color="#FF6B6B" />
      <Text style={styles.errorText}>{error}</Text>
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryBtnText}>{t('playAgain')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>{t('newPhoto')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface GamePlayScreenProps {
  insetsTop: number;
  t: (k: string) => string;
  game: GameState;
  revealed: boolean;
  onReveal: () => void;
  onBack: () => void;
  onPlayAgain: () => void;
  hitTest: (px: number, py: number) => void;
  imageLayout: { w: number; h: number } | null;
  onImageLayout: (w: number, h: number) => void;
  onImageLoad: (w: number, h: number) => void;
  imageSize: { w: number; h: number } | null;
}

function GamePlayScreen({
  insetsTop, t, game, revealed, onReveal, onBack, onPlayAgain,
  hitTest, imageLayout, onImageLayout, onImageLoad, imageSize,
}: GamePlayScreenProps) {
  const progress = game.foundIndices.length / game.totalChanges;
  const isWeb = Platform.OS === 'web';
  const screenW = Dimensions.get('window').width;
  const imgW = isWeb ? 375 : screenW - 32;
  const availableH = Dimensions.get('window').height - insetsTop - 60 - 20 - 16;
  const imgH = isWeb ? 280 : Math.floor((availableH - 8) / 2);
  const diffMarkers = revealed
    ? game.differences
    : game.foundIndices.map((fi) => game.differences[fi]);
  const diffOffsets = revealed
    ? game.differences.map((_, i) => i)
    : game.foundIndices;

  // Calculate rendered image area within the container (letterbox-aware)
  const imgRender = useMemo(() => {
    if (!imageSize) return null;
    const cw = imgW, ch = imgH;
    const iw = imageSize.w, ih = imageSize.h;
    const renderW = Math.min(cw, ch * (iw / ih));
    const renderH = Math.min(ch, cw / (iw / ih));
    const offsetX = (cw - renderW) / 2;
    const offsetY = (ch - renderH) / 2;
    return { renderW, renderH, offsetX, offsetY };
  }, [imageSize, imgW, imgH]);

  const content = (
    <View style={isWeb ? styles.imageColumnWeb : styles.imageColumn}>
      <ImagePanelMemo
        key="original"
        source={game.originalImage}
        label={t('original')}
        onTap={hitTest}
        onLayout={onImageLayout}
        onImageLoad={onImageLoad}
        width={imgW}
        height={imgH}
        markers={diffMarkers}
        markerOffsets={diffOffsets}
        imgRender={imgRender}
      />
      <ImagePanelMemo
        key="modified"
        source={game.modifiedImage}
        label={t('modified')}
        onTap={hitTest}
        onLayout={() => {}}
        onImageLoad={() => {}}
        width={imgW}
        height={imgH}
        markers={diffMarkers}
        markerOffsets={diffOffsets}
        imgRender={imgRender}
      />
    </View>
  );

  return (
    <View style={isWeb ? styles.containerWeb : styles.container}>
      {isWeb ? (
        <ScrollView style={styles.scrollWeb} contentContainerStyle={{ paddingTop: insetsTop }}>
          <View style={styles.hud}>
            <TouchableOpacity onPress={onBack} hitSlop={12}>
              <Ionicons name="chevron-back" size={26} color="#333" />
            </TouchableOpacity>
            <View style={styles.hudCenter}>
              <Text style={styles.hudText}>
                {t('found')} {game.foundIndices.length} {t('of')} {game.totalChanges}
              </Text>
            </View>
            <TouchableOpacity onPress={onReveal} style={styles.revealBtn} hitSlop={8}>
              <Text style={styles.revealBtnText}>{t('reveal')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          {content}

          {game.status === 'completed' && (
            <View style={styles.completedOverlay}>
              <Ionicons name="checkmark-circle" size={48} color={THEME} />
              <Text style={styles.completedText}>{t('completed')}</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.retryBtn} onPress={onPlayAgain}>
                  <Text style={styles.retryBtnText}>{t('playAgain')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                  <Text style={styles.backBtnText}>{t('newPhoto')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingTop: insetsTop }}>
          <View style={styles.hud}>
            <TouchableOpacity onPress={onBack} hitSlop={12}>
              <Ionicons name="chevron-back" size={26} color="#333" />
            </TouchableOpacity>
            <View style={styles.hudCenter}>
              <Text style={styles.hudText}>
                {t('found')} {game.foundIndices.length} {t('of')} {game.totalChanges}
              </Text>
            </View>
            <TouchableOpacity onPress={onReveal} style={styles.revealBtn} hitSlop={8}>
              <Text style={styles.revealBtnText}>{t('reveal')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          {content}

          {game.status === 'completed' && (
            <View style={styles.completedOverlay}>
              <Ionicons name="checkmark-circle" size={48} color={THEME} />
              <Text style={styles.completedText}>{t('completed')}</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.retryBtn} onPress={onPlayAgain}>
                  <Text style={styles.retryBtnText}>{t('playAgain')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                  <Text style={styles.backBtnText}>{t('newPhoto')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function extractSessionId(url: string): string | null {
  const match = url.match(/session_id=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

interface PanelProps {
  source: string;
  label: string;
  onTap: (px: number, py: number) => void;
  onLayout: (w: number, h: number) => void;
  onImageLoad: (w: number, h: number) => void;
  width: number;
  height: number;
  markers: Difference[];
  markerOffsets: number[];
  imgRender: { offsetX: number; offsetY: number; renderW: number; renderH: number } | null;
}

function ImagePanel({
  source,
  label,
  onTap,
  onLayout,
  onImageLoad,
  width,
  height,
  markers,
  markerOffsets,
  imgRender,
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
          onLoad={(e) => {
            const { width: iw, height: ih } = e.nativeEvent.source;
            onImageLoad(iw, ih);
          }}
          resizeMode="contain"
        />
        <View style={styles.imgLabel}>
          <Text style={styles.imgLabelText}>{label}</Text>
        </View>
        {imgRender && markers.map((d, i) => (
          <View
            key={i}
            style={[
              styles.marker,
              {
                left: imgRender.offsetX + (d.x + d.w / 2) * imgRender.renderW - 75,
                top: imgRender.offsetY + (d.y + d.h / 2) * imgRender.renderH - 75,
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
  containerWeb: { flex: 1, backgroundColor: '#FFF' },
  scrollWeb: { flex: 1 },
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
  hudRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  versionBadge: { fontSize: 11, color: '#AAA', fontWeight: '500' },
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
  imageColumnWeb: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
    gap: 8,
    paddingBottom: 40,
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
  payTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginTop: 8 },
  payPrice: { fontSize: 36, fontWeight: '800', color: THEME },
  payBtn: {
    backgroundColor: THEME,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  payBtnText: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  cancelBtn: { paddingVertical: 8 },
  cancelBtnText: { fontSize: 15, color: '#888' },
});
