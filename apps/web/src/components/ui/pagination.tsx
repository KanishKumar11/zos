'use client';

import { Button } from './button';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
  className?: string;
}

export function Pagination({ page, totalPages, total, onPage, className }: PaginationProps) {
  return (
    <div className={`flex items-center justify-between text-sm text-muted-foreground ${className ?? ''}`}>
      <span>{total} total</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ←
        </Button>
        <span className="tabular-nums">
          {page} / {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          →
        </Button>
      </div>
    </div>
  );
}
