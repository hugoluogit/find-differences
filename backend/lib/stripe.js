// In-memory set of used session IDs (resets on cold start — acceptable for hobby)
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

module.exports = { verifySession, consumeSession, usedSessions };
