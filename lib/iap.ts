import {
  initConnection,
  endConnection,
  fetchProducts as fetchIapProducts,
  requestPurchase,
  finishTransaction,
  type Purchase,
  type Product,
} from 'expo-iap';
import { verifyReceipt } from './api';
import { saveJwt } from './store';

const PRODUCT_IDS = [
  'com.hugoluo.finddifferences.1play',
  'com.hugoluo.finddifferences.5play',
] as const;

const PLAN_TO_SKU: Record<1 | 5, string> = {
  1: 'com.hugoluo.finddifferences.1play',
  5: 'com.hugoluo.finddifferences.5play',
};

let initialized = false;

export async function setupIAP() {
  if (initialized) return;
  try {
    await initConnection();
    initialized = true;
  } catch {
    // IAP not available on this device
  }
}

export async function fetchProducts(): Promise<Product[]> {
  try {
    const products = await (fetchIapProducts as any)({ skus: [...PRODUCT_IDS] });
    return Array.isArray(products) ? (products as Product[]) : [];
  } catch {
    return [];
  }
}

export async function purchasePlays(plan: 1 | 5): Promise<string | null> {
  if (!initialized) await setupIAP();

  const sku = PLAN_TO_SKU[plan];

  // Load products first so StoreKit has the product metadata before purchasing
  const products = await fetchProducts();
  if (!products.some((p) => p.id === sku)) {
    // StoreKit couldn't load the product — most often the Paid Apps Agreement
    // isn't signed or the product is misconfigured in App Store Connect.
    throw new Error('This item is not available for purchase');
  }

  let purchase;
  try {
    purchase = await requestPurchase({
      request: {
        ios: { sku },
        android: { skus: [sku] },
      },
      type: 'in-app',
    });
  } catch (e: any) {
    // The user dismissed the payment sheet — not a real failure.
    if (e?.code === 'user-cancelled') return null;
    // Surface the native error code so IAP failures are diagnosable.
    const code = e?.code ? `${e.code}: ` : '';
    throw new Error(`${code}${e?.message || 'Purchase failed'}`);
  }

  if (!purchase) {
    return null;
  }

  const p = Array.isArray(purchase) ? purchase[0] : purchase;

  // purchaseToken is the StoreKit 2 JWS on iOS (Play token on Android). The
  // backend verifies the JWS directly, avoiding the legacy base64 receipt that
  // was unreliable in the StoreKit 2 sandbox.
  const receipt = (p as Purchase).purchaseToken;

  if (!receipt) {
    throw new Error('[token] empty');
  }

  let jwt: string;
  try {
    ({ jwt } = await verifyReceipt(receipt));
  } catch (e: any) {
    throw new Error(`[verify] ${e?.message || e}`);
  }

  try {
    await finishTransaction({ purchase: p, isConsumable: true });
  } catch (e: any) {
    // Non-fatal: the play was already granted via the JWT above.
    console.log('finishTransaction failed (non-fatal):', e?.message || e);
  }

  saveJwt(jwt);

  return jwt;
}

export async function cleanupIAP() {
  if (initialized) {
    try {
      await endConnection();
    } catch {
      // ignore
    }
    initialized = false;
  }
}
