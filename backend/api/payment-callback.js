module.exports = async (req, res) => {
  const sessionId = req.query.session_id || '';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>付款成功</title>
  <style>
    body { font-family: -apple-system, sans-serif; text-align: center; padding: 40px 20px; background: #FFF0F3; }
    h1 { color: #FF6B8A; font-size: 24px; }
    p { color: #333; font-size: 16px; }
  </style>
</head>
<body>
  <h1>✅ 付款成功</h1>
  <p>正在返回應用程式...</p>
  <script>
    setTimeout(function() {
      window.location.href = 'find-differences://payment-success?session_id=${sessionId}';
    }, 500);
  </script>
</body>
</html>`);
};
