const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// In-memory set of used session IDs (resets on cold start — acceptable for hobby)
const usedSessions = new Set();

async function verifySession(sessionId) {
  if (!sessionId) return false;
  if (usedSessions.has(sessionId)) return false;

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
