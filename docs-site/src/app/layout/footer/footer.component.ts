import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  template: `
    <footer class="site-footer">
      <div class="footer-content">
        <span>Released under <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener">AGPL-3.0</a> License</span>
        <span class="separator">|</span>
        <span>Copyright &copy; 2024-{{ currentYear }} <a href="https://www.federicocalo.dev" target="_blank" rel="noopener">Federico Calo</a></span>
      </div>
    </footer>
  `,
  styles: [`
    .site-footer {
      padding: 1.5rem 2rem;
      border-top: 1px solid var(--border-color, #e1e4e8);
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-secondary, #6a737d);
    }
    .footer-content {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .separator { color: var(--border-color, #e1e4e8); }
    a { color: var(--primary-color, #3f51b5); text-decoration: none; }
    a:hover { text-decoration: underline; }
  `],
})
export class FooterComponent {
  readonly currentYear = new Date().getFullYear();
}
