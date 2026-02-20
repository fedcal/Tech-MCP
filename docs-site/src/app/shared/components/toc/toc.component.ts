import { Component, input, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TocHeading } from '../../../core/models/doc-page.model';

@Component({
  selector: 'app-toc',
  standalone: true,
  templateUrl: './toc.component.html',
  styleUrl: './toc.component.scss',
})
export class TocComponent {
  readonly headings = input.required<TocHeading[]>();
  private readonly platformId = inject(PLATFORM_ID);

  scrollTo(event: Event, id: string): void {
    if (isPlatformBrowser(this.platformId)) {
      event.preventDefault();
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
