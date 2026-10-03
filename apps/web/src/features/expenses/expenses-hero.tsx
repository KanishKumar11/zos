// Expenses hero — one sentence about this month's spending, written from live data.
'use client';

import type { ReactNode } from 'react';

import { todayLocal } from '@/lib/form';

import { Button } from '@/components/ui/button';
import { Hero, HeroFigure, HeroMark, Price } from '@/components/viz';

import { categoryPhrase } from './expense-meta';
import { useExpenseSummary } from './expenses.hooks';
import { monthEndYmd, monthName, monthStartYmd } from './money-time';

export function ExpensesHero({ aside }: { aside?: ReactNode }) {
  const today = todayLocal();
  const thisMonth = useExpenseSummary({ from: monthStartYmd(0), to: today });
  const lastMonth = useExpenseSummary({ from: monthStartYmd(-1), to: monthEndYmd(-1) });
  const allTime = useExpenseSummary({});

  const month = monthName(0);
  const prevMonth = monthName(-1);
  const loading = thisMonth.isLoading || allTime.isLoading;
  const failed = (thisMonth.error && !thisMonth.data) || (allTime.error && !allTime.data);

  let sentence: ReactNode = 'Expenses';
  let lede: ReactNode = null;

  if (failed) {
    lede = (
      <>
        Couldn&apos;t load this month&apos;s figures.{' '}
        <Button
          variant="link"
          className="h-auto p-0 text-[15px]"
          onClick={() => {
            void thisMonth.refetch();
            void allTime.refetch();
            void lastMonth.refetch();
          }}
        >
          Try again
        </Button>
      </>
    );
  } else if (thisMonth.data && allTime.data) {
    const now = thisMonth.data;
    const last = lastMonth.data;
    const lastLine =
      last && last.grossPaise > 0 ? (
        <>
          {prevMonth} came to <Price paise={last.grossPaise} compact className="font-sans" /> in total.
        </>
      ) : last ? (
        <>Nothing was logged in {prevMonth}.</>
      ) : null;

    if (allTime.data.count === 0) {
      sentence = 'No expenses logged yet.';
      lede = 'Log tools, hosting, marketing and other running costs, and this page will show where the money goes.';
    } else if (now.count === 0 || now.grossPaise <= 0) {
      sentence = `Nothing spent yet in ${month}.`;
      lede = lastLine;
    } else {
      const top = now.byCategory[0];
      const recovered = now.grossPaise - now.netPaise;
      sentence =
        !top || now.byCategory.length === 1 ? (
          <>
            You&apos;ve spent{' '}
            <HeroFigure>
              <Price paise={now.grossPaise} compact className="font-display" />
            </HeroFigure>{' '}
            this month{top ? `, all of it on ${categoryPhrase(top._id)}` : ''}.
          </>
        ) : (
          <>
            You&apos;ve spent{' '}
            <HeroFigure>
              <Price paise={now.grossPaise} compact className="font-display" />
            </HeroFigure>{' '}
            this month —{' '}
            <HeroMark>
              <Price paise={top.totalPaise} compact className="font-display" />
            </HeroMark>{' '}
            of it on {categoryPhrase(top._id)}.
          </>
        );
      lede = (
        <>
          {now.count} {now.count === 1 ? 'entry' : 'entries'} so far
          {recovered > 0 && (
            <>
              , and the team covered <Price paise={recovered} compact className="font-sans" /> of it
            </>
          )}
          . {lastLine}
        </>
      );
    }
  }

  return (
    <Hero
      pageTitle="Expenses"
      eyebrow={`Money out · ${monthName(0, true)}`}
      aside={aside}
      loading={loading}
      lede={lede}
    >
      {sentence}
    </Hero>
  );
}
