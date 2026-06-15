import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const sharp = require('sharp');
    const buf = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } },
    }).jpeg().toBuffer();

    return response.status(200).json({
      sharpOk: true,
      bufLength: buf.length,
      envKeySet: !!process.env.ARK_API_KEY,
    });
  } catch (error: any) {
    return response.status(500).json({
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    });
  }
}
