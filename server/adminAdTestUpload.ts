import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { SubscriptionError } from './subscriptionService.js';

type Config = { cloudName: string; apiKey: string; apiSecret: string; uploadPreset: string };
type ResourceType = 'image' | 'video';
const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function fail(code: string, status = 400): never { throw new SubscriptionError(status, code, 'Advertisement media test failed.'); }
function config(): Config {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret, CLOUDINARY_UPLOAD_PRESET: uploadPreset } = process.env;
  if (!cloudName || !/^[A-Za-z0-9_-]+$/.test(cloudName) || !apiKey || !apiSecret || !uploadPreset) return fail('ad_upload_not_configured', 503);
  return { cloudName, apiKey, apiSecret, uploadPreset };
}
function owner(uid: string) { if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) fail('invalid_upload_request'); }
function resource(value: unknown): ResourceType {
  if (value !== 'image' && value !== 'video') return fail('invalid_media_type');
  return value;
}

/** Owner-only test: gateway must authenticate and authorize before calling. No Firebase writes. */
export function signAdminAdTestUpload(uid: string, payload: Record<string, unknown>, cfg = config(), now = Date.now(), id: string = randomUUID(), folder: 'test' | 'submissions' | 'receipts' | 'subscription-receipts' = 'test') {
  owner(uid);
  const resourceType = resource(payload.resourceType);
  const limit = (resourceType === 'image' ? 5 : 25) * 1024 * 1024;
  if (!Number.isSafeInteger(payload.bytes) || (payload.bytes as number) <= 0 || (payload.bytes as number) > limit || !Number.isFinite(now) || !idPattern.test(id)) return fail('invalid_upload_request');
  const publicId = `mybucket/ads/${folder}/${uid}/${id}`;
  const timestamp = Math.floor(now / 1000);
  const signingString = `overwrite=false&public_id=${publicId}&timestamp=${timestamp}&type=authenticated&upload_preset=${cfg.uploadPreset}`;
  const signature = createHash('sha1').update(signingString + cfg.apiSecret).digest('hex');
  return { cloudName: cfg.cloudName, apiKey: cfg.apiKey, uploadPreset: cfg.uploadPreset, publicId, timestamp, signature, resourceType, deliveryType: 'authenticated' as const };
}

export async function confirmAdminAdTestUpload(uid: string, payload: Record<string, unknown>, cfg = config(), getResource = fetch, folder: 'test' | 'submissions' | 'receipts' | 'subscription-receipts' = 'test', maxVideoSeconds = 60) {
  owner(uid);
  const resourceType = resource(payload.resourceType);
  const publicId = payload.publicId;
  if (typeof publicId !== 'string' || !publicId.startsWith(`mybucket/ads/${folder}/${uid}/`) || !idPattern.test(publicId.slice(`mybucket/ads/${folder}/${uid}/`.length))) return fail('invalid_upload_request');
  const version = payload.version, signature = payload.responseSignature;
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version <= 0 || typeof signature !== 'string' || !/^[a-f0-9]{40}$/.test(signature)) return fail('invalid_upload_response');
  const expected = createHash('sha1').update(`public_id=${publicId}&version=${version}${cfg.apiSecret}`).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return fail('invalid_upload_response');
  const path = publicId.split('/').map(encodeURIComponent).join('/');
  // Cloudinary's Admin API omits video duration by default: request the media metadata explicitly.
  const metadataQuery = resourceType === 'video' ? '?media_metadata=true' : '';
  const response = await getResource(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/resources/${resourceType}/authenticated/${path}${metadataQuery}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${cfg.apiKey}:${cfg.apiSecret}`).toString('base64')}` }, signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) return fail('ad_upload_verification_failed', 503);
  const data: any = await response.json();
  let secureUrl: URL;
  try { secureUrl = new URL(data.secure_url); } catch { return fail('invalid_upload_response'); }
  const maxBytes = (resourceType === 'image' ? 5 : 25) * 1024 * 1024;
  const formats = resourceType === 'image' ? ['jpg', 'png', 'webp'] : ['mp4', 'webm', 'mov'];
  if (data.public_id !== publicId || data.resource_type !== resourceType || data.type !== 'authenticated' || data.version !== version ||
      !Number.isSafeInteger(data.bytes) || data.bytes <= 0 || data.bytes > maxBytes || !formats.includes(data.format) ||
      typeof data.asset_id !== 'string' || !data.asset_id || secureUrl.protocol !== 'https:' || secureUrl.hostname !== 'res.cloudinary.com' ||
      !secureUrl.pathname.startsWith(`/${cfg.cloudName}/${resourceType}/authenticated/`)) return fail('invalid_upload_response');
  if (resourceType === 'video') {
    // Admin API can return video_duration with media_metadata=true; retain duration as a fallback.
    const duration = data.video_duration ?? data.duration;
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) return fail('ad_video_duration_unavailable', 422);
    if (duration > maxVideoSeconds) return fail('invalid_video_duration');
  }
  return { publicId, resourceType, assetId: data.asset_id, secureUrl: secureUrl.href, version, bytes: data.bytes, format: data.format };
}

/** Delete only the authenticated test asset in the current administrator's folder. */
export async function deleteAdminAdTestUpload(uid: string, payload: Record<string, unknown>, cfg = config(), destroy = fetch, folder: 'test' | 'submissions' | 'receipts' | 'subscription-receipts' = 'test') {
  owner(uid);
  const resourceType = resource(payload.resourceType);
  const publicId = payload.publicId;
  const prefix = `mybucket/ads/${folder}/${uid}/`;
  if (typeof publicId !== 'string' || !publicId.startsWith(prefix) || !idPattern.test(publicId.slice(prefix.length))) {
    return fail('invalid_upload_request');
  }
  const timestamp = String(Math.floor(Date.now() / 1000));
  const fields = { invalidate: 'true', public_id: publicId, timestamp, type: 'authenticated' };
  const signedFields = new URLSearchParams(fields);
  const signature = createHash('sha1').update(Object.entries(fields).map(([key, value]) => `${key}=${value}`).join('&') + cfg.apiSecret).digest('hex');
  signedFields.set('signature', signature);
  signedFields.set('api_key', cfg.apiKey);
  const response = await destroy(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/${resourceType}/destroy`, {
    method: 'POST', body: signedFields, signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) return fail('ad_upload_delete_failed', 503);
  const data = await response.json();
  if (data.result !== 'ok' && data.result !== 'not found') return fail('ad_upload_delete_failed', 503);
  return { removed: true };
}
