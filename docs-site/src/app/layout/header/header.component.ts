import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { LocaleService } from '../../core/services/locale.service';
import { ThemeService } from '../../core/services/theme.service';
import { NavigationService } from '../../core/services/navigation.service';
import { Locale } from '../../core/models/locale.model';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  readonly localeService = inject(LocaleService);
  readonly themeService = inject(ThemeService);
  readonly navService = inject(NavigationService);
  private readonly router = inject(Router);

  readonly serverCategories = [
    { section: '06-server-produttivita', firstPage: '01-code-review', labelIt: 'Produttivita', labelEn: 'Productivity', sectionEn: '06-productivity-servers' },
    { section: '07-server-devops', firstPage: '01-docker-compose', labelIt: 'DevOps', labelEn: 'DevOps', sectionEn: '07-devops-servers' },
    { section: '08-server-database', firstPage: '01-db-schema-explorer', labelIt: 'Database', labelEn: 'Database', sectionEn: '08-database-servers' },
    { section: '09-server-documentazione', firstPage: '01-api-documentation', labelIt: 'Documentazione', labelEn: 'Documentation', sectionEn: '09-documentation-servers' },
    { section: '10-server-testing', firstPage: '01-test-generator', labelIt: 'Testing', labelEn: 'Testing', sectionEn: '10-testing-servers' },
    { section: '11-server-utility', firstPage: '01-regex-builder', labelIt: 'Utility', labelEn: 'Utility', sectionEn: '11-utility-servers' },
    { section: '12-server-project-management', firstPage: '01-scrum-board', labelIt: 'Project Management', labelEn: 'Project Management', sectionEn: '12-project-management-servers' },
    { section: '13-server-comunicazione', firstPage: '01-standup-notes', labelIt: 'Comunicazione', labelEn: 'Communication', sectionEn: '13-communication-servers' },
  ];

  getSectionForLocale(cat: typeof this.serverCategories[0]): string {
    return this.locale === 'en' ? cat.sectionEn : cat.section;
  }

  get locale(): Locale {
    return this.localeService.currentLocale();
  }

  switchLocale(): void {
    const newLocale: Locale = this.locale === 'it' ? 'en' : 'it';
    const currentUrl = this.router.url;
    const newUrl = currentUrl.replace(/^\/(it|en)/, `/${newLocale}`);
    this.localeService.setLocale(newLocale);
    this.router.navigateByUrl(newUrl);
  }
}
