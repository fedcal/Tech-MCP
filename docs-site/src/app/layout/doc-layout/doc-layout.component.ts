import { Component, input } from '@angular/core';
import { TocComponent } from '../../shared/components/toc/toc.component';
import { PrevNextNavComponent } from '../../shared/components/prev-next-nav/prev-next-nav.component';
import { TocHeading, PageLink } from '../../core/models/doc-page.model';

@Component({
  selector: 'app-doc-layout',
  standalone: true,
  imports: [TocComponent, PrevNextNavComponent],
  templateUrl: './doc-layout.component.html',
  styleUrl: './doc-layout.component.scss',
})
export class DocLayoutComponent {
  readonly title = input.required<string>();
  readonly headings = input.required<TocHeading[]>();
  readonly prev = input<PageLink | null>(null);
  readonly next = input<PageLink | null>(null);
}
