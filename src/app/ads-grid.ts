import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  CellStyleModule,
  ClientSideRowModelModule,
  ColDef,
  CsvExportModule,
  DateFilterModule,
  GridApi,
  ModuleRegistry,
  NumberFilterModule,
  RowApiModule,
  TextFilterModule,
  createGrid,
  themeQuartz,
} from 'ag-grid-community';
import { Ad } from './ads-logic';

// Only the grid features this table uses, to keep the bundle small.
ModuleRegistry.registerModules([
  CellStyleModule,
  ClientSideRowModelModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  CsvExportModule,
  RowApiModule,
]);

const FORMAT_LABELS = ['Text', 'Image', 'Video'];

interface Row {
  id: string;
  brand: string;
  format: string;
  first: string;
  last: string;
  days: number;
  url: string;
}

const theme = themeQuartz.withParams({
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  fontSize: 14,
  backgroundColor: 'var(--surface)',
  foregroundColor: 'var(--ink)',
  headerBackgroundColor: 'var(--surface)',
  headerTextColor: 'var(--ink-2)',
  headerFontWeight: 600,
  borderColor: 'var(--rule)',
  rowHoverColor: 'var(--hover)',
  accentColor: 'var(--series-1)',
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  spacing: 6,
});

@Component({
  selector: 'app-ads-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gridbox" #host role="region" aria-label="Ads table"></div>
    <p class="gridnote">{{ timing() }}</p>
  `,
})
export class AdsGrid implements AfterViewInit, OnDestroy {
  readonly ads = input.required<Ad[]>();
  readonly names = input.required<string[]>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private api?: GridApi<Row>;
  protected readonly timing = signal('');

  constructor() {
    effect(() => {
      const ads = this.ads();
      const names = this.names();
      if (!this.api) return;
      this.setRows(ads, names);
    });
  }

  ngAfterViewInit(): void {
    const cols: ColDef<Row>[] = [
      { field: 'brand', headerName: 'Brand', filter: 'agTextColumnFilter', flex: 1.2, minWidth: 130 },
      {
        field: 'format',
        headerName: 'Format',
        filter: 'agTextColumnFilter',
        width: 120,
        cellRenderer: (p: { value: string }) => {
          const el = document.createElement('span');
          const i = FORMAT_LABELS.indexOf(p.value);
          el.innerHTML = `<i class="swatch s${i}" style="margin-right:8px"></i>`;
          el.append(p.value);
          return el;
        },
      },
      { field: 'first', headerName: 'First shown', filter: 'agDateColumnFilter', sort: 'desc', width: 140 },
      { field: 'last', headerName: 'Last shown', filter: 'agDateColumnFilter', width: 140 },
      { field: 'days', headerName: 'Days running', filter: 'agNumberColumnFilter', type: 'rightAligned', width: 150 },
      {
        field: 'url',
        headerName: 'Link',
        sortable: false,
        filter: false,
        width: 130,
        cellRenderer: (p: { value: string; data?: Row }) => {
          const a = document.createElement('a');
          a.href = p.value;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = 'Open ↗';
          a.setAttribute('aria-label', `Open ad ${p.data?.id ?? ''} in Google Ads Transparency Center`);
          a.style.color = 'var(--series-1)';
          return a;
        },
      },
    ];
    this.api = createGrid<Row>(this.host().nativeElement, {
      theme,
      columnDefs: cols,
      defaultColDef: { sortable: true, resizable: true },
      rowData: [],
      getRowId: (p) => p.data.id,
      suppressCellFocus: false,
      animateRows: false,
    });
    this.setRows(this.ads(), this.names());
  }

  ngOnDestroy(): void {
    this.api?.destroy();
  }

  /** Export the rows currently shown (including grid-level column filters). */
  exportCsv(): void {
    this.api?.exportDataAsCsv({ fileName: 'ad-watch-ads.csv' });
  }

  private setRows(ads: Ad[], names: string[]): void {
    const rows: Row[] = ads.map((a) => ({
      id: a.id,
      brand: names[a.brand],
      format: FORMAT_LABELS[a.format],
      first: a.first,
      last: a.last,
      days: a.days,
      url: a.url,
    }));
    const t0 = performance.now();
    this.api!.setGridOption('rowData', rows);
    const ms = Math.max(1, Math.round(performance.now() - t0));
    this.timing.set(
      `${rows.length.toLocaleString('en-US')} rows loaded into the grid in ${ms} ms in this browser. Scrolling is virtual: only the rows you can see exist in the page.`,
    );
  }
}
