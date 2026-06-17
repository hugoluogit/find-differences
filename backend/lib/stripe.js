const usedSessions = new Set();
const paymentRefs = new Map(); // paymentRef → { sessionId, paid }

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

function storePaymentRef(paymentRef, sessionId) {
  paymentRefs.set(paymentRef, { sessionId, paid: false });
  // Auto-cleanup after 1 hour
  setTimeout(() => paymentRefs.delete(paymentRef), 3600000);
}

async function resolvePaymentRef(paymentRef) {
  const entry = paymentRefs.get(paymentRef);
  if (!entry) return null;
  if (entry.paid) return entry.sessionId; // already confirmed

  // Check Stripe payment status
  const stripe = getStripe();
  if (!stripe) return null;

  try {
    const session = await stripe.checkout.sessions.retrieve(entry.sessionId);
    if (session.payment_status === 'paid') {
      entry.paid = true;
      return entry.sessionId;
    }
    return null;
  } catch {
    return null;
  }
}

module.exports = { verifySession, consumeSession, usedSessions, storePaymentRef, resolvePaymentRef };
