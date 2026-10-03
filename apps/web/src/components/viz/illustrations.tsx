// Warm line-art spot illustrations for empty states. Drawn with theme tokens so they work in both themes.
import { cn } from '@/lib/cn';

type Kind = 'inbox' | 'money' | 'projects' | 'people' | 'calendar' | 'done' | 'files';

export function SpotIllustration({ kind, className }: { kind: Kind; className?: string }) {
  const stroke = 'hsl(var(--foreground) / 0.55)';
  const brand = 'hsl(var(--primary))';
  const wash = 'hsl(var(--brand-wash))';
  return (
    <svg viewBox="0 0 120 90" className={cn('h-20 w-28', className)} fill="none" aria-hidden strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="60" cy="80" rx="42" ry="5" fill="hsl(var(--muted))" />
      {kind === 'money' && (
        <>
          <rect x="22" y="22" width="76" height="44" rx="8" fill={wash} stroke={stroke} strokeWidth="2" />
          <circle cx="60" cy="44" r="11" stroke={brand} strokeWidth="2.5" />
          <path d="M56 40h8M56 44h8M58 40c4 0 5 8-2 9l6 4" stroke={brand} strokeWidth="2" />
          <path d="M30 30v0M90 58v0" stroke={stroke} strokeWidth="4" />
        </>
      )}
      {kind === 'projects' && (
        <>
          <rect x="18" y="20" width="38" height="46" rx="6" fill={wash} stroke={stroke} strokeWidth="2" />
          <rect x="64" y="28" width="38" height="38" rx="6" stroke={stroke} strokeWidth="2" />
          <path d="M26 32h22M26 40h16M72 40h22M72 48h14" stroke={stroke} strokeWidth="2" />
          <circle cx="44" cy="56" r="5" fill={brand} />
        </>
      )}
      {kind === 'people' && (
        <>
          <circle cx="46" cy="36" r="10" fill={wash} stroke={stroke} strokeWidth="2" />
          <circle cx="74" cy="40" r="8" stroke={stroke} strokeWidth="2" />
          <path d="M28 66c2-10 10-16 18-16s16 6 18 16M62 66c1-7 6-12 12-12s11 5 12 12" stroke={stroke} strokeWidth="2" />
          <circle cx="86" cy="24" r="4" fill={brand} />
        </>
      )}
      {kind === 'calendar' && (
        <>
          <rect x="26" y="20" width="68" height="50" rx="8" fill={wash} stroke={stroke} strokeWidth="2" />
          <path d="M26 32h68M42 14v12M78 14v12" stroke={stroke} strokeWidth="2" />
          <rect x="54" y="42" width="12" height="12" rx="3" fill={brand} />
        </>
      )}
      {kind === 'done' && (
        <>
          <circle cx="60" cy="42" r="24" fill={wash} stroke={stroke} strokeWidth="2" />
          <path d="M49 42l8 8 15-16" stroke={brand} strokeWidth="3.5" />
        </>
      )}
      {kind === 'files' && (
        <>
          <path d="M36 18h30l14 14v38H36z" fill={wash} stroke={stroke} strokeWidth="2" />
          <path d="M66 18v14h14M46 46h24M46 54h16" stroke={stroke} strokeWidth="2" />
          <circle cx="76" cy="66" r="7" fill={brand} />
        </>
      )}
      {kind === 'inbox' && (
        <>
          <path d="M24 46l10-24h52l10 24v20H24z" fill={wash} stroke={stroke} strokeWidth="2" />
          <path d="M24 46h22l4 8h20l4-8h22" stroke={stroke} strokeWidth="2" />
          <circle cx="60" cy="34" r="4" fill={brand} />
        </>
      )}
    </svg>
  );
}
