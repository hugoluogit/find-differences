const { createPlayToken } = require('../lib/jwt');

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return require('stripe')(key);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { sessionId } = req.body || {};
  if (!sessionId) {
    console.log('confirm-payment: missing sessionId');
    return res.json({ paid: false, playToken: null, reason: 'missing sessionId' });
  }

  const stripe = getStripe();
  if (!stripe) {
    console.log('confirm-payment: STRIPE_SECRET_KEY not configured');
    return res.json({ paid: false, playToken: null, reason: 'stripe not configured' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log('confirm-payment: session', sessionId, 'payment_status =', session.payment_status);

    if (session.payment_status !== 'paid') {
      return res.json({ paid: false, playToken: null, reason: 'not paid' });
    }

    const plays = parseInt(session.metadata?.plays || '1', 10);
    const playToken = await createPlayToken(sessionId, plays);
    console.log('confirm-payment: created playToken with', plays, 'plays');

    return res.json({ paid: true, playToken, plays });
  } catch (e) {
    console.error('confirm-payment error:', e.message);
    return res.json({ paid: false, playToken: null, reason: e.message });
  }
};
