module.exports = async (_, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>隱私政策 — 找不同</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 640px; margin: 0 auto; padding: 32px 16px; color: #333; line-height: 1.7; }
  h1 { font-size: 24px; color: #FF6B8A; }
  h2 { font-size: 18px; margin-top: 24px; }
  p { margin: 8px 0; }
</style>
</head>
<body>
<h1>隱私政策</h1>
<p>最後更新：2026 年 6 月 17 日</p>

<p>本隱私政策說明「找不同」（以下稱「我們」）如何收集、使用及保護您的資訊。</p>

<h2>1. 我們收集的資訊</h2>
<p><strong>照片：</strong>當您使用本 App 產生謎題時，您選擇或拍攝的照片會上傳至我們的伺服器進行處理。處理完成後，照片會從伺服器刪除，僅保留產生的謎題結果。</p>
<p><strong>裝置識別碼：</strong>我們可能收集匿名裝置識別碼以記錄付款狀態及使用次數。</p>
<p><strong>付款資訊：</strong>所有付款皆透過 Stripe 處理，我們不會儲存您的信用卡資訊。</p>

<h2>2. 資訊的使用</h2>
<p>您的照片僅用於產生「找不同」謎題，不會用於任何其他目的。</p>

<h2>3. 第三方服務</h2>
<p>本 App 使用以下第三方服務：</p>
<ul>
  <li><strong>Stripe</strong> — 處理付款</li>
  <li><strong>ARK API（Doubao）</strong> — AI 圖片生成</li>
  <li><strong>Vercel</strong> — 伺服器託管</li>
</ul>

<h2>4. 資料保留</h2>
<p>謎題產生完成後，原始照片會立即從伺服器刪除。謎題結果（兩張比對圖及差異資料）在遊戲階段保留於伺服器記憶體中，不持久儲存。</p>

<h2>5. 聯絡方式</h2>
<p>如有任何疑問，請透過 GitHub Issues 聯絡我們。</p>
</body>
</html>`);
};
