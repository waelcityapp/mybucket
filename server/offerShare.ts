import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { DEMO_ADS } from '../src/data/demoAds.js';
import { offerShareExcerpt, offerSharePath } from '../src/utils/offerShare.js';
import { getAppIdentity } from './appIdentity.js';
import { readPublicOfferAds } from './offerAds.js';

const defaultIcon = 'icons/mybucket-512.png';
const width = 1080;
const height = 1080;
const logoInset = 36;
const escape = (value: string) => value.replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function offerShareOrigin(host?: string) {
  const allowedHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || host || 'mybucket-beta.vercel.app';
  if (/^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(allowedHost)) return `http://${allowedHost}`;
  return /^[a-z0-9.-]+$/i.test(allowedHost) ? `https://${allowedHost}` : 'https://mybucket-beta.vercel.app';
}

async function loadOffer(id: string, lang: 'ar' | 'en') {
  const demo = DEMO_ADS.find(ad => ad.id === id);
  if (demo) {
    const [title, description, merchant] = demo[lang];
    const image = 'image' in demo ? demo.image : 'poster' in demo ? demo.poster : null;
    return { title, description, merchant, image: image ? `demo-ads/${image}` : null };
  }
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  const offer = await readPublicOfferAds('ads.detail', { id });
  if (!offer || Array.isArray(offer) || !('title' in offer)) return null;
  return { title: offer.title, description: offer.description, merchant: offer.merchant,
    image: offer.media?.type === 'video' ? offer.media.poster : offer.media?.url };
}

async function imageBytes(source: string): Promise<Buffer> {
  if (!source.startsWith('https://')) return readFile(join(process.cwd(), 'public', source));
  const url = new URL(source);
  if (url.hostname !== 'res.cloudinary.com') throw new Error('unexpected image host');
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5000) });
  if (!response.ok || !response.body) throw new Error('image unavailable');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 6 * 1024 * 1024) throw new Error('image too large');
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export async function brandedOfferImage(photo: Buffer | null, icon: Buffer) {
  const background = photo ? await sharp(photo, { limitInputPixels: 30_000_000 }).rotate()
    .resize(width, height, { fit: 'cover' }).jpeg().toBuffer() : null;
  const size = background ? 104 : 230;
  const logo = await sharp(icon, { limitInputPixels: 16_000_000 }).resize(size, size, { fit: 'contain', background: '#ffffff' })
    .flatten({ background: '#ffffff' }).png().toBuffer();
  const canvas = background ? sharp(background) : sharp({ create: { width, height, channels: 3, background: '#064e3b' } });
  return canvas
    .composite([{ input: logo, left: background ? width - size - logoInset : (width - size) / 2, top: background ? height - size - logoInset : (height - size) / 2 }])
    .jpeg({ quality: 75 }).toBuffer();
}

export function offerShareHtml({ url, destination, image, app, title, description, lang }: {
  url: string; destination: string; image: string; app: string; title: string; description: string; lang: 'ar' | 'en';
}) {
  return `<!doctype html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title><meta name="robots" content="noindex">
<meta property="og:type" content="website"><meta property="og:url" content="${escape(url)}">
<meta property="og:site_name" content="${escape(app)}"><meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}"><meta property="og:image" content="${escape(image)}">
<meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="${width}"><meta property="og:image:height" content="${height}">
<meta name="twitter:card" content="summary_large_image">
</head><body><a id="offer" href="${escape(destination)}">${escape(title)}</a>
<script>location.replace(document.getElementById('offer').href)</script></body></html>`;
}

export async function renderOfferShare(id: string, language: string, origin: string, image: boolean) {
  const lang = language === 'en' ? 'en' : 'ar';
  const offer = await loadOffer(id, lang);
  if (!offer && image) return null;
  const identity = await getAppIdentity().catch(() => null);
  const app = (lang === 'ar' ? identity?.appNameAr : identity?.appNameEn) || 'My Bucket';
  if (image && offer) {
    const [photo, icon] = await Promise.all([
      offer.image ? imageBytes(offer.image).catch(() => null) : null,
      imageBytes(identity?.icon192Url || defaultIcon).catch(() => imageBytes(defaultIcon)),
    ]);
    try { return await brandedOfferImage(photo, icon); }
    catch { return brandedOfferImage(null, await imageBytes(defaultIcon)); }
  }
  const destination = new URL(`/offers/ad/${encodeURIComponent(id)}`, origin).href;
  const url = new URL(offerSharePath(id, lang), origin).href;
  return offerShareHtml({
    url, destination, lang, app,
    title: offer ? (lang === 'ar' ? `${offer.merchant} · ${offer.title}` : `${offer.title} · ${offer.merchant}`) : app,
    description: offer ? `${app} · ${offerShareExcerpt(offer.description, 85)}` : app,
    image: offer ? `${url}/i` : new URL(`/${defaultIcon}`, origin).href,
  });
}
