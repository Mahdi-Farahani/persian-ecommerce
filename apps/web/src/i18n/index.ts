import { fa, type Messages } from './fa';

export const DEFAULT_LOCALE = 'fa' as const;
export type Locale = typeof DEFAULT_LOCALE;

const catalogues: Record<Locale, Messages> = { fa };

/** Returns the message catalogue for the active locale (Persian only for now). */
export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return catalogues[locale];
}

export const t = getMessages();
export type { Messages };
