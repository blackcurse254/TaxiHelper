const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizeDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const pIdx = PERSIAN_DIGITS.indexOf(ch);
    if (pIdx !== -1) {
      out += String(pIdx);
      continue;
    }
    const aIdx = ARABIC_DIGITS.indexOf(ch);
    if (aIdx !== -1) {
      out += String(aIdx);
      continue;
    }
    out += ch;
  }
  return out;
}

export function parseTomanInput(raw: string): number {
  const normalized = normalizeDigits(raw).replace(/[^\d]/g, '');
  if (!normalized) return 0;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatToman(amount: number): string {
  return new Intl.NumberFormat('fa-IR').format(Math.max(0, Math.round(amount)));
}

export function validateCardNumber(raw: string): boolean {
  const digits = normalizeDigits(raw).replace(/\D/g, '');
  if (!/^\d{16}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    let val = Number(digits[i]);
    if (i % 2 === 0) {
      val *= 2;
      if (val > 9) val -= 9;
    }
    sum += val;
  }
  return sum % 10 === 0;
}

export function formatCardDisplay(raw: string): string {
  const digits = normalizeDigits(raw).replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1-').replace(/-$/, '');
}

export function maskCardDisplay(raw: string): string {
  const digits = normalizeDigits(raw).replace(/\D/g, '');
  if (digits.length !== 16) return '••••-••••-••••-••••';
  return `${digits.slice(0, 4)}-••••-••••-${digits.slice(-4)}`;
}

export function splitCardGroups(raw: string): string[] {
  const digits = normalizeDigits(raw).replace(/\D/g, '').slice(0, 16);
  if (!digits) return ['••••', '••••', '••••', '••••'];
  const groups: string[] = Array.from(digits.match(/.{1,4}/g) ?? []);
  while (groups.length < 4) groups.push('••••');
  return groups;
}

export interface DetectedBankInfo {
  name: string;
  shortCode: string;
}

const IRANIAN_BANK_BINS: Record<string, DetectedBankInfo> = {
  '603799': { name: 'بانک ملی ایران', shortCode: 'BMI' },
  '589210': { name: 'بانک سپه', shortCode: 'SEPAH' },
  '627648': { name: 'بانک توسعه صادرات', shortCode: 'EDBI' },
  '627961': { name: 'بانک صنعت و معدن', shortCode: 'BIM' },
  '603770': { name: 'بانک کشاورزی', shortCode: 'BKI' },
  '628023': { name: 'بانک مسکن', shortCode: 'MASKAN' },
  '627760': { name: 'پست بانک ایران', shortCode: 'POST' },
  '502908': { name: 'بانک توسعه تعاون', shortCode: 'TTB' },
  '627412': { name: 'بانک اقتصاد نوین', shortCode: 'EN' },
  '622106': { name: 'بانک پارسیان', shortCode: 'PARSIAN' },
  '502229': { name: 'بانک پاسارگاد', shortCode: 'BPI' },
  '627488': { name: 'بانک کارآفرین', shortCode: 'KAR' },
  '621986': { name: 'بانک سامان / بلوبانک', shortCode: 'SAMAN' },
  '639346': { name: 'بانک سینا', shortCode: 'SINA' },
  '639607': { name: 'بانک سرمایه', shortCode: 'SARMAYEH' },
  '636214': { name: 'بانک آینده', shortCode: 'AYANDEH' },
  '502806': { name: 'بانک شهر', shortCode: 'SHAHR' },
  '504706': { name: 'بانک شهر', shortCode: 'SHAHR' },
  '502938': { name: 'بانک دی', shortCode: 'DAY' },
  '603769': { name: 'بانک صادرات ایران', shortCode: 'BSI' },
  '610433': { name: 'بانک ملت', shortCode: 'MELLAT' },
  '627353': { name: 'بانک تجارت', shortCode: 'TEJARAT' },
  '585983': { name: 'بانک تجارت', shortCode: 'TEJARAT' },
  '589463': { name: 'بانک رفاه کارگران', shortCode: 'REFAH' },
  '627381': { name: 'بانک انصار', shortCode: 'ANSAR' },
  '606256': { name: 'موسسه اعتباری ملل', shortCode: 'MELAL' },
  '606373': { name: 'بانک قرض‌الحسنه مهر ایران', shortCode: 'MEHR' },
  '504172': { name: 'بانک رسالت', shortCode: 'RESALAT' },
};

export function detectIranianBankByCard(raw: string): DetectedBankInfo {
  const digits = normalizeDigits(raw).replace(/\D/g, '');
  const bin = digits.slice(0, 6);
  return IRANIAN_BANK_BINS[bin] ?? { name: 'کارت بانکی عضو شتاب', shortCode: 'SHETAB' };
}
