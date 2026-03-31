import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="home-wrap">
      <div class="kpi-grid">
        <article>
          <p class="label">Order Volume</p>
          <p class="value">{{ kpis?.orderVolume ?? 0 }}</p>
        </article>
        <article>
          <p class="label">Acceptance Rate</p>
          <p class="value">{{ kpis?.acceptanceRate ?? 0 }}</p>
        </article>
        <article>
          <p class="label">Fulfillment Time (min)</p>
          <p class="value">{{ kpis?.fulfillmentTimeMinutes ?? 0 }}</p>
        </article>
        <article>
          <p class="label">Cancellation Rate</p>
          <p class="value">{{ kpis?.cancellationRate ?? 0 }}</p>
        </article>
      </div>
    </section>
  `,
  styles: [`
    .home-wrap { display: grid; gap: .8rem; }
    .kpi-grid { display: grid; gap: .7rem; grid-template-columns: repeat(4, 1fr); }
    article { border: 1px solid #d6e2d8; padding: .9rem; background: #f7fbf8; }
    .label { margin: 0; color: #5f7469; font-size: .82rem; }
    .value { margin: .3rem 0 0; font-size: 1.25rem; color: #0f6a4b; }
    @media (max-width: 980px) { .kpi-grid { grid-template-columns: 1fr; } }
  `],
})
export class HomePageComponent {
  @Input() kpis: any = {};
}
