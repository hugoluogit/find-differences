const ARK_API = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

async function planChanges(imageBuffer, apiKey) {
  const base64 = imageBuffer.toString('base64');

  const response = await fetch(ARK_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'doubao-seed-2-0-lite-260215',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'You are a spot-the-difference puzzle creator.\n' +
                'Analyze this image and plan exactly 5 visual changes.\n' +
                'IMPORTANT: At most 3 of the 5 changes may involve color changes.\n' +
                'The remaining changes must be NON-COLOR types, such as:\n' +
                'adding/removing objects, changing object size/shape, moving objects,\n' +
                'changing patterns/textures, hiding/revealing elements, etc.\n' +
                'For color changes, use clearly contrasting colors\n' +
                '(e.g., red↔blue, yellow↔purple, white↔black). Do NOT use similar colors\n' +
                'or different shades of the same color (e.g., light blue↔dark blue is FORBIDDEN).\n' +
                'For each change, give:\n' +
                '- "description_en": a short instruction in English (e.g., "change the red cup to blue")\n' +
                '- "description_zh": the same instruction in Simplified Chinese (e.g., "将红色杯子改为蓝色")\n' +
                '- Bounding box: x,y is the CENTER (not top-left), w,h is size. All as percentage coordinates (0–1)\n' +
                'Respond with ONLY a JSON array, no other text:\n' +
                '[\n  {"description_en":"...","description_zh":"...","x":0.xx,"y":0.xx,"w":0.xx,"h":0.xx},\n  ...\n]',
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'high' },
            },
          ],
        },
      ],
      max_tokens: 1024,
      temperature: 0.1,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error('ARK error (' + response.status + '): ' + (data.error?.message || 'Unknown error'));
  }

  const text = data.choices?.[0]?.message?.content || '';
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error('ARK vision model response is not an array');
    }
    if (parsed.length < 5) {
      throw new Error('ARK vision model returned ' + parsed.length + ' changes, expected 5');
    }
    return parsed.slice(0, 5).map((d) => ({
      description_en: String(d.description_en || d.description || ''),
      description_zh: String(d.description_zh || ''),
      x: Number(d.x),
      y: Number(d.y),
      w: Number(d.w),
      h: Number(d.h),
    }));
  } catch (e) {
    if (e.message.startsWith('ARK')) throw e;
    throw new Error('Failed to parse ARK vision response: ' + text.slice(0, 200));
  }
}

module.exports = { planChanges };
