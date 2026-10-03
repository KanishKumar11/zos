// "Paid" stamp — a rotated, double-bordered rubber stamp in the success colour, shown on an invoice
// once it is settled in full. Decorative; the status badge carries the same meaning for screen readers.
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/formatters';

export function PaidStamp({ date, className }: { date?: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none inline-flex -rotate-[9deg] select-none flex-col items-center rounded-xl border-[3px] border-success px-4 pb-1.5 pt-1 text-success',
        'outline outline-1 outline-offset-[3px] outline-success/50',
        className,
      )}
    >
      <span className="font-display text-[2rem] font-extrabold leading-none tracking-wide">Paid</span>
      <span className="mt-0.5 text-[10px] font-semibold tracking-wide">{date ? `in full · ${formatDate(date)}` : 'in full'}</span>
    </div>
  );
}
