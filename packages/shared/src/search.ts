import type { ProductCard } from './catalog.js';

/** Autocomplete payload for the header search box. */
export interface SearchSuggestions {
  query: string;
  products: Array<
    Pick<ProductCard, 'id' | 'title' | 'slug' | 'image' | 'price' | 'compareAtPrice' | 'inStock'>
  >;
  categories: Array<{ id: string; name: string; slug: string }>;
  brands: Array<{ id: string; name: string; slug: string }>;
}

export const SEARCH_SUGGEST_MIN_LENGTH = 2;
export const SEARCH_SUGGEST_LIMIT = 6;
