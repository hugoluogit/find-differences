const sharp = require('sharp');

const ARK_API = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

async function findDifferences(original, modified, apiKey) {
  if (!apiKey) return [];

  // Step 1: Use vision model to find differences
  const visionDiffs = await findWithVision(original, modified, apiKey);

  // Step 2: Use pixel comparison to fill gaps
  const pixelDiffs = await findWithPixels(original, modified);

  // Step 3: Merge results — prefer vision, fill missing with pixel
  const merged = mergeDiffs(visionDiffs, pixelDiffs);
  return merged.slice(0, 5);
}

// --- Vision model approach ---
async function findWithVision(original, modified, apiKey) {
  const oBase64 = original.toString('base64');
  const mBase64 = modified.toString('base64');

  const body = {
    model: 'doubao-seed-2-0-lite-260215',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'You are a spot-the-difference puzzle solver.\n' +
              'Image A is the original photo. Image B has exactly 5 subtle visual changes.\n' +
              'Find all 5 differences between Image A and Image B.\n' +
              'For each difference, give the bounding box as percentage coordinates (0–1).\n' +
              'Respond with ONLY a JSON array, no other text:\n' +
              '[\n  {"x":0.xx,"y":0.xx,"w":0.xx,"h":0.xx},\n  ...\n]',
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${oBase64}`, detail: 'high' },
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${mBase64}`, detail: 'high' },
          },
        ],
      },
      { role: 'assistant', content: '[' },
    ],
    max_tokens: 1024,
    temperature: 0.1,
  };

  const resp = await fetch(ARK_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (!resp.ok) return [];

  const text = '[' + (data.choices?.[0]?.message?.content || '');
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (d) =>
        typeof d.x === 'number' && typeof d.y === 'number' &&
        typeof d.w === 'number' && typeof d.h === 'number' &&
        d.x >= 0 && d.x <= 1 && d.y >= 0 && d.y <= 1 &&
        d.w > 0 && d.w <= 1 && d.h > 0 && d.h <= 1,
    );
  } catch {
    return [];
  }
}

// --- Pixel comparison approach ---
async function findWithPixels(original, modified) {
  const SIZE = 48; // block size
  const WANTED = 5;

  const [oRaw, mRaw, meta] = await Promise.all([
    sharp(original).resize(1024, 1024, { fit: 'fill' }).raw().toBuffer(),
    sharp(modified).resize(1024, 1024, { fit: 'fill' }).raw().toBuffer(),
    sharp(original).metadata(),
  ]);

  const w = 1024, h = 1024;
  const cols = Math.floor(w / SIZE);
  const rows = Math.floor(h / SIZE);
  const scores = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let totalDiff = 0;
      const pixelCount = SIZE * SIZE;
      for (let py = 0; py < SIZE; py++) {
        for (let px = 0; px < SIZE; px++) {
          const i = ((r * SIZE + py) * w + (c * SIZE + px)) * 3;
          const diff = Math.abs(oRaw[i] - mRaw[i])
                     + Math.abs(oRaw[i+1] - mRaw[i+1])
                     + Math.abs(oRaw[i+2] - mRaw[i+2]);
          if (diff > 60) totalDiff++;
        }
      }
      const score = totalDiff / pixelCount;
      if (score > 0.02) {
        scores.push({
          score,
          x: (c * SIZE) / w,
          y: (r * SIZE) / h,
          w: SIZE / w,
          h: SIZE / h,
          cx: (c * SIZE + SIZE / 2) / w,
          cy: (r * SIZE + SIZE / 2) / h,
        });
      }
    }
  }

  // Greedy pick top blocks with overlap avoidance
  scores.sort((a, b) => b.score - a.score);
  const picked = [];
  for (const s of scores) {
    const overlap = picked.some((p) =>
      Math.abs(s.cx - p.cx) < 0.08 && Math.abs(s.cy - p.cy) < 0.08
    );
    if (!overlap) {
      picked.push({ x: s.x, y: s.y, w: s.w, h: s.h });
      if (picked.length >= WANTED) break;
    }
  }

  return picked;
}

// --- Merge: keep vision diffs, fill with pixel diffs ---
function mergeDiffs(vision, pixel) {
  const result = [...vision];
  const used = new Set();

  // Track regions already covered by vision
  for (const v of vision) {
    const cx = v.x + v.w / 2;
    const cy = v.y + v.h / 2;
    used.add(`${cx.toFixed(3)},${cy.toFixed(3)}`);
  }

  for (const p of pixel) {
    if (result.length >= 5) break;
    const cx = (p.x + p.w / 2).toFixed(3);
    const cy = (p.y + p.h / 2).toFixed(3);
    // Skip if this region is already covered by a vision diff
    const tooClose = result.some((r) => {
      const rc = r.x + r.w / 2;
      const ry = r.y + r.h / 2;
      return Math.abs(cx - rc) < 0.06 && Math.abs(cy - ry) < 0.06;
    });
    if (!tooClose) {
      result.push(p);
    }
  }

  return result;
}

module.exports = { findDifferences };
