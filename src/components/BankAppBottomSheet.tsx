import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Search,
  Smartphone,
  X,
} from 'lucide-react';
import { BANKS, type BankAppConfig } from '../config/banks';
import { executeBankTap, orderBanksWithLastUsed } from '../utils/bankIntent';
import { formatCardDisplay, formatToman } from '../utils/iranianValidation';
import { BankLogo } from './BankLogo';

interface BankAppBottomSheetProps {
  open: boolean;
  cardNumber: string;
  driverName: string;
  amountToman: number;
  onClose: () => void;
}

interface BankFeedbackState {
  bank: BankAppConfig;
  toastMessage: string;
  secondaryMessage: string | null;
  webUrl: string | null;
  storeUrl: string | null;
  notOpened: boolean;
}

const LAST_BANK_STORAGE_KEY = 'kerayeyar_last_bank_id';

function readLastUsedBankId(): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const value = window.localStorage.getItem(LAST_BANK_STORAGE_KEY);
    return value ? value.trim() : null;
  } catch {
    return null;
  }
}

function saveLastUsedBankId(id: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LAST_BANK_STORAGE_KEY, id);
    }
  } catch {
    // Ignore localStorage restrictions (private mode / quota)
  }
}

function fallbackCopyWithTextarea(text: string): void {
  try {
    if (typeof document === 'undefined') return;
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.className = 'fixed -top-[9999px] -left-[9999px] opacity-0';
    document.body.appendChild(el);
    el.select();
    el.setSelectionRange(0, text.length);
    document.execCommand('copy');
    document.body.removeChild(el);
  } catch {
    // Ignore DOM copy fallback error
  }
}

function copyCardSynchronously(digits: string): void {
  if (!digits || typeof navigator === 'undefined') {
    fallbackCopyWithTextarea(digits);
    return;
  }
  if (navigator.clipboard?.writeText) {
    try {
      navigator.clipboard.writeText(digits).catch(() => {
        fallbackCopyWithTextarea(digits);
      });
    } catch {
      fallbackCopyWithTextarea(digits);
    }
  } else {
    fallbackCopyWithTextarea(digits);
  }
}

export function BankAppBottomSheet({
  open,
  cardNumber,
  driverName,
  amountToman,
  onClose,
}: BankAppBottomSheetProps) {
  const [feedback, setFeedback] = useState<BankFeedbackState | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUsedId, setLastUsedId] = useState<string | null>(() => readLastUsedBankId());
  const timerRef = useRef<number | null>(null);
  const visibilityListenerRef = useRef<(() => void) | null>(null);

  function clearPendingMonitor() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (visibilityListenerRef.current) {
      document.removeEventListener('visibilitychange', visibilityListenerRef.current);
      visibilityListenerRef.current = null;
    }
  }

  useEffect(() => {
    if (open) {
      setLastUsedId(readLastUsedBankId());
    } else {
      clearPendingMonitor();
      setFeedback(null);
      setSearchQuery('');
    }
    return () => {
      clearPendingMonitor();
    };
  }, [open]);

  const orderedBanks = useMemo(
    () => orderBanksWithLastUsed(BANKS, lastUsedId, searchQuery),
    [lastUsedId, searchQuery]
  );

  if (!open) return null;

  function handleBankSelect(bank: BankAppConfig) {
    clearPendingMonitor();

    // ذخیره آخرین بانک انتخاب‌شده بدون تاثیر روی عملیات کپی/اجرا
    saveLastUsedBankId(bank.id);
    setLastUsedId(bank.id);

    const plan = executeBankTap({
      bank,
      cardNumber,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      copyCard: copyCardSynchronously,
      launchIntent: (intentUri) => {
        window.location.href = intentUri;
      },
      openWebTab: (webUrl) => {
        window.open(webUrl, '_blank', 'noopener,noreferrer');
      },
    });

    setFeedback({
      bank,
      toastMessage: plan.toastMessage,
      secondaryMessage: plan.secondaryMessage,
      webUrl: plan.webUrl,
      storeUrl: plan.storeUrl,
      notOpened: false,
    });

    if (plan.shouldMonitorVisibility && plan.intentUri) {
      const handleVisibility = () => {
        if (document.visibilityState === 'hidden') {
          clearPendingMonitor();
        }
      };
      visibilityListenerRef.current = handleVisibility;
      document.addEventListener('visibilitychange', handleVisibility);

      timerRef.current = window.setTimeout(() => {
        if (document.visibilityState === 'visible') {
          setFeedback((prev) =>
            prev
              ? {
                  ...prev,
                  notOpened: true,
                  secondaryMessage: plan.notInstalledMessage,
                }
              : null
          );
        }
        clearPendingMonitor();
      }, plan.fallbackDelayMs);
    }
  }

  const formattedCard = formatCardDisplay(cardNumber);

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bank-sheet-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm"
    >
      <button
        type="button"
        aria-label="بستن پنجره انتخاب بانک"
        onClick={onClose}
        className="fixed inset-0 cursor-default"
      />

      <div className="relative z-10 w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[88vh] overflow-y-auto">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-amber-400 shrink-0">
              <Smartphone className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="bank-sheet-title" className="text-base font-bold text-slate-900">
                پرداخت با اپ بانک
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                انتخاب بانک برای کپی خودکار کارت و انتقال به برنامه
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن لیست بانک‌ها"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Driver Card & Amount Strip */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <span className="text-slate-500">کارت {driverName}: </span>
            <span dir="ltr" className="inline-block font-mono font-semibold text-slate-900 tabular-nums">
              {formattedCard || 'شماره کارت ثبت نشده'}
            </span>
          </div>
          <div className="font-bold text-slate-900 tabular-nums">
            {formatToman(amountToman)} تومان
          </div>
        </div>

        {/* Feedback / Toast Banner */}
        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className={`mt-4 rounded-2xl border p-3.5 text-xs space-y-2 ${
              feedback.notOpened
                ? 'border-amber-300 bg-amber-50 text-amber-950'
                : 'border-emerald-200 bg-emerald-50 text-emerald-950'
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              {feedback.notOpened ? (
                <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
              )}
              <span>{feedback.toastMessage}</span>
            </div>

            {feedback.secondaryMessage && (
              <div className="flex items-center gap-1.5 font-semibold">
                <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{feedback.secondaryMessage}</span>
              </div>
            )}

            {feedback.notOpened && (feedback.webUrl || feedback.storeUrl) && (
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {feedback.webUrl && (
                  <a
                    href={feedback.webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[38px] inline-flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-400"
                  >
                    <span>باز کردن وب‌اپ بانک</span>
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
                {feedback.storeUrl && (
                  <a
                    href={feedback.storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[38px] inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800"
                  >
                    <span>دانلود از بازار</span>
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Search Input */}
        <div className="mt-4 relative">
          <Search
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جست‌وجوی نام بانک..."
            aria-label="جست‌وجوی نام بانک"
            className="w-full min-h-[44px] rounded-2xl border border-slate-200 bg-slate-50 pr-10 pl-9 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="پاک کردن جست‌وجو"
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* 3-Column Bank Grid (min-h 88px, >= 44px touch target) */}
        {orderedBanks.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
            بانکی با این نام یافت نشد.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {orderedBanks.map((bank) => {
              const isSelected = feedback?.bank.id === bank.id;
              const isLastUsed = lastUsedId === bank.id;
              return (
                <button
                  key={bank.id}
                  type="button"
                  onClick={() => handleBankSelect(bank)}
                  aria-pressed={isSelected}
                  className={`relative min-h-[88px] flex flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-2.5 text-center transition-all duration-150 active:scale-[0.95] cursor-pointer ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-500/30 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {isSelected && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 left-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-slate-950"
                    >
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  )}

                  {isLastUsed && !isSelected && (
                    <span className="absolute top-1.5 right-1.5 text-[9px] font-bold text-amber-800 bg-amber-100 rounded-md px-1.5 py-0.5 leading-none">
                      آخرین استفاده
                    </span>
                  )}

                  <BankLogo name={bank.name} bankId={bank.id} logo={bank.logo} selected={isSelected} />

                  <span className="text-[11px] sm:text-xs font-semibold text-slate-900 leading-snug line-clamp-2">
                    {bank.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
