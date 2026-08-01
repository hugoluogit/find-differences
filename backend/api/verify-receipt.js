const { createPlayToken, PLAYS_PER_PURCHASE } = require('../lib/jwt');

const PRODUCT_ID = 'com.hugoluo.finddifferences.4plays';
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
    // Try production first
    let appleResult = await verifyWithApple(receipt, APPLE_PRODUCTION);

    // status 21007 = sandbox receipt sent to production — retry sandbox
    if (appleResult.status === 21007) {
      appleResult = await verifyWithApple(receipt, APPLE_SANDBOX);
    }

    if (appleResult.status !== 0) {
      console.error('Apple receipt validation failed:', appleResult.status);
      return res.status(400).json({ error: 'Invalid receipt', status: appleResult.status });
    }

    // Extract the latest transaction for our product
    const inApp = appleResult.receipt?.in_app || [];
    const ourTx = inApp.find((tx) => tx.product_id === PRODUCT_ID);
    if (!ourTx) {
      return res.status(400).json({ error: 'Product not found in receipt' });
    }

    const transactionId = ourTx.original_transaction_id;
    const jwt = await createPlayToken(transactionId);

    return res.json({ jwt, playsRemaining: PLAYS_PER_PURCHASE });
  } catch (error) {
    console.error('Receipt verification error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
