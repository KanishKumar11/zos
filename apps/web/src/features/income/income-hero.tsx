// Other-income hero — one sentence about this financial year, written from live data.
'use client';

import type { ReactNode } from 'react';

import { todayLocal } from '@/lib/form';

import { Button } from '@/components/ui/button';
import { Hero, HeroFigure, HeroMark, Price } from '@/components/viz';
import { financialYear } from '@/features/expenses/money-time';

import { incomeCategoryPhrase } from './income-meta';
import { useIncomeSummary } from './income.hooks';

export function IncomeHero({ aside }: { aside?: ReactNode }) {
  const fy = financialYear();
  const thisFy = useIncomeSummary({ from: fy.from, to: todayLocal() });
  const allTime = useIncomeSummary({});

  const loading = thisFy.isLoading || allTime.isLoading;
  const failed = (thisFy.error && !thisFy.data) || (allTime.error && !allTime.data);

  let sentence: ReactNode = 'Other income';
  let lede: ReactNode = "Money in that isn't a client invoice — affiliate payouts, referrals, interest and refunds.";

  if (failed) {
    lede = (
      <>
        Couldn&apos;t load this year&apos;s figures.{' '}
        <Button
          variant="link"
          className="h-auto p-0 text-[15px]"
          onClick={() => {
            void thisFy.refetch();
            void allTime.refetch();
          }}
        >
          Try again
        </Button>
      </>
    );
  } else if (thisFy.data && allTime.data) {
    const year = thisFy.data;
    const earlier = allTime.data.grandTotalPaise - year.grandTotalPaise;
    if (allTime.data.count === 0) {
      sentence = 'No other income recorded yet.';
      lede = 'Affiliate payouts, referral fees, interest and refunds belong here, so your profit figures include them.';
    } else if (year.count === 0 || year.grandTotalPaise <= 0) {
      sentence = `Nothing received yet this financial year.`;
      lede =
        earlier > 0 ? (
          <>
            Earlier years brought in <Price paise={earlier} compact className="font-sans" /> across {allTime.data.count}{' '}
            {allTime.data.count === 1 ? 'entry' : 'entries'}.
          </>
        ) : null;
    } else {
      const top = year.byCategory[0];
      const share = top && year.grandTotalPaise > 0 ? top.totalPaise / year.grandTotalPaise : 0;
      const figure = (
        <HeroFigure>
          <Price paise={year.grandTotalPaise} compact className="font-display" />
        </HeroFigure>
      );
      sentence = !top ? (
        <>{figure} of other income this financial year.</>
      ) : year.byCategory.length === 1 ? (
        <>
          {figure} of other income this financial year, all of it from {incomeCategoryPhrase(top._id)}.
        </>
      ) : share >= 0.5 ? (
        <>
          {figure} of other income this financial year, mostly from <HeroMark>{incomeCategoryPhrase(top._id)}</HeroMark>.
        </>
      ) : (
        <>
          {figure} of other income this financial year, the biggest share from <HeroMark>{incomeCategoryPhrase(top._id)}</HeroMark>.
        </>
      );
      lede = (
        <>
          {year.count} {year.count === 1 ? 'entry' : 'entries'} in {fy.label}
          {top && year.byCategory.length > 1 && (
            <>
              ; {incomeCategoryPhrase(top._id)} brought in <Price paise={top.totalPaise} compact className="font-sans" />
            </>
          )}
          .
        </>
      );
    }
  }

  return (
    <Hero pageTitle="Other income" eyebrow={`Money in · ${fy.label}`} aside={aside} loading={loading} lede={lede}>
      {sentence}
    </Hero>
  );
}
