import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adContactError, adVideoLimit, containsExternalAdLink, normalizeAdPhone, normalizeGoogleMapsUrl } from '../src/utils/adContent.ts';

test('Egyptian and international landlines and mobiles get canonical independent contact numbers', () => {
  assert.equal(normalizeAdPhone('٠١٠ ١٢٣٤ ٥٦٧٨'), '+201012345678');
  assert.equal(normalizeAdPhone('02 2345 6789'), '+20223456789');
  assert.equal(normalizeAdPhone('0044 20 7946 0958'), '+442079460958');
  assert.equal(normalizeAdPhone('+44 7400 123456', true), '+447400123456');
  assert.equal(normalizeAdPhone('+44 20 7946 0958', true), null);
  for (const number of ['123', '+9991234567', 'Call +201012345678', '+201012345678 ext 12', 'https://example.com']) {
    assert.equal(normalizeAdPhone(number), null);
  }
  assert.equal(adContactError({}), null);
  assert.equal(adContactError({ callPhone: '01012345678', whatsappPhone: '01012345678' }), null);
  assert.equal(adContactError({ callPhone: '02 2345 6789', whatsappPhone: '+44 7400 123456' }), null);
  assert.equal(adContactError({ whatsappPhone: '02 2345 6789' }), 'ad_invalid_whatsapp_phone');
});

test('only recognized HTTPS Google Maps routes are accepted as maps actions', () => {
  for (const url of [
    'https://maps.app.goo.gl/Abc123', 'https://goo.gl/maps/Abc123',
    'https://www.google.com/maps/place/Cairo', 'https://www.google.com.eg/maps?cid=123',
    'https://maps.google.com/?q=30.1,31.2', 'https://www.google.com/maps/@30.1,31.2,12z',
  ]) assert.equal(normalizeGoogleMapsUrl(url), url);
  for (const url of [
    'https://google.com.example/maps/place/Cairo', 'https://www.google.com/url?q=https://example.com',
    'https://google.com@evil.example/maps', 'https://evil.example/maps', 'javascript:alert(1)',
    'https://www.google.com/maps/../url?q=abc', 'https://goo.gl/anything',
  ]) assert.equal(normalizeGoogleMapsUrl(url), null);
});

test('text blocks explicit, bare and Unicode links while allowing phone digits and ordinary Arabic', () => {
  for (const value of ['HTTPS://example.com', 'example.com', 'https://maps.app.goo.gl/Abc123',
    'wa.me/201012345678', 'www．example．com', 'مثال.مصر', 'example\u200B.com', '192.168.0.1']) {
    assert.equal(containsExternalAdLink(value), true, value);
  }
  for (const value of ['القاهرة، مصر', 'اتصل على 010 1234 5678', '0020 2 2345 6789', 'السعر 100.50 جنيه']) {
    assert.equal(containsExternalAdLink(value), false, value);
  }
  assert.deepEqual(['free', 'featured', 'vip'].map(adVideoLimit), [0, 30, 60]);
});
