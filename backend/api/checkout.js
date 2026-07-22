// Stripe lookup is done via client_reference_id, no in-memory store needed

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const { paymentRef, returnUrl } = req.body || {};
  if (!paymentRef) {
    return res.status(400).json({ error: 'Missing paymentRef' });
  }

  try {
    const stripe = require('stripe')(secretKey);
    const metadata = {};
    if (returnUrl) metadata.returnUrl = returnUrl;

    const callbackBase = 'https://find-differences-m5tr.vercel.app/api/payment-callback';
    const successParams = new URLSearchParams({ session_id: '{CHECKOUT_SESSION_ID}' });
    const cancelParams = new URLSearchParams({ cancelled: '1' });
    if (returnUrl) {
      successParams.set('return_url', encodeURIComponent(returnUrl));
      cancelParams.set('return_url', encodeURIComponent(returnUrl));
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'hkd',
            product_data: { name: '找不同 — 一局' },
            unit_amount: 400, // HK$4.00 ≈ $0.51 USD
          },
          quantity: 1,
        },
      ],
      client_reference_id: paymentRef,
      metadata,
      success_url: `${callbackBase}?${successParams.toString()}`,
      cancel_url: `${callbackBase}?${cancelParams.toString()}`,
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create checkout' });
  }
};
