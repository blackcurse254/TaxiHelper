import { useState } from 'react';
import { Check, Copy, Landmark, Wifi } from 'lucide-react';
import {
  detectIranianBankByCard,
  formatToman,
  normalizeDigits,
  splitCardGroups,
} from '../utils/iranianValidation';

interface BankCardPreviewProps {
  cardNumber: string;
  cardHolder: string;
  driverName: string;
  amountToman?: number;
  onCopyCard?: () => void;
}

export function BankCardPreview({
  cardNumber,
  cardHolder,
  driverName,
  amountToman,
  onCopyCard,
}: BankCardPreviewProps) {
  const [copied, setCopied] = useState(false);

  const cleanCard = normalizeDigits(cardNumber).replace(/\D/g, '');
  const groups = splitCardGroups(cleanCard);
  const bank = detectIranianBankByCard(cleanCard);

  function handleCopy() {
    if (cleanCard && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(cleanCard).catch(() => {});
    }
    setCopied(true);
    onCopyCard?.();
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section
      aria-label="پیش‌نمایش کارت بانکی راننده"
      className="relative overflow-hidden rounded-3xl border border-slate-700/80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-5 sm:p-6 text-white shadow-xl"
    >
      {/* Subtle metallic card arcs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -left-20 h-56 w-56 rounded-full bg-amber-400/10 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-16 h-60 w-60 rounded-full bg-sky-400/10 blur-2xl"
      />

      <div className="relative z-10 flex flex-col justify-between gap-5">
        {/* Top Row: Bank Identity + EMV Chip & NFC */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/15 text-amber-300 shrink-0">
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white">{bank.name}</div>
              <div className="text-[11px] text-slate-400">کارت مقصد · شبکه شتاب</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0" aria-hidden="true">
            <Wifi className="h-4 w-4 rotate-90 text-slate-400" />
            {/* Graphic EMV Metallic Chip */}
            <svg
              viewBox="0 0 42 32"
              className="h-8 w-10 rounded-md border border-amber-300/50 bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 shadow-inner"
            >
              <line x1="14" y1="0" x2="14" y2="32" stroke="#78350F" strokeWidth="1" strokeOpacity="0.45" />
              <line x1="28" y1="0" x2="28" y2="32" stroke="#78350F" strokeWidth="1" strokeOpacity="0.45" />
              <line x1="0" y1="11" x2="14" y2="11" stroke="#78350F" strokeWidth="1" strokeOpacity="0.45" />
              <line x1="0" y1="21" x2="14" y2="21" stroke="#78350F" strokeWidth="1" strokeOpacity="0.45" />
              <line x1="28" y1="11" x2="42" y2="11" stroke="#78350F" strokeWidth="1" strokeOpacity="0.45" />
              <line x1="28" y1="21" x2="42" y2="21" stroke="#78350F" strokeWidth="1" strokeOpacity="0.45" />
              <rect
                x="14"
                y="9"
                width="14"
                height="14"
                rx="2.5"
                fill="none"
                stroke="#78350F"
                strokeWidth="1"
                strokeOpacity="0.5"
              />
            </svg>
          </div>
        </div>

        {/* Middle Row: 16-Digit Embossed Card Number + Copy Button */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              dir="ltr"
              aria-label={`شماره کارت ${cleanCard}`}
              className="inline-flex items-center gap-2.5 sm:gap-3.5 font-mono text-xl sm:text-2xl font-bold tracking-wider text-white tabular-nums"
            >
              {groups.map((grp, idx) => (
                <span key={idx} className="drop-shadow-sm">
                  {grp}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-600/80 bg-slate-800/90 px-3.5 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-700 active:scale-[0.98] cursor-pointer shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4 text-amber-400" aria-hidden="true" />
              )}
              <span>{copied ? 'شماره کارت کپی شد' : 'کپی شماره کارت'}</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Card Holder + Driver + Optional Exact Amount */}
        <div className="pt-3.5 border-t border-slate-700/70 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] text-slate-400">به نام صاحب کارت</div>
            <div className="mt-0.5 text-sm font-bold text-slate-100">
              {cardHolder}
              {driverName && driverName !== cardHolder && (
                <span className="text-xs font-normal text-slate-400"> (راننده: {driverName})</span>
              )}
            </div>
          </div>

          <div className="text-left">
            {typeof amountToman === 'number' && amountToman > 0 ? (
              <div>
                <div className="text-[10px] text-slate-400">مبلغ واریزی</div>
                <div className="mt-0.5 text-sm font-bold text-amber-300 tabular-nums">
                  {formatToman(amountToman)} تومان
                </div>
              </div>
            ) : (
              <span dir="ltr" className="font-mono text-xs font-semibold tracking-widest text-slate-400">
                {bank.shortCode}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
