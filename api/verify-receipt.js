const { createPlayToken, PLAYS_PER_PRODUCT } = require('../lib/jwt');
const { verifyStoreKitJws } = require('../lib/apple-jws');

const PRODUCT_IDS = [
  'com.hugoluo.finddifferences.1play',
  'com.hugoluo.finddifferences.5play',
];
const BUNDLE_ID = 'com.hugoluo.finddifferences';
const APPLE_PRODUCTION = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX = 'https://sandbox.itunes.apple.com/verifyReceipt';

function getSharedSecret() {
  const secret = process.env.APPLE_SHARED_SECRET;
  if (!secret) throw new Error('APPLE_SHARED_SECRET not configured');
  return secret;
}

async function verifyWithApple(receiptData, url) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'receipt-data': receiptData,
      password: getSharedSecret(),
      'exclude-old-transactions': true,
    }),
  });
  return res.json();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { receipt } = req.body || {};
  if (!receipt) {
    return res.status(400).json({ error: 'Missing receipt' });
  }

  try {
    let productId;
    let transactionId;

    // A StoreKit 2 JWS contains '.' separators; a legacy base64 receipt does not.
    if (receipt.includes('.')) {
      const payload = verifyStoreKitJws(receipt);
      if (payload.bundleId !== BUNDLE_ID) {
        return res.status(400).json({ error: 'Bundle ID mismatch' });
      }
      productId = payload.productId;
      transactionId = payload.transactionId;
    } else {
      // Legacy base64 receipt — try production first.
      let appleResult = await verifyWithApple(receipt, APPLE_PRODUCTION);

      // status 21007 = sandbox receipt sent to production — retry sandbox.
      if (appleResult.status === 21007) {
        appleResult = await verifyWithApple(receipt, APPLE_SANDBOX);
      }

      if (appleResult.status !== 0) {
        console.error('Apple receipt validation failed:', appleResult.status);
        return res.status(400).json({ error: 'Invalid receipt', status: appleResult.status });
      }

      const inApp = appleResult.receipt?.in_app || [];
      const ourTx = inApp.find((tx) => PRODUCT_IDS.includes(tx.product_id));
      if (!ourTx) {
        return res.status(400).json({ error: 'Product not found in receipt' });
      }
      productId = ourTx.product_id;
      transactionId = ourTx.original_transaction_id;
    }

    if (!PRODUCT_IDS.includes(productId)) {
      return res.status(400).json({ error: 'Product not found' });
    }

    const playsRemaining = PLAYS_PER_PRODUCT[productId] || 1;
    const jwt = await createPlayToken(transactionId, playsRemaining);

    return res.json({ jwt, playsRemaining });
  } catch (error) {
    console.error('Receipt verification error:', error);
    return res.status(400).json({ error: error.message || 'Invalid receipt' });
  }
};
