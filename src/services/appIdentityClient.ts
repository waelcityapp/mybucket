import { auth } from '../lib/firebase';
import type { Language } from '../types';

export type AppIdentity = {
  appNameAr: string;
  appNameEn: string;
  iconUrl: string | null;
  icon192Url: string | null;
  icon512Url: string | null;
  iconPublicId: string | null;
  updatedAt: number | null;
};
export const DEFAULT_APP_IDENTITY: AppIdentity = {
  appNameAr: 'My Bucket', appNameEn: 'My Bucket',
  iconUrl: null, icon192Url: null, icon512Url: null, iconPublicId: null, updatedAt: null,
};

type SignedBrandUpload = {
  cloudName: string; apiKey: string; publicId: string; assetFolder: string;
  timestamp: number; signature: string;
};

export async function identityRequest<T>(action: 'app.identity.get' | 'admin.identity.signUpload' | 'admin.identity.save', payload: Record<string, unknown> = {}): Promise<T> {
  const isPublic = action === 'app.identity.get';
  const token = isPublic ? '' : await auth.currentUser?.getIdToken();
  if (!isPublic && !token) throw new Error('login_required');
  const response = await fetch('/api/gateway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify({ action, payload }),
  });
  const result = await response.json();
  if (!response.ok || !result?.ok || !result.data) throw new Error(result?.error || 'identity_request_failed');
  return result.data as T;
}

/** The existing signed API credentials remain server-only; uploads go to My Bucket's own Cloudinary environment. */
export async function uploadBrandIcon(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size < 1 || file.size > 3 * 1024 * 1024) {
    throw new Error('invalid_identity_image');
  }
  const signed = await identityRequest<SignedBrandUpload>('admin.identity.signUpload', { mime: file.type, bytes: file.size });
  if (!/^[A-Za-z0-9_-]+$/.test(signed.cloudName) || !signed.publicId.startsWith('mybucket/branding/icons/')) throw new Error('invalid_upload_configuration');
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', String(signed.timestamp));
  form.append('signature', signed.signature);
  form.append('public_id', signed.publicId);
  form.append('asset_folder', signed.assetFolder);
  form.append('overwrite', 'false');
  const upload = await fetch('https://api.cloudinary.com/v1_1/' + signed.cloudName + '/image/upload', {
    method: 'POST', body: form,
  });
  if (!upload.ok) throw new Error('identity_upload_failed');
  const asset = await upload.json();
  if (asset.public_id !== signed.publicId || asset.resource_type !== 'image' || asset.type !== 'upload' ||
    typeof asset.secure_url !== 'string' || !asset.secure_url.startsWith('https://res.cloudinary.com/' + signed.cloudName + '/image/upload/')) {
    throw new Error('identity_upload_verification_failed');
  }
  return signed.publicId;
}

function setMeta(key: string, value: string, attribute: 'name' | 'property' = 'name') {
  const element = document.querySelector('meta[' + attribute + '="' + key + '"]');
  if (element) element.setAttribute('content', value);
}

export function applyAppIdentity(identity: AppIdentity, lang: Language) {
  const name = lang === 'ar' ? identity.appNameAr : identity.appNameEn;
  document.title = name;
  setMeta('application-name', name);
  setMeta('apple-mobile-web-app-title', name);
  setMeta('og:title', name, 'property');
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (icon) {
    icon.href = identity.icon192Url || '/icons/mybucket.svg';
    icon.type = identity.icon192Url ? 'image/png' : 'image/svg+xml';
  }
  const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (appleIcon) appleIcon.href = identity.icon192Url || '/icons/mybucket-192.png';

  // Keep the manifest URL and its PWA id stable; after service-worker activation,
  // it serves the latest public branding from the same-origin cache, not from Firebase.
  // Existing OS-installed icons may still need a manual reinstall to refresh.
  if ('caches' in window) {
    const manifest = {
      id: '/', name, short_name: name.slice(0, 30),
      description: 'My Bucket - personal financial management',
      lang, dir: lang === 'ar' ? 'rtl' : 'ltr',
      start_url: '/', scope: '/', display: 'standalone',
      background_color: '#F8FAFC', theme_color: '#047857',
      categories: ['finance', 'productivity'],
      icons: [
        { src: identity.icon192Url || '/icons/mybucket-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: identity.icon512Url || '/icons/mybucket-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    };
    void caches.open('mybucket-pwa-branding-v1')
      .then(cache => cache.put('/manifest.webmanifest', new Response(JSON.stringify(manifest), {
        headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-store' },
      }))).catch(() => { /* Cache Storage is optional (e.g. private browsing). */ });
  }
}
