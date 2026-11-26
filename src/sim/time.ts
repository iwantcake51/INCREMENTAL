export const J2000 = Date.UTC(2000, 0, 1, 12);
export const DAY_MS = 864e5;
export const DAYS_PER_YEAR = 365.25;

export const dayFromDate = (y: number, m = 1, d = 1) => (Date.UTC(y, m - 1, d, 12) - J2000) / DAY_MS;
export const dayFromISO = (iso: string) => (Date.parse(iso + "T12:00:00Z") - J2000) / DAY_MS;
export const dayNow = () => (Date.now() - J2000) / DAY_MS;
export const yearOf = (day: number) => 2000 + day / DAYS_PER_YEAR;
export const dayOfYear = (year: number) => (year - 2000) * DAYS_PER_YEAR;

export const MIN_DAY = dayFromDate(1944);
export const MAX_DAY = dayFromDate(2600, 12, 31);

export const isoOf = (day: number) => new Date(J2000 + day * DAY_MS).toISOString().slice(0, 10);
export const longDateOf = (day: number) =>
  new Date(J2000 + day * DAY_MS).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const shortDateOf = (day: number) =>
  new Date(J2000 + day * DAY_MS).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Playback speeds in simulated days per real second. */
export const SPEEDS = [
  { label: "1 h/s", value: 1 / 24 },
  { label: "1 d/s", value: 1 },
  { label: "1 mo/s", value: 30.44 },
  { label: "1 yr/s", value: 365.25 },
  { label: "10 yr/s", value: 3652.5 },
] as const;
