import { useEffect, useRef, useState } from 'react';
import { getBankInitial, sanitizeLogoSrc } from '../utils/bankIntent';

export interface BankLogoProps {
  name: string;
  logo?: string;
  bankId?: string;
  src?: string;
  selected?: boolean;
  className?: string;
}

export function BankLogo({
  name,
  logo,
  bankId,
  src,
  selected = false,
  className = '',
}: BankLogoProps) {
  const candidates = [src ?? logo, bankId ? `/banks/${bankId}.svg` : undefined]
    .map(sanitizeLogoSrc)
    .filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
  const key = candidates.join('|');
  const [idx, setIdx] = useState(0);
  const resolvedSrc = candidates[idx] ?? null;
  const failed = resolvedSrc === null;
  const setFailed = () => setIdx(i => i + 1);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setIdx(0);
  }, [key]);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      setFailed();
    }
  }, [resolvedSrc]);

  if (resolvedSrc && !failed) {
    return (
      <img
        ref={imgRef}
        src={resolvedSrc}
        alt={name}
        width={48}
        height={48}
        loading="lazy"
        decoding="async"
        onError={() => setFailed()}
        className={`h-12 w-12 rounded-xl bg-white object-contain p-1 border transition-colors ${
          selected ? 'border-amber-400' : 'border-slate-200'
        } ${className}`.trim()}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name}
      className={`flex h-12 w-12 items-center justify-center rounded-xl border text-base font-bold transition-colors ${
        selected
          ? 'bg-amber-500 text-slate-950 border-amber-600'
          : 'bg-slate-900 text-amber-400 border-slate-800'
      } ${className}`.trim()}
    >
      {getBankInitial(name)}
    </span>
  );
}

export default BankLogo;
