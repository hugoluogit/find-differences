const { findSessionByRef } = require('../lib/stripe');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { paymentRef } = req.body || {};
  if (!paymentRef) {
    return res.status(400).json({ error: 'Missing paymentRef' });
  }

  const sessionId = await findSessionByRef(paymentRef);
  if (!sessionId) {
    return res.json({ paid: false, sessionId: null });
  }

  return res.json({ paid: true, sessionId });
};
