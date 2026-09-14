const THEME = '#FF6B8A';
const CARD_WIDTH = 1080;
const GAP = 8;
const HALF = (CARD_WIDTH - GAP) / 2;
const FOOTER_HEIGHT = 330;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

export interface ShareCardOptions {
  originalImageDataUrl: string;
  modifiedImageDataUrl: string;
  titleZh: string;
  subtitle: string;
  /** 纯图模式：只输出原图+修改图并排，不带标题/二维码/网址 */
  bare?: boolean;
}

export async function generateShareCard({
  originalImageDataUrl,
  modifiedImageDataUrl,
  titleZh,
  subtitle,
  bare,
}: ShareCardOptions): Promise<string> {
  const [original, modified] = await Promise.all([
    loadImage(originalImageDataUrl),
    loadImage(modifiedImageDataUrl),
  ]);

  const imgH = Math.max(1, Math.round((original.height / original.width) * HALF));

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = bare ? imgH : imgH + FOOTER_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Original and modified images side by side
  ctx.drawImage(original, 0, 0, HALF, imgH);
  ctx.drawImage(modified, HALF + GAP, 0, HALF, imgH);

  if (bare) {
    return canvas.toDataURL('image/png');
  }

  const qr = await loadImage('/qrcode.png');

  // Footer
  const footerTop = imgH;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, footerTop, CARD_WIDTH, FOOTER_HEIGHT);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  ctx.fillStyle = '#333333';
  ctx.font = 'bold 54px -apple-system, "PingFang TC", "Microsoft YaHei", sans-serif';
  let y = footerTop + 48;
  titleZh.split('\n').forEach((line) => {
    ctx.fillText(line, CARD_WIDTH / 2, y);
    y += 72;
  });

  // QR code + scan hint (bottom row)
  const QR_SIZE = 112;
  const qrX = CARD_WIDTH - 48 - QR_SIZE;
  const qrY = footerTop + FOOTER_HEIGHT - QR_SIZE - 24;
  ctx.drawImage(qr, qrX, qrY, QR_SIZE, QR_SIZE);

  ctx.fillStyle = THEME;
  ctx.font = 'bold 42px -apple-system, "PingFang TC", "Microsoft YaHei", sans-serif';
  ctx.fillText('扫码用你自己的照片玩找不同', CARD_WIDTH / 2, qrY + 14);

  ctx.fillStyle = '#999999';
  ctx.font = '32px -apple-system, "PingFang TC", "Microsoft YaHei", sans-serif';
  ctx.fillText(subtitle, CARD_WIDTH / 2, qrY + 64);

  return canvas.toDataURL('image/png');
}
