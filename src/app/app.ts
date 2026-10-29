import { ChangeDetectionStrategy, Component, computed, effect, signal, viewChild } from '@angular/core';
import { AdsGrid } from './ads-grid';
import {
  Ad,
  AdsFile,
  Filters,
  NO_FILTERS,
  applyFilters,
  countByBrand,
  stressAds,
  summarySentence,
  toAds,
  weeklyStarts,
} from './ads-logic';
import { BrandBars } from './brand-bars';
import { WeeklyLine } from './weekly-line';

const STRESS_ROWS = 10_000;
const FORMAT_LABELS = ['Text', 'Image', 'Video'];

type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('ad-watch-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage can be blocked; fall through to the OS setting */
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdsGrid, BrandBars, WeeklyLine],
  templateUrl: './app.html',
})
export class App {
  protected readonly labels = FORMAT_LABELS;
  protected readonly stressRows = STRESS_ROWS;

  protected readonly file = signal<AdsFile | null>(null);
  protected readonly error = signal('');
  protected readonly filters = signal<Filters>(NO_FILTERS);
  protected readonly stress = signal(false);
  protected readonly theme = signal<Theme>(initialTheme());

  private readonly grid = viewChild(AdsGrid);

  private readonly realAds = computed<Ad[]>(() => {
    const f = this.file();
    return f ? toAds(f) : [];
  });
  protected readonly baseAds = computed(() => (this.stress() ? stressAds(this.realAds(), STRESS_ROWS) : this.realAds()));
  protected readonly shown = computed(() => {
    const f = this.file();
    return f ? applyFilters(this.baseAds(), this.filters(), f) : [];
  });
  protected readonly names = computed(() => this.file()?.brands.map((b) => b.name) ?? []);
  protected readonly emptySet: ReadonlySet<number> = new Set();
  protected readonly brandOrder = computed(() =>
    this.names()
      .map((n, i) => ({ n, i }))
      .sort((a, b) => a.n.localeCompare(b.n)),
  );
  /** Bar chart rows ignore the brand filter, so every brand stays visible and the selected ones are highlighted. */
  protected readonly rows = computed(() => {
    const f = this.file();
    return f ? countByBrand(applyFilters(this.baseAds(), { ...this.filters(), brands: this.emptySet }, f), f) : [];
  });
  protected readonly weeks = computed(() => {
    const f = this.file();
    return f ? weeklyStarts(this.shown(), f.fetched) : [];
  });
  protected readonly summary = computed(() => {
    const f = this.file();
    return f ? summarySentence(this.shown(), this.baseAds().length, f) : 'Loading ads…';
  });
  protected readonly isFiltered = computed(() => {
    const f = this.filters();
    return f.brands.size > 0 || f.formats.size > 0 || f.newOnly || f.sinceDays !== null || f.search.trim() !== '';
  });
  protected readonly brandLabel = computed(() => {
    const n = this.filters().brands.size;
    if (n === 0) return 'All brands';
    if (n === 1) return this.names()[[...this.filters().brands][0]];
    return `${n} brands`;
  });

  constructor() {
    effect(() => {
      const t = this.theme();
      document.documentElement.dataset['theme'] = t;
      try {
        localStorage.setItem('ad-watch-theme', t);
      } catch {
        /* optional convenience only */
      }
    });
    fetch('data/ads.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<AdsFile>;
      })
      .then((f) => this.file.set(f))
      .catch((e) => this.error.set(`Could not load the data (${e.message}). Reload the page to try again.`));
  }

  protected toggleTheme(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  protected patch(p: Partial<Filters>): void {
    this.filters.update((f) => ({ ...f, ...p }));
  }

  protected toggleFormat(i: number): void {
    const next = new Set(this.filters().formats);
    next.has(i) ? next.delete(i) : next.add(i);
    this.patch({ formats: next });
  }

  protected toggleBrand(i: number): void {
    const next = new Set(this.filters().brands);
    next.has(i) ? next.delete(i) : next.add(i);
    this.patch({ brands: next });
  }

  /** Clicking a bar focuses that brand; clicking it again clears the brand filter. */
  protected focusBrand(i: number): void {
    const cur = this.filters().brands;
    this.patch({ brands: cur.size === 1 && cur.has(i) ? new Set() : new Set([i]) });
  }

  protected setSince(v: string): void {
    this.patch({ sinceDays: v === 'all' ? null : Number(v) });
  }

  protected clear(): void {
    this.filters.set(NO_FILTERS);
  }

  protected exportCsv(): void {
    this.grid()?.exportCsv();
  }
}
