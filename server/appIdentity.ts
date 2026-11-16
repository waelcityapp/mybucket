import { createHash, randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from './firebaseAdmin.js';
import { SubscriptionError } from './subscriptionService.js';

export type AppIdentity = {
  appNameAr: string;
  appNameEn: string;
  iconUrl: string | null;
  icon192Url: string | null;
  icon512Url: string | null;
  iconPublicId: string | null;
  updatedAt: number | null;
};

type CloudinarySettings = { cloudName: string; apiKey: string; apiSecret: string };
const IDENTITY_PATH = 'appIdentity';
const ICON_PREFIX = 'mybucket/branding/icons/';
const ICON_FOLDER = 'mybucket/branding/icons';
const MAX_ICON_BYTES = 3 * 1024 * 1024;
const MAX_NAME_LENGTH = 48;
const ID_PATTERN = /^mybucket\/branding\/icons\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const FORMATS = ['png', 'jpg', 'webp'];
const MIMES = ['image/png', 'image/jpeg', 'image/webp'];
const defaultIdentity: AppIdentity = {
  appNameAr: 'My Bucket', appNameEn: 'My Bucket',
  iconUrl: null, icon192Url: null, icon512Url: null, iconPublicId: null, updatedAt: null,
};
function error(code: string, status = 400): never {
  throw new SubscriptionError(status, code, 'Could not update the My Bucket app identity.');
}
function cloudinarySettings(): CloudinarySettings {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
  const apiKey = process.env.CLOUDINARY_API_KEY || '';
  const apiSecret = process.env.CLOUDINARY_API_SECRET || '';
  if (!/^[A-Za-z0-9_-]+$/.test(cloudName) || !apiKey || !apiSecret) error('identity_media_not_configured', 503);
  return { cloudName, apiKey, apiSecret };
}
function cleanName(value: unknown): string {
  if (typeof value !== 'string') error('invalid_identity_name');
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > MAX_NAME_LENGTH || /[<>\u0000-\u001f\u007f]/.test(name)) error('invalid_identity_name');
  return name;
}
export function validateIdentityNames(payload: Record<string, unknown>) {
  return { appNameAr: cleanName(payload.appNameAr), appNameEn: cleanName(payload.appNameEn) };
}
export function buildIdentityIconUrl(cloudName: string, publicId: string, version: number, size: 192 | 512): string {
  if (!/^[A-Za-z0-9_-]+$/.test(cloudName) || !ID_PATTERN.test(publicId) || !Number.isSafeInteger(version) || version < 1) error('invalid_identity_icon');
  return 'https://res.cloudinary.com/' + cloudName + '/image/upload/c_pad,b_transparent,w_' + size + ',h_' + size + ',f_png/v' + version + '/' + publicId + '.png';
}
function identityRef() { return getAdminFirestore().collection('systemConfigs').doc(IDENTITY_PATH); }
function toPublicIdentity(data: Record<string, unknown> | undefined): AppIdentity {
  if (!data) return defaultIdentity;
  const appNameAr = typeof data.appNameAr === 'string' && data.appNameAr.trim() ? data.appNameAr : defaultIdentity.appNameAr;
  const appNameEn = typeof data.appNameEn === 'string' && data.appNameEn.trim() ? data.appNameEn : defaultIdentity.appNameEn;
  const iconPublicId = typeof data.iconPublicId === 'string' && ID_PATTERN.test(data.iconPublicId) ? data.iconPublicId : null;
  const cloudName = typeof data.iconCloudName === 'string' ? data.iconCloudName : '';
  const version = typeof data.iconVersion === 'number' ? data.iconVersion : 0;
  const iconUrl = iconPublicId && typeof data.iconUrl === 'string' && data.iconUrl.startsWith('https://res.cloudinary.com/' + cloudName + '/image/upload/')
    ? data.iconUrl : null;
  const validIcon = iconUrl && iconPublicId && /^[A-Za-z0-9_-]+$/.test(cloudName) && version > 0;
  return {
    appNameAr, appNameEn,
    iconUrl: validIcon ? iconUrl : null,
    iconPublicId: validIcon ? iconPublicId : null,
    icon192Url: validIcon ? buildIdentityIconUrl(cloudName, iconPublicId, version, 192) : null,
    icon512Url: validIcon ? buildIdentityIconUrl(cloudName, iconPublicId, version, 512) : null,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : null,
  };
}
/** Public, read-only branding. It never returns Cloudinary credentials or other app settings. */
export async function getAppIdentity(): Promise<AppIdentity> {
  const snapshot = await identityRef().get();
  return toPublicIdentity(snapshot.exists ? snapshot.data() : undefined);
}
/** Called only from the admin-authorized gateway action. The API secret never leaves the server. */
export function signBrandIconUpload(payload: Record<string, unknown>, config: CloudinarySettings = cloudinarySettings(), now = Date.now(), uuid = randomUUID()) {
  if (!Number.isSafeInteger(payload.bytes) || (payload.bytes as number) < 1 || (payload.bytes as number) > MAX_ICON_BYTES || !MIMES.includes(String(payload.mime))) error('invalid_identity_image');
  if (!Number.isFinite(now) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid)) error('invalid_identity_image');
  const publicId = ICON_PREFIX + uuid;
  const timestamp = Math.floor(now / 1000);
  const signText = 'asset_folder=' + ICON_FOLDER + '&overwrite=false&public_id=' + publicId + '&timestamp=' + timestamp;
  const signature = createHash('sha1').update(signText + config.apiSecret).digest('hex');
  return { cloudName: config.cloudName, apiKey: config.apiKey, publicId, assetFolder: ICON_FOLDER, timestamp, signature };
}
async function verifiedIcon(publicId: string, config: CloudinarySettings, get: typeof fetch = fetch) {
  if (!ID_PATTERN.test(publicId)) error('invalid_identity_icon');
  const escaped = publicId.split('/').map(encodeURIComponent).join('/');
  const response = await get('https://api.cloudinary.com/v1_1/' + config.cloudName + '/resources/image/upload/' + escaped, {
    headers: { Authorization: 'Basic ' + Buffer.from(config.apiKey + ':' + config.apiSecret).toString('base64') },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) error('identity_image_not_found', 422);
  const data: any = await response.json();
  let url: URL;
  try { url = new URL(data.secure_url); } catch { error('invalid_identity_image'); }
  if (data.public_id !== publicId || data.resource_type !== 'image' || data.type !== 'upload' ||
    !FORMATS.includes(data.format) || !Number.isSafeInteger(data.bytes) || data.bytes > MAX_ICON_BYTES || data.bytes < 1 ||
    !Number.isSafeInteger(data.width) || !Number.isSafeInteger(data.height) || data.width < 256 || data.height < 256 ||
    data.width > 4096 || data.height > 4096 || !Number.isSafeInteger(data.version) || data.version < 1 ||
    url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' ||
    !url.pathname.startsWith('/' + config.cloudName + '/image/upload/')) error('invalid_identity_image');
  return { iconPublicId: publicId, iconUrl: url.href, iconVersion: data.version as number, iconCloudName: config.cloudName };
}
/** Auth and administrator role are checked at /api/gateway, not in the browser. */
export async function saveAppIdentity(payload: Record<string, unknown>, uid: string, config?: CloudinarySettings, getResource: typeof fetch = fetch) {
  if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) error('admin_only', 403);
  const names = validateIdentityNames(payload);
  const publicId = payload.iconPublicId;
  if (publicId !== null && (typeof publicId !== 'string' || !ID_PATTERN.test(publicId))) error('invalid_identity_icon');
  const ref = identityRef();
  const previous = await ref.get();
  const prior = previous.data() || {};
  let iconFields: Record<string, unknown>;
  if (publicId === null) {
    iconFields = { iconUrl: null, iconPublicId: null, iconCloudName: null, iconVersion: null };
  } else if (publicId === prior.iconPublicId && typeof prior.iconUrl === 'string') {
    iconFields = { iconUrl: prior.iconUrl, iconPublicId: prior.iconPublicId, iconCloudName: prior.iconCloudName, iconVersion: prior.iconVersion };
  } else {
    iconFields = await verifiedIcon(publicId as string, config || cloudinarySettings(), getResource);
  }
  const stored = { ...names, ...iconFields, updatedAt: Date.now(), updatedBy: uid, serverTimestamp: FieldValue.serverTimestamp() };
  await ref.set(stored);
  return toPublicIdentity(stored);
}
