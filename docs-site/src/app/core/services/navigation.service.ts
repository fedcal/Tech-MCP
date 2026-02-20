import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { NavigationManifest } from '../models/nav-manifest.model';
import { Locale } from '../models/locale.model';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly http = inject(HttpClient);
  private manifestCache = new Map<Locale, Observable<NavigationManifest>>();

  readonly sidebarOpen = signal(true);
  readonly expandedSections = signal<Set<string>>(new Set());
  readonly currentSection = signal<string>('');
  readonly currentPage = signal<string>('');

  getManifest(locale: Locale): Observable<NavigationManifest> {
    if (!this.manifestCache.has(locale)) {
      const url = `assets/manifests/${locale}/manifest.json`;
      this.manifestCache.set(
        locale,
        this.http.get<NavigationManifest>(url).pipe(shareReplay(1))
      );
    }
    return this.manifestCache.get(locale)!;
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  toggleSection(slug: string): void {
    this.expandedSections.update(set => {
      const next = new Set(set);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  expandSection(slug: string): void {
    this.expandedSections.update(set => new Set(set).add(slug));
  }

  setCurrentPage(section: string, page: string): void {
    this.currentSection.set(section);
    this.currentPage.set(page);
    this.expandSection(section);
  }
}
