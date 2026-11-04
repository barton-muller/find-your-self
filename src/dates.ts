const DAY = 86400000;

export const parseDate = (s: string): number => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
};

export const addDays = (s: string, n: number): string =>
  new Date((parseDate(s) + n) * DAY).toISOString().slice(0, 10);

export const diffDays = (a: string, b: string): number => parseDate(b) - parseDate(a);

const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtShort = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtMonth = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });

export const todayStr = () => new Date().toLocaleDateString('en-CA');

export const fmtDate = (s: string) => fmt.format(new Date(parseDate(s) * DAY));
export const fmtShortDate = (s: string) => fmtShort.format(new Date(parseDate(s) * DAY));
export const fmtMonthName = (s: string) => fmtMonth.format(new Date(parseDate(s) * DAY));
