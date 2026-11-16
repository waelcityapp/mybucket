import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { validateIdentityNames, signBrandIconUpload, buildIdentityIconUrl } from '../server/appIdentity.ts';

const config = { cloudName: 'mybucket-test', apiKey: 'public-key', apiSecret: 'server-only-secret' };
const uuid = 'b38bb5fa-4395-4aac-8eaa-66693675f8d9';
const file = { mime: 'image/png', bytes: 194200 };

test('app identity accepts Arabic/English names and safely strips excess whitespace', () => {
  assert.deepEqual(validateIdentityNames({ appNameAr: '  ماي   بوكت ', appNameEn: ' My Bucket  ' }),
    { appNameAr: 'ماي بوكت', appNameEn: 'My Bucket' });
});
test('app identity rejects blank, long, markup, and control-character names', () => {
  for (const name of ['', 'a', 'x'.repeat(49), '<img>', 'test\u0000name']) {
    assert.throws(() => validateIdentityNames({ appNameAr: name, appNameEn: 'My Bucket' }));
  }
});
test('Cloudinary signing uses isolated My Bucket public folder and never returns secret', () => {
  const signed = signBrandIconUpload(file, config, 1794800000000, uuid);
  assert.equal(signed.publicId, 'mybucket/branding/icons/' + uuid);
  assert.equal(signed.assetFolder, 'mybucket/branding/icons');
  assert.equal(signed.cloudName, config.cloudName);
  assert.equal(signed.apiKey, config.apiKey);
  assert.equal('apiSecret' in signed, false);
  const params = 'asset_folder=mybucket/branding/icons&overwrite=false&public_id=mybucket/branding/icons/' + uuid + '&timestamp=' + signed.timestamp;
  assert.equal(signed.signature, createHash('sha1').update(params + config.apiSecret).digest('hex'));
});
test('Cloudinary signing rejects oversized or non-image uploads', () => {
  for (const item of [{ bytes: 0, mime: 'image/png' }, { bytes: 4 * 1024 * 1024, mime: 'image/png' }, { bytes: 500, mime: 'image/svg+xml' }, { bytes: 500, mime: 'video/mp4' }]) {
    assert.throws(() => signBrandIconUpload(item, config, 1794800000000, uuid));
  }
});
test('icon resize links stay on the dedicated Cloudinary environment', () => {
  const url = buildIdentityIconUrl(config.cloudName, 'mybucket/branding/icons/' + uuid, 1731, 512);
  assert.equal(url, 'https://res.cloudinary.com/mybucket-test/image/upload/c_pad,b_transparent,w_512,h_512,f_png/v1731/mybucket/branding/icons/' + uuid + '.png');
  assert.throws(() => buildIdentityIconUrl('cityeve/other', 'mybucket/branding/icons/' + uuid, 1731, 512));
  assert.throws(() => buildIdentityIconUrl(config.cloudName, 'cityeve/branding/icons/' + uuid, 1731, 512));
});
