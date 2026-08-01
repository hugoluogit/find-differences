import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  type Purchase,
  type Product,
} from 'expo-iap';
import { verifyReceipt } from './api';
import { saveJwt } from './store';

const PRODUCT_ID = 'com.hugoluo.finddifferences.4plays';

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

export function getPurchaseProductId() {
  return PRODUCT_ID;
}

export async function fetchProduct(): Promise<Product | null> {
  try {
    const products = await fetchProducts({ skus: [PRODUCT_ID] });
    if (Array.isArray(products) && products.length > 0) {
      return products[0] as Product;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Start a purchase flow for 4 plays.
 * Returns the JWT from the backend after receipt validation.
 */
export async function purchase4Plays(): Promise<string> {
  if (!initialized) await setupIAP();

  const purchase = await requestPurchase({
    request: {
      apple: { sku: PRODUCT_ID },
      google: { sku: PRODUCT_ID },
    },
    type: 'in-app',
  });

  if (!purchase) {
    throw new Error('Purchase returned no data');
  }

  const p = Array.isArray(purchase) ? purchase[0] : purchase;

  const receipt = (p as Purchase).purchaseToken;
  if (!receipt) {
    throw new Error('No receipt received from App Store');
  }

  const { jwt } = await verifyReceipt(receipt);

  await finishTransaction({ purchase: p, isConsumable: true });

  await saveJwt(jwt);

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
