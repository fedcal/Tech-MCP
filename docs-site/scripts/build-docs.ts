/**
 * build-docs.ts
 *
 * Build-time script that transforms markdown documentation files into
 * Angular standalone components with pre-rendered HTML, lazy-loaded routes,
 * navigation manifests, and a prerender route list.
 *
 * AUTO-GENERATED output — do NOT manually edit files under pages/docs/.
 *
 * Usage:  tsx scripts/build-docs.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT_DIR = path.resolve(__dirname, '..');
const DOCS_DIR = path.resolve(ROOT_DIR, '..', 'docs');
const OUTPUT_DIR = path.resolve(ROOT_DIR, 'src', 'app', 'pages', 'docs');
const ROUTES_FILE = path.resolve(OUTPUT_DIR, 'docs.routes.ts');
const ROUTES_TXT = path.resolve(ROOT_DIR, 'routes.txt');
const MANIFESTS_DIR = path.resolve(ROOT_DIR, 'public', 'assets', 'manifests');

const LOCALES = ['it', 'en'] as const;
type Locale = (typeof LOCALES)[number];

// ---------------------------------------------------------------------------
// Section title mappings (hardcoded per locale)
// ---------------------------------------------------------------------------

const SECTION_TITLES: Record<string, Record<string, string>> = {
  it: {
    '01-introduzione-mcp': 'Introduzione a MCP',
    '02-architettura': 'Architettura',
    '03-installazione': 'Installazione',
    '04-configurazione': 'Configurazione',
    '05-pacchetti-condivisi': 'Pacchetti Condivisi',
    '06-server-produttivita': 'Server Produttivita',
    '07-server-devops': 'Server DevOps',
    '08-server-database': 'Server Database',
    '09-server-documentazione': 'Server Documentazione',
    '10-server-testing': 'Server Testing',
    '11-server-utility': 'Server Utility',
    '12-server-project-management': 'Server Project Management',
    '13-server-comunicazione': 'Server Comunicazione',
    '14-collaborazione-inter-server': 'Collaborazione Inter-Server',
    '15-sviluppi-futuri': 'Sviluppi Futuri',
    '16-guida-creazione-server-client': 'Guida Creazione Server/Client',
  },
  en: {
    '01-introduction-to-mcp': 'Introduction to MCP',
    '02-architecture': 'Architecture',
    '03-installation': 'Installation',
    '04-configuration': 'Configuration',
    '05-shared-packages': 'Shared Packages',
    '06-productivity-servers': 'Productivity Servers',
    '07-devops-servers': 'DevOps Servers',
    '08-database-servers': 'Database Servers',
    '09-documentation-servers': 'Documentation Servers',
    '10-testing-servers': 'Testing Servers',
    '11-utility-servers': 'Utility Servers',
    '12-project-management-servers': 'Project Management Servers',
    '13-communication-servers': 'Communication Servers',
    '14-inter-server-collaboration': 'Inter-Server Collaboration',
    '15-future-developments': 'Future Developments',
    '16-server-client-creation-guide': 'Server/Client Creation Guide',
  },
};

// ---------------------------------------------------------------------------
// Marked instance with highlight.js
// ---------------------------------------------------------------------------

const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  }),
);

// ---------------------------------------------------------------------------
// Escape HTML for embedding inside a TypeScript template literal
// ---------------------------------------------------------------------------

function escapeTsTemplateLiteral(html: string): string {
  return html
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

// ---------------------------------------------------------------------------
// Slugify helper — produces URL-safe IDs from heading text
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ---------------------------------------------------------------------------
// Strip numeric prefix from filename  "01-cos-e-mcp" -> "cos-e-mcp"
// ---------------------------------------------------------------------------

function stripPrefix(name: string): string {
  return name.replace(/^\d+-/, '');
}

// ---------------------------------------------------------------------------
// PascalCase from slug  "cos-e-mcp" -> "CosEMcp"
// ---------------------------------------------------------------------------

function toPascalCase(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

// ---------------------------------------------------------------------------
// Escape single quotes for TypeScript string literals
// ---------------------------------------------------------------------------

function escapeTs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

interface PageInfo {
  locale: Locale;
  section: string;
  filename: string; // e.g. "01-cos-e-mcp" (no .md)
  slug: string; // e.g. "cos-e-mcp" (prefix stripped)
  title: string; // from first # heading
  mdPath: string; // absolute path to .md
}

interface RenderedPage extends PageInfo {
  html: string;
  headings: TocHeading[];
  prevPage: PageInfo | null;
  nextPage: PageInfo | null;
}

// ---------------------------------------------------------------------------
// Custom renderer to collect headings & wrap tables
// ---------------------------------------------------------------------------

function renderMarkdown(mdContent: string): { html: string; headings: TocHeading[] } {
  const headings: TocHeading[] = [];

  const renderer = {
    heading({ text, depth }: { text: string; depth: number; raw: string }): string {
      const cleanText = text.replace(/<[^>]+>/g, '');
      const id = slugify(cleanText);
      if (depth === 2 || depth === 3) {
        headings.push({ id, text: cleanText, level: depth as 2 | 3 });
      }
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
    table({ header, body }: { header: string; body: string }): string {
      return (
        '<div class="table-responsive">\n<table>\n<thead>\n' +
        header +
        '</thead>\n<tbody>\n' +
        body +
        '</tbody>\n</table>\n</div>\n'
      );
    },
  };

  marked.use({ renderer });

  const html = marked.parse(mdContent) as string;
  return { html, headings };
}

// ---------------------------------------------------------------------------
// Extract title from markdown (first # heading)
// ---------------------------------------------------------------------------

function extractTitle(mdContent: string): string {
  const match = mdContent.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

// ---------------------------------------------------------------------------
// Scan a locale directory and return ordered PageInfo[]
// ---------------------------------------------------------------------------

function scanLocale(locale: Locale): PageInfo[] {
  const localeDir = path.join(DOCS_DIR, locale);
  if (!fs.existsSync(localeDir)) return [];

  const sections = fs
    .readdirSync(localeDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const pages: PageInfo[] = [];

  for (const section of sections) {
    const sectionDir = path.join(localeDir, section);
    const files = fs
      .readdirSync(sectionDir)
      .filter((f) => f.endsWith('.md'))
      .sort();

    for (const file of files) {
      const filename = file.replace(/\.md$/, '');
      const mdPath = path.join(sectionDir, file);
      const mdContent = fs.readFileSync(mdPath, 'utf-8');
      const title = extractTitle(mdContent);

      pages.push({
        locale,
        section,
        filename,
        slug: stripPrefix(filename),
        title,
        mdPath,
      });
    }
  }

  return pages;
}

// ---------------------------------------------------------------------------
// Render all pages for a locale
// ---------------------------------------------------------------------------

function renderLocale(pages: PageInfo[]): RenderedPage[] {
  return pages.map((page, idx) => {
    const mdContent = fs.readFileSync(page.mdPath, 'utf-8');
    const { html, headings } = renderMarkdown(mdContent);
    return {
      ...page,
      html,
      headings,
      prevPage: idx > 0 ? pages[idx - 1] : null,
      nextPage: idx < pages.length - 1 ? pages[idx + 1] : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Generate component .ts content
// ---------------------------------------------------------------------------

function generateComponentTs(page: RenderedPage): string {
  const className = `${toPascalCase(page.slug)}Component`;
  const selector = `app-doc-${page.locale}-${page.slug}`;

  const headingsLiteral = page.headings
    .map((h) => `    { id: '${escapeTs(h.id)}', text: '${escapeTs(h.text)}', level: ${h.level} }`)
    .join(',\n');

  const prevLiteral =
    page.prevPage === null
      ? 'null'
      : `{\n    slug: '${escapeTs(page.prevPage.filename)}',\n    section: '${escapeTs(page.prevPage.section)}',\n    title: '${escapeTs(page.prevPage.title)}',\n  }`;

  const nextLiteral =
    page.nextPage === null
      ? 'null'
      : `{\n    slug: '${escapeTs(page.nextPage.filename)}',\n    section: '${escapeTs(page.nextPage.section)}',\n    title: '${escapeTs(page.nextPage.title)}',\n  }`;

  const htmlLiteral = escapeTsTemplateLiteral(page.html.trim());

  return `// AUTO-GENERATED by build-docs.ts - DO NOT EDIT
import { Component } from '@angular/core';
import { DocLayoutComponent } from '../../../../layout/doc-layout/doc-layout.component';
import { TocHeading, PageLink } from '../../../../core/models/doc-page.model';

@Component({
  selector: '${selector}',
  standalone: true,
  imports: [DocLayoutComponent],
  templateUrl: './${page.slug}.component.html',
})
export class ${className} {
  readonly title = '${escapeTs(page.title)}';
  readonly html = \`${htmlLiteral}\`;
  readonly headings: TocHeading[] = [
${headingsLiteral}
  ];
  readonly prev: PageLink | null = ${prevLiteral};
  readonly next: PageLink | null = ${nextLiteral};
}
`;
}

// ---------------------------------------------------------------------------
// Generate component .html content
// ---------------------------------------------------------------------------

function generateComponentHtml(_page: RenderedPage): string {
  return `<!-- AUTO-GENERATED by build-docs.ts - DO NOT EDIT -->
<app-doc-layout [title]="title" [headings]="headings" [prev]="prev" [next]="next">
  <div class="doc-content" [innerHTML]="html"></div>
</app-doc-layout>
`;
}

// ---------------------------------------------------------------------------
// Generate docs.routes.ts
// ---------------------------------------------------------------------------

function generateRoutesTs(allPages: RenderedPage[]): string {
  const imports = allPages
    .map((p) => {
      const className = `${toPascalCase(p.slug)}Component`;
      const importPath = `./${p.locale}/${p.section}/${p.slug}.component`;
      const routePath = `${p.section}/${p.filename}`;
      return `  {
    path: '${routePath}',
    loadComponent: () => import('${importPath}').then(m => m.${className}),
    data: { locale: '${p.locale}', section: '${p.section}', page: '${p.filename}' },
  }`;
    })
    .join(',\n');

  return `// AUTO-GENERATED by build-docs.ts - DO NOT EDIT
import { Routes } from '@angular/router';

export const docsRoutes: Routes = [
${imports},
];
`;
}

// ---------------------------------------------------------------------------
// Generate manifest.json for a locale
// ---------------------------------------------------------------------------

interface ManifestPage {
  slug: string;
  title: string;
}

interface ManifestSection {
  slug: string;
  title: string;
  pages: ManifestPage[];
}

interface Manifest {
  locale: string;
  sections: ManifestSection[];
}

function generateManifest(locale: Locale, pages: PageInfo[]): Manifest {
  const sectionMap = new Map<string, ManifestPage[]>();

  for (const page of pages) {
    if (!sectionMap.has(page.section)) {
      sectionMap.set(page.section, []);
    }
    sectionMap.get(page.section)!.push({
      slug: page.filename,
      title: page.title,
    });
  }

  const sections: ManifestSection[] = [];
  const titles = SECTION_TITLES[locale] || {};

  for (const [sectionSlug, sectionPages] of sectionMap) {
    sections.push({
      slug: sectionSlug,
      title: titles[sectionSlug] || sectionSlug,
      pages: sectionPages,
    });
  }

  return { locale, sections };
}

// ---------------------------------------------------------------------------
// Generate routes.txt for Angular prerenderer
// ---------------------------------------------------------------------------

function generateRoutesTxt(allPages: RenderedPage[]): string {
  const staticRoutes = ['/it', '/en'];
  const pageRoutes = allPages.map(
    (p) => `/${p.locale}/${p.section}/${p.filename}`,
  );
  return [...staticRoutes, ...pageRoutes].join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Ensure directory exists
// ---------------------------------------------------------------------------

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Clean previously generated output
// ---------------------------------------------------------------------------

function cleanOutput(): void {
  for (const locale of LOCALES) {
    const localeOutput = path.join(OUTPUT_DIR, locale);
    if (fs.existsSync(localeOutput)) {
      fs.rmSync(localeOutput, { recursive: true, force: true });
    }
  }
  // Remove previously generated routes file
  if (fs.existsSync(ROUTES_FILE)) {
    fs.unlinkSync(ROUTES_FILE);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const startTime = Date.now();
  console.log('[build-docs] Starting documentation build...');

  // Clean previous output
  cleanOutput();
  ensureDir(OUTPUT_DIR);

  const allRendered: RenderedPage[] = [];
  let totalFiles = 0;

  for (const locale of LOCALES) {
    console.log(`[build-docs] Scanning ${locale}...`);
    const pages = scanLocale(locale);

    if (pages.length === 0) {
      console.log(`[build-docs]   No pages found for locale "${locale}", skipping.`);
      continue;
    }

    console.log(`[build-docs]   Found ${pages.length} pages in ${locale}.`);

    // Render all pages (two-pass: scan then render with prev/next)
    const rendered = renderLocale(pages);
    allRendered.push(...rendered);

    // Write component files
    for (const page of rendered) {
      const outDir = path.join(OUTPUT_DIR, page.locale, page.section);
      ensureDir(outDir);

      const tsPath = path.join(outDir, `${page.slug}.component.ts`);
      const htmlPath = path.join(outDir, `${page.slug}.component.html`);

      fs.writeFileSync(tsPath, generateComponentTs(page), 'utf-8');
      fs.writeFileSync(htmlPath, generateComponentHtml(page), 'utf-8');
      totalFiles += 2;
    }

    // Write manifest.json (in both pages/docs for reference and public/assets for runtime)
    const manifest = generateManifest(locale, pages);
    const manifestPath = path.join(OUTPUT_DIR, locale, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
    const publicManifestDir = path.join(MANIFESTS_DIR, locale);
    ensureDir(publicManifestDir);
    fs.writeFileSync(path.join(publicManifestDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
    totalFiles += 2;

    console.log(`[build-docs]   Generated ${rendered.length} components for ${locale}.`);
  }

  // Write docs.routes.ts
  fs.writeFileSync(ROUTES_FILE, generateRoutesTs(allRendered), 'utf-8');
  totalFiles += 1;
  console.log(`[build-docs] Generated docs.routes.ts with ${allRendered.length} routes.`);

  // Write routes.txt
  fs.writeFileSync(ROUTES_TXT, generateRoutesTxt(allRendered), 'utf-8');
  totalFiles += 1;
  console.log(`[build-docs] Generated routes.txt.`);

  const elapsed = Date.now() - startTime;
  console.log(
    `[build-docs] Done. ${totalFiles} files written for ${allRendered.length} pages in ${elapsed}ms.`,
  );
}

main();
