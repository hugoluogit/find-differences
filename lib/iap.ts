import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts as fetchIapProducts,
  requestPurchase,
  finishTransaction,
  getReceiptDataIOS,
  requestReceiptRefreshIOS,
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

export async function purchasePlays(plan: 1 | 5): Promise<string> {
  if (!initialized) await setupIAP();

  const sku = PLAN_TO_SKU[plan];

  // Load products first so StoreKit has the product metadata before purchasing
  const products = await fetchProducts();
  if (products.length > 0 && !products.some((p) => p.id === sku)) {
    throw new Error('This item is not available for purchase');
  }

  const purchase = await requestPurchase({
    request: {
      ios: { sku },
      android: { skus: [sku] },
    },
    type: 'in-app',
  });

  if (!purchase) {
    throw new Error('Purchase was cancelled or returned no data');
  }

  const p = Array.isArray(purchase) ? purchase[0] : purchase;

  // New expo-iap returns a JWS in purchaseToken, but our backend validates the
  // legacy base64 receipt — fetch that on iOS instead.
  let receipt: string | null | undefined;
  if (Platform.OS === 'ios') {
    receipt = await getReceiptDataIOS();
    if (!receipt) receipt = await requestReceiptRefreshIOS();
  } else {
    receipt = (p as Purchase).purchaseToken;
  }

  if (!receipt) {
    throw new Error('No receipt received from App Store');
  }

  const { jwt } = await verifyReceipt(receipt);

  await finishTransaction({ purchase: p, isConsumable: true });

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
