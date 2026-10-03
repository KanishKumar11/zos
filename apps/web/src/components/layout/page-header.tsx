// PageHeader — title, description and actions for every page. Also publishes the title and
// breadcrumbs to the top bar and the browser tab, so detail pages never show raw ids.
'use client';

import { useEffect, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { usePageMetaStore, type Crumb } from '@/store/page-meta.store';

export type { Crumb };

/** Publishes the page title + breadcrumbs to the top bar and browser tab. Use it on pages that
 *  open with a `Hero` instead of a `PageHeader`. */
export function usePageTitle(title: string, crumbs: Crumb[] = []) {
  const setMeta = usePageMetaStore((s) => s.set);
  const crumbKey = crumbs.map((c) => `${c.label}|${c.href ?? ''}`).join('>');
  useEffect(() => {
    setMeta(title, crumbs);
    document.title = title ? `${title} · ZOS` : 'ZOS';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, crumbKey, setMeta]);
}

export function PageHeader({
  title,
  description,
  action,
  crumbs = [],
  meta,
  eyebrow,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Parent pages, e.g. [{ label: 'Projects', href: '/projects' }]. The current page is added automatically. */
  crumbs?: Crumb[];
  /** Small inline badges next to the title (status etc). */
  meta?: ReactNode;
  /** Small line above the title, e.g. the client name on a project page. */
  eyebrow?: ReactNode;
  className?: string;
}) {
  usePageTitle(title, crumbs);

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4', className)}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow && <p className="text-[13px] text-muted-foreground">{eyebrow}</p>}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-[1.75rem] font-bold leading-[1.1] sm:text-[2.1rem]">{title}</h1>
          {meta}
        </div>
        {description && <p className="max-w-[68ch] text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
