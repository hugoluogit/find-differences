// Track sessionId → remaining plays (not binary consumed)
const sessionPlays = new Map();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return require('stripe')(key);
}

async function verifySession(sessionId) {
  if (!sessionId) {
    console.log('verifySession: missing sessionId');
    return false;
  }

  // Check in-memory remaining plays first
  if (sessionPlays.has(sessionId)) {
    const remaining = sessionPlays.get(sessionId);
    if (remaining <= 0) {
      console.log('verifySession: session out of plays', sessionId);
      return false;
    }
    return true;
  }

  const stripe = getStripe();
  if (!stripe) {
    console.log('verifySession: STRIPE_SECRET_KEY not configured');
    return false;
  }

  try {
    console.log('verifySession: retrieving session', sessionId);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log('verifySession: payment_status =', session.payment_status);
    if (session.payment_status !== 'paid') return false;

    // Initialize play count from metadata
    const plays = parseInt(session.metadata?.plays || '1', 10);
    sessionPlays.set(sessionId, plays);
    return true;
  } catch (e) {
    console.error('verifySession: Stripe API error:', e.message, e.type, e.code);
    return false;
  }
}

// Deduct one play, returns true if session still has plays remaining
function consumeSession(sessionId) {
  if (!sessionId || !sessionPlays.has(sessionId)) return false;
  const remaining = sessionPlays.get(sessionId);
  if (remaining <= 0) return false;
  sessionPlays.set(sessionId, remaining - 1);
  console.log('consumeSession:', sessionId, 'plays left:', remaining - 1);
  return true;
}

function getRemainingPlays(sessionId) {
  return sessionPlays.has(sessionId) ? sessionPlays.get(sessionId) : 0;
}

module.exports = { verifySession, consumeSession, getRemainingPlays, sessionPlays };
