export interface NavigationManifest {
  locale: string;
  sections: Section[];
}

export interface Section {
  slug: string;
  title: string;
  pages: PageRef[];
}

export interface PageRef {
  slug: string;
  title: string;
}
