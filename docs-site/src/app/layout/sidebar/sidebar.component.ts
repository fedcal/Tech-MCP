import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { NavigationService } from '../../core/services/navigation.service';
import { LocaleService } from '../../core/services/locale.service';
import { NavigationManifest, Section } from '../../core/models/nav-manifest.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, MatListModule, MatIconModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent implements OnInit, OnDestroy {
  readonly navService = inject(NavigationService);
  readonly localeService = inject(LocaleService);

  manifest: NavigationManifest | null = null;
  private sub?: Subscription;

  ngOnInit(): void {
    this.loadManifest();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private loadManifest(): void {
    this.sub?.unsubscribe();
    this.sub = this.navService.getManifest(this.localeService.currentLocale()).subscribe(m => {
      this.manifest = m;
    });
  }

  isSectionExpanded(slug: string): boolean {
    return this.navService.expandedSections().has(slug);
  }

  isCurrentPage(section: string, page: string): boolean {
    return this.navService.currentSection() === section && this.navService.currentPage() === page;
  }
}
