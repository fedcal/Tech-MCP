import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LocaleService } from '../../core/services/locale.service';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="not-found">
      <mat-icon class="not-found-icon">search_off</mat-icon>
      <h1>404</h1>
      <p>{{ localeService.currentLocale() === 'it' ? 'Pagina non trovata' : 'Page not found' }}</p>
      <a mat-raised-button color="primary" [routerLink]="['/', localeService.currentLocale()]">
        <mat-icon>home</mat-icon>
        {{ localeService.currentLocale() === 'it' ? 'Torna alla Home' : 'Back to Home' }}
      </a>
    </div>
  `,
  styles: [`
    .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      text-align: center;
    }
    .not-found-icon {
      font-size: 4rem;
      width: 64px;
      height: 64px;
      color: var(--text-secondary, #6a737d);
    }
    h1 {
      font-size: 4rem;
      font-weight: 800;
      margin: 0.5rem 0;
      color: var(--primary-color, #3f51b5);
    }
    p {
      font-size: 1.25rem;
      color: var(--text-secondary, #6a737d);
      margin-bottom: 2rem;
    }
  `],
})
export class NotFoundComponent {
  readonly localeService = inject(LocaleService);
}
