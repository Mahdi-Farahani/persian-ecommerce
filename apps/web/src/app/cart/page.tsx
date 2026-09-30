import type { Metadata } from 'next';
import { CartPage } from '@/components/cart/cart-page';
import { Container } from '@/components/layout/container';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { t } from '@/i18n';
import { getCart } from '@/lib/cart/server';

export const metadata: Metadata = { title: t.cart.title, robots: { index: false } };

export default async function CartRoute() {
  const cart = await getCart();
  return (
    <Container className="py-6">
      <div className="mb-4">
        <Breadcrumbs items={[{ label: t.cart.title }]} />
      </div>
      <h1 className="mb-4 text-xl font-bold">{t.cart.title}</h1>
      <CartPage initialCart={cart} />
    </Container>
  );
}
