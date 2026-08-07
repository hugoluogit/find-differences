import { useState, useEffect, useRef, memo, useCallback, useMemo, Component, type ReactNode } from 'react';
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
import type { GameState, Difference, PlanOption } from '../lib/types';
import { popPendingImageUri, getJwt } from '../lib/store';

const THEME = '#FF6B8A';
const HIT_MARGIN = 0.06;

const PLANS: Array<{ plays: PlanOption; price: string; labelKey: string }> = [
  { plays: 1, price: 'HK$4', labelKey: 'plan1' },
  { plays: 5, price: 'HK$8', labelKey: 'plan5' },
  { plays: 10, price: 'HK$12', labelKey: 'plan10' },
];

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; errorMsg: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error?.message || 'Unknown error' };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.center}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#FF6B8A', marginBottom: 8 }}>Error</Text>
          <Text style={{ fontSize: 13, color: '#999', textAlign: 'center', paddingHorizontal: 32 }}>{this.state.errorMsg}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function GameScreen() {
  const { t, tf } = useI18n();
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
  const [playToken, setPlayToken] = useState<string | null>(() => {
    if (typeof sessionStorage !== 'undefined') return sessionStorage.getItem('playToken');
    return getJwt();
  });
  const [remainingPlays, setRemainingPlays] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const savedUri = useRef<string | null>(null);
  const initiated = useRef(false);

  // Persist playToken to sessionStorage on changes
  const updatePlayToken = useCallback((token: string | null) => {
    setPlayToken(token);
    if (typeof sessionStorage !== 'undefined') {
      if (token) sessionStorage.setItem('playToken', token);
      else sessionStorage.removeItem('playToken');
    }
  }, []);

  // Web: enable body scrolling and override Expo's overflow:hidden
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const style = document.getElementById('body-scroll-override');
      if (!style) {
        const el = document.createElement('style');
        el.id = 'body-scroll-override';
        el.textContent = 'html,body{overflow:auto!important}#root{height:auto!important;min-height:100vh!important}';
        document.head.appendChild(el);
      }
      return () => {
        const el = document.getElementById('body-scroll-override');
        if (el) el.remove();
      };
    }
  }, []);

  useEffect(() => {
    if (initiated.current) return;
    initiated.current = true;

    // Web: check for returning from Stripe payment
    if (Platform.OS === 'web') {
      const params = new URLSearchParams(window.location.search);
      const sid = params.get('session_id');
      const cancelled = params.get('cancelled');
      if (cancelled === '1') {
        // Clean URL and show payment screen again
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        const savedUri = sessionStorage.getItem('pendingImageBase64');
        if (savedUri) setImageUri(savedUri);
        setLoading(false);
        return;
      }
      if (sid) {
        // Clean URL
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        // Restore image from sessionStorage (stored as base64 data URL)
        const savedUri = sessionStorage.getItem('pendingImageBase64');
        if (savedUri) {
          try { sessionStorage.removeItem('pendingImageBase64'); } catch {}
          setImageUri(savedUri);
          // Auto-confirm after a short delay for state to settle
          setTimeout(async () => {
            setChecking(true);
            // Retry up to 5 times with 2s delay (Stripe may need a moment)
            for (let attempt = 0; attempt < 5; attempt++) {
              try {
                const result = await confirmPayment(sid);
                if (result.paid && result.playToken) {
                  updatePlayToken(result.playToken);
                  setRemainingPlays(result.plays || 0);
                  doGenerate(savedUri, result.playToken);
                  return;
                }
              } catch (e: any) {
                console.log('confirm attempt', attempt, e?.message);
              }
              if (attempt < 4) await new Promise(r => setTimeout(r, 2000));
            }
            setChecking(false);
            setLoading(false);
            setError(`Payment not confirmed (session: ${sid.slice(-8)})`);
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

  // Auto-generate when image is ready and user has a playToken
  useEffect(() => {
    if (imageUri && !game && !error && playToken && !loading && !checking && !currentSessionId) {
      doGenerate(imageUri, playToken);
    }
  }, [imageUri, playToken]);

  const doGenerate = async (uri: string, token: string) => {
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
      const res = await generateGame(uri, token);
      if (res.newPlayToken) {
        updatePlayToken(res.newPlayToken);
      } else {
        updatePlayToken(null);
      }
      setRemainingPlays(res.remainingPlays ?? 0);
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
      if (e.message?.includes('402') || e.message?.includes('Payment') || e.message?.includes('play token')) {
        // Token exhausted or invalid, show payment screen
        updatePlayToken(null);
        setLoading(false);
        return;
      }
      setError(e.message || 'Failed to generate puzzle');
      setLoading(false);
    }
  };

  const handlePay = useCallback(async (plan: PlanOption = 1) => {
    try {
      setPaying(true);
      setError(null);

      if (Platform.OS !== 'web') {
        // Native: use IAP
        const { purchasePlays } = await import('../lib/iap');
        const jwt = await purchasePlays(plan);
        updatePlayToken(jwt);
        setPaying(false);
        if (imageUri) {
          doGenerate(imageUri, jwt);
        }
        return;
      }

      // Web: Stripe Checkout
      const ref = Math.random().toString(36).substring(2, 15);
      const { url, sessionId: sid } = await startCheckout(ref, plan);
      setCurrentSessionId(sid);
      // On web, convert image to base64 before redirect (blob URLs don't survive redirect)
      if (typeof window !== 'undefined' && imageUri) {
        try {
          const res = await fetch(imageUri);
          const blob = await res.blob();
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          sessionStorage.setItem('pendingImageBase64', base64);
        } catch {}
      }
      setPaying(false);
      openPaymentUrl(url);
    } catch (e: any) {
      console.log('Payment error:', e.message);
      setPaying(false);
      setError(e.message || 'Payment failed');
    }
  }, [imageUri, updatePlayToken]);

  const handleCheckPayment = useCallback(async () => {
    if (!currentSessionId || !imageUri) return;
    setChecking(true);
    setError(null);
    try {
      const result = await confirmPayment(currentSessionId);
      if (result.paid && result.playToken) {
        updatePlayToken(result.playToken);
        setRemainingPlays(result.plays || 0);
        savedUri.current = imageUri;
        doGenerate(imageUri, result.playToken);
      } else {
        setChecking(false);
      }
    } catch {
      setChecking(false);
    }
  }, [currentSessionId, imageUri]);

  const handlePayWithPlan = useCallback((plan: PlanOption) => {
    handlePay(plan);
  }, [handlePay]);

  const handleRetry = () => {
    setError(null);
    const uri = savedUri.current || imageUri;
    if (uri && playToken) {
      doGenerate(uri, playToken);
    } else if (uri) {
      setLoading(false);
    } else {
      router.replace('/');
    }
  };

  const handlePlayAgain = () => {
    setGame((prev) => prev ? { ...prev, foundIndices: [], status: 'playing' } : prev);
    setRevealed(false);
  };

  /** Convert container-relative px to image-relative %, accounting for letterbox */
  const toImagePct = useCallback((px: number, py: number) => {
    if (!imageLayout || !imageSize) return null;
    const cw = imageLayout.w, ch = imageLayout.h;
    const iw = imageSize.w, ih = imageSize.h;
    if (!iw || !ih || !cw || !ch) return null;
    const renderW = Math.min(cw, ch * (iw / ih));
    const renderH = Math.min(ch, cw / (iw / ih));
    if (!renderW || !renderH) return null;
    const offsetX = (cw - renderW) / 2;
    const offsetY = (ch - renderH) / 2;
    const xPct = (px - offsetX) / renderW;
    const yPct = (py - offsetY) / renderH;
    if (isNaN(xPct) || isNaN(yPct) || xPct < 0 || xPct > 1 || yPct < 0 || yPct > 1) return null;
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
        xPct >= d.x - d.w / 2 - HIT_MARGIN &&
        xPct <= d.x + d.w / 2 + HIT_MARGIN &&
        yPct >= d.y - d.h / 2 - HIT_MARGIN &&
        yPct <= d.y + d.h / 2 + HIT_MARGIN
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
        <LoadingScreen insetsTop={insets.top} t={t} imageUri={savedUri.current} />
      ) : imageUri && !game && !error ? (
        <PaymentScreen
          insetsTop={insets.top}
          t={t}
          imageUri={imageUri}
          currentSessionId={currentSessionId}
          paying={paying}
          checking={checking}
          onPayWithPlan={handlePayWithPlan}
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
          tf={tf}
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
          remainingPlays={remainingPlays}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Separate component per state — each is a distinct React type, so transitions
// always trigger a clean unmount → remount cycle, never View-in-place update.
// ---------------------------------------------------------------------------

function LoadingScreen({ insetsTop, t, imageUri }: { insetsTop: number; t: (k: string) => string; imageUri?: string | null }) {
  const [targets, setTargets] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [score, setScore] = useState(0);
  const idRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const id = ++idRef.current;
      const x = 0.15 + Math.random() * 0.7;
      const y = 0.15 + Math.random() * 0.7;
      setTargets(prev => [...prev.slice(-3), { id, x, y }]);
      // auto-remove after 2s
      setTimeout(() => setTargets(prev => prev.filter(t => t.id !== id)), 2000);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const hitTarget = (id: number) => {
    setTargets(prev => prev.filter(t => t.id !== id));
    setScore(s => s + 1);
  };

  const isWeb = Platform.OS === 'web';
  const screenW = Dimensions.get('window').width;
  const previewW = isWeb ? 375 : screenW - 64;
  const previewH = isWeb ? 280 : Math.floor(previewW * 0.75);

  return (
    <View style={[styles.center, { paddingTop: insetsTop }]}>
      <ActivityIndicator size="large" color={THEME} />
      <Text style={styles.loadingLabel}>{t('generating')}</Text>
      <Text style={styles.loadingGameText}>{t('loadingGame')}</Text>
      {imageUri ? (
        <View style={{ width: previewW, height: previewH, borderRadius: 12, overflow: 'hidden', marginTop: 16 }}>
          <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          {targets.map(tg => (
            <TouchableWithoutFeedback key={tg.id} onPress={() => hitTarget(tg.id)}>
              <View style={[styles.target, { left: `${tg.x * 100}%`, top: `${tg.y * 100}%` }]} />
            </TouchableWithoutFeedback>
          ))}
          <View style={styles.targetScore}>
            <Text style={styles.targetScoreText}>{score}</Text>
          </View>
        </View>
      ) : null}
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
  onPayWithPlan: (plan: PlanOption) => void;
  onCheckPayment: () => void;
  onCancel: () => void;
  onCancelNav: () => void;
}

function PaymentScreen({
  insetsTop, t, imageUri, currentSessionId,
  paying, checking,
  onPayWithPlan, onCheckPayment, onCancel, onCancelNav,
}: PaymentScreenProps) {
  const isWeb = Platform.OS === 'web';
  const screenW = Dimensions.get('window').width;
  const previewW = isWeb ? 375 : screenW - 64;
  const previewH = isWeb ? 280 : Math.floor(previewW * 0.75);
  const awaitingPayment = currentSessionId !== null;

  return (
    <View style={[styles.center, { paddingTop: insetsTop }]}>
      <Ionicons name={awaitingPayment ? "hourglass-outline" : "lock-closed-outline"} size={36} color={THEME} />
      <Text style={styles.payTitle}>{t('payToPlay')}</Text>
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
          {PLANS.map((plan) => (
            <TouchableOpacity
              key={plan.plays}
              style={[styles.planBtn, paying && { opacity: 0.6 }]}
              onPress={() => onPayWithPlan(plan.plays)}
              disabled={paying}
            >
              <Text style={styles.planBtnLabel}>{t(plan.labelKey)}</Text>
              <Text style={styles.planBtnPrice}>{plan.price}</Text>
            </TouchableOpacity>
          ))}
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
  tf: (k: string, params?: Record<string, string | number>) => string;
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
  remainingPlays: number;
}

function GamePlayScreen({
  insetsTop, t, tf, game, revealed, onReveal, onBack, onPlayAgain,
  hitTest, imageLayout, onImageLayout, onImageLoad, imageSize,
  remainingPlays,
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
    if (!iw || !ih) return null;
    const renderW = Math.min(cw, ch * (iw / ih));
    const renderH = Math.min(ch, cw / (iw / ih));
    if (!renderW || !renderH) return null;
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
                {t('found')}: {game.foundIndices.length}/{game.totalChanges}
              </Text>
            </View>
            <View style={styles.hudRight}>
              <Text style={styles.playsLeft}>
                {tf('playsLeft', { n: remainingPlays })}
              </Text>
              {isWeb && <Text style={styles.versionBadge}>v1.0.19</Text>}
              <TouchableOpacity onPress={onReveal} style={styles.revealBtn} hitSlop={8}>
                <Text style={styles.revealBtnText}>{t('reveal')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          {content}

          {diffOffsets.length > 0 && (
            <View style={styles.descPanel}>
              {diffOffsets.map((di: number) => {
                const d = game.differences[di];
                return (
                  <View key={di} style={styles.descItem}>
                    <View style={styles.descNum}>
                      <Text style={styles.descNumText}>{di + 1}</Text>
                    </View>
                    <View style={styles.descTextWrap}>
                      <Text style={styles.descEn}>{d.description_en}</Text>
                      {d.description_zh ? (
                        <Text style={styles.descZh}>{d.description_zh}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
              {game.status === 'completed' && (
                <View style={styles.completedSection}>
                  <Ionicons name="checkmark-circle" size={32} color={THEME} />
                  <Text style={styles.completedText}>{t('completed')}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={onPlayAgain}>
                    <Text style={styles.retryBtnText}>{t('playAgain')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                    <Text style={styles.backBtnText}>{t('newPhoto')}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {revealed && game.status !== 'completed' && (
                <View style={styles.revealedActions}>
                  <TouchableOpacity style={styles.retryBtn} onPress={onPlayAgain}>
                    <Text style={styles.retryBtnText}>{t('playAgain')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                    <Text style={styles.backBtnText}>{t('newPhoto')}</Text>
                  </TouchableOpacity>
                </View>
              )}
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
                {t('found')}: {game.foundIndices.length}/{game.totalChanges}
              </Text>
            </View>
            <View style={styles.hudRight}>
              <Text style={styles.playsLeft}>
                {tf('playsLeft', { n: remainingPlays })}
              </Text>
              {isWeb && <Text style={styles.versionBadge}>v1.0.19</Text>}
              <TouchableOpacity onPress={onReveal} style={styles.revealBtn} hitSlop={8}>
                <Text style={styles.revealBtnText}>{t('reveal')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          {content}

          {diffOffsets.length > 0 && (
            <View style={styles.descPanel}>
              {diffOffsets.map((di: number) => {
                const d = game.differences[di];
                return (
                  <View key={di} style={styles.descItem}>
                    <View style={styles.descNum}>
                      <Text style={styles.descNumText}>{di + 1}</Text>
                    </View>
                    <View style={styles.descTextWrap}>
                      <Text style={styles.descEn}>{d.description_en}</Text>
                      {d.description_zh ? (
                        <Text style={styles.descZh}>{d.description_zh}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
              {game.status === 'completed' && (
                <View style={styles.completedSection}>
                  <Ionicons name="checkmark-circle" size={32} color={THEME} />
                  <Text style={styles.completedText}>{t('completed')}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={onPlayAgain}>
                    <Text style={styles.retryBtnText}>{t('playAgain')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                    <Text style={styles.backBtnText}>{t('newPhoto')}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {revealed && game.status !== 'completed' && (
                <View style={styles.revealedActions}>
                  <TouchableOpacity style={styles.retryBtn} onPress={onPlayAgain}>
                    <Text style={styles.retryBtnText}>{t('playAgain')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                    <Text style={styles.backBtnText}>{t('newPhoto')}</Text>
                  </TouchableOpacity>
                </View>
              )}
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
      onPress={(e: any) => {
            const ne = e.nativeEvent;
            let x = ne.locationX;
            let y = ne.locationY;
            // On web, locationX/Y are not set; compute from DOM event
            if (x === undefined && e.currentTarget) {
              const rect = e.currentTarget.getBoundingClientRect();
              x = ne.clientX - rect.left;
              y = ne.clientY - rect.top;
            }
            onTap(x, y);
          }}
    >
      <View style={[styles.imgWrapper, { width, height }]}>
        <Image
          source={{ uri: source }}
          style={{ width, height }}
          onLayout={() => onLayout(width, height)}
          onLoad={(e: any) => {
            const ne = e.nativeEvent;
            const iw = ne.source?.width || ne.target?.naturalWidth || 1;
            const ih = ne.source?.height || ne.target?.naturalHeight || 1;
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
                left: imgRender.offsetX + d.x * imgRender.renderW - 25,
                top: imgRender.offsetY + d.y * imgRender.renderH - 25,
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
  containerWeb: { minHeight: '100vh', backgroundColor: '#FFF' },
  scrollWeb: { minHeight: '100vh' },
  loadingLabel: { fontSize: 15, color: '#888', marginTop: 8 },
  loadingGameText: { fontSize: 13, color: '#AAA' },
  target: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,107,138,0.7)',
    borderWidth: 2,
    borderColor: '#FFF',
    marginLeft: -22,
    marginTop: -22,
  },
  targetScore: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  targetScoreText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
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
  playsLeft: { fontSize: 12, color: '#999', fontWeight: '500' },
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
    width: 50,
    height: 50,
    borderWidth: 3,
    borderColor: THEME,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 107, 138, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    color: THEME,
    fontSize: 18,
    fontWeight: '800',
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
  buttonRow: { gap: 8, marginTop: 8 },
  revealedActions: { marginTop: 16, gap: 8 },
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
  planBtn: {
    backgroundColor: THEME,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planBtnLabel: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  planBtnPrice: { color: '#FFF', fontSize: 20, fontWeight: '800' },
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
  descPanel: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    gap: 8,
  },
  completedSection: {
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  descItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  descNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: THEME,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  descNumText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  descTextWrap: {
    flex: 1,
  },
  descEn: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  descZh: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
    marginTop: 2,
  },
});

export default function GameScreenWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <GameScreen />
    </ErrorBoundary>
  );
}
