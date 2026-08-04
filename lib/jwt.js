const { SignJWT, jwtVerify } = require('jose');

const JWT_EXPIRY = '30d';

function getSecret() {
  const raw = process.env.JWT_SECRET;
  if (!raw) throw new Error('JWT_SECRET not configured');
  return new TextEncoder().encode(raw);
}

/** Create a JWT with remaining plays for a given transaction */
async function createPlayToken(transactionId, playsRemaining) {
  return new SignJWT({ transactionId, playsRemaining })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getSecret());
}

/**
 * Verify a JWT and consume one play.
 * Returns { remaining, newToken } where newToken is null when empty.
 * Throws on invalid/expired/exhausted tokens.
 */
async function verifyAndConsume(token) {
  const { payload } = await jwtVerify(token, getSecret());
  if (typeof payload.playsRemaining !== 'number' || payload.playsRemaining <= 0) {
    throw new Error('No plays remaining');
  }
  const remaining = payload.playsRemaining - 1;
  const newToken = remaining > 0
    ? await createPlayToken(payload.transactionId, remaining)
    : null;
  return { remaining, newToken };
}

const PLAYS_PER_PRODUCT = {
  'com.hugoluo.finddifferences.1play': 1,
  'com.hugoluo.finddifferences.5plays': 5,
  'com.hugoluo.finddifferences.10plays': 10,
};

module.exports = { createPlayToken, verifyAndConsume, PLAYS_PER_PRODUCT };
