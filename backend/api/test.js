module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const results = {};

  try {
    const sharp = require('sharp');
    results.sharpLoaded = true;
    const buf = await sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } } }).jpeg().toBuffer();
    results.sharpWorked = true;
    results.bufLen = buf.length;
  } catch (e) {
    results.sharpError = e.message;
  }

  try {
    const fetchOk = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.ARK_API_KEY },
      body: JSON.stringify({ model: 'doubao-seed-2-0-lite-260215', messages: [{ role: 'user', content: 'hi' }], max_tokens: 10 }),
    });
    results.fetchStatus = fetchOk.status;
  } catch (e) {
    results.fetchError = e.message;
  }

  results.envKeySet = !!process.env.ARK_API_KEY;
  res.status(200).json(results);
};
