import { describe, expect, it } from 'vitest';
import {
  booleanQuery,
  buildSearchText,
  relaxedQuery,
  shortTokens,
  tokenize,
} from './search-text.js';

describe('search text helpers', () => {
  it('normalises Persian/Arabic variants, digits and operators when tokenizing', () => {
    expect(tokenize('گوشي سامسونگ ٢٥٦ +گیگ')).toEqual(['گوشی', 'سامسونگ', '256', 'گیگ']);
    expect(tokenize('Galaxy-S25, "Ultra"')).toEqual(['galaxy', 's25', 'ultra']);
    expect(tokenize('می‌خواهم')).toEqual(['می', 'خواهم']);
    expect(tokenize('   ')).toEqual([]);
    expect(tokenize('a b c d e f g h i j', 3)).toHaveLength(3);
  });

  it('builds a de-duplicated search text from product context', () => {
    const text = buildSearchText({
      title: 'گوشی سامسونگ Galaxy S25',
      titleEn: 'Samsung Galaxy S25',
      brandName: 'سامسونگ',
      categoryName: 'گوشی موبایل',
      skus: ['SM-S25-128-BLK'],
      attributeValues: ['مشکی', '۱۲۸ گیگابایت'],
      shortDescription: 'پرچمدار جدید سامسونگ',
    });
    expect(text.split(' ')).toEqual([
      'گوشی',
      'سامسونگ',
      'galaxy',
      's25',
      'samsung',
      'موبایل',
      'sm',
      '128',
      'blk',
      'مشکی',
      'گیگابایت',
      'پرچمدار',
      'جدید',
    ]);
  });

  it('produces boolean-mode expressions with prefix matching', () => {
    expect(booleanQuery(['گوشی', 'سامسونگ'])).toBe('+گوشی* +سامسونگ*');
    expect(booleanQuery(['s2'])).toBeNull();
    expect(booleanQuery(['s25', 'a'])).toBe('+s25*');
    expect(shortTokens(['s25', 'a', 'به'])).toEqual(['a', 'به']);
  });

  it('relaxes tokens to prefixes for typo tolerance', () => {
    expect(relaxedQuery(['سامسونک'])).toBe('سامسو*');
    expect(relaxedQuery(['galaxy', 'ultra'])).toBe('gala* ult*');
    expect(relaxedQuery(['ab'])).toBeNull();
  });
});
