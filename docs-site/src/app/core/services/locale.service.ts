import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Locale, DEFAULT_LOCALE } from '../models/locale.model';

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly STORAGE_KEY = 'mcp-docs-locale';

  readonly currentLocale = signal<Locale>(DEFAULT_LOCALE);

  setLocale(locale: Locale): void {
    this.currentLocale.set(locale);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.STORAGE_KEY, locale);
    }
  }

  getStoredLocale(): Locale | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem(this.STORAGE_KEY) as Locale | null;
    }
    return null;
  }
}
