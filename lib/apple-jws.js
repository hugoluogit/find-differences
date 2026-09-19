const crypto = require('crypto');

// Apple Root CA - G3 is the trust anchor for StoreKit 2 signed transactions.
// Public cert distributed by Apple at
// https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
const APPLE_ROOT_CA_G3 = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`;

function base64UrlToBuffer(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * Verify a StoreKit 2 signed transaction (JWS) and return its decoded payload.
 * Throws if the token is malformed, the signature is invalid, or the
 * certificate chain does not anchor to Apple Root CA - G3.
 */
function verifyStoreKitJws(jws) {
  const parts = jws.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWS format');

  const [headerB64, payloadB64, sigB64] = parts;

  let header;
  try {
    header = JSON.parse(base64UrlToBuffer(headerB64).toString('utf8'));
  } catch {
    throw new Error('Invalid JWS header');
  }

  if (header.alg !== 'ES256') throw new Error('Unsupported JWS algorithm');
  if (!Array.isArray(header.x5c) || header.x5c.length === 0) {
    throw new Error('Missing x5c certificate chain');
  }

  const certs = header.x5c.map(
    (b64) => new crypto.X509Certificate(Buffer.from(b64, 'base64'))
  );
  const root = new crypto.X509Certificate(APPLE_ROOT_CA_G3);

  // Verify each certificate is signed by the next, anchoring to Apple Root CA - G3.
  for (let i = 0; i < certs.length; i++) {
    const issuer = i + 1 < certs.length ? certs[i + 1] : root;
    if (!certs[i].verify(issuer.publicKey)) {
      throw new Error('Invalid certificate chain');
    }
  }

  // Verify the ES256 signature over header.payload using the leaf certificate's key.
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
  const signature = base64UrlToBuffer(sigB64);
  const valid = crypto.verify(
    'sha256',
    signingInput,
    { key: certs[0].publicKey, dsaEncoding: 'ieee-p1363' },
    signature
  );
  if (!valid) throw new Error('Invalid JWS signature');

  let payload;
  try {
    payload = JSON.parse(base64UrlToBuffer(payloadB64).toString('utf8'));
  } catch {
    throw new Error('Invalid JWS payload');
  }
  return payload;
}

module.exports = { verifyStoreKitJws };
