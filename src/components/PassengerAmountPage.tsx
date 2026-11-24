import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, CarTaxiFront, CreditCard } from 'lucide-react';
import { formatToman, parseTomanInput } from '../utils/iranianValidation';
import type { DriverPublicInfo } from '../types/taxi';

const QUICK_AMOUNTS = [20000, 35000, 50000, 75000, 100000, 150000];

interface PassengerAmountPageProps {
  slug: string;
  onNavigate: (to: string) => void;
}

export function PassengerAmountPage({ slug, onNavigate }: PassengerAmountPageProps) {
  const [driver, setDriver] = useState<DriverPublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [baseAmount, setBaseAmount] = useState<number>(50000);
  const [customInput, setCustomInput] = useState<string>('50000');
  const [creating, setCreating] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');

    fetch(`/api/d/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          setLoadError(data.error || 'راننده یافت نشد.');
        } else {
          setDriver(data);
        }
      })
      .catch(() => {
        if (active) setLoadError('خطا در دریافت اطلاعات راننده.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  function handleQuickSelect(amt: number) {
    setBaseAmount(amt);
    setCustomInput(String(amt));
    setSubmitError('');
  }

  function handleCustomChange(raw: string) {
    setCustomInput(raw);
    setBaseAmount(parseTomanInput(raw));
    setSubmitError('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (baseAmount < 1000 || baseAmount > 50_000_000) {
      setSubmitError('مبلغ کرایه باید بین ۱٬۰۰۰ تا ۵۰٬۰۰۰٬۰۰۰ تومان باشد.');
      return;
    }

    setCreating(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/pay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, baseAmount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || 'خطا در ایجاد مبلغ یکتا');
        return;
      }
      onNavigate(data.payUrl);
    } catch {
      setSubmitError('ارتباط با سرور برقرار نشد.');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        در حال بارگذاری اطلاعات راننده...
      </div>
    );
  }

  if (loadError || !driver) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-rose-200 bg-white p-8 text-center space-y-4">
        <p className="text-sm font-semibold text-rose-700">{loadError || 'راننده یافت نشد.'}</p>
        <button
          type="button"
          onClick={() => onNavigate('/admin')}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
        >
          <span>ثبت راننده جدید در پنل مدیریت</span>
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {/* Driver Header Card */}
      <section className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 sm:p-6 text-white shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-slate-950 shrink-0 shadow-sm">
              <CarTaxiFront className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-amber-300">
                پرداخت مستقیم کارت‌به‌کارت
              </div>
              <h1 className="mt-0.5 text-xl sm:text-2xl font-bold tracking-tight">{driver.name}</h1>
              <p className="mt-1 text-xs text-slate-300">
                به نام {driver.cardHolder}
                <span aria-hidden="true"> · </span>
                <span dir="ltr" className="inline-block font-mono tabular-nums text-slate-200">
                  {driver.cardNumberMasked}
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Amount Selection Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 space-y-5 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">مبلغ کرایه چقدر است؟</h2>
          <span className="text-xs font-medium text-slate-500">به تومان</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {QUICK_AMOUNTS.map((amt) => {
            const active = baseAmount === amt;
            return (
              <button
                key={amt}
                type="button"
                onClick={() => handleQuickSelect(amt)}
                className={`min-h-[54px] rounded-2xl border px-3 py-2.5 text-center transition cursor-pointer active:scale-[0.98] ${
                  active
                    ? 'border-amber-500 bg-amber-50 text-slate-950 font-bold ring-2 ring-amber-500/30 shadow-xs'
                    : 'border-slate-200 bg-slate-50/70 text-slate-800 font-medium hover:bg-slate-100'
                }`}
              >
                <span className="text-base tabular-nums">{formatToman(amt)}</span>
                <span className="block text-[11px] text-slate-500 mt-0.5">تومان</span>
              </button>
            );
          })}
        </div>

        <div>
          <label htmlFor="base-amount-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
            یا مبلغ دلخواه را بنویسید (تومان)
          </label>
          <div className="relative">
            <input
              id="base-amount-input"
              type="text"
              inputMode="numeric"
              dir="ltr"
              value={customInput}
              onChange={(e) => handleCustomChange(e.target.value)}
              placeholder="50000"
              className="w-full min-h-[50px] rounded-2xl border border-slate-300 bg-white pl-4 pr-32 py-2.5 font-mono text-base font-bold text-slate-900 tabular-nums focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-semibold text-slate-500 tabular-nums">
              {baseAmount > 0 ? `${formatToman(baseAmount)} تومان` : 'تومان'}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            برای تشخیص خودکار واریز شما، مبلغ ۰ تا ۸۹ تومان کد یکتا به کرایه اضافه می‌شود.
          </p>
        </div>

        {submitError && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={creating}
          className="w-full min-h-[54px] inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3.5 text-base font-bold text-slate-950 shadow-sm transition hover:bg-amber-400 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
        >
          <CreditCard className="h-5 w-5" aria-hidden="true" />
          <span className="tabular-nums">
            {creating
              ? 'در حال آماده‌سازی کارت...'
              : baseAmount >= 1000
              ? `ادامه و پرداخت ${formatToman(baseAmount)} تومان`
              : 'ادامه و دریافت شماره کارت'}
          </span>
        </button>
      </form>
    </div>
  );
}
