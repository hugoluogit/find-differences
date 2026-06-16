const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: '找不同 — 一局' },
            unit_amount: 10, // $0.10
          },
          quantity: 1,
        },
      ],
      success_url: 'find-differences://payment-success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'find-differences://payment-cancelled',
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create checkout' });
  }
};
