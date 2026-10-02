'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/cn';

import { Button } from './button';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
  /** Rows per page, for the "Showing 21–40 of 134" label. */
  pageSize?: number;
  className?: string;
}

export function Pagination({ page, totalPages, total, onPage, pageSize, className }: PaginationProps) {
  if (total === 0) return null;
  const from = pageSize ? (page - 1) * pageSize + 1 : undefined;
  const to = pageSize ? Math.min(page * pageSize, total) : undefined;
  return (
    <div className={cn('flex items-center justify-between gap-3 text-sm text-muted-foreground', className)}>
      <span className="tabular-nums">
        {from !== undefined ? `Showing ${from}–${to} of ${total}` : `${total} total`}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 tabular-nums">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Next page" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
