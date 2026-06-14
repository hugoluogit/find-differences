import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import { generateModifiedImage } from '../lib/generateDiff';
import { findDifferences } from '../lib/findDifferences';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const { image: base64Image } = body;

    if (!base64Image) {
      return response.status(400).json({ error: 'Missing "image" field in request body' });
    }

    const apiKey = process.env.ARK_API_KEY;
    if (!apiKey) {
      return response.status(500).json({ error: 'ARK_API_KEY not configured' });
    }

    const rawBuffer = Buffer.from(base64Image, 'base64');

    // Resize original preserving aspect ratio (max 1024 on longest side)
    const processed = await sharp(rawBuffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    // For AI input, pad to square so the model gets a 1:1 image
    const squareInput = await sharp(processed)
      .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 85 })
      .toBuffer();

    const modifiedBuffer = await generateModifiedImage(squareInput, apiKey);

    // Center-crop AI output back to original's aspect ratio
    const origMeta = await sharp(processed).metadata();
    const modified = await sharp(modifiedBuffer)
      .resize(origMeta.width!, origMeta.height!, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 85 })
      .toBuffer();

    const differences = await findDifferences(processed, modified, apiKey);

    return response.status(200).json({
      originalImage: processed.toString('base64'),
      modifiedImage: modified.toString('base64'),
      differences,
      totalChanges: differences.length,
    });
  } catch (error: any) {
    console.error('Generation failed:', error);
    return response.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
}
