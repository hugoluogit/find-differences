export default async function handler(
  request: any,
  response: any,
) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.status(200).json({ ok: true, time: Date.now() });
}
