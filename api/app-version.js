module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // When we publish a breaking update, bump this value.
  // Users running a lower version will be blocked until they update.
  const minimumVersion = process.env.MINIMUM_APP_VERSION || '1.0.0';

  return res.json({ minimumVersion });
};
