/**
 * فهرست بانک‌ها — برای هر بانک فقط همین فیلدها را پر کنید (خالی = غیرفعال):
 *
 * pkg      اندروید: نام بسته (از آدرس صفحه‌ی اپ در Cafe Bazaar بعد از /app/)
 * ios      آیفون: لینک باز کردن اپ. یکی از این دو:
 *            - URL scheme اپ، مثل  mybank://
 *            - Universal Link رسمی (https) که اپ را باز می‌کند
 *          اگر مطمئن نیستید خالی بگذارید؛ حدس نزنید.
 * appStore آیفون: لینک اپ در App Store/سیب‌اپ، یا هر لینک نصب (https)
 * web      وب‌اپ رسمی بانک (https) — اگر اپ باز نشد یا scheme ندارید، این باز می‌شود
 * store    لینک نصب اندروید (به‌طور پیش‌فرض از روی pkg ساخته می‌شود)
 *
 * لوگو: /public/banks/{id}.png (رسمی) ← {id}.svg (جایگزین) ← حرف اول
 */

export interface BankAppConfig {
  id: string;
  name: string;
  pkg?: string;
  ios?: string;
  appStore?: string;
  web?: string;
  store?: string;
  logo?: string;
}

const bazaar = (pkg?: string) => (pkg ? `https://cafebazaar.ir/app/${pkg}` : '');
const mk = (b: Omit<BankAppConfig, 'logo' | 'store'> & { store?: string }): BankAppConfig => ({
  ...b,
  store: b.store ?? bazaar(b.pkg),
  logo: `/banks/${b.id}.png`,
});

export const BANKS: BankAppConfig[] = [
  mk({ id: 'melli', name: 'ملی (بام)', pkg: 'ir.bmi.bam.nativeweb', ios: '', appStore: '', web: '' }),
  mk({ id: 'mellat', name: 'ملت', pkg: '', ios: '', appStore: '', web: '' }),
  mk({ id: 'sepah', name: 'سپه', pkg: 'mob.banking.android.sepah', ios: '', appStore: '', web: '' }),
  mk({ id: 'saderat', name: 'صادرات', pkg: 'com.isc.bsinew', ios: '', appStore: '', web: '' }),
  mk({ id: 'tejarat', name: 'تجارت', pkg: 'ir.tejaratbank.tata.mobile.android.tejarat', ios: '', appStore: '', web: '' }),
  mk({ id: 'pasargad', name: 'پاسارگاد', pkg: 'mob.banking.android.pasargad', ios: '', appStore: '', web: '' }),
  mk({ id: 'blu', name: 'سامان (blu)', pkg: 'com.samanpr.blu', ios: '', appStore: '', web: '' }),
  mk({ id: 'refah', name: 'رفاه', pkg: 'com.refahbank.dpi.android', ios: '', appStore: '', web: '' }),
  mk({ id: 'ayandeh', name: 'آینده', pkg: 'com.adpdigital.mbs.ayand', ios: '', appStore: '', web: '' }),
  mk({ id: 'shahr', name: 'شهر (آپ/همراه شهر)', pkg: 'com.citydi.hplus', ios: '', appStore: '', web: '' }),
  mk({ id: 'postbank', name: 'پست‌بانک', pkg: '', ios: '', appStore: '', web: '' }),
  mk({ id: 'keshavarzi', name: 'کشاورزی', pkg: '', ios: '', appStore: '', web: '' }),
  mk({ id: 'maskan', name: 'مسکن', pkg: '', ios: '', appStore: '', web: '' }),
  mk({ id: 'melal', name: 'ملل', pkg: '', ios: '', appStore: '', web: '' }),
];
