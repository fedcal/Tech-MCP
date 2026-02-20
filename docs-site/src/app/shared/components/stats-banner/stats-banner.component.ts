import { Component } from '@angular/core';

@Component({
  selector: 'app-stats-banner',
  standalone: true,
  template: `
    <div class="stats-banner">
      @for (stat of stats; track stat.label) {
        <div class="stat">
          <span class="stat-value">{{ stat.value }}</span>
          <span class="stat-label">{{ stat.label }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .stats-banner {
      display: flex;
      justify-content: center;
      gap: 3rem;
      padding: 2rem;
      flex-wrap: wrap;
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      display: block;
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--primary-color, #3f51b5);
    }
    .stat-label {
      font-size: 0.9rem;
      color: var(--text-secondary, #6a737d);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  `],
})
export class StatsBannerComponent {
  readonly stats = [
    { value: '30', label: 'Server' },
    { value: '127', label: 'Tools' },
    { value: '42', label: 'Eventi' },
    { value: '6', label: 'Pacchetti' },
  ];
}
