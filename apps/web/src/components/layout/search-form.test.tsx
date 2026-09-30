import { formatToman, type SearchSuggestions } from '@pe/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { SearchForm } from './search-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
}));

const get = vi.fn();
vi.mock('@/lib/api/client', () => ({
  browserApi: {
    get: (...args: unknown[]) => get(...args),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const suggestions: SearchSuggestions = {
  query: 'گوشی',
  products: [
    {
      id: 'p1',
      title: 'گوشی سامسونگ',
      slug: 'samsung-phone',
      image: null,
      price: 125_000_000,
      compareAtPrice: null,
      inStock: true,
    },
    {
      id: 'p2',
      title: 'گوشی شیائومی',
      slug: 'xiaomi-phone',
      image: null,
      price: 90_000_000,
      compareAtPrice: null,
      inStock: false,
    },
  ],
  categories: [{ id: 'c1', name: 'گوشی موبایل', slug: 'mobile' }],
  brands: [],
};

describe('SearchForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue(suggestions);
  });

  it('submits to the search page without JavaScript', () => {
    render(<SearchForm />);
    const form = screen.getByRole('search');
    expect(form).toHaveAttribute('action', '/search');
    expect(form).toHaveAttribute('method', 'get');
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('name', 'q');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
  });

  it('fetches suggestions after a debounce and renders them', async () => {
    const user = userEvent.setup();
    render(<SearchForm />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'گ');
    expect(get).not.toHaveBeenCalled();
    await user.type(input, 'وشی');

    const options = await screen.findAllByRole('option');
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]?.[0]).toBe('/search/suggest');
    expect(get.mock.calls[0]?.[1]).toMatchObject({ query: { q: 'گوشی' } });
    // Two products, one category, plus the "view all" row.
    expect(options).toHaveLength(4);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(formatToman(125_000_000))).toBeInTheDocument();
    expect(screen.getByText(t.catalog.outOfStock)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'گوشی موبایل' })).toHaveAttribute(
      'href',
      '/categories/mobile',
    );
    expect(screen.getByRole('link', { name: t.search.viewAll('گوشی') })).toHaveAttribute(
      'href',
      `/search?q=${encodeURIComponent('گوشی')}`,
    );
  });

  it('navigates with arrow keys and Enter, closes on Escape', async () => {
    const user = userEvent.setup();
    render(<SearchForm />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'گوشی');
    await screen.findAllByRole('option');

    await user.keyboard('{ArrowDown}{ArrowDown}');
    const active = screen.getAllByRole('option')[1];
    expect(active).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', active?.id);

    await user.keyboard('{Enter}');
    expect(push).toHaveBeenCalledWith('/products/xiaomi-phone');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('submits the query to the search page on Enter without a selection', async () => {
    const user = userEvent.setup();
    render(<SearchForm />);
    await user.type(screen.getByRole('combobox'), 'کفش{Enter}');
    expect(push).toHaveBeenCalledWith(`/search?q=${encodeURIComponent('کفش')}`);
  });
});
