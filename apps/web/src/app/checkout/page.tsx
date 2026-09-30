import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CheckoutFlow } from '@/components/checkout/checkout-flow';
import { Container } from '@/components/layout/container';
import { t } from '@/i18n';
import { serverApi } from '@/lib/api/server';
import { requireUser } from '@/lib/auth/server';
import { getCart } from '@/lib/cart/server';
import type { Address } from '@/lib/types/address';

export const metadata: Metadata = { title: t.checkout.title, robots: { index: false } };

export default async function CheckoutRoute() {
  await requireUser('/checkout');
  const [cart, addresses] = await Promise.all([
    getCart(),
    serverApi<Address[]>('/users/me/addresses', { cache: 'no-store' }),
  ]);
  if (!cart || cart.items.length === 0) redirect('/cart');
  return (
    <Container className="py-6">
      <h1 className="mb-4 text-xl font-bold">{t.checkout.title}</h1>
      <CheckoutFlow initialCart={cart} initialAddresses={addresses} />
    </Container>
  );
}
