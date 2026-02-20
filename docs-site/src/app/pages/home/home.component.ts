import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LocaleService } from '../../core/services/locale.service';
import { StatsBannerComponent } from '../../shared/components/stats-banner/stats-banner.component';

interface ServerCategory {
  icon: string;
  titleIt: string;
  titleEn: string;
  descIt: string;
  descEn: string;
  sectionIt: string;
  sectionEn: string;
  firstPage: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, MatCardModule, MatButtonModule, MatIconModule, StatsBannerComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  readonly locale = inject(LocaleService).currentLocale;

  readonly categories: ServerCategory[] = [
    { icon: 'code', titleIt: 'Produttivita e Codice', titleEn: 'Productivity & Code', descIt: 'Code review, gestione dipendenze, scaffolding progetti', descEn: 'Code review, dependency management, project scaffolding', sectionIt: '06-server-produttivita', sectionEn: '06-productivity-servers', firstPage: '01-code-review' },
    { icon: 'cloud', titleIt: 'DevOps e Infrastruttura', titleEn: 'DevOps & Infrastructure', descIt: 'Docker Compose, analisi log, monitoraggio CI/CD', descEn: 'Docker Compose, log analysis, CI/CD monitoring', sectionIt: '07-server-devops', sectionEn: '07-devops-servers', firstPage: '01-docker-compose' },
    { icon: 'storage', titleIt: 'Database e Dati', titleEn: 'Database & Data', descIt: 'Esplorazione schema, generazione dati mock', descEn: 'Schema exploration, mock data generation', sectionIt: '08-server-database', sectionEn: '08-database-servers', firstPage: '01-db-schema-explorer' },
    { icon: 'description', titleIt: 'Documentazione', titleEn: 'Documentation', descIt: 'API documentation, analisi codebase, OpenAPI 3.0', descEn: 'API documentation, codebase analysis, OpenAPI 3.0', sectionIt: '09-server-documentazione', sectionEn: '09-documentation-servers', firstPage: '01-api-documentation' },
    { icon: 'science', titleIt: 'Testing e Qualita', titleEn: 'Testing & Quality', descIt: 'Generazione test, profiling performance, benchmark', descEn: 'Test generation, performance profiling, benchmarks', sectionIt: '10-server-testing', sectionEn: '10-testing-servers', firstPage: '01-test-generator' },
    { icon: 'build', titleIt: 'Utility', titleEn: 'Utility', descIt: 'Regex builder, HTTP client, snippet manager', descEn: 'Regex builder, HTTP client, snippet manager', sectionIt: '11-server-utility', sectionEn: '11-utility-servers', firstPage: '01-regex-builder' },
    { icon: 'dashboard', titleIt: 'Project Management', titleEn: 'Project Management', descIt: 'Scrum board, metriche agile, time tracking, economics, retrospettive', descEn: 'Scrum board, agile metrics, time tracking, economics, retrospectives', sectionIt: '12-server-project-management', sectionEn: '12-project-management-servers', firstPage: '01-scrum-board' },
    { icon: 'forum', titleIt: 'Comunicazione', titleEn: 'Communication', descIt: 'Standup giornalieri, gestione ambienti .env', descEn: 'Daily standups, .env environment management', sectionIt: '13-server-comunicazione', sectionEn: '13-communication-servers', firstPage: '01-standup-notes' },
    { icon: 'sync_alt', titleIt: 'Collaborazione Inter-Server', titleEn: 'Inter-Server Collaboration', descIt: 'EventBus tipizzato, 42 eventi, comunicazione automatica', descEn: 'Typed EventBus, 42 events, automatic communication', sectionIt: '14-collaborazione-inter-server', sectionEn: '14-inter-server-collaboration', firstPage: '01-event-bus' },
    { icon: 'school', titleIt: 'Tutorial Completo', titleEn: 'Complete Tutorial', descIt: 'Guida in 10 capitoli: dal protocollo alla produzione', descEn: '10-chapter guide: from protocol to production', sectionIt: '16-guida-creazione-server-client', sectionEn: '16-server-client-creation-guide', firstPage: '01-fondamenti-protocollo' },
  ];

  getSection(cat: ServerCategory): string {
    return this.locale() === 'en' ? cat.sectionEn : cat.sectionIt;
  }
}
