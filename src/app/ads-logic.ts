// Pure data logic for Ad Watch: no Angular, no DOM, so it is unit-tested on its own.

export interface AdsFile {
  fetched: string;
  region: string;
  windowDays: number;
  windowStart: string;
  formats: string[];
  brands: { name: string; domain: string }[];
  advertisers: string[];
  /** [brandIndex, formatIndex, firstShown, lastShown, advertiserIndex, creativeId] */
  ads: [number, number, string, string, number, string][];
}

export interface Ad {
  id: string;
  brand: number;
  format: number;
  first: string;
  last: string;
  days: number;
  isNew: boolean;
  url: string;
}

export interface Filters {
  brands: ReadonlySet<number>;
  formats: ReadonlySet<number>;
  newOnly: boolean;
  /** Only ads first shown within this many days of the snapshot; null = all time. */
  sinceDays: number | null;
  search: string;
}

export interface WeekBucket {
  /** Last day of the 7-day bucket (ISO date). */
  end: string;
  count: number;
}

const DAY_MS = 86_400_000;

const toDay = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;
const fromDay = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);

/** Days an ad has run, counting both the first and the last day. */
export function daysRunning(first: string, last: string): number {
  return toDay(last) - toDay(first) + 1;
}

export function toAds(file: AdsFile): Ad[] {
  return file.ads.map(([brand, format, first, last, adv, id]) => ({
    id,
    brand,
    format,
    first,
    last,
    days: daysRunning(first, last),
    isNew: first >= file.windowStart,
    url: `https://adstransparency.google.com/advertiser/${file.advertisers[adv]}/creative/${id}?region=${file.region}`,
  }));
}

export const NO_FILTERS: Filters = {
  brands: new Set(),
  formats: new Set(),
  newOnly: false,
  sinceDays: null,
  search: '',
};

export function applyFilters(ads: Ad[], f: Filters, file: AdsFile): Ad[] {
  const q = f.search.trim().toLowerCase();
  const earliest = f.sinceDays === null ? null : fromDay(toDay(file.fetched) - (f.sinceDays - 1));
  return ads.filter((a) => {
    if (f.brands.size && !f.brands.has(a.brand)) return false;
    if (f.formats.size && !f.formats.has(a.format)) return false;
    if (f.newOnly && !a.isNew) return false;
    if (earliest !== null && a.first < earliest) return false;
    if (q && !file.brands[a.brand].name.toLowerCase().includes(q) && !a.id.toLowerCase().includes(q)) return false;
    return true;
  });
}

export interface BrandRow {
  brand: number;
  total: number;
  /** Ads per format, indexed like `file.formats`. */
  byFormat: number[];
}

/** One row per brand with at least one ad, sorted by total (largest first, then name). */
export function countByBrand(ads: Ad[], file: AdsFile): BrandRow[] {
  const rows = new Map<number, BrandRow>();
  for (const a of ads) {
    let r = rows.get(a.brand);
    if (!r) {
      r = { brand: a.brand, total: 0, byFormat: file.formats.map(() => 0) };
      rows.set(a.brand, r);
    }
    r.total++;
    r.byFormat[a.format]++;
  }
  return [...rows.values()].sort(
    (x, y) => y.total - x.total || file.brands[x.brand].name.localeCompare(file.brands[y.brand].name),
  );
}

/** New ads per 7-day bucket, oldest first; the last bucket ends on the snapshot date. */
export function weeklyStarts(ads: Ad[], fetched: string, weeks = 26): WeekBucket[] {
  const end = toDay(fetched);
  const counts = new Array<number>(weeks).fill(0);
  for (const a of ads) {
    const age = Math.floor((end - toDay(a.first)) / 7);
    if (age >= 0 && age < weeks) counts[weeks - 1 - age]++;
  }
  return counts.map((count, i) => ({ end: fromDay(end - (weeks - 1 - i) * 7), count }));
}

export function summarySentence(shown: Ad[], total: number, file: AdsFile): string {
  const brands = new Set(shown.map((a) => a.brand)).size;
  const fresh = shown.filter((a) => a.isNew).length;
  const n = (x: number) => x.toLocaleString('en-US');
  if (!shown.length) return 'No ads match these filters.';
  const scope = shown.length === total ? '' : ` of ${n(total)}`;
  return `${n(shown.length)}${scope} ads from ${brands} ${brands === 1 ? 'brand' : 'brands'}; ${n(fresh)} started in the last ${file.windowDays} days.`;
}

/** Synthetic rows for the labelled stress toggle: cycles the real ads with new ids and shifted dates. */
export function stressAds(ads: Ad[], target: number): Ad[] {
  if (!ads.length || target <= ads.length) return ads;
  const out = ads.slice();
  for (let i = 0; out.length < target; i++) {
    const src = ads[i % ads.length];
    const copy = Math.floor(i / ads.length) + 1;
    out.push({ ...src, id: `${src.id}-synthetic-${copy}` });
  }
  return out;
}
