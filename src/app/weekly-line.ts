import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { WeekBucket } from './ads-logic';

const W = 640;
const H = 240;
const PAD = { left: 40, right: 48, top: 14, bottom: 30 };

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const fmt = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));
const startOf = (endIso: string) => fmt(new Date(Date.parse(`${endIso}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10));

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

@Component({
  selector: 'app-weekly-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart">
      <div class="plot">
      <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" role="img" [attr.aria-label]="summary()">
        @for (t of yTicks(); track t.v) {
          <line class="rule" [attr.x1]="pad.left" [attr.x2]="w - pad.right" [attr.y1]="t.y" [attr.y2]="t.y" [attr.opacity]="$first ? 1 : 0.6" />
          <text [attr.x]="pad.left - 8" [attr.y]="t.y + 4" text-anchor="end">{{ t.v }}</text>
        }
        @for (x of xTicks(); track x.label) {
          <text [attr.x]="x.x" [attr.y]="h - 8" [attr.text-anchor]="x.anchor">{{ x.label }}</text>
        }
        <path [attr.d]="path()" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        @if (last(); as l) {
          <circle [attr.cx]="l.x" [attr.cy]="l.y" r="4" fill="var(--ink)" stroke="var(--surface)" stroke-width="2" />
          <text class="strong" [attr.x]="l.x + 10" [attr.y]="l.y + 4">{{ l.count }}</text>
        }
        @if (hover(); as p) {
          <line [attr.x1]="p.x" [attr.x2]="p.x" [attr.y1]="pad.top" [attr.y2]="h - pad.bottom" stroke="var(--ink-2)" stroke-width="1" stroke-dasharray="3 3" />
          <circle [attr.cx]="p.x" [attr.cy]="p.y" r="4" fill="var(--ink)" stroke="var(--surface)" stroke-width="2" />
        }
        <rect
          [attr.x]="pad.left"
          [attr.y]="pad.top"
          [attr.width]="w - pad.left - pad.right"
          [attr.height]="h - pad.top - pad.bottom"
          fill="transparent"
          (pointermove)="move($event)"
          (pointerleave)="hoverIdx.set(null)"
        />
      </svg>
      </div>
      @if (hover(); as p) {
        <div class="tip" [style.left.px]="p.px" [style.top.px]="p.py">{{ p.text }}</div>
      }
      <p class="chartnote">Each point is a 7-day period ending on the date shown. Only ads first shown in the last 26 weeks are counted.</p>
      <details class="data">
        <summary>Chart data as table</summary>
        <div class="scroll">
          <table>
            <thead>
              <tr><th>Week</th><th class="num">New ads</th></tr>
            </thead>
            <tbody>
              @for (b of reversed(); track b.end) {
                <tr><td>{{ rangeLabel(b.end) }}</td><td class="num">{{ b.count.toLocaleString('en-US') }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </details>
    </div>
  `,
})
export class WeeklyLine {
  readonly weeks = input.required<WeekBucket[]>();

  protected readonly w = W;
  protected readonly h = H;
  protected readonly pad = PAD;
  protected readonly hoverIdx = signal<number | null>(null);

  private readonly max = computed(() => niceMax(Math.max(0, ...this.weeks().map((b) => b.count))));
  private readonly pts = computed(() => {
    const ws = this.weeks();
    const m = this.max();
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    return ws.map((b, i) => ({
      x: PAD.left + (ws.length > 1 ? (i / (ws.length - 1)) * iw : iw / 2),
      y: PAD.top + ih - (b.count / m) * ih,
      count: b.count,
      end: b.end,
    }));
  });

  protected readonly path = computed(() => this.pts().map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(''));
  protected readonly last = computed(() => this.pts().at(-1) ?? null);
  protected readonly reversed = computed(() => [...this.weeks()].reverse());
  protected readonly yTicks = computed(() => {
    const m = this.max();
    const ih = H - PAD.top - PAD.bottom;
    return [0, 0.5, 1].map((f) => ({ v: Math.round(m * f), y: PAD.top + ih - f * ih }));
  });
  protected readonly xTicks = computed(() => {
    const p = this.pts();
    if (!p.length) return [];
    const idx = [0, Math.floor((p.length - 1) / 2), p.length - 1];
    const anchors = ['start', 'middle', 'end'];
    return idx.map((i, k) => ({ x: p[i].x, label: fmt(p[i].end), anchor: anchors[k] }));
  });
  protected readonly summary = computed(() => {
    const ws = this.weeks();
    const total = ws.reduce((s, b) => s + b.count, 0);
    return `New ads started per week over the last ${ws.length} weeks: ${total} in total.`;
  });
  protected readonly hover = computed(() => {
    const i = this.hoverIdx();
    const p = i === null ? null : this.pts()[i];
    if (!p) return null;
    return { ...p, px: (p.x / W) * this.boxWidth, py: (p.y / H) * this.boxHeight, text: `${this.rangeLabel(p.end)}: ${p.count.toLocaleString('en-US')} new ads` };
  });

  private boxWidth = W;
  private boxHeight = H;

  protected rangeLabel(end: string): string {
    return `${startOf(end)} – ${fmt(end)}`;
  }

  protected move(ev: PointerEvent): void {
    const svg = (ev.currentTarget as SVGElement).ownerSVGElement!;
    const box = svg.getBoundingClientRect();
    this.boxWidth = box.width;
    this.boxHeight = box.height;
    const x = ((ev.clientX - box.left) / box.width) * W;
    const pts = this.pts();
    if (!pts.length) return;
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].x - x) < Math.abs(pts[best].x - x)) best = i;
    this.hoverIdx.set(best);
  }
}
