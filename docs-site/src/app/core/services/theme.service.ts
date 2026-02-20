import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly STORAGE_KEY = 'mcp-docs-theme';

  readonly isDark = signal(false);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored !== null) {
        this.isDark.set(stored === 'dark');
      } else {
        this.isDark.set(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    }

    effect(() => {
      const dark = this.isDark();
      this.document.body.classList.toggle('dark-theme', dark);
      this.document.body.classList.toggle('light-theme', !dark);
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem(this.STORAGE_KEY, dark ? 'dark' : 'light');
      }
    });
  }

  toggle(): void {
    this.isDark.update(v => !v);
  }
}
