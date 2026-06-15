import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // Test 1: basic
    const basic = 'hello';

    // Test 2: sharp
    let sharpOk = false;
    let sharpError: string | null = null;
    try {
      const sharp = require('sharp');
      await sharp({
        create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } },
      }).jpeg().toBuffer();
      sharpOk = true;
    } catch (e: any) {
      sharpError = e.message;
    }

    // Test 3: fetch
    let fetchOk = false;
    try {
      const r = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.ARK_API_KEY },
        body: JSON.stringify({ model: 'doubao-seed-2-0-lite-260215', messages: [{ role: 'user', content: 'hi' }], max_tokens: 10 }),
      });
      fetchOk = r.ok || r.status === 400; // 400 = reached API (bad key), better than network error
    } catch (e: any) {
      fetchOk = false;
    }

    return response.status(200).json({
      basic,
      sharpOk,
      sharpError,
      fetchOk,
      envKeySet: !!process.env.ARK_API_KEY,
      nodeVersion: process.version,
    });
  } catch (error: any) {
    return response.status(500).json({
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
    });
  }
}
