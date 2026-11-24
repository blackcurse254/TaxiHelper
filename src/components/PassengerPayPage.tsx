import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Smartphone,
  UserCheck,
} from 'lucide-react';
import { formatToman } from '../utils/iranianValidation';
import type { PayDetailResponse } from '../types/taxi';
import { BankAppBottomSheet } from './BankAppBottomSheet';
import { BankCardPreview } from './BankCardPreview';

interface PassengerPayPageProps {
  paymentId: string;
  token: string;
  onAmountReady: (amount: number | null) => void;
  onNavigate: (to: string) => void;
}

export function PassengerPayPage({
  paymentId,
  token,
  onAmountReady,
  onNavigate,
}: PassengerPayPageProps) {
  const [payment, setPayment] = useState<PayDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/pay/${encodeURIComponent(paymentId)}?t=${encodeURIComponent(token)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'اطلاعات پرداخت معتبر نیست.');
        onAmountReady(null);
      } else {
        setPayment(data);
        onAmountReady(data.amount);
        setError('');
      }
    } catch {
      setError('خطا در بررسی وضعیت پرداخت.');
    } finally {
      setLoading(false);
    }
  }, [paymentId, token, onAmountReady]);

  useEffect(() => {
    fetchStatus();
    return () => onAmountReady(null);
  }, [fetchStatus, onAmountReady]);

  // Poll every 3 seconds while pending or claimed
  useEffect(() => {
    if (!payment || payment.status === 'confirmed' || payment.status === 'expired') {
      return;
    }
    const pollTimer = window.setInterval(() => {
      fetchStatus();
    }, 3000);
    return () => window.clearInterval(pollTimer);
  }, [payment, fetchStatus]);

  // 1-second countdown ticker
  useEffect(() => {
    if (!payment || payment.status === 'confirmed' || payment.status === 'expired') {
      return;
    }
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [payment]);

  function handleCopyAmountInline() {
    if (!payment) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(String(payment.amount)).catch(() => {});
    }
    setCopiedAmount(true);
    window.setTimeout(() => setCopiedAmount(false), 1800);
  }

  async function handleClaim() {
    if (!payment) return;
    setClaiming(true);
    try {
      const res = await fetch(`/api/pay/${encodeURIComponent(paymentId)}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'خطا در ثبت اعلام پرداخت');
      } else {
        setPayment((prev) =>
          prev ? { ...prev, status: data.status, claimedAt: data.claimedAt } : prev
        );
      }
    } catch {
      setError('خطا در ارسال درخواست اعلام پرداخت.');
    } finally {
      setClaiming(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        در حال دریافت اطلاعات کارت و مبلغ یکتا...
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-rose-200 bg-white p-8 text-center space-y-4">
        <p className="text-sm font-semibold text-rose-700">{error || 'پرداخت یافت نشد.'}</p>
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="min-h-[44px] rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
        >
          بازگشت به صفحه اصلی
        </button>
      </div>
    );
  }

  const remainingMs = Math.max(0, new Date(payment.expiresAt).getTime() - nowMs);
  const remMin = Math.floor(remainingMs / 60000);
  const remSec = Math.floor((remainingMs % 60000) / 1000);
  const countdownStr = `${String(remMin).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {/* Status Banner */}
      {payment.status === 'confirmed' && (
        <div
          role="status"
          className="rounded-3xl border border-emerald-300 bg-emerald-50 p-5 sm:p-6 space-y-4 text-emerald-950 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h1 className="text-base sm:text-lg font-bold">پرداخت با موفقیت تایید شد</h1>
              <p className="text-xs sm:text-sm text-emerald-800 mt-1 tabular-nums leading-6">
                مبلغ <strong>{formatToman(payment.amount)} تومان</strong> به کارت {payment.driver.cardHolder} واریز و به راننده اعلام شد. سفر خوشی داشته باشید.
              </p>
            </div>
          </div>
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => onNavigate(`/d/${encodeURIComponent(payment.driver.slug)}`)}
              className="min-h-[42px] rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 cursor-pointer"
            >
              پرداخت کرایه جدید
            </button>
          </div>
        </div>
      )}

      {payment.status === 'claimed' && (
        <div
          role="status"
          className="rounded-3xl border border-amber-300 bg-amber-50 p-5 flex items-center gap-3 text-amber-950 shadow-sm"
        >
          <Clock className="h-6 w-6 text-amber-700 shrink-0" aria-hidden="true" />
          <div>
            <h1 className="text-base font-bold">اعلام پرداخت ثبت شد</h1>
            <p className="text-xs text-amber-900/80 mt-0.5 leading-5">
              در حال تایید خودکار پیامک واریز یا تایید توسط راننده (به‌روزرسانی هر ۳ ثانیه)...
            </p>
          </div>
        </div>
      )}

      {payment.status === 'expired' && (
        <div
          role="alert"
          className="rounded-3xl border border-rose-200 bg-rose-50 p-5 flex items-center justify-between gap-3 text-rose-900"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-6 w-6 text-rose-600 shrink-0" aria-hidden="true" />
            <div>
              <h1 className="text-base font-bold">مهلت ۱۵ دقیقه‌ای این مبلغ به پایان رسید</h1>
              <p className="text-xs text-rose-700 mt-0.5">لطفاً مبلغ یکتای جدید دریافت کنید.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate(`/d/${encodeURIComponent(payment.driver.slug)}`)}
            className="min-h-[40px] rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 shrink-0 cursor-pointer"
          >
            دریافت مجدد
          </button>
        </div>
      )}

      {/* Exact Unique Amount + Inline Copy + Countdown */}
      <section className="rounded-3xl border border-amber-200 bg-amber-50/90 p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-amber-950">مبلغ دقیق انتقال (کارت‌به‌کارت)</p>
            {payment.status === 'pending' && (
              <button
                type="button"
                onClick={() => onNavigate(`/d/${encodeURIComponent(payment.driver.slug)}`)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900/80 hover:text-slate-950 cursor-pointer"
              >
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
                <span>تغییر مبلغ</span>
              </button>
            )}
          </div>
          <div className="text-3xl font-bold text-slate-950 tabular-nums">
            {formatToman(payment.amount)} <span className="text-base font-medium text-slate-700">تومان</span>
          </div>
          <p className="text-[11px] text-amber-900/80 tabular-nums">
            پایه {formatToman(payment.baseAmount)} + {formatToman(payment.amount - payment.baseAmount)} تومان کد یکتا
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {payment.status !== 'confirmed' && payment.status !== 'expired' && (
            <button
              type="button"
              onClick={handleCopyAmountInline}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-2xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 shadow-xs hover:bg-amber-100/60 active:scale-[0.98] cursor-pointer"
            >
              {copiedAmount ? (
                <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4 text-amber-700" aria-hidden="true" />
              )}
              <span>{copiedAmount ? 'مبلغ کپی شد' : 'کپی مبلغ'}</span>
            </button>
          )}

          {payment.status !== 'confirmed' && payment.status !== 'expired' && (
            <div className="rounded-2xl bg-slate-900 px-3.5 py-2 text-center text-white">
              <div className="text-[10px] text-slate-400">اعتبار</div>
              <div className="font-mono text-sm font-bold text-amber-400 tabular-nums" dir="ltr">
                {countdownStr}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Graphic Bank Card Preview */}
      <BankCardPreview
        cardNumber={payment.driver.cardNumber}
        cardHolder={payment.driver.cardHolder}
        driverName={payment.driver.name}
        amountToman={payment.amount}
      />

      {/* Payment Actions */}
      {(payment.status === 'pending' || payment.status === 'claimed') && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3.5 shadow-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
            <span className="font-bold text-slate-900">۲ مرحله ساده:</span>
            <span>۱. انتقال دقیق مبلغ با اپ بانک</span>
            <span aria-hidden="true">·</span>
            <span>۲. لمس «پرداخت کردم»</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setBankSheetOpen(true)}
              className="min-h-[54px] inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] cursor-pointer"
            >
              <Smartphone className="h-5 w-5 text-amber-400" aria-hidden="true" />
              <span>پرداخت با اپ بانک</span>
            </button>

            <button
              type="button"
              disabled={claiming || payment.status === 'claimed'}
              onClick={handleClaim}
              className="min-h-[54px] inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-amber-400 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              <UserCheck className="h-5 w-5" aria-hidden="true" />
              <span>
                {payment.status === 'claimed'
                  ? 'اعلام پرداخت ثبت شد'
                  : claiming
                  ? 'در حال ثبت...'
                  : 'پرداخت کردم'}
              </span>
            </button>
          </div>
        </section>
      )}

      <BankAppBottomSheet
        open={bankSheetOpen}
        cardNumber={payment.driver.cardNumber}
        driverName={payment.driver.name}
        amountToman={payment.amount}
        onClose={() => setBankSheetOpen(false)}
      />
    </div>
  );
}
