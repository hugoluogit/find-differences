const usedSessions = new Set();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return require('stripe')(key);
}

async function verifySession(sessionId) {
  if (!sessionId) return false;
  if (usedSessions.has(sessionId)) return false;

  const stripe = getStripe();
  if (!stripe) return false;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session.payment_status === 'paid';
  } catch {
    return false;
  }
}

function consumeSession(sessionId) {
  if (sessionId) usedSessions.add(sessionId);
}

async function findSessionByRef(paymentRef) {
  const stripe = getStripe();
  if (!stripe) return null;

  const sessions = await stripe.checkout.sessions.list({
    client_reference_id: paymentRef,
    limit: 1,
  });

  const session = sessions.data?.[0];
  if (!session || session.payment_status !== 'paid') return null;
  return session.id;
}

module.exports = { verifySession, consumeSession, usedSessions, findSessionByRef };
