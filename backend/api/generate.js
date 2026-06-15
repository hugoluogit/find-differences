const sharp = require('sharp');
const { generateModifiedImage } = require('../lib/generateDiff');
const { findDifferences } = require('../lib/findDifferences');

module.exports = async (req, res) => {
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

    const processed = await sharp(rawBuffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const squareInput = await sharp(processed)
      .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 85 })
      .toBuffer();

    const modifiedBuffer = await generateModifiedImage(squareInput, apiKey);

    const origMeta = await sharp(processed).metadata();
    const modified = await sharp(modifiedBuffer)
      .resize(origMeta.width, origMeta.height, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 85 })
      .toBuffer();

    const differences = await findDifferences(processed, modified, apiKey);

    return res.json({
      originalImage: processed.toString('base64'),
      modifiedImage: modified.toString('base64'),
      differences,
      totalChanges: differences.length,
    });
  } catch (error) {
    console.error('Generation failed:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
