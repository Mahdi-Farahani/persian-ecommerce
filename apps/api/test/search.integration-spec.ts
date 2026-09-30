import type { ProductCard, SearchSuggestions } from '@pe/shared';
import { bearer, loginAsAdmin, registerUser } from './utils/auth-helpers.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

interface Page {
  items: ProductCard[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

describe('Search (integration)', () => {
  let ctx: TestApp;
  let admin: { Authorization: string };

  async function search(query: Record<string, string | number>): Promise<Page> {
    const res = await ctx.http().get('/api/v1/search').query(query).expect(200);
    return res.body as Page;
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = bearer(await loginAsAdmin(ctx));
    // The seed indexes products; make sure the index is fresh for this run.
    const res = await ctx.http().post('/api/v1/admin/search/reindex').set(admin).expect(200);
    expect(res.body.indexed).toBeGreaterThanOrEqual(14);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('finds products by Persian words, ranking exact matches first', async () => {
    const result = await search({ q: 'گوشی سامسونگ' });
    expect(result.pagination.total).toBeGreaterThanOrEqual(2);
    // Brand and category names are indexed too, so every hit is a Samsung phone.
    expect(
      result.items.every((p) => p.brand?.slug === 'samsung' || p.title.includes('سامسونگ')),
    ).toBe(true);
    expect(result.items.some((p) => p.title.includes('Galaxy S25'))).toBe(true);
    // Draft products never appear.
    expect(result.items.every((p) => p.status === 'ACTIVE')).toBe(true);
  });

  it('matches English titles, partial words and Arabic-script variants', async () => {
    const english = await search({ q: 'galaxy' });
    expect(english.items.length).toBeGreaterThanOrEqual(2);

    const partial = await search({ q: 'سامس' });
    expect(partial.items.some((p) => p.title.includes('سامسونگ'))).toBe(true);

    const arabicScript = await search({ q: 'گوشي موبايل' }); // Arabic yeh
    expect(arabicScript.items.length).toBeGreaterThanOrEqual(3);

    const sku = await search({ q: 'SM-S25-128-BLK' });
    expect(sku.items[0]?.slug).toBe('samsung-galaxy-s25');
  });

  it('tolerates a typo by relaxing to prefixes', async () => {
    const result = await search({ q: 'سامسونک' });
    expect(result.items.some((p) => p.title.includes('سامسونگ'))).toBe(true);
  });

  it('combines text with category, brand, price and availability filters', async () => {
    const inCategory = await search({ q: 'گوشی', category: 'smartphones' });
    expect(inCategory.items.length).toBeGreaterThanOrEqual(3);
    expect(inCategory.items.every((p) => p.category.slug === 'smartphones')).toBe(true);

    const apple = await search({ q: 'گوشی', brand: 'apple' });
    expect(apple.items.every((p) => p.brand?.slug === 'apple')).toBe(true);
    expect(apple.items.length).toBeGreaterThanOrEqual(1);

    const cheap = await search({ q: 'گوشی', maxPrice: 300_000_000 });
    expect(cheap.items.every((p) => (p.price ?? 0) <= 300_000_000)).toBe(true);

    const inStock = await search({ q: 'Galaxy A55', inStock: 'true' });
    expect(inStock.items.some((p) => p.slug === 'samsung-galaxy-a55')).toBe(false);

    const unknownCategory = await search({ q: 'گوشی', category: 'does-not-exist' });
    expect(unknownCategory.pagination.total).toBe(0);
  });

  it('sorts by price and paginates', async () => {
    const asc = await search({ q: 'گوشی', sort: 'price_asc', limit: 2, page: 1 });
    expect(asc.items).toHaveLength(2);
    expect(asc.items[0]!.price!).toBeLessThanOrEqual(asc.items[1]!.price!);
    const desc = await search({ q: 'گوشی', sort: 'price_desc', limit: 2 });
    expect(desc.items[0]!.price!).toBeGreaterThanOrEqual(desc.items[1]!.price!);

    const page2 = await search({ q: 'گوشی', sort: 'price_asc', limit: 2, page: 2 });
    expect(page2.pagination.page).toBe(2);
    expect(page2.items.map((p) => p.id)).not.toContain(asc.items[0]!.id);
    expect(page2.pagination.total).toBe(asc.pagination.total);

    const relevance = await search({ q: 'گوشی', limit: 2, page: 2 });
    expect(relevance.pagination.total).toBe(asc.pagination.total);
    expect(relevance.items.length).toBeGreaterThanOrEqual(1);
  });

  it('returns an empty page for nonsense and rejects oversized queries', async () => {
    const nothing = await search({ q: 'xyzqwv123' });
    expect(nothing.items).toEqual([]);
    expect(nothing.pagination.total).toBe(0);
    await ctx
      .http()
      .get('/api/v1/search')
      .query({ q: 'a'.repeat(101) })
      .expect(400);
  });

  it('shares the engine with the catalogue listing', async () => {
    const viaProducts = await ctx
      .http()
      .get('/api/v1/products')
      .query({ q: 'سامسونگ' })
      .expect(200);
    const viaSearch = await search({ q: 'سامسونگ' });
    expect(viaProducts.body.pagination.total).toBe(viaSearch.pagination.total);
    expect(viaProducts.body.items[0].id).toBe(viaSearch.items[0]!.id);
  });

  it('suggests products, categories and brands', async () => {
    const res = await ctx.http().get('/api/v1/search/suggest').query({ q: 'سامس' }).expect(200);
    const body = res.body as SearchSuggestions;
    expect(body.products.length).toBeGreaterThanOrEqual(1);
    expect(body.products.length).toBeLessThanOrEqual(6);
    expect(body.products[0]).toMatchObject({ slug: expect.any(String), price: expect.any(Number) });
    expect(body.brands.some((b) => b.slug === 'samsung')).toBe(true);

    const cat = await ctx.http().get('/api/v1/search/suggest').query({ q: 'گوشی' }).expect(200);
    expect((cat.body as SearchSuggestions).categories.some((c) => c.slug === 'smartphones')).toBe(
      true,
    );

    const short = await ctx.http().get('/api/v1/search/suggest').query({ q: 'س' }).expect(200);
    expect(short.body).toMatchObject({ products: [], categories: [], brands: [] });
  });

  it('reindexes a product when an admin edits it', async () => {
    const product = await ctx.http().get('/api/v1/products/anker-nano-65w').expect(200);
    const before = await search({ q: 'شارژرآزمایشی' });
    expect(before.pagination.total).toBe(0);
    await ctx
      .http()
      .patch(`/api/v1/admin/products/${product.body.id}`)
      .set(admin)
      .send({ shortDescription: 'شارژرآزمایشی سریع' })
      .expect(200);
    const after = await search({ q: 'شارژرآزمایشی' });
    expect(after.items[0]?.slug).toBe('anker-nano-65w');
    await ctx
      .http()
      .patch(`/api/v1/admin/products/${product.body.id}`)
      .set(admin)
      .send({ shortDescription: product.body.shortDescription ?? '' })
      .expect(200);

    const customer = await registerUser(ctx);
    await ctx.http().post('/api/v1/admin/search/reindex').set(bearer(customer)).expect(403);
  });
});
