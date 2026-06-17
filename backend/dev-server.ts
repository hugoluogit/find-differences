import express from 'express';
import sharp from 'sharp';
import Stripe from 'stripe';
import { generateModifiedImage } from './lib/generateDiff';
import { findDifferences } from './lib/findDifferences';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-03-31.basil' as any });
const usedSessions = new Set<string>();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));

// --- Checkout: create Stripe session ---
app.post('/api/checkout', async (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: '找不同 — 一局' },
            unit_amount: 50, // $0.50 (Stripe min ~$0.50)
          },
          quantity: 1,
        },
      ],
      success_url: 'find-differences://payment-success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'find-differences://payment-cancelled',
    });

    return res.json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create checkout' });
  }
});

// --- Generate: verify payment then generate puzzle ---
app.post('/api/generate', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const { image: base64Image, sessionId } = req.body;
    if (!base64Image) {
      return res.status(400).json({ error: 'Missing "image" field' });
    }

    // Verify Stripe session
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(402).json({ error: 'Payment required' });
    }
    if (usedSessions.has(sessionId)) {
      return res.status(402).json({ error: 'Session already used' });
    }
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== 'paid') {
        return res.status(402).json({ error: 'Payment not completed' });
      }
    } catch {
      return res.status(402).json({ error: 'Invalid session' });
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
      .resize(origMeta.width!, origMeta.height!, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 85 })
      .toBuffer();

    const differences = await findDifferences(processed, modified, apiKey);

    // Only mark session as used AFTER successful generation
    usedSessions.add(sessionId);

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
