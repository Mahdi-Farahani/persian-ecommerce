import { describe, expect, it } from 'vitest';
import {
  hasActiveFilters,
  listingPageHref,
  normalizeSearchQuery,
  parseListFilters,
  searchHref,
} from './listing';

describe('parseListFilters', () => {
  it('defaults to newest without a query and relevance with one', () => {
    expect(parseListFilters({}).sort).toBe('newest');
    expect(parseListFilters({ q: 'گوشی' }).sort).toBe('relevance');
    expect(parseListFilters({ q: 'گوشی', sort: 'price_asc' }).sort).toBe('price_asc');
    expect(parseListFilters({ q: 'گوشی', sort: 'bogus' }).sort).toBe('relevance');
    expect(parseListFilters({}, { defaultSort: 'relevance' }).sort).toBe('relevance');
  });

  it('normalises the query and reads attribute filters', () => {
    const filters = parseListFilters({
      q: ['  لپ‌تاپ  ', 'ignored'],
      'attr[color]': ['black', 'white'],
      brand: 'apple',
      inStock: 'true',
      minPrice: '1000',
      page: '3',
    });
    expect(filters).toMatchObject({
      q: 'لپ‌تاپ',
      attr: { color: 'black,white' },
      brand: 'apple',
      inStock: true,
      minPrice: 1000,
      maxPrice: undefined,
      page: 3,
      limit: 24,
    });
  });

  it('truncates over-long queries and treats blanks as absent', () => {
    expect(normalizeSearchQuery('   ')).toBeUndefined();
    expect(normalizeSearchQuery('a'.repeat(150))).toHaveLength(100);
    expect(parseListFilters({ q: '   ' }).q).toBeUndefined();
  });
});

describe('listingPageHref', () => {
  it('keeps the query and filters under the search base path', () => {
    const hrefFor = listingPageHref('/search', {
      q: 'گوشی',
      brand: 'apple',
      sort: 'relevance',
      page: '2',
    });
    const url = new URL(hrefFor(3), 'http://localhost');
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('q')).toBe('گوشی');
    expect(url.searchParams.get('brand')).toBe('apple');
    expect(url.searchParams.get('sort')).toBe('relevance');
    expect(url.searchParams.get('page')).toBe('3');
    expect(new URL(hrefFor(1), 'http://localhost').searchParams.has('page')).toBe(false);
  });

  it('returns the bare path when nothing is set', () => {
    expect(listingPageHref('/products', {})(1)).toBe('/products');
  });
});

describe('searchHref / hasActiveFilters', () => {
  it('encodes the query', () => {
    expect(searchHref(' گوشی ')).toBe(`/search?q=${encodeURIComponent('گوشی')}`);
    expect(searchHref('')).toBe('/search');
  });

  it('ignores query, sort and page when detecting filters', () => {
    expect(hasActiveFilters({ q: 'x', sort: 'newest', page: '2' })).toBe(false);
    expect(hasActiveFilters({ q: 'x', inStock: 'true' })).toBe(true);
  });
});
