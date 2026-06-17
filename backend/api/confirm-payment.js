const { verifySession } = require('../lib/stripe');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { sessionId } = req.body || {};
  if (!sessionId) {
    return res.json({ paid: false, sessionId: null });
  }

  const paid = await verifySession(sessionId);
  if (!paid) {
    return res.json({ paid: false, sessionId: null });
  }

  return res.json({ paid: true, sessionId });
};
