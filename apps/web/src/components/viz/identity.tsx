// Avatars and project chips with deterministic colours.
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { identityColor, initialsOf } from '@/lib/identity';

const SIZES = { xs: 'h-5 w-5 text-[9px]', sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-sm' } as const;

export function Avatar({
  id,
  name,
  size = 'md',
  className,
  ring,
}: {
  id?: string;
  name?: string;
  size?: keyof typeof SIZES;
  className?: string;
  /** Adds a ring in the page background colour — for stacks. */
  ring?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white',
        SIZES[size],
        ring && 'ring-2 ring-background',
        className,
      )}
      style={{ background: identityColor(id ?? name) }}
      title={name}
      aria-label={name}
    >
      {initialsOf(name)}
    </span>
  );
}

export function AvatarStack({
  people,
  max = 4,
  size = 'sm',
}: {
  people: { id?: string; name?: string }[];
  max?: number;
  size?: keyof typeof SIZES;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="inline-flex items-center -space-x-2">
      {shown.map((p, i) => (
        <Avatar key={p.id ?? `${p.name}-${i}`} id={p.id} name={p.name} size={size} ring />
      ))}
      {extra > 0 && (
        <span className={cn('inline-flex items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground ring-2 ring-background', SIZES[size])}>
          +{extra}
        </span>
      )}
    </span>
  );
}

/** Coloured dot + name. Links when `href` is given. */
export function ProjectChip({ id, name, href, className }: { id?: string; name: string; href?: string; className?: string }) {
  const body = (
    <>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: identityColor(id ?? name) }} />
      <span className="truncate">{name}</span>
    </>
  );
  const cls = cn('inline-flex min-w-0 items-center gap-1.5', className);
  return href ? (
    <Link href={href} className={cn(cls, 'hover:underline')}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}
