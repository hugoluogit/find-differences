const sharp = require('sharp');

const ARK_API = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

async function generateModifiedImage(imageBuffer, apiKey, changeDescriptions) {
  const base64 = imageBuffer.toString('base64');

  const prompt = changeDescriptions
    ? 'Modify this image with these specific changes. Return ONLY the modified image, not the original:\n' +
      changeDescriptions + '\n' +
      'Keep everything else IDENTICAL to the original image.'
    : 'Create a spot-the-difference puzzle. Make exactly 5 subtle visual changes ' +
      'to this photo. Examples: change an object color, remove a small object, ' +
      'add a small detail, or modify something. ' +
      'Keep everything else IDENTICAL to the original photo.';

  const response = await fetch(ARK_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'doubao-seedream-5-0-260128',
      prompt,
      image: `data:image/jpeg;base64,${base64}`,
      size: '2K',
      output_format: 'jpeg',
      watermark: false,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const msg = data.error?.message || JSON.stringify(data.error) || 'Unknown error';
    throw new Error('ARK error (' + response.status + '): ' + msg);
  }

  const result = data.data?.[0];
  if (!result) throw new Error('ARK: empty response');

  if (result.b64_json) {
    return Buffer.from(result.b64_json, 'base64');
  }

  if (result.url) {
    const imgResp = await fetch(result.url);
    if (!imgResp.ok) throw new Error('Failed to fetch generated image');
    return Buffer.from(await imgResp.arrayBuffer());
  }

  throw new Error('ARK: unexpected response format');
}

module.exports = { generateModifiedImage };
