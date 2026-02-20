import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FooterComponent } from '../footer/footer.component';
import { LocaleService } from '../../core/services/locale.service';
import { NavigationService } from '../../core/services/navigation.service';
import { isValidLocale } from '../../core/models/locale.model';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, MatSidenavModule, HeaderComponent, SidebarComponent, FooterComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly localeService = inject(LocaleService);
  readonly navService = inject(NavigationService);
  private readonly platformId = inject(PLATFORM_ID);

  sidenavMode: 'side' | 'over' = 'side';

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const locale = params.get('locale');
      if (locale && isValidLocale(locale)) {
        this.localeService.setLocale(locale);
      }
    });

    if (isPlatformBrowser(this.platformId)) {
      this.updateSidenavMode();
      window.addEventListener('resize', () => this.updateSidenavMode());
    }
  }

  private updateSidenavMode(): void {
    const isMobile = window.innerWidth < 960;
    this.sidenavMode = isMobile ? 'over' : 'side';
    if (isMobile) {
      this.navService.sidebarOpen.set(false);
    }
  }
}
