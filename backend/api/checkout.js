module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  try {
    const stripe = require('stripe')(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'hkd',
            product_data: { name: '找不同 — 一局' },
            unit_amount: 400, // HK$4.00 ≈ $0.51 USD (Stripe min ~400 HKD cents)
          },
          quantity: 1,
        },
      ],
      success_url: 'https://find-differences-m5tr.vercel.app/api/payment-callback?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'find-differences://payment-cancelled',
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create checkout' });
  }
};
