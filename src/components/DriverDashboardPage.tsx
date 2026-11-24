import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, Copy, Play, QrCode, Volume2, Wallet } from 'lucide-react';
import { formatToman } from '../utils/iranianValidation';
import { formatDepositAnnouncement } from '../utils/persianNumbers';
import type { DriverSyncResponse, PaymentRecordItem } from '../types/taxi';
import { QrCodeView } from './QrCodeView';

interface DriverDashboardPageProps {
  driverToken: string;
}

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  released: boolean;
}

export function DriverDashboardPage({ driverToken }: DriverDashboardPageProps) {
  const [started, setStarted] = useState(false);
  const [syncData, setSyncData] = useState<DriverSyncResponse | null>(null);
  const [error, setError] = useState('');
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [lastAnnouncement, setLastAnnouncement] = useState<string>('');
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [copiedPassengerLink, setCopiedPassengerLink] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  const playChimeAndSpeak = useCallback((amountToman: number, customText?: string) => {
    const text = customText ?? formatDepositAnnouncement(amountToman);
    if (!customText) {
      setLastAnnouncement(text);
    }

    // 1. Two-tone Web Audio chime
    try {
      const ctx = audioCtxRef.current;
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(660, now);
        osc1.frequency.setValueAtTime(880, now + 0.14);
        gain1.gain.setValueAtTime(0.001, now);
        gain1.gain.exponentialRampToValueAtTime(0.28, now + 0.03);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.44);
      }
    } catch {
      // Audio playback blocked
    }

    // 2. Persian Web Speech announcement
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'fa-IR';
        utter.rate = 0.95;
        window.speechSynthesis.speak(utter);
      }
    } catch {
      // SpeechSynthesis unavailable
    }
  }, []);

  const runSync = useCallback(async () => {
    if (!driverToken) {
      setError('توکن راننده (?k=...) در آدرس یافت نشد.');
      return;
    }
    try {
      const res = await fetch('/api/driver/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ k: driverToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'توکن راننده نامعتبر است.');
        return;
      }
      const typed = data as DriverSyncResponse;
      setSyncData(typed);
      setError('');

      if (typed.newlyConfirmed.length > 0) {
        for (const item of typed.newlyConfirmed) {
          playChimeAndSpeak(item.amount);
        }
      }
    } catch {
      setError('خطا در ارتباط با سرور راننده.');
    }
  }, [driverToken, playChimeAndSpeak]);

  async function handleStart() {
    // Unlock AudioContext on explicit user click
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        await ctx.resume();
        audioCtxRef.current = ctx;
      }
    } catch {
      // Ignore AudioContext error
    }

    // Prime SpeechSynthesis silently on click
    try {
      if ('speechSynthesis' in window) {
        const prime = new SpeechSynthesisUtterance('');
        window.speechSynthesis.speak(prime);
      }
    } catch {
      // Ignore SpeechSynthesis error
    }

    // Request Screen Wake Lock
    try {
      const nav = navigator as unknown as {
        wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
      };
      if (nav.wakeLock?.request) {
        const sentinel = await nav.wakeLock.request('screen');
        wakeLockRef.current = sentinel;
        setWakeLockActive(true);
      }
    } catch {
      setWakeLockActive(false);
    }

    setStarted(true);
    runSync();
  }

  // Re-acquire Wake Lock when tab returns to visible
  useEffect(() => {
    if (!started) return;
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const nav = navigator as unknown as {
            wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
          };
          if (nav.wakeLock?.request) {
            wakeLockRef.current = await nav.wakeLock.request('screen');
            setWakeLockActive(true);
          }
        } catch {
          setWakeLockActive(false);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, [started]);

  // Poll POST /api/driver/sync every 3 seconds once started
  useEffect(() => {
    if (!started) return;
    const timer = window.setInterval(() => {
      runSync();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [started, runSync]);

  async function handleManualConfirm(item: PaymentRecordItem) {
    setConfirmingId(item.id);
    try {
      const res = await fetch('/api/driver/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ k: driverToken, paymentId: item.id }),
      });
      if (res.ok) {
        playChimeAndSpeak(item.amount);
        await runSync();
      }
    } finally {
      setConfirmingId(null);
    }
  }

  const recentTotalToman = useMemo(() => {
    if (!syncData) return 0;
    return syncData.recentConfirmed.reduce((acc, item) => acc + item.amount, 0);
  }, [syncData]);

  const passengerUrl = useMemo(() => {
    if (!syncData?.driver.slug || typeof window === 'undefined') return '';
    return `${window.location.origin}/d/${encodeURIComponent(syncData.driver.slug)}`;
  }, [syncData?.driver.slug]);

  function handleCopyPassengerLink() {
    if (!passengerUrl) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(passengerUrl).catch(() => {});
    }
    setCopiedPassengerLink(true);
    window.setTimeout(() => setCopiedPassengerLink(false), 1800);
  }

  if (!driverToken) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-rose-200 bg-white p-8 text-center text-sm text-rose-700">
        لینک پنل راننده ناقص است. لینک اختصاصی خود را از صفحه مدیر دریافت کنید.
      </div>
    );
  }

  if (!started) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-6 shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-900 text-amber-400 shadow-md">
          <Volume2 className="h-8 w-8" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">آماده‌سازی پنل صوتی راننده</h1>
          <p className="text-xs sm:text-sm leading-6 text-slate-600">
            با لمس «شروع»، بوق و اعلام صوتی فارسی مبلغ واریزی فعال می‌شود و صفحه گوشی حین کار روشن می‌ماند.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-right text-xs">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="font-bold text-slate-900">اعلام صوتی خودکار</div>
            <div className="mt-0.5 text-slate-500">خواندن مبلغ واریز به فارسی</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="font-bold text-slate-900">صفحه همیشه روشن</div>
            <div className="mt-0.5 text-slate-500">فعال‌سازی Wake Lock</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="font-bold text-slate-900">تایید یک‌لمسی</div>
            <div className="mt-0.5 text-slate-500">دکمه سریع «موجودی آمد»</div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleStart}
          className="w-full min-h-[56px] inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3.5 text-base font-bold text-slate-950 shadow-sm transition hover:bg-amber-400 active:scale-[0.99] cursor-pointer"
        >
          <Play className="h-5 w-5" aria-hidden="true" />
          <span>شروع</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
          {error}
        </div>
      )}

      {/* Active Driver Header + Shift Stats + Quick Tools */}
      <section className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 sm:p-6 text-white shadow-lg space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-amber-300 font-medium">پنل دریافت کرایه راننده</p>
            <h1 className="mt-1 text-xl sm:text-2xl font-bold">
              {syncData?.driver.name || 'در حال همگام‌سازی...'}
            </h1>
            {syncData && (
              <p className="mt-1 text-xs text-slate-300">
                <span dir="ltr" className="inline-block font-mono tabular-nums">
                  {syncData.driver.cardNumberMasked}
                </span>
              </p>
            )}
          </div>

          <div className="text-xs text-right sm:text-left space-y-1">
            <div className={wakeLockActive ? 'text-emerald-300 font-semibold' : 'text-slate-300 font-medium'}>
              {wakeLockActive ? 'صفحه روشن (Wake Lock فعال)' : 'اعلام صوتی فعال'}
            </div>
            <div className="text-slate-400">به‌روزرسانی خودکار هر ۳ ثانیه</div>
          </div>
        </div>

        {/* Summary Numbers */}
        {syncData && (
          <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-slate-700/80 text-center">
            <div className="rounded-2xl bg-slate-800/80 p-3">
              <div className="text-[11px] text-slate-400">جمع تاییدشده اخیر</div>
              <div className="mt-1 text-sm sm:text-base font-bold text-amber-300 tabular-nums">
                {formatToman(recentTotalToman)} <span className="text-[10px] font-normal">تومان</span>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-800/80 p-3">
              <div className="text-[11px] text-slate-400">اعلام مسافر</div>
              <div className="mt-1 text-sm sm:text-base font-bold text-white tabular-nums">
                {syncData.claimedPayments.length} مورد
              </div>
            </div>
            <div className="rounded-2xl bg-slate-800/80 p-3">
              <div className="text-[11px] text-slate-400">در انتظار</div>
              <div className="mt-1 text-sm sm:text-base font-bold text-slate-200 tabular-nums">
                {syncData.pendingCount} مورد
              </div>
            </div>
          </div>
        )}

        {/* Driver Quick Tools: Test Sound + Show Passenger QR */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => playChimeAndSpeak(50000, 'صدای اعلان کرایه فعال است')}
            className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-slate-600/80 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 cursor-pointer"
          >
            <Volume2 className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <span>تست صدا</span>
          </button>

          {passengerUrl && (
            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-slate-600/80 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 cursor-pointer"
            >
              <QrCode className="h-4 w-4 text-amber-400" aria-hidden="true" />
              <span>{showQr ? 'بستن QR مسافر' : 'نمایش QR به مسافر'}</span>
            </button>
          )}
        </div>
      </section>

      {/* Expandable Passenger QR Code Card */}
      {showQr && passengerUrl && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <QrCodeView value={passengerUrl} size={148} label="کد QR پرداخت مسافر" />
          <div className="flex-1 text-center sm:text-right space-y-2.5">
            <h2 className="text-sm font-bold text-slate-900">اسکن سریع توسط مسافر</h2>
            <p className="text-xs leading-5 text-slate-500">
              مسافر با اسکن این کد مستقیماً وارد صفحه انتخاب مبلغ و شماره کارت شما می‌شود.
            </p>
            <button
              type="button"
              onClick={handleCopyPassengerLink}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              {copiedPassengerLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedPassengerLink ? 'لینک کپی شد' : 'کپی لینک مسافر'}</span>
            </button>
          </div>
        </section>
      )}

      {lastAnnouncement && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3.5 flex items-center gap-2.5 text-sm font-bold text-emerald-950 shadow-xs"
        >
          <Volume2 className="h-5 w-5 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>{lastAnnouncement}</span>
        </div>
      )}

      {/* Claimed Payments awaiting manual or SMS confirmation */}
      <section
        className={`rounded-3xl border bg-white p-5 sm:p-6 space-y-4 shadow-sm ${
          syncData && syncData.claimedPayments.length > 0
            ? 'border-amber-300 ring-2 ring-amber-500/15'
            : 'border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">پرداخت‌های اعلام‌شده توسط مسافر</h2>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {syncData?.claimedPayments.length ?? 0} مورد
          </span>
        </div>

        {!syncData || syncData.claimedPayments.length === 0 ? (
          <p className="text-xs text-slate-500">
            در حال حاضر پرداختی با وضعیت «پرداخت کردم» در صف تایید نیست.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {syncData.claimedPayments.map((item) => (
              <li
                key={item.id}
                className="py-4 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xl font-bold text-slate-950 tabular-nums">
                    {formatToman(item.amount)}{' '}
                    <span className="text-xs font-medium text-slate-500">تومان</span>
                  </div>
                  <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                    شناسه #{item.id} · مبلغ پایه {formatToman(item.baseAmount)} تومان
                  </div>
                </div>

                <button
                  type="button"
                  disabled={confirmingId === item.id}
                  onClick={() => handleManualConfirm(item)}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 cursor-pointer shrink-0"
                >
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                  <span>{confirmingId === item.id ? 'در حال ثبت...' : 'موجودی آمد'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent Confirmed */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-3 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">واریزی‌های تاییدشده اخیر</h2>
        {!syncData || syncData.recentConfirmed.length === 0 ? (
          <p className="text-xs text-slate-500">هنوز واریزی تایید نشده است.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {syncData.recentConfirmed.map((item) => (
              <li key={item.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>تاییدشده (#{item.id})</span>
                </span>
                <span className="font-bold text-slate-900 tabular-nums text-sm">
                  {formatToman(item.amount)} تومان
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
