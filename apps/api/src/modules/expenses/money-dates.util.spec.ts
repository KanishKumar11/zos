import { dateToYmd, dayToDate, nextPeriodYmd } from './money-dates.util';

describe('nextPeriodYmd', () => {
  it('moves a monthly expense one month on, keeping the day', () => {
    expect(nextPeriodYmd('2026-10-05', 'MONTHLY')).toBe('2026-11-05');
  });
  it('rolls December into January of the next year', () => {
    expect(nextPeriodYmd('2026-12-15', 'MONTHLY')).toBe('2027-01-15');
  });
  it('clamps to the end of a shorter month', () => {
    expect(nextPeriodYmd('2027-01-31', 'MONTHLY')).toBe('2027-02-28');
    expect(nextPeriodYmd('2028-01-31', 'MONTHLY')).toBe('2028-02-29');
    expect(nextPeriodYmd('2026-03-31', 'MONTHLY')).toBe('2026-04-30');
  });
  it('moves a yearly expense one year on, clamping 29 Feb', () => {
    expect(nextPeriodYmd('2026-04-01', 'YEARLY')).toBe('2027-04-01');
    expect(nextPeriodYmd('2028-02-29', 'YEARLY')).toBe('2029-02-28');
  });
  it('round-trips stored dates to the same calendar day', () => {
    expect(dateToYmd(dayToDate('2026-10-02'))).toBe('2026-10-02');
    expect(dateToYmd(new Date('2026-10-02'))).toBe('2026-10-02');
  });
});
