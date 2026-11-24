import type { BankAppConfig } from '../config/banks';
import { normalizeDigits } from './iranianValidation';

export type MobilePlatform = 'android' | 'ios' | 'desktop';

export interface BankTapPlan {
  platform: MobilePlatform;
  copyText: string;
  toastMessage: string;
  secondaryMessage: string | null;
  intentUri: string | null;
  webUrl: string | null;
  storeUrl: string | null;
  openWebOnTap: boolean;
  shouldMonitorVisibility: boolean;
  notInstalledMessage: string;
  fallbackDelayMs: number;
}

const VALID_ANDROID_PKG = /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)+$/;

export function detectMobilePlatform(userAgent: string): MobilePlatform {
  const ua = (userAgent || '').toLowerCase();
  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  return 'desktop';
}

export function sanitizeHttpsUrl(raw?: string): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

const BLOCKED_SCHEMES = /^(javascript|data|file|vbscript|blob|about|intent):/i;

/** لینک باز کردن اپ در iOS: URL scheme اختصاصی (مثل mybank://) یا Universal Link (https). */
export function sanitizeIosLaunchUri(raw?: string): string | null {
  const t = (raw || '').trim();
  if (!t || BLOCKED_SCHEMES.test(t)) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\/\S*$/i.test(t)) return null;
  if (/^https?:/i.test(t)) return sanitizeHttpsUrl(t);
  return t;
}

export function buildAndroidIntentUri(pkg?: string, fallbackUrl?: string | null): string | null {
  const trimmed = (pkg || '').trim();
  if (!trimmed || !VALID_ANDROID_PKG.test(trimmed)) {
    return null;
  }
  const safeFallback = sanitizeHttpsUrl(fallbackUrl ?? undefined);
  if (safeFallback) {
    return `intent://#Intent;package=${trimmed};S.browser_fallback_url=${encodeURIComponent(safeFallback)};end`;
  }
  return `intent://#Intent;package=${trimmed};end`;
}

export function getBankInitial(name: string): string {
  const clean = (name || '').trim();
  if (!clean) return 'ب';
  return clean.slice(0, 1);
}

export function sanitizeLogoSrc(raw?: string): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  ) {
    return trimmed.startsWith('//') ? null : trimmed;
  }

  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'blob:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function normalizePersianSearch(text: string): string {
  return (text || '')
    .trim()
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ');
}

export function orderBanksWithLastUsed(
  banks: BankAppConfig[],
  lastUsedId: string | null,
  query: string
): BankAppConfig[] {
  const q = normalizePersianSearch(query);
  const filtered = q
    ? banks.filter(
        (b) =>
          normalizePersianSearch(b.name).includes(q) ||
          normalizePersianSearch(b.id).includes(q)
      )
    : banks.slice();

  if (!lastUsedId) return filtered;
  const idx = filtered.findIndex((b) => b.id === lastUsedId);
  if (idx <= 0) return filtered;
  const [chosen] = filtered.splice(idx, 1);
  return [chosen, ...filtered];
}

export function getBankTapPlan(params: {
  bank: BankAppConfig;
  cardNumber: string;
  userAgent: string;
}): BankTapPlan {
  const copyText = normalizeDigits(params.cardNumber || '').replace(/\D/g, '');
  const platform = detectMobilePlatform(params.userAgent);
  const webUrl = sanitizeHttpsUrl(params.bank.web);
  const platformPre = detectMobilePlatform(params.userAgent);
  const storeUrl = sanitizeHttpsUrl(platformPre === 'ios' ? params.bank.appStore || params.bank.store : params.bank.store);
  const fallbackForIntent = webUrl ?? storeUrl ?? null;
  const intentUri = buildAndroidIntentUri(params.bank.pkg, fallbackForIntent);

  const toastMessage = 'شماره کارت کپی شد؛ در اپ بانک Paste کنید';
  const notInstalledMessage = 'اپ باز نشد';
  const fallbackDelayMs = 1500;

  if (platform === 'android') {
    if (intentUri) {
      return {
        platform,
        copyText,
        toastMessage,
        secondaryMessage: null,
        intentUri,
        webUrl,
        storeUrl,
        openWebOnTap: false,
        shouldMonitorVisibility: true,
        notInstalledMessage,
        fallbackDelayMs,
      };
    }

    return {
      platform,
      copyText,
      toastMessage,
      secondaryMessage: webUrl ? null : 'اپ بانک را باز کنید',
      intentUri: null,
      webUrl,
      storeUrl,
      openWebOnTap: Boolean(webUrl),
      shouldMonitorVisibility: false,
      notInstalledMessage,
      fallbackDelayMs,
    };
  }

  if (platform === 'ios') {
    const iosUri = sanitizeIosLaunchUri(params.bank.ios);
    return {
      platform,
      copyText,
      toastMessage,
      secondaryMessage: iosUri || webUrl ? null : 'اپ بانک را باز کنید',
      intentUri: iosUri,
      webUrl,
      storeUrl,
      openWebOnTap: !iosUri && Boolean(webUrl),
      shouldMonitorVisibility: Boolean(iosUri),
      notInstalledMessage,
      fallbackDelayMs,
    };
  }

  // Desktop / non-iOS fallback
  return {
    platform,
    copyText,
    toastMessage,
    secondaryMessage: null,
    intentUri: null,
    webUrl,
    storeUrl,
    openWebOnTap: Boolean(webUrl),
    shouldMonitorVisibility: false,
    notInstalledMessage,
    fallbackDelayMs,
  };
}

/**
 * اجرای هم‌زمان عملیات کلیک بانک:
 * همیشه ابتدا copyCard() را قبل از باز کردن Intent یا تب جدید وب فراخوانی می‌کند.
 */
export function executeBankTap(params: {
  bank: BankAppConfig;
  cardNumber: string;
  userAgent: string;
  copyCard: (cardDigits: string) => void;
  launchIntent: (intentUri: string) => void;
  openWebTab: (webUrl: string) => void;
}): BankTapPlan {
  const plan = getBankTapPlan({
    bank: params.bank,
    cardNumber: params.cardNumber,
    userAgent: params.userAgent,
  });

  if (plan.copyText) {
    params.copyCard(plan.copyText);
  }

  if (plan.intentUri) {
    params.launchIntent(plan.intentUri);
  } else if (plan.openWebOnTap && plan.webUrl) {
    params.openWebTab(plan.webUrl);
  }

  return plan;
}
