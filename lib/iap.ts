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
  'com.hugoluo.finddifferences.10play',
] as const;

const PLAN_TO_SKU: Record<1 | 5 | 10, string> = {
  1: 'com.hugoluo.finddifferences.1play',
  5: 'com.hugoluo.finddifferences.5play',
  10: 'com.hugoluo.finddifferences.10play',
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

export async function purchasePlays(plan: 1 | 5 | 10): Promise<string> {
  if (!initialized) await setupIAP();

  const sku = PLAN_TO_SKU[plan];

  const purchase = await requestPurchase({
    request: {
      apple: { sku },
      google: { skus: [sku] },
    },
    type: 'in-app',
  });

  if (!purchase) {
    throw new Error('Purchase returned no data');
  }

  const p = Array.isArray(purchase) ? purchase[0] : purchase;

  const receipt = (p as any).transactionReceipt || (p as Purchase).purchaseToken;
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
