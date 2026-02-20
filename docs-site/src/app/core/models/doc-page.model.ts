export interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface PageLink {
  slug: string;
  section: string;
  title: string;
}
