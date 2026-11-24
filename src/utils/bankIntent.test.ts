import test from 'node:test';
import assert from 'node:assert/strict';
import { BANKS } from '../config/banks';
import {
  buildAndroidIntentUri,
  detectMobilePlatform,
  executeBankTap,
  getBankInitial,
  getBankTapPlan,
  orderBanksWithLastUsed,
  sanitizeHttpsUrl,
  sanitizeLogoSrc,
} from './bankIntent';

test('BANKS config preserves all 14 banks with required id, name, and local logo path', () => {
  assert.equal(BANKS.length, 14);
  for (const bank of BANKS) {
    assert.match(bank.id, /^[a-z0-9]+$/);
    assert.ok(bank.name.length > 0);
    assert.equal(bank.logo, `/banks/${bank.id}.png`);
  }
});

test('detectMobilePlatform classifies Android, iOS, and desktop user agents', () => {
  assert.equal(detectMobilePlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8)'), 'android');
  assert.equal(detectMobilePlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), 'ios');
  assert.equal(detectMobilePlatform('Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0'), 'desktop');
});

test('sanitizeHttpsUrl allows https only and rejects unsafe schemes', () => {
  assert.equal(sanitizeHttpsUrl('https://my.bmi.ir'), 'https://my.bmi.ir/');
  assert.equal(sanitizeHttpsUrl('http://example.com'), null);
  assert.equal(sanitizeHttpsUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeHttpsUrl(''), null);
});

test('buildAndroidIntentUri generates intent with encoded browser_fallback_url and without fallback', () => {
  assert.equal(
    buildAndroidIntentUri('ir.bmi.bam', 'https://my.bmi.ir/?a=1&b=2'),
    'intent://#Intent;package=ir.bmi.bam;S.browser_fallback_url=https%3A%2F%2Fmy.bmi.ir%2F%3Fa%3D1%26b%3D2;end'
  );
  assert.equal(
    buildAndroidIntentUri('com.pmb.mobile', null),
    'intent://#Intent;package=com.pmb.mobile;end'
  );
  assert.equal(buildAndroidIntentUri('', 'https://my.bmi.ir'), null);
  assert.equal(buildAndroidIntentUri('bad;scheme=javascript', null), null);
});

test('getBankTapPlan prioritizes web over store in Android intent fallback', () => {
  const planWithWebAndStore = getBankTapPlan({
    bank: {
      id: 'melli',
      name: 'ملی (بام)',
      pkg: 'ir.bmi.bam',
      web: 'https://my.bmi.ir',
      store: 'https://cafebazaar.ir/app/ir.bmi.bam',
    },
    cardNumber: '۶۰۳۷-۹۹۷۵-۱۲۳۴-۴۸۱۲',
    userAgent: 'Mozilla/5.0 (Linux; Android 14)',
  });

  assert.equal(
    planWithWebAndStore.intentUri,
    'intent://#Intent;package=ir.bmi.bam;S.browser_fallback_url=https%3A%2F%2Fmy.bmi.ir%2F;end'
  );
  assert.equal(planWithWebAndStore.shouldMonitorVisibility, true);
  assert.equal(planWithWebAndStore.notInstalledMessage, 'اپ باز نشد');

  const planStoreOnly = getBankTapPlan({
    bank: {
      id: 'mellat',
      name: 'ملت',
      pkg: 'com.pmb.mobile',
      web: '',
      store: 'https://cafebazaar.ir/app/com.pmb.mobile',
    },
    cardNumber: '6104337912348831',
    userAgent: 'Mozilla/5.0 (Linux; Android 14)',
  });

  assert.equal(
    planStoreOnly.intentUri,
    'intent://#Intent;package=com.pmb.mobile;S.browser_fallback_url=https%3A%2F%2Fcafebazaar.ir%2Fapp%2Fcom.pmb.mobile;end'
  );
});

test('getBankTapPlan opens web in new tab when pkg is missing on Android or desktop', () => {
  const androidNoPkgWithWeb = getBankTapPlan({
    bank: { id: 'custom', name: 'تست', pkg: '', web: 'https://bank.example.ir' },
    cardNumber: '6062561012345678',
    userAgent: 'Mozilla/5.0 (Linux; Android 14)',
  });
  assert.equal(androidNoPkgWithWeb.intentUri, null);
  assert.equal(androidNoPkgWithWeb.openWebOnTap, true);
  assert.equal(androidNoPkgWithWeb.webUrl, 'https://bank.example.ir/');

  const androidNoPkgNoWeb = getBankTapPlan({
    bank: { id: 'melal', name: 'ملل', pkg: '', web: '' },
    cardNumber: '6062561012345678',
    userAgent: 'Mozilla/5.0 (Linux; Android 14)',
  });
  assert.equal(androidNoPkgNoWeb.intentUri, null);
  assert.equal(androidNoPkgNoWeb.openWebOnTap, false);
  assert.equal(androidNoPkgNoWeb.toastMessage, 'شماره کارت کپی شد؛ در اپ بانک Paste کنید');
});

test('getBankTapPlan on iOS opens web only when available and never invents URL schemes', () => {
  const iosWithWeb = getBankTapPlan({
    bank: { id: 'melli', name: 'ملی (بام)', pkg: 'ir.bmi.bam', web: 'https://my.bmi.ir' },
    cardNumber: '6037991100001233',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
  });
  assert.equal(iosWithWeb.intentUri, null);
  assert.equal(iosWithWeb.openWebOnTap, true);
  assert.equal(iosWithWeb.webUrl, 'https://my.bmi.ir/');
  assert.equal(iosWithWeb.secondaryMessage, null);

  const iosNoWeb = getBankTapPlan({
    bank: { id: 'mellat', name: 'ملت', pkg: 'com.pmb.mobile', web: '' },
    cardNumber: '6104337912348831',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
  });
  assert.equal(iosNoWeb.intentUri, null);
  assert.equal(iosNoWeb.openWebOnTap, false);
  assert.equal(iosNoWeb.secondaryMessage, 'اپ بانک را باز کنید');
});

test('executeBankTap invokes copy synchronously BEFORE launching Android intent or opening web tab', () => {
  const events: string[] = [];

  executeBankTap({
    bank: {
      id: 'melli',
      name: 'ملی (بام)',
      pkg: 'ir.bmi.bam',
      web: 'https://my.bmi.ir',
      store: 'https://cafebazaar.ir/app/ir.bmi.bam',
    },
    cardNumber: '۶۰۳۷-۹۹۱۱-۰۰۰۰-۱۲۳۳',
    userAgent: 'Mozilla/5.0 (Linux; Android 14)',
    copyCard: (digits) => events.push(`copy:${digits}`),
    launchIntent: (uri) => events.push(`intent:${uri}`),
    openWebTab: (url) => events.push(`web:${url}`),
  });

  assert.deepEqual(events, [
    'copy:6037991100001233',
    'intent:intent://#Intent;package=ir.bmi.bam;S.browser_fallback_url=https%3A%2F%2Fmy.bmi.ir%2F;end',
  ]);

  const webEvents: string[] = [];
  executeBankTap({
    bank: { id: 'melli', name: 'ملی (بام)', pkg: 'ir.bmi.bam', web: 'https://my.bmi.ir' },
    cardNumber: '6037991100001233',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
    copyCard: (digits) => webEvents.push(`copy:${digits}`),
    launchIntent: (uri) => webEvents.push(`intent:${uri}`),
    openWebTab: (url) => webEvents.push(`web:${url}`),
  });

  assert.deepEqual(webEvents, ['copy:6037991100001233', 'web:https://my.bmi.ir/']);
});

test('orderBanksWithLastUsed places lastUsedId first and filters Persian/English search queries', () => {
  const ordered = orderBanksWithLastUsed(BANKS, 'blu', '');
  assert.equal(ordered[0].id, 'blu');

  const searched = orderBanksWithLastUsed(BANKS, 'blu', 'ملت');
  assert.equal(searched.length, 1);
  assert.equal(searched[0].id, 'mellat');
});

test('sanitizeLogoSrc accepts valid paths/URLs and rejects unsafe schemes; getBankInitial extracts first letter', () => {
  assert.equal(sanitizeLogoSrc('/banks/melli.png'), '/banks/melli.png');
  assert.equal(sanitizeLogoSrc('https://cdn.example.com/bank.png'), 'https://cdn.example.com/bank.png');
  assert.equal(sanitizeLogoSrc('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
  assert.equal(sanitizeLogoSrc('//evil.example.com/x.png'), null);
  assert.equal(sanitizeLogoSrc('javascript:alert(1)'), null);
  assert.equal(sanitizeLogoSrc(''), null);

  assert.equal(getBankInitial('ملی (بام)'), 'م');
  assert.equal(getBankInitial('  آینده '), 'آ');
  assert.equal(getBankInitial(''), 'ب');
});

import { test as t2 } from 'node:test';
import assert2 from 'node:assert/strict';
import { getBankTapPlan as plan2, sanitizeIosLaunchUri } from './bankIntent';

const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
t2('iOS: scheme اختصاصی اجرا و پایش می‌شود', () => {
  const p = plan2({ bank: { id: 'x', name: 'x', ios: 'mybank://', appStore: 'https://apps.apple.com/app/id1' }, cardNumber: '6037991100001233', userAgent: IOS });
  assert2.equal(p.intentUri, 'mybank://');
  assert2.equal(p.shouldMonitorVisibility, true);
  assert2.equal(p.storeUrl, 'https://apps.apple.com/app/id1');
});
t2('iOS: بدون ios ولی با web، وب باز می‌شود', () => {
  const p = plan2({ bank: { id: 'x', name: 'x', web: 'https://example.ir' }, cardNumber: '6037991100001233', userAgent: IOS });
  assert2.equal(p.intentUri, null);
  assert2.equal(p.openWebOnTap, true);
});
t2('iOS: بدون هیچ لینکی فقط پیام راهنما', () => {
  const p = plan2({ bank: { id: 'x', name: 'x' }, cardNumber: '6037991100001233', userAgent: IOS });
  assert2.equal(p.secondaryMessage, 'اپ بانک را باز کنید');
});
t2('schemeهای خطرناک رد می‌شوند', () => {
  for (const bad of ['javascript://x', 'data://x', 'file:///x', 'intent://x', 'http://x', 'abc', '']) assert2.equal(sanitizeIosLaunchUri(bad), null);
  assert2.equal(sanitizeIosLaunchUri('https://bank.ir/open'), 'https://bank.ir/open');
});
