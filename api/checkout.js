const PLANS = {
  1: { price: 400, name: '找不同 — 1 局', plays: 1 },      // HK$4.00
  5: { price: 800, name: '找不同 — 5 局', plays: 5 },      // HK$8.00
  10: { price: 1200, name: '找不同 — 10 局', plays: 10 },  // HK$12.00
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const secretKey = process.env.STRIPE_SECRET_KEY;
  console.log('checkout: key prefix =', secretKey ? secretKey.substring(0, 8) : 'undefined');
  if (!secretKey) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const { paymentRef, returnUrl, plan } = req.body || {};
  if (!paymentRef) {
    return res.status(400).json({ error: 'Missing paymentRef' });
  }

  const planConfig = PLANS[plan] || PLANS[1];

  try {
    const stripe = require('stripe')(secretKey);
    const metadata = { plays: String(planConfig.plays) };
    if (returnUrl) metadata.returnUrl = returnUrl;

    const returnParam = returnUrl ? `&return_url=${encodeURIComponent(returnUrl)}` : '';
    const callbackBase = 'https://ai-find-differences.vercel.app/api/payment-callback';

    const successUrl = `${callbackBase}?session_id={CHECKOUT_SESSION_ID}${returnParam}`;
    const cancelUrl = `${callbackBase}?cancelled=1${returnParam}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'alipay'],
      line_items: [
        {
          price_data: {
            currency: 'hkd',
            product_data: { name: planConfig.name },
            unit_amount: planConfig.price,
          },
          quantity: 1,
        },
      ],
      client_reference_id: paymentRef,
      metadata,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return res.json({ url: session.url, sessionId: session.id, plays: planConfig.plays });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create checkout' });
  }
};
