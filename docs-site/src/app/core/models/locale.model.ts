export type Locale = 'it' | 'en';

export function isValidLocale(value: string): value is Locale {
  return value === 'it' || value === 'en';
}

export const DEFAULT_LOCALE: Locale = 'it';
export const SUPPORTED_LOCALES: Locale[] = ['it', 'en'];
