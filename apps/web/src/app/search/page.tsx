import { redirect } from 'next/navigation';

/** The header search form posts here; results live on the products page. */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim();
  redirect(query ? `/products?q=${encodeURIComponent(query)}` : '/products');
}
