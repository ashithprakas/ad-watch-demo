import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { BrandRow } from './ads-logic';

const W = 640;
const LABEL_W = 132;
const RIGHT_PAD = 52;
const ROW_H = 26;
const BAR_H = 14;
const GAP = 2;
const FORMAT_LABELS = ['Text', 'Image', 'Video'];

interface Seg {
  format: number;
  x: number;
  w: number;
  count: number;
  path: string;
}
interface Bar {
  brand: number;
  name: string;
  y: number;
  total: number;
  totalX: number;
  segs: Seg[];
  dim: boolean;
  label: string;
}

/** Path for a bar segment whose right end is rounded (radius r) and left end square. */
function roundedRight(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w, h / 2);
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
}

@Component({
  selector: 'app-brand-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart">
      <div class="legend" aria-hidden="true">
        @for (f of formats(); track f) {
          <span><i class="swatch s{{ $index }}"></i>{{ labels[$index] }}</span>
        }
      </div>
      <div class="plot">
      <svg [attr.viewBox]="'0 0 ' + width + ' ' + height()" role="group" [attr.aria-label]="'Ads per brand by format'">
        <line class="rule" [attr.x1]="labelW" [attr.x2]="labelW" y1="0" [attr.y2]="height()" />
        @for (b of bars(); track b.brand) {
          <g
            class="row"
            tabindex="0"
            role="button"
            [attr.aria-pressed]="!b.dim && selectedCount() > 0"
            [attr.aria-label]="b.label"
            (click)="brandClick.emit(b.brand)"
            (keydown.enter)="brandClick.emit(b.brand)"
            (keydown.space)="$event.preventDefault(); brandClick.emit(b.brand)"
          >
            <rect class="focusbox" x="0" [attr.y]="b.y" [attr.width]="width" [attr.height]="rowH" />
            <g [class.dim]="b.dim">
              <text class="strong" [attr.x]="labelW - 8" [attr.y]="b.y + rowH / 2 + 4" text-anchor="end">{{ b.name }}</text>
              @for (s of b.segs; track s.format) {
                @if ($last) {
                  <path [attr.class]="'seg-' + s.format" [attr.d]="s.path" />
                } @else {
                  <rect
                    [attr.class]="'seg-' + s.format"
                    [attr.x]="s.x"
                    [attr.y]="b.y + (rowH - barH) / 2"
                    [attr.width]="s.w"
                    [attr.height]="barH"
                  />
                }
              }
              <text [attr.x]="b.totalX + 6" [attr.y]="b.y + rowH / 2 + 4">{{ b.total.toLocaleString('en-US') }}</text>
            </g>
            @for (s of b.segs; track s.format) {
              <rect
                fill="transparent"
                [attr.x]="s.x"
                [attr.y]="b.y"
                [attr.width]="s.w + (s.w < 8 ? 8 : 0)"
                [attr.height]="rowH"
                (pointermove)="show($event, b, s)"
                (pointerleave)="tip.set(null)"
              />
            }
          </g>
        }
      </svg>
      </div>
      @if (tip(); as t) {
        <div class="tip" [style.left.px]="t.x" [style.top.px]="t.y">{{ t.text }}</div>
      }
      @if (!bars().length) {
        <p class="empty">No ads match these filters.</p>
      }
      <details class="data">
        <summary>Chart data as table</summary>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Brand</th>
                @for (l of labels; track l) {
                  <th class="num">{{ l }}</th>
                }
                <th class="num">Total</th>
              </tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.brand) {
                <tr>
                  <td>{{ names()[r.brand] }}</td>
                  @for (c of r.byFormat; track $index) {
                    <td class="num">{{ c.toLocaleString('en-US') }}</td>
                  }
                  <td class="num">{{ r.total.toLocaleString('en-US') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </details>
    </div>
  `,
})
export class BrandBars {
  readonly rows = input.required<BrandRow[]>();
  readonly names = input.required<string[]>();
  readonly formats = input.required<string[]>();
  readonly selected = input.required<ReadonlySet<number>>();
  readonly brandClick = output<number>();

  protected readonly width = W;
  protected readonly labelW = LABEL_W;
  protected readonly rowH = ROW_H;
  protected readonly barH = BAR_H;
  protected readonly labels = FORMAT_LABELS;
  protected readonly tip = signal<{ x: number; y: number; text: string } | null>(null);
  protected readonly selectedCount = computed(() => this.selected().size);
  protected readonly height = computed(() => Math.max(this.rows().length, 1) * ROW_H);

  protected readonly bars = computed<Bar[]>(() => {
    const rows = this.rows();
    const max = rows.length ? rows[0].total : 1;
    const scale = (W - LABEL_W - RIGHT_PAD) / max;
    const sel = this.selected();
    return rows.map((r, i) => {
      const y = i * ROW_H;
      const by = y + (ROW_H - BAR_H) / 2;
      let x = LABEL_W;
      const present = r.byFormat.map((count, format) => ({ count, format })).filter((s) => s.count > 0);
      const segs = present.map((s, k) => {
        const last = k === present.length - 1;
        const full = s.count * scale;
        const w = Math.max(last ? full : full - GAP, 1);
        const seg: Seg = { format: s.format, x, w, count: s.count, path: last ? roundedRight(x, by, w, BAR_H, 4) : '' };
        x += full;
        return seg;
      });
      const name = this.names()[r.brand];
      const detail = r.byFormat.map((c, f) => `${FORMAT_LABELS[f].toLowerCase()} ${c}`).join(', ');
      return {
        brand: r.brand,
        name,
        y,
        total: r.total,
        totalX: x,
        segs,
        dim: sel.size > 0 && !sel.has(r.brand),
        label: `${name}: ${r.total} ads (${detail}). Press to filter to this brand.`,
      };
    });
  });

  protected show(ev: PointerEvent, b: Bar, s: Seg): void {
    const box = (ev.currentTarget as SVGElement).closest('.chart')!.getBoundingClientRect();
    const share = Math.round((s.count / b.total) * 100);
    this.tip.set({
      x: ev.clientX - box.left,
      y: ev.clientY - box.top,
      text: `${b.name} · ${FORMAT_LABELS[s.format]}: ${s.count.toLocaleString('en-US')} (${share}%)`,
    });
  }
}
