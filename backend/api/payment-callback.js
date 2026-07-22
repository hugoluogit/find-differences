module.exports = async (req, res) => {
  const sessionId = req.query.session_id || '';
  const cancelled = req.query.cancelled === '1';
  const returnUrl = req.query.return_url ? decodeURIComponent(req.query.return_url) : null;

  let redirectUrl;
  if (returnUrl) {
    // Web flow: redirect back to web app
    redirectUrl = cancelled
      ? `${returnUrl}?cancelled=1`
      : `${returnUrl}?session_id=${sessionId}`;
    res.writeHead(302, { Location: redirectUrl });
    res.end();
    return;
  }

  // Native flow: deep link
  const backUrl = `find-differences://payment-success?session_id=${sessionId}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>付款成功</title>
  <style>
    body { font-family: -apple-system, sans-serif; text-align: center; padding: 40px 20px; background: #FFF0F3; margin: 0; }
    .wrap { max-width: 400px; margin: 0 auto; }
    h1 { color: #FF6B8A; font-size: 28px; }
    p { color: #333; font-size: 16px; line-height: 1.5; }
    .btn { display: inline-block; background: #FF6B8A; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 17px; font-weight: 600; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>✅ 付款成功</h1>
    <p>請點擊下方按鈕返回 App</p>
    <a class="btn" href="${backUrl}">打開 App</a>
    <p style="margin-top:24px;color:#888;font-size:14px">如果按鈕無效，請手動切換回 App</p>
  </div>
  <script>
    setTimeout(function() {
      window.location.href = '${backUrl}';
    }, 500);
  </script>
</body>
</html>`);
};
