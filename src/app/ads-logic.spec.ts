import {
  AdsFile,
  NO_FILTERS,
  applyFilters,
  countByBrand,
  daysRunning,
  stressAds,
  summarySentence,
  toAds,
  weeklyStarts,
} from './ads-logic';

const file: AdsFile = {
  fetched: '2026-10-27',
  region: 'US',
  windowDays: 30,
  windowStart: '2026-09-28',
  formats: ['TEXT', 'IMAGE', 'VIDEO'],
  brands: [
    { name: 'Alpha', domain: 'alpha.com' },
    { name: 'Beta', domain: 'beta.com' },
  ],
  advertisers: ['AR1', 'AR2'],
  ads: [
    [0, 0, '2026-10-27', '2026-10-27', 0, 'CR1'], // new, 1 day
    [0, 1, '2026-09-28', '2026-10-27', 0, 'CR2'], // new (window start), 30 days
    [0, 2, '2026-09-27', '2026-10-27', 0, 'CR3'], // not new
    [1, 0, '2025-10-01', '2026-10-27', 1, 'CR4'], // old
    [1, 0, '2026-10-20', '2026-10-27', 1, 'CR5'], // new, 8 days
  ],
};
const ads = toAds(file);

describe('daysRunning', () => {
  it('counts first and last day', () => {
    expect(daysRunning('2026-10-27', '2026-10-27')).toBe(1);
    expect(daysRunning('2026-10-20', '2026-10-27')).toBe(8);
  });
  it('is not thrown off by a month or year boundary', () => {
    expect(daysRunning('2026-09-28', '2026-10-27')).toBe(30);
    expect(daysRunning('2025-12-31', '2026-01-02')).toBe(3);
  });
});

describe('toAds', () => {
  it('builds the Transparency Center link and flags new ads from the window start', () => {
    expect(ads[0].url).toBe('https://adstransparency.google.com/advertiser/AR1/creative/CR1?region=US');
    expect(ads.map((a) => a.isNew)).toEqual([true, true, false, false, true]);
  });
});

describe('applyFilters', () => {
  it('returns everything with no filters', () => {
    expect(applyFilters(ads, NO_FILTERS, file)).toHaveLength(5);
  });
  it('filters by brand and format together', () => {
    const f = { ...NO_FILTERS, brands: new Set([1]), formats: new Set([0]) };
    expect(applyFilters(ads, f, file).map((a) => a.id)).toEqual(['CR4', 'CR5']);
  });
  it('new-only keeps ads first shown on or after the window start', () => {
    expect(applyFilters(ads, { ...NO_FILTERS, newOnly: true }, file).map((a) => a.id)).toEqual(['CR1', 'CR2', 'CR5']);
  });
  it('sinceDays counts back from the snapshot date, inclusive', () => {
    const f = { ...NO_FILTERS, sinceDays: 8 };
    expect(applyFilters(ads, f, file).map((a) => a.id)).toEqual(['CR1', 'CR5']);
  });
  it('search matches brand name or creative id, ignoring case', () => {
    expect(applyFilters(ads, { ...NO_FILTERS, search: ' beta ' }, file)).toHaveLength(2);
    expect(applyFilters(ads, { ...NO_FILTERS, search: 'cr3' }, file)).toHaveLength(1);
  });
});

describe('countByBrand', () => {
  it('counts per format and sorts by total', () => {
    const rows = countByBrand(ads, file);
    expect(rows.map((r) => [r.brand, r.total])).toEqual([[0, 3], [1, 2]]);
    expect(rows[0].byFormat).toEqual([1, 1, 1]);
  });
  it('omits brands with no matching ads', () => {
    expect(countByBrand(applyFilters(ads, { ...NO_FILTERS, brands: new Set([1]) }, file), file)).toHaveLength(1);
  });
});

describe('weeklyStarts', () => {
  it('buckets 7 days ending on the snapshot date, oldest first', () => {
    const w = weeklyStarts(ads, file.fetched, 4);
    expect(w).toHaveLength(4);
    expect(w[3].end).toBe('2026-10-27');
    // CR1 (0 days old) and CR5 (7 days old -> previous bucket)
    expect(w[3].count).toBe(1);
    expect(w[2].count).toBe(1);
    // CR2 is 29 days old -> bucket 4 back, outside a 4-week view; CR3 and CR4 too
    expect(w.reduce((s, b) => s + b.count, 0)).toBe(2);
  });
  it('drops ads older than the view', () => {
    expect(weeklyStarts(ads, file.fetched, 26).reduce((s, b) => s + b.count, 0)).toBe(4);
  });
});

describe('summarySentence', () => {
  it('describes the full set', () => {
    expect(summarySentence(ads, ads.length, file)).toBe('5 ads from 2 brands; 3 started in the last 30 days.');
  });
  it('shows the filtered share and singular brand', () => {
    const one = applyFilters(ads, { ...NO_FILTERS, brands: new Set([1]) }, file);
    expect(summarySentence(one, ads.length, file)).toBe('2 of 5 ads from 1 brand; 1 started in the last 30 days.');
  });
  it('has a clear empty state', () => {
    expect(summarySentence([], 5, file)).toBe('No ads match these filters.');
  });
});

describe('stressAds', () => {
  it('keeps real ads first and labels the extra rows as synthetic', () => {
    const out = stressAds(ads, 12);
    expect(out).toHaveLength(12);
    expect(out.slice(0, 5)).toEqual(ads);
    expect(out[5].id).toBe('CR1-synthetic-1');
    expect(new Set(out.map((a) => a.id)).size).toBe(12);
  });
  it('does nothing when the target is not larger', () => {
    expect(stressAds(ads, 3)).toBe(ads);
  });
});
