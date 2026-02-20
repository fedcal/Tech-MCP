import { Component, input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageLink } from '../../../core/models/doc-page.model';
import { LocaleService } from '../../../core/services/locale.service';

@Component({
  selector: 'app-prev-next-nav',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './prev-next-nav.component.html',
  styleUrl: './prev-next-nav.component.scss',
})
export class PrevNextNavComponent {
  readonly prev = input<PageLink | null>(null);
  readonly next = input<PageLink | null>(null);
  private readonly localeService = inject(LocaleService);

  getLink(link: PageLink): string[] {
    return ['/', this.localeService.currentLocale(), link.section, link.slug];
  }
}
