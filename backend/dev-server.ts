import express from 'express';
import sharp from 'sharp';
import { generateModifiedImage } from './lib/generateDiff';
import { findDifferences } from './lib/findDifferences';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));

app.post('/api/generate', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const { image: base64Image } = req.body;
    if (!base64Image) {
      return res.status(400).json({ error: 'Missing "image" field' });
    }

    const apiKey = process.env.ARK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ARK_API_KEY not configured' });
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

    // Step 1: AI generates a modified version
    const modifiedBuffer = await generateModifiedImage(squareInput, apiKey);

    // Step 2: Center-crop AI output back to original's aspect ratio so both
    // images have the same dimensions for display and pixel comparison.
    const origMeta = await sharp(processed).metadata();
    const modified = await sharp(modifiedBuffer)
      .resize(origMeta.width!, origMeta.height!, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Step 3: Use vision model to identify differences
    const differences = await findDifferences(processed, modified, apiKey);

    return res.json({
      originalImage: processed.toString('base64'),
      modifiedImage: modified.toString('base64'),
      differences,
      totalChanges: differences.length,
    });
  } catch (error: any) {
    console.error('Generation failed:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});
