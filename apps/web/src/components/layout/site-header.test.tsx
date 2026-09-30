import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { t } from '@/i18n';
import { MobileMenu } from './mobile-menu';
import { SiteHeader } from './site-header';

describe('SiteHeader', () => {
  it('renders brand, navigation and search', () => {
    render(<SiteHeader />);
    expect(screen.getAllByText(t.app.name).length).toBeGreaterThan(0);
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.nav.cart })).toHaveAttribute('href', '/cart');
  });
});

describe('MobileMenu', () => {
  it('opens and closes with keyboard', async () => {
    const user = userEvent.setup();
    render(<MobileMenu items={[{ href: '/products', label: t.nav.products }]} />);
    const toggle = screen.getByRole('button', { name: t.nav.menu });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(screen.getByRole('link', { name: t.nav.products })).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('link', { name: t.nav.products })).not.toBeInTheDocument();
  });
});
