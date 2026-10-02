import Link from 'next/link';

export function Brand({ href = '/dashboard' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-bold tracking-tight text-primary-foreground">
        Z
      </span>
      <span className="text-[13px] font-semibold tracking-tight">ZOS</span>
    </Link>
  );
}
