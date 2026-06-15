const sharp = require('sharp');

const ARK_API = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

async function findDifferences(original, modified, apiKey) {
  if (!apiKey) return [];

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
              'You are a spot-the-difference puzzle solver. Compare Image A (original) and Image B (modified) VERY carefully.\n' +
              'Image B has exactly 5 visual changes. Find ALL 5 differences.\n' +
              'Look for: color changes, missing objects, new objects, shape changes, or size changes.\n' +
              'Scan the entire image systematically — top to bottom, left to right.\n' +
              'For each difference, give the bounding box as percentage coordinates (0–1).\n' +
              'Be precise: the box should tightly enclose the changed area.\n' +
              'If the change spans a large area, cover the full region.\n' +
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
    max_tokens: 2048,
    temperature: 0.05,
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
  if (!resp.ok) {
    console.error('Vision API error:', data);
    return [];
  }

  const text = '[' + (data.choices?.[0]?.message?.content || '');
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    // Filter to valid entries with 0–1 coordinates, max 5
    return parsed.filter(
      (d) =>
        typeof d.x === 'number' &&
        typeof d.y === 'number' &&
        typeof d.w === 'number' &&
        typeof d.h === 'number' &&
        d.x >= 0 && d.x <= 1 &&
        d.y >= 0 && d.y <= 1 &&
        d.w > 0 && d.w <= 1 &&
        d.h > 0 && d.h <= 1,
    ).slice(0, 5);
  } catch {
    return [];
  }
}

module.exports = { findDifferences };
