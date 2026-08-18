module.exports = async (_, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>支援中心 — 找不同</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 640px; margin: 0 auto; padding: 32px 16px; color: #333; line-height: 1.7; }
  h1 { font-size: 24px; color: #FF6B8A; }
  h2 { font-size: 18px; margin-top: 24px; }
  p { margin: 8px 0; }
  a { color: #FF6B8A; }
  .email { font-size: 18px; font-weight: 600; }
  hr { border: none; border-top: 1px solid #eee; margin: 24px 0; }
</style>
</head>
<body>
<h1>找不同 — 支援中心</h1>
<p>感謝您使用「找不同」。如有任何問題、意見或需要退款協助，請透過以下方式與我們聯絡，我們會盡快回覆。</p>

<h2>聯絡我們</h2>
<p class="email">📧 <a href="mailto:37ftech@gmail.com">37ftech@gmail.com</a></p>

<h2>常見問題</h2>
<p><strong>如何開始遊戲？</strong><br>開啟 App 後，選擇一張照片或直接拍照，系統會自動產生一組「找不同」謎題。</p>
<p><strong>付款相關問題</strong><br>如購買後未能解鎖局數，或想申請退款，請來信提供您的購買時間與平台（App Store / 網頁），我們會協助處理。</p>
<p><strong>圖片格式</strong><br>支援 JPG、PNG、HEIC 等常見格式，單張圖片建議不超過 3MB。</p>

<hr>
<p><em>Support Center</em></p>
<p>Thanks for using "Find Differences". If you have any questions, feedback, or need a refund, please contact us at <a href="mailto:37ftech@gmail.com">37ftech@gmail.com</a> and we will get back to you as soon as possible.</p>
</body>
</html>`);
};
