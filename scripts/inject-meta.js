const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const distDir = path.join(__dirname, '..', 'dist');
const assetsDir = path.join(__dirname, '..', 'assets');
const htmlPath = path.join(distDir, 'index.html');

async function main() {
  // Generate favicon PNG (48x48) from source
  const faviconSrc = path.join(assetsDir, 'favicon.png');
  const faviconDest = path.join(distDir, 'favicon-48.png');
  if (fs.existsSync(faviconSrc)) {
    fs.copyFileSync(faviconSrc, faviconDest);
    console.log('Copied favicon-48.png');
  }

  // Generate apple-touch-icon (180x180) from app icon
  const iconSrc = path.join(assetsDir, 'icon.png');
  const appleIconDest = path.join(distDir, 'apple-touch-icon.png');
  if (fs.existsSync(iconSrc)) {
    await sharp(iconSrc)
      .resize(180, 180)
      .png()
      .toFile(appleIconDest);
    console.log('Generated apple-touch-icon.png (180x180)');
  }

  // Inject meta tags into HTML
  const APP_TITLE = 'AI Find the Differences — Spot the Difference Game';
  const APP_DESCRIPTION = 'Turn any photo into a spot-the-difference puzzle. Upload a selfie, couple photo, or pet pic—AI creates 5 subtle changes in seconds. Play instantly.';
  const APP_URL = 'https://ai-find-differences.vercel.app';
  const OG_IMAGE = 'https://ai-find-differences.vercel.app/og-image.png';

  const metaTags = `
    <meta name="description" content="${APP_DESCRIPTION}" />
    <meta name="author" content="Hugo Luo" />

    <!-- Open Graph -->
    <meta property="og:title" content="${APP_TITLE}" />
    <meta property="og:description" content="${APP_DESCRIPTION}" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:image:width" content="1024" />
    <meta property="og:image:height" content="1024" />
    <meta property="og:image:alt" content="AI Find the Differences — spot the difference game" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${APP_URL}" />
    <meta property="og:locale" content="zh_Hant" />
    <meta property="og:site_name" content="AI Find the Differences" />

    <!-- Twitter / X Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@hugoluogit" />
    <meta name="twitter:title" content="${APP_TITLE}" />
    <meta name="twitter:description" content="${APP_DESCRIPTION}" />
    <meta name="twitter:image" content="${OG_IMAGE}" />
    <meta name="twitter:image:alt" content="AI Find the Differences — spot the difference game" />

    <!-- Canonical -->
    <link rel="canonical" href="${APP_URL}" />

    <!-- Favicon / App Icons -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />`;

  let html = fs.readFileSync(htmlPath, 'utf8');

  // Remove expo-generated favicon link (we provide our own)
  html = html.replace(/<link rel="icon".*?>/g, '');

  // Inject title + meta tags
  html = html.replace(
    '<title>找不同</title>',
    `<title>${APP_TITLE}</title>${metaTags}`
  );

  fs.writeFileSync(htmlPath, html);
  console.log('Meta tags + favicon links injected into dist/index.html');
}

main().catch(err => {
  console.error('inject-meta failed:', err);
  process.exit(1);
});
