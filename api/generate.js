const sharp = require('sharp');
const { generateModifiedImage } = require('../lib/generateDiff');
const { planChanges } = require('../lib/planChanges');
const { verifyAndConsume } = require('../lib/jwt');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const { image: base64Image, playToken } = req.body;
    if (!base64Image) {
      return res.status(400).json({ error: 'Missing "image" field' });
    }

    if (!playToken) {
      return res.status(402).json({ error: 'Payment required' });
    }

    let consumed;
    try {
      consumed = await verifyAndConsume(playToken);
    } catch {
      return res.status(402).json({ error: 'Invalid or expired play token' });
    }

    const apiKey = process.env.ARK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ARK_API_KEY not configured' });
    }

    const rawBuffer = Buffer.from(base64Image, 'base64');

    const processed = await sharp(rawBuffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const squareInput = await sharp(processed)
      .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Step 1: Plan 5 changes with ARK vision model
    const changes = await planChanges(squareInput, apiKey);

    // Step 2: Build specific prompt for Seedream
    const changePrompt = changes.map((c, i) =>
      `${i + 1}. ${c.description_en} (at x:${c.x.toFixed(2)}, y:${c.y.toFixed(2)}, w:${c.w.toFixed(2)}, h:${c.h.toFixed(2)})`
    ).join('\n');

    // Step 3: Generate modified image
    const modifiedBuffer = await generateModifiedImage(squareInput, apiKey, changePrompt);

    // Step 4: Resize modified to match original dimensions
    const origMeta = await sharp(processed).metadata();
    const modified = await sharp(modifiedBuffer)
      .resize(origMeta.width, origMeta.height, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Step 5: Use ARK vision model's bounding boxes directly
    const differences = changes.map((c) => ({
      x: c.x, y: c.y, w: c.w, h: c.h,
      description_en: c.description_en,
      description_zh: c.description_zh,
    }));

    return res.json({
      originalImage: processed.toString('base64'),
      modifiedImage: modified.toString('base64'),
      differences,
      totalChanges: differences.length,
      remainingPlays: consumed.remaining,
      newPlayToken: consumed.newToken,
    });
  } catch (error) {
    console.error('Generation failed:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
